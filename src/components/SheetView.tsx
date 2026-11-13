import { useEffect, useMemo, useState } from 'react';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { CellHistory } from './CellHistory';
import { runWorkbookQuery, summarizeTable, checkComputed } from '../lib/workbookSql';
import { validateWorkbook, cloneWorkbook, type Workbook } from '../lib/workbook';
import type { SheetData } from '../lib/types';

interface Props {
  wb: Workbook; table: string; onChange: (wb: Workbook) => void; readOnly: boolean;
  tip: string; branch: string; saved: Workbook | null;
}
type Summary = Awaited<ReturnType<typeof summarizeTable>>;

const fmt = (n: number | null) => n === null ? '' : Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function SheetView({ wb, table, onChange, readOnly, tip, branch, saved }: Props) {
  const t = wb.tables[table];
  const [values, setValues] = useState<Record<string, Record<string, unknown>>>({});
  const [errors, setErrors] = useState<{ name: string; error: string }[]>([]);
  const [summary, setSummary] = useState<Summary>([]);
  const [sel, setSel] = useState<{ rowId: string; column: string } | null>(null);
  const [name, setName] = useState(''), [expr, setExpr] = useState(''), [formError, setFormError] = useState('');
  const key = useMemo(() => JSON.stringify([t, table]), [t, table]);

  useEffect(() => { setSel(null); }, [table]);
  useEffect(() => {
    let live = true;
    (async () => {
      const single: Workbook = { order: [table], tables: { [table]: t } };
      const errs = (await checkComputed(single)).filter(e => e.table === table).map(e => ({ name: e.name, error: e.error }));
      const bad = new Set(errs.map(e => e.name));
      const names = t.computed.map(c => c.name).filter(n => !bad.has(n));
      const vals: Record<string, Record<string, unknown>> = {};
      if (names.length) {
        const r = await runWorkbookQuery(single, `SELECT id, ${names.map(n => `"${n}"`).join(', ')} FROM "${table}" LIMIT 1000`);
        if (r.success) names.forEach((n, i) => { vals[n] = Object.fromEntries(r.values.map(row => [String(row[0]), row[i + 1]])); });
      }
      const s = await summarizeTable(single, table).catch(() => []);
      if (live) { setValues(vals); setErrors(errs); setSummary(s); }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = (d: SheetData) => { const next = cloneWorkbook(wb); next.tables[table] = { ...t, rows: d.rows, columns: d.columns }; onChange(next); };
  function addComputed() {
    setFormError('');
    const next = cloneWorkbook(wb);
    next.tables[table].computed = [...t.computed, { name: name.trim(), expr: expr.trim() }];
    try { validateWorkbook(next); } catch (e) { setFormError(e instanceof Error ? e.message : String(e)); return; }
    onChange(next); setName(''); setExpr('');
  }
  function removeComputed(n: string) { const next = cloneWorkbook(wb); next.tables[table].computed = t.computed.filter(c => c.name !== n); onChange(next); }
  const savedVal = sel && saved?.tables[table]?.rows.find(r => r.id === sel.rowId)?.[sel.column];
  const curVal = sel && t.rows.find(r => r.id === sel.rowId)?.[sel.column];

  return <div className="sheet-view">
    <SpreadsheetGrid data={t} onChange={update} readOnly={readOnly}
      computed={{ names: t.computed.map(c => c.name).filter(n => values[n]), values }} onSelectCell={(rowId, column) => setSel({ rowId, column })} selected={sel} />
    <section className="table-panel" aria-label="Computed columns and totals">
      <div className="panel-col">
        <h3>Computed columns <small>SQLite expressions, not Excel formulas</small></h3>
        {t.computed.length === 0 && <p className="fine-print">None yet. Example: <code>quantity * unit_value_usd</code></p>}
        {t.computed.map(c => <div className="computed-def" key={c.name}>
          <code>{c.name}</code> = <code>{c.expr}</code>
          {errors.find(e => e.name === c.name) && <span className="computed-error"> error: {errors.find(e => e.name === c.name)!.error}</span>}
          {!readOnly && <button className="btn btn-icon" aria-label={`Remove computed ${c.name}`} onClick={() => removeComputed(c.name)}>×</button>}
        </div>)}
        {!readOnly && <div className="computed-form">
          <input aria-label="Computed column name" placeholder="column_name" value={name} onChange={e => setName(e.target.value)} maxLength={40} />
          <input aria-label="Computed column expression" placeholder="quantity * unit_value_usd" value={expr} onChange={e => setExpr(e.target.value)} maxLength={300} />
          <button className="btn btn-secondary" disabled={!name.trim() || !expr.trim()} onClick={addComputed}>Add computed column</button>
        </div>}
        {formError && <p className="error-box" role="alert">{formError}</p>}
        <p className="fine-print">Evaluated per row by SQLite against this table's own columns. Subqueries and statements are rejected. Values are not stored in Git; the definition is, so branches and merges carry it.</p>
      </div>
      <div className="panel-col">
        <h3>Totals <small>numeric columns, computed by SQLite</small></h3>
        {summary.length === 0 ? <p className="fine-print">No fully numeric columns in this table.</p> :
          <div className="summary-wrap"><table className="summary-table"><thead><tr><th>Column</th><th>Count</th><th>Sum</th><th>Avg</th><th>Min</th><th>Max</th></tr></thead>
            <tbody>{summary.map(s => <tr key={s.column} data-summary={s.column}><td>{s.column}</td><td>{s.count}</td><td>{fmt(s.sum)}</td><td>{fmt(s.avg)}</td><td>{fmt(s.min)}</td><td>{fmt(s.max)}</td></tr>)}</tbody></table></div>}
        <p className="fine-print">Totals reflect the working copy, including uncommitted edits.</p>
      </div>
    </section>
    {sel ? <CellHistory tip={tip} branch={branch} table={table} rowId={sel.rowId} field={sel.column} dirtyValue={savedVal !== curVal} />
      : <p className="fine-print cell-history-hint">Click any cell to see the commits that changed it.</p>}
  </div>;
}
