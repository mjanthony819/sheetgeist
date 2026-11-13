import { useEffect, useState } from 'react';
import { cellHistory, type CellChange } from '../lib/gitWorkbook';
import { formatCell } from '../lib/diff';

interface Props { tip: string; branch: string; table: string; rowId: string; field: string; dirtyValue: boolean }

/** Provenance for one cell: every commit on this branch's first-parent line that changed it. */
export function CellHistory({ tip, branch, table, rowId, field, dirtyValue }: Props) {
  const [changes, setChanges] = useState<CellChange[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true; setChanges(null); setError('');
    cellHistory(tip, table, rowId, field).then(c => { if (live) setChanges(c); }).catch(e => { if (live) setError(String(e)); });
    return () => { live = false; };
  }, [tip, table, rowId, field]);
  return <section className="cell-history" aria-label="Cell history">
    <h3>Cell history <code>{table}.{rowId}.{field}</code> <small>on {branch}</small></h3>
    {dirtyValue && <p className="fine-print">This cell has an uncommitted edit. Below is the committed history only.</p>}
    {error && <p className="error-box">{error}</p>}
    {!changes && !error && <p className="fine-print">Reading commits...</p>}
    {changes && !changes.length && <p className="fine-print">No commit on this branch has changed this cell yet.</p>}
    {changes?.map(c => <div className="cell-change" key={c.oid}>
      <code>{c.oid.slice(0, 7)}</code> <span>{c.message}{c.isMerge ? ' (merge, compared with first parent)' : ''}</span>
      <span className="cell-values">{c.kind === 'added' ? <>row added: <b>{formatCell(c.after as never)}</b></> : c.kind === 'removed' ? <>row removed (was <b>{formatCell(c.before as never)}</b>)</> : <><s>{formatCell(c.before as never)}</s> → <b>{formatCell(c.after as never)}</b></>}</span>
      <small>{new Date(c.timestamp).toLocaleString()}</small>
    </div>)}
  </section>;
}
