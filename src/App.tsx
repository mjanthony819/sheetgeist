import { useEffect, useRef, useState } from 'react';
import type { BranchInfo } from './lib/types';
import * as repo from './lib/git';
import * as wbRepo from './lib/gitWorkbook';
import { mergeWorkbooks, resolveWorkbookConflicts, type TableConflict } from './lib/workbookMerge';
import { validateWorkbook, cloneWorkbook, emptyTable, type Workbook } from './lib/workbook';
import { generateMuseumWorkbook } from './lib/dataset';
import { downloadCSV, importCSV } from './lib/csv';
import { importXlsx, exportXlsx, type ImportReport } from './lib/xlsxio';
import { runWorkbookQuery } from './lib/workbookSql';
import { exportGitArchive } from './lib/archive';
import { SheetView } from './components/SheetView';
import { QueryStudio } from './components/QueryStudio';
import { History } from './components/History';
import { Help } from './components/Help';
import './index.css';

type Side = 'ours' | 'theirs';
type Choices = Record<string, Record<string, Record<string, Side>>>;
type MergePlan = { branch: string; base: Workbook; ours: Workbook; theirs: Workbook; conflicts: TableConflict[]; clean: Workbook | null; oursOid: string; theirsOid: string };

const TABLE_NAME = /^[a-z][a-z0-9_]{0,39}$/;
const slug = (w: Workbook) => JSON.stringify(w);

