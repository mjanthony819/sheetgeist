import React, { useState } from 'react';
import { runWorkbookQuery } from '../lib/workbookSql';
import type { QueryResult } from '../lib/sql';
import type { Workbook } from '../lib/workbook';

interface Props { wb: Workbook }

export function QueryStudio({ wb }: Props) {
  const hasMuseum = wb.tables.items && wb.tables.exhibits;
  const first = wb.order[0];
  const [query, setQuery] = useState(hasMuseum
    ? 'SELECT e.title, e.hall, COUNT(i.id) AS objects, SUM(i.quantity) AS units\nFROM exhibits e JOIN items i ON i.location = e.hall\nGROUP BY e.title, e.hall ORDER BY units DESC'
    : `SELECT * FROM "${first}" LIMIT 10`);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => { setLoading(true); setResult(await runWorkbookQuery(wb, query)); setLoading(false); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void handleExecute(); } };

  return <div className="query-studio">
    <div className="query-editor">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label htmlFor="sql-query" className="form-label">SQL Query (SELECT only, joins across tables)</label>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Ctrl/Cmd + Enter to execute</span>
      </div>
      <textarea id="sql-query" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder="SELECT * FROM items WHERE status = 'active'" />
      <button className="btn btn-primary" onClick={() => void handleExecute()} disabled={loading || !query.trim()}>{loading ? 'Executing...' : 'Execute Query'}</button>
    </div>
    {result && <div className="query-result">{result.success ? <>
      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{result.values.length} row{result.values.length !== 1 ? 's' : ''} returned</div>
      <div className="result-table-container"><table className="result-table"><thead><tr>{result.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{result.values.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell === null ? <span style={{ color: 'var(--color-text-muted)' }}>NULL</span> : String(cell)}</td>)}</tr>)}</tbody></table></div>
    </> : <div className="error-box"><strong>Error:</strong> {result.error}</div>}</div>}
    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 'auto' }}>
      {wb.order.map(n => <p key={n}><strong>Table {n}:</strong> id, {wb.tables[n].columns.join(', ')}{wb.tables[n].computed.length ? `; computed: ${wb.tables[n].computed.map(c => c.name).join(', ')}` : ''}</p>)}
      <p><strong>Note:</strong> Only SELECT queries are permitted. Write operations are disabled for safety. Queries run against the working copy, including uncommitted edits.</p>
    </div>
  </div>;
}
