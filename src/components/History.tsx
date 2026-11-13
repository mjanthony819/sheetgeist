import { useState, useEffect, useRef } from 'react';
import { getCommitLog } from '../lib/git';
import { readCommitWorkbook } from '../lib/gitWorkbook';
import { diffSnapshots, formatCell, type SnapshotDiff } from '../lib/diff';
import type { CommitInfo, SheetData } from '../lib/types';
import type { Workbook, TableData } from '../lib/workbook';
import { SpreadsheetGrid } from './SpreadsheetGrid';

interface Props {
  current: Workbook; branch: string; tip: string; canRestore: boolean;
  onRestore: (oid: string, expectedHead: string, expectedBranch: string) => Promise<void>;
}
interface TableDiff { name: string; status: 'added' | 'removed' | 'modified' | 'unchanged'; diff: SnapshotDiff; computedChanged: string[] }

const emptyLike = (t: TableData | undefined, fallback: TableData | undefined): TableData => ({ rows: [], columns: (t ?? fallback)?.columns ?? [], computed: [] });
const summary = (d: SnapshotDiff) => d.added + d.removed + d.modified;

export function diffWorkbooks(before: Workbook, after: Workbook): TableDiff[] {
  const names = [...new Set([...before.order, ...after.order])];
  return names.map(name => {
    const a = before.tables[name], b = after.tables[name];
    const diff = diffSnapshots(a ?? emptyLike(undefined, b), b ?? emptyLike(undefined, a));
    const defs = (t?: TableData) => new Map((t?.computed ?? []).map(c => [c.name, c.expr]));
    const da = defs(a), db = defs(b);
    const computedChanged = [...new Set([...da.keys(), ...db.keys()])].filter(k => da.get(k) !== db.get(k)).map(k => !da.has(k) ? `+ ${k} = ${db.get(k)}` : !db.has(k) ? `- ${k}` : `~ ${k}: ${da.get(k)} -> ${db.get(k)}`);
    const status = !a ? 'added' : !b ? 'removed' : summary(diff) || diff.columnOrderChanged || computedChanged.length ? 'modified' : 'unchanged';
    return { name, status, diff, computedChanged } as TableDiff;
  });
}