function download(bytes: Uint8Array | string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export default function App() {
  const [wb, setWb] = useState<Workbook | null>(null);
  const [saved, setSaved] = useState('');
  const [table, setTable] = useState('');
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [branch, setBranch] = useState('main');
  const [tab, setTab] = useState('Sheet');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [mergeBranch, setMergeBranch] = useState('');
  const [plan, setPlan] = useState<MergePlan | null>(null);
  const [mergeErrors, setMergeErrors] = useState<string[]>([]);
  const [choices, setChoices] = useState<Choices>({});
  const [dark, setDark] = useState(localStorage.getItem('sheetgeist-theme') === 'dark');
  const [menu, setMenu] = useState(false);
  const [addingTable, setAddingTable] = useState(false);
  const [tName, setTName] = useState(''), [tCols, setTCols] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const dirty = !!wb && slug(wb) !== saved;

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('sheetgeist-theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', f); return () => window.removeEventListener('beforeunload', f);
  }, [dirty]);

  async function refresh(snapshot?: Workbook) {
    const w = snapshot ?? await wbRepo.readWorkingWorkbook();
    validateWorkbook(w);
    setWb(w); setSaved(slug(w));
    setTable(t => w.tables[t] ? t : w.order[0]);
    setBranch(await repo.getCurrentBranch()); setBranches(await repo.listBranches()); setVersion(v => v + 1);
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true); setError(''); setNote('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  useEffect(() => { void action(async () => {
    if (!await repo.repoExists()) { await repo.initRepo(); await wbRepo.createInitialWorkbookCommit(generateMuseumWorkbook()); }
    await refresh();
  }); }, []);

  function edit(w: Workbook) { setWb(w); setNote('Unsaved edits stay in memory until committed. Export before closing.'); }

  async function commit() {
    if (!wb || !message.trim()) return;
    await action(async () => { validateWorkbook(wb); await wbRepo.writeWorkingWorkbook(wb); await wbRepo.commitWorkbook(message.trim()); setMessage(''); await refresh(wb); setNote('Snapshot committed to your browser Git repository.'); });
  }
  async function switchBranch(b: string) {
    if (dirty) { setError('Commit or discard your edits before switching branches.'); return; }
    await action(async () => { await refresh(await wbRepo.checkoutWorkbookBranch(b)); setPlan(null); setMenu(false); setNote(`Switched to ${b}`); });
  }
  async function create() {
    if (dirty) { setError('Commit or discard edits first.'); return; }
    await action(async () => {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,39}$/.test(newBranch)) throw new Error('Use 1-40 letters, numbers, underscores or dashes');
      await repo.createBranch(newBranch); await refresh(await wbRepo.checkoutWorkbookBranch(newBranch)); setNewBranch('');
    });
  }
  async function previewMerge() {
    if (dirty) { setError('Commit or discard edits before merging.'); return; }
    await action(async () => {
      const bs = await repo.listBranches();
      const a = bs.find(x => x.name === branch)!, b = bs.find(x => x.name === mergeBranch);
      if (!b || a.name === b.name) throw new Error('Choose another branch');
      if (a.oid === b.oid) throw new Error('Both branches already point to the same snapshot');
      const baseOid = await repo.findMergeBase(a.oid, b.oid);
      if (!baseOid) throw new Error('No shared ancestor found. Unrelated histories cannot merge.');
      if (baseOid === b.oid) throw new Error('This branch is already included in the current branch');
      const [base, ours, theirs] = await Promise.all([wbRepo.readCommitWorkbook(baseOid), wbRepo.readCommitWorkbook(a.oid), wbRepo.readCommitWorkbook(b.oid)]);
      const result = mergeWorkbooks(base, ours, theirs);
      if (result.errors.length) throw new Error(result.errors.join(' '));
      setMergeErrors([]); setChoices({});
      setPlan({ branch: b.name, base, ours, theirs, conflicts: result.conflicts, clean: result.data, oursOid: a.oid, theirsOid: b.oid });
    });
  }
  const needed = (p: MergePlan) => p.conflicts.flatMap(c => c.conflict.type === 'edit-delete' ? [[c.table, c.conflict.rowId, '_row']] : c.conflict.conflicts.map(f => [c.table, c.conflict.rowId, f.field]));
  const unresolved = plan ? needed(plan).filter(([t, r, f]) => !choices[t]?.[r]?.[f]).length : 0;
  async function applyMerge() {
    if (!plan) return;
    await action(async () => {
      const current = await repo.listBranches();
      if (current.find(b => b.name === branch)?.oid !== plan.oursOid || current.find(b => b.name === plan.branch)?.oid !== plan.theirsOid) throw new Error('Branches changed. Preview the merge again.');
      if (!plan.clean && unresolved) throw new Error('Choose a side for every conflicting field first.');
      const merged = plan.clean ?? resolveWorkbookConflicts(plan.conflicts, choices, plan.base, plan.ours, plan.theirs);
      validateWorkbook(merged);
      await wbRepo.writeWorkingWorkbook(merged); await wbRepo.createWorkbookMergeCommit(`Merge ${plan.branch} into ${branch}`, plan.branch);
      await refresh(merged); setPlan(null); setNote('Merged as a real two-parent Git commit.');
    });
  }
  function choose(t: string, id: string, key: string, side: Side) { setChoices(c => ({ ...c, [t]: { ...c[t], [id]: { ...c[t]?.[id], [key]: side } } })); }

  function addTable() {
    if (!wb) return;
    const name = tName.trim(), cols = tCols.split(',').map(c => c.trim()).filter(Boolean);
    if (!TABLE_NAME.test(name)) { setError('Table name: lowercase letters, numbers and underscores, starting with a letter (max 40).'); return; }
    if (wb.tables[name]) { setError(`A table named ${name} already exists.`); return; }
    if (!cols.length) { setError('Add at least one column name, separated by commas.'); return; }
    try { const next = cloneWorkbook(wb); next.order.push(name); next.tables[name] = emptyTable(cols); validateWorkbook(next); edit(next); setTable(name); setAddingTable(false); setTName(''); setTCols(''); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  function removeTable() {
    if (!wb || wb.order.length < 2) return;
    if (!confirm(`Remove table ${table} from the working copy? It stays in earlier commits.`)) return;
    const next = cloneWorkbook(wb); next.order = next.order.filter(n => n !== table); delete next.tables[table]; edit(next); setTable(next.order[0]);
  }

  async function onImport(f: File) {
    if (dirty && !confirm('Replace uncommitted edits with the imported file?')) return;
    await action(async () => {
      if (/\.xlsx$/i.test(f.name)) {
        const { workbook, report: r } = importXlsx(await f.arrayBuffer());
        validateWorkbook(workbook); edit(workbook); setTable(workbook.order[0]); setReport(r);
        setNote(`Imported ${r.sheets} sheet(s), ${r.rows} row(s) from ${f.name}. Review, then commit.`);
      } else {
        if (f.size > 2_000_000) throw new Error('CSV limit is 2 MB');
        if (!wb) return;
        const d = await importCSV(f); const next = cloneWorkbook(wb);
        next.tables[table] = { ...d, computed: wb.tables[table].computed.filter(c => !d.columns.includes(c.name)) };
        validateWorkbook(next); edit(next); setReport(null); setNote(`CSV replaced the rows and columns of table ${table}. Review, then commit.`);
      }
      setTab('Sheet');
    });
  }
  async function exportXlsxFile() {
    if (!wb) return;
    await action(async () => {
      const computed: Record<string, Record<string, (string | number | boolean | null)[]>> = {};
      for (const n of wb.order) {
        const t = wb.tables[n]; if (!t.computed.length) continue;
        const names = t.computed.map(c => c.name);
        const r = await runWorkbookQuery({ order: [n], tables: { [n]: t } }, `SELECT ${names.map(x => `"${x}"`).join(', ')} FROM "${n}" LIMIT 1000`);
        if (!r.success) continue;
        computed[n] = Object.fromEntries(names.map((nm, i) => [nm, r.values.map(row => row[i] as string | number | null)]));
      }
      const head = await wbRepo.headSummary();
      const prov = [
        { label: 'Exported by', value: 'Sheetgeist (local browser workspace)' },
        { label: 'Exported at', value: new Date().toISOString() },
        { label: 'Branch', value: branch },
        { label: 'HEAD commit', value: head ? head.oid : '(none)' },
        { label: 'HEAD message', value: head?.message ?? '' },
        { label: 'HEAD time', value: head ? new Date(head.timestamp).toISOString() : '' },
        { label: 'Working copy', value: dirty ? 'INCLUDES UNCOMMITTED EDITS (not in HEAD)' : 'Matches HEAD commit' },
        { label: 'Tables', value: wb.order.map(n => `${n} (${wb.tables[n].rows.length} rows)`).join('; ') },
        { label: 'Computed columns', value: 'Exported as values. They are SQLite expressions in Sheetgeist, not Excel formulas.' },
      ];
      download(exportXlsx(wb, prov, computed), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `sheetgeist-${branch}-${head?.oid.slice(0, 7) ?? 'workbook'}.xlsx`);
      setNote('Workbook exported as .xlsx with a Provenance sheet.');
    });
  }

  const active = wb?.tables[table];
  const records = wb ? wb.order.reduce((n, t) => n + wb.tables[t].rows.length, 0) : 0;
  const tip = branches.find(b => b.name === branch)?.oid ?? '';

  return <div className="app">
    <header className="toolbar">
      <button aria-label="Toggle branches" className="mobile-menu" onClick={() => setMenu(!menu)}>☰</button>
      <div className="toolbar-title"><svg width="25" height="28" viewBox="0 0 25 28" aria-hidden="true"><path d="M3 25V12a9.5 9.5 0 0 1 19 0v13l-5-3-5 3-4-3z" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="9" cy="12" r="1.5" fill="currentColor" /><circle cx="16" cy="12" r="1.5" fill="currentColor" /></svg><span>sheetgeist<span className="brand-period">.</span><small>THE DATA VERSIONING WORKSPACE</small></span></div>
      <div className="header-path">Workspace <span>/</span> museum-workbook</div>
      <span className="local-label"><i /> Local workspace</span>
      <button className="theme-toggle" onClick={() => setDark(!dark)}>{dark ? 'Light' : 'Dark'} mode</button>
    </header>
    <div className="main-layout">
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <div className="workspace-label"><span className="workspace-symbol">M</span><div>Museum workbook<small>Personal workspace</small></div></div>
        <section className="sidebar-section"><div className="sidebar-section-title">Your branches</div>
          {branches.map(b => <button key={b.name} className={`branch-item ${b.name === branch ? 'active' : ''}`} disabled={busy} onClick={() => void switchBranch(b.name)}><span>⑂ {b.name}</span><code>{b.oid.slice(0, 6)}</code></button>)}
          <label className="small-label" htmlFor="newbranch">Experiment on a new branch</label>
          <div className="inline-form"><input id="newbranch" value={newBranch} placeholder="exhibition-plan" onChange={e => setNewBranch(e.target.value)} /><button className="btn btn-secondary" disabled={busy || !newBranch} onClick={() => void create()}>Create</button></div>
        </section>
        <section className="sidebar-section"><div className="sidebar-section-title">Merge changes</div>
          <label className="small-label" htmlFor="mergebranch">Merge into {branch}</label>
          <select id="mergebranch" value={mergeBranch} onChange={e => setMergeBranch(e.target.value)}><option value="">Choose branch</option>{branches.filter(b => b.name !== branch).map(b => <option key={b.name}>{b.name}</option>)}</select>
          <button className="btn btn-secondary full" disabled={busy || !mergeBranch} onClick={() => void previewMerge()}>Preview merge</button>
        </section>
        <section className="sidebar-section"><div className="sidebar-section-title">Import & export</div>
          <button className="text-button" disabled={busy} onClick={() => file.current?.click()}>Import .xlsx or .csv</button>
          <button className="text-button" disabled={!wb || busy} onClick={() => void exportXlsxFile()}>Export workbook (.xlsx)</button>
          <button className="text-button" disabled={!active || busy} onClick={() => active && downloadCSV(active, `${table}.csv`)}>Export {table || 'table'} (.csv)</button>
          <button className="text-button" disabled={busy || dirty} onClick={() => void action(async () => { await exportGitArchive(); setNote('Git archive downloaded. Unzip and run git log to inspect.'); })}>Export Git repository</button>
          <input ref={file} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onImport(f); }} />
          <p className="storage-note"><span>Local by design.</span> Nothing to sign into. Files are read in your browser, not uploaded. Export a backup before clearing your browser.</p>
        </section>
        <section className="sidebar-section"><button className="text-button danger" disabled={busy} onClick={() => { if (confirm('Delete this browser repository and ALL branches? Export a backup first.')) void action(async () => { await repo.deleteRepo(); await repo.initRepo(); await wbRepo.createInitialWorkbookCommit(generateMuseumWorkbook()); await refresh(); setPlan(null); setReport(null); }); }}>Reset demo repository</button></section>
      </aside>
      <main className="content">
        <div className="project-heading"><div><div className="eyebrow">WORKBOOK <span> / </span> SYNTHETIC DEMO</div><h1>Museum workbook<span className="title-dot">.</span></h1><p>Related tables, computed columns and a full history. Branch, explore and bring the good edits back.</p>
          <div className="dataset-meta"><span>{wb?.order.length ?? 0} tables</span><span>{records} records</span><span>Git-backed history</span></div></div>
          <div className="branch-art" aria-hidden="true"><svg viewBox="0 0 210 100"><path d="M15 71H195M65 71C91 71 87 25 112 25H145C169 25 166 71 195 71" /><circle cx="20" cy="71" r="6" /><circle cx="65" cy="71" r="6" /><circle cx="115" cy="25" r="6" /><circle cx="145" cy="25" r="6" /><circle cx="195" cy="71" r="8" /></svg><span>One workbook. Room to experiment.</span></div></div>
        <div className="content-tabs" role="tablist">{['Sheet', 'Query', 'History', 'Guide'].map((t, i) => <button role="tab" aria-label={t} aria-selected={t === tab} key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setMenu(false); }}><span className="tab-number">0{i + 1}</span>{t}</button>)}<span className={`work-status ${dirty ? 'unsaved' : ''}`}>{busy ? 'Working…' : dirty ? 'Uncommitted edits' : 'All changes committed'}</span></div>
        {error && <div className="notice error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
        {note && <div className="notice" role="status">{note}</div>}
        {report && <div className="notice import-report" role="status" aria-label="Import report">
          <strong>Import report</strong>: {report.sheets} sheet(s), {report.rows} row(s). {report.formulaCells > 0 ? `${report.formulaCells} formula cell(s) were imported as their saved values only; formulas are not evaluated or kept.` : 'No formula cells found.'}
          {report.skipped.length > 0 && <> Skipped: {report.skipped.join('; ')}.</>}{report.warnings.length > 0 && <> Notes: {report.warnings.join('; ')}.</>}
          <button aria-label="Dismiss import report" onClick={() => setReport(null)}>×</button></div>}
        <div className="tab-panel">
          {wb && tab === 'Sheet' && <>
            <div className="commit-bar"><div><strong>⑂ {branch}</strong><span>Current branch</span></div>
              <input aria-label="Commit message" placeholder="Describe this snapshot..." value={message} onChange={e => setMessage(e.target.value)} maxLength={140} />
              <button className="btn btn-primary" disabled={busy || !dirty || !message.trim()} onClick={() => void commit()}>Commit snapshot</button>
              <button className="btn btn-secondary" disabled={!dirty || busy} onClick={() => { if (confirm('Discard uncommitted edits?')) void action(() => refresh()); }}>Discard</button></div>
            <div className="table-bar" role="tablist" aria-label="Workbook tables">
              {wb.order.map(n => <button key={n} role="tab" aria-selected={n === table} className={`table-chip ${n === table ? 'active' : ''}`} onClick={() => setTable(n)}>{n}<small>{wb.tables[n].rows.length} rows</small></button>)}
              <button className="table-chip add" onClick={() => setAddingTable(!addingTable)} aria-label="Add table">+ Table</button>
              {wb.order.length > 1 && <button className="table-chip remove" onClick={removeTable} aria-label={`Remove table ${table}`}>Remove {table}</button>}
            </div>
            {addingTable && <div className="table-form"><input aria-label="New table name" placeholder="table_name" value={tName} onChange={e => setTName(e.target.value)} /><input aria-label="New table columns" placeholder="column_a, column_b" value={tCols} onChange={e => setTCols(e.target.value)} /><button className="btn btn-primary" onClick={addTable}>Create table</button></div>}
            {active && <SheetView key={version + table} wb={wb} table={table} onChange={edit} readOnly={busy} tip={tip} branch={branch} saved={saved ? JSON.parse(saved) as Workbook : null} />}
          </>}
          {wb && tab === 'Query' && <QueryStudio wb={wb} />}
          {wb && tab === 'History' && <History key={`${version}-${branch}`} current={wb} branch={branch} tip={tip} canRestore={!dirty && !busy}
            onRestore={async (oid, head, b) => { if (dirty) { setError('Commit or discard edits before restoring.'); return; } await action(async () => { await refresh(await wbRepo.restoreWorkbookSnapshot(oid, head, b)); setNote('Earlier snapshot restored as a new commit. Previous history is preserved.'); }); }} />}
          {tab === 'Guide' && <Help />}
          {!wb && <p className="loading">{busy ? 'Opening your local Git repository…' : 'Repository unavailable. See the error above.'}</p>}
        </div>
        <footer className="status-footer"><span><i /> Local Git repository · SQLite WASM</span><span>Built with Kiro + AI assistance <b>PROTOTYPE</b></span></footer>
      </main>
    </div>
    {plan && <div className="modal-overlay"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="merge-title">
      <div className="modal-header"><h2 id="merge-title">Merge {plan.branch} → {branch}</h2><button aria-label="Close merge" onClick={() => setPlan(null)}>×</button></div>
      <div className="modal-body">
        <p>{plan.conflicts.length ? `${plan.conflicts.length} row conflict(s) across ${new Set(plan.conflicts.map(c => c.table)).size} table(s). Choose each differing field. Non-conflicting edits are kept.` : 'No conflicts. Both histories will be preserved in a two-parent commit.'}</p>
        {mergeErrors.length > 0 && <p className="error-box">{mergeErrors.join(' ')}</p>}
        {plan.conflicts.map(({ table: t, conflict: c }) => <div className="conflict-card" key={t + c.rowId}>
          <h3><small className="conflict-table">{t}</small> {c.rowId} <small>{c.type}</small></h3>
          {c.type === 'edit-delete' ? <div className="conflict-options">{(['ours', 'theirs'] as const).map(side => <button className={`conflict-option ${choices[t]?.[c.rowId]?.['_row'] === side ? 'selected' : ''}`} key={side} onClick={() => choose(t, c.rowId, '_row', side)}>{side === 'ours' ? branch : plan.branch}: {c[side === 'ours' ? 'oursRow' : 'theirsRow'] ? 'Keep row' : 'Delete row'}</button>)}</div>
            : c.conflicts.map(f => <div className="conflict-field" key={f.field}><strong>{f.field}</strong><p className="fine-print">Base: {String(f.baseValue)}</p>
              <div className="conflict-options">{(['ours', 'theirs'] as const).map(side => <button className={`conflict-option ${choices[t]?.[c.rowId]?.[f.field] === side ? 'selected' : ''}`} key={side} onClick={() => choose(t, c.rowId, f.field, side)}>{side === 'ours' ? branch : plan.branch}<br />{String(side === 'ours' ? f.oursValue : f.theirsValue)}</button>)}</div></div>)}
        </div>)}
        {!plan.clean && unresolved > 0 && <p className="fine-print">{unresolved} choice(s) still needed.</p>}
      </div>
      <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setPlan(null)}>Cancel</button><button className="btn btn-primary" disabled={busy || (!plan.clean && unresolved > 0)} onClick={() => void applyMerge()}>Create merge commit</button></div>
    </section></div>}
  </div>;
}