export function History({ current, branch, tip, canRestore, onRestore }: Props) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selected, setSelected] = useState<CommitInfo | null>(null);
  const [snapshot, setSnapshot] = useState<Workbook | null>(null);
  const [diffs, setDiffs] = useState<TableDiff[] | null>(null);
  const [table, setTable] = useState('');
  const [mode, setMode] = useState<'diff' | 'snapshot'>('diff');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<{ oid: string; head: string; branch: string } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    let active = true;
    getCommitLog(50).then(c => { if (active) setCommits(c); }).catch(e => { if (active) setError(String(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; request.current++; };
  }, []);

  async function select(commit: CommitInfo) {
    const token = ++request.current;
    setSelected(commit); setSnapshot(null); setDiffs(null); setError(''); setConfirm(null);
    try {
      const next = await readCommitWorkbook(commit.oid);
      const base = commit.parents[0] ? await readCommitWorkbook(commit.parents[0]) : { order: [], tables: {} } as Workbook;
      if (token !== request.current) return;
      const d = diffWorkbooks(base, next);
      setSnapshot(next); setDiffs(d); setMode('diff');
      setTable((d.find(x => x.status !== 'unchanged') ?? d[0])?.name ?? '');
    } catch (e) { if (token === request.current) setError(e instanceof Error ? e.message : String(e)); }
  }

  const restoreDiffs = snapshot ? diffWorkbooks(current, snapshot) : null;
  const noChange = !!restoreDiffs && restoreDiffs.every(d => d.status === 'unchanged');
  const active = diffs?.find(d => d.name === table);
  const snapTable: SheetData | undefined = snapshot?.tables[table];

  return <div className="history-layout">
    <div className="history-timeline">
      <div className="history-title">COMMIT HISTORY <span>latest 50</span></div>
      {loading ? <p className="loading">Loading history...</p> : <div className="history-list">{commits.map(c =>
        <button key={c.oid} className={`commit-card ${selected?.oid === c.oid ? 'active' : ''}`} onClick={() => void select(c)}>
          <div className="commit-message">{c.message}</div>
          <div className="commit-meta"><div>{new Date(c.timestamp).toLocaleString()}</div><div className="commit-oid">{c.oid.slice(0, 7)}</div>{c.parents.length > 1 && <div className="merge-label">Merge commit</div>}</div>
        </button>)}</div>}
    </div>
    <div className="history-detail">
      {error && <div className="error-box">{error}</div>}
      {selected && snapshot && diffs ? <>
        <div className="history-detail-head">
          <div className="eyebrow">SNAPSHOT / {selected.oid.slice(0, 7)}</div>
          <h2>{selected.message}</h2>
          <p>{selected.parents.length > 1 ? 'Merge commit · differences below compare the first parent only.' : selected.parents.length ? 'Compared with its parent commit.' : 'Initial snapshot compared with an empty workbook.'}</p>
          <div className="table-chips" role="tablist" aria-label="Tables in this commit">{diffs.map(d =>
            <button key={d.name} role="tab" aria-selected={d.name === table} className={`table-chip ${d.name === table ? 'active' : ''}`} onClick={() => setTable(d.name)}>
              {d.name}<small>{d.status === 'unchanged' ? 'no change' : d.status === 'modified' ? `${summary(d.diff)} row changes` : d.status}</small>
            </button>)}</div>
          <div className="history-detail-actions">
            <button className={`btn ${mode === 'diff' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('diff')}>Changes</button>
            <button className={`btn ${mode === 'snapshot' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('snapshot')}>View snapshot</button>
            <button className="btn btn-secondary restore-button" disabled={!canRestore || noChange || restoring} onClick={() => setConfirm({ oid: selected.oid, head: tip, branch })}>Restore this snapshot</button>
          </div>
          {!canRestore && <p className="fine-print">Commit or discard working edits before restoring.</p>}
          {noChange && <p className="fine-print">This snapshot matches the current working workbook.</p>}
        </div>
        {mode === 'snapshot' ? (snapTable ? <SpreadsheetGrid data={snapTable} onChange={() => {}} readOnly /> : <p className="fine-print">This table does not exist in the snapshot.</p>)
          : active ? <div className="diff-view">
            <div className="diff-summary"><span>+ {active.diff.added} added</span><span>− {active.diff.removed} removed</span><span>~ {active.diff.modified} modified</span></div>
            {active.status === 'added' && <div className="schema-change">Table <code>{active.name}</code> was added in this commit.</div>}
            {active.status === 'removed' && <div className="schema-change">Table <code>{active.name}</code> was removed in this commit.</div>}
            {active.diff.columnOrderChanged && <div className="schema-change">Schema changed. Added: {active.diff.columnsAdded.join(', ') || 'none'}. Removed: {active.diff.columnsRemoved.join(', ') || 'none'}. Column ordering is included.</div>}
            {active.computedChanged.length > 0 && <div className="schema-change">Computed column definitions changed: {active.computedChanged.join(' · ')}</div>}
            {!active.diff.rows.length && !active.computedChanged.length && <p className="fine-print">No row content changes in this table.</p>}
            {active.diff.rows.slice(0, 200).map(row => <section className={`diff-row ${row.kind}`} key={row.id}>
              <h3><code>{row.id}</code><span>{row.kind}</span></h3>
              {row.fields.map(f => <div className="diff-field" key={f.field}><strong>{f.field}</strong>
                <div className="diff-before"><span>BEFORE</span><code>{formatCell(f.before)}</code></div>
                <div className="diff-after"><span>AFTER</span><code>{formatCell(f.after)}</code></div></div>)}
            </section>)}
            {active.diff.rows.length > 200 && <p className="fine-print">Showing the first 200 changed rows. Export the repository to inspect the full snapshot.</p>}
          </div> : null}
      </> : <div className="history-empty"><span>↗</span><h2>{selected ? 'Loading snapshot...' : 'Every change has a story.'}</h2>
        <p>{selected ? 'Reading the commit and its parent from your local repository.' : 'Pick a commit to see which tables changed, the exact row and field differences, or restore its content without erasing the past.'}</p>
        <small>Typed values are shown explicitly: "1" is text; 1 is a number.</small></div>}
    </div>
    {confirm && snapshot && restoreDiffs && <div className="modal-overlay"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="restore-title">
      <div className="modal-header"><h2 id="restore-title">Restore {confirm.oid.slice(0, 7)}?</h2><button aria-label="Close restore" onClick={() => setConfirm(null)}>×</button></div>
      <div className="modal-body">
        <p>This replaces the whole workbook on <strong>{confirm.branch}</strong> with the selected snapshot and creates a new commit. Existing commits and branches are preserved.</p>
        {restoreDiffs.filter(d => d.status !== 'unchanged').map(d => <div className="diff-summary" key={d.name}><span><b>{d.name}</b> {d.status}</span><span>+ {d.diff.added}</span><span>− {d.diff.removed}</span><span>~ {d.diff.modified}</span></div>)}
        <p className="fine-print">This is a full snapshot restore, not a field-level cherry-pick. Export a backup if you need one. Do not edit this repository in another tab during a write.</p>
      </div>
      <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
        <button className="btn btn-primary" disabled={!canRestore || restoring} onClick={async () => { setRestoring(true); try { await onRestore(confirm.oid, confirm.head, confirm.branch); setConfirm(null); } finally { setRestoring(false); } }}>{restoring ? 'Restoring...' : 'Create restore commit'}</button></div>
    </section></div>}
  </div>;
}
