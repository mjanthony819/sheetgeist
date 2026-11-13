// Workbook persistence on top of the real Git repository (isomorphic-git + LightningFS).
// Layout per commit: workbook.json (manifest) + tables/<name>.json. Legacy commits with data.json still read.
import git from 'isomorphic-git';
import { fs, GIT_DIR } from './git';
import { parseWorkbookFiles, serializeWorkbook, validateWorkbook, type Workbook } from './workbook';

const AUTHOR = { name: 'Sheetgeist User', email: 'user@sheetgeist.local' };
async function flush(): Promise<void> { await (fs.promises as unknown as { flush: () => Promise<void> }).flush(); }

async function readDirFiles(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const tryRead = async (p: string) => { try { out[p] = await fs.promises.readFile(`${GIT_DIR}/${p}`, 'utf8') as string; } catch { /* absent */ } };
  await tryRead('workbook.json'); await tryRead('data.json');
  try { for (const f of await fs.promises.readdir(`${GIT_DIR}/tables`)) if (f.endsWith('.json')) await tryRead(`tables/${f}`); } catch { /* no tables dir */ }
  return out;
}

export async function readWorkingWorkbook(): Promise<Workbook> {
  try { return parseWorkbookFiles(await readDirFiles()); }
  catch (e) { throw new Error('Cannot read working workbook. Export a backup before resetting. ' + (e instanceof Error ? e.message : '')); }
}

export async function writeWorkingWorkbook(w: Workbook): Promise<void> {
  validateWorkbook(w);
  const files = serializeWorkbook(w);
  try { await fs.promises.mkdir(`${GIT_DIR}/tables`); } catch { /* exists */ }
  try { for (const f of await fs.promises.readdir(`${GIT_DIR}/tables`)) if (!files[`tables/${f}`]) await fs.promises.unlink(`${GIT_DIR}/tables/${f}`); } catch { /* none */ }
  try { await fs.promises.unlink(`${GIT_DIR}/data.json`); } catch { /* no legacy file */ }
  for (const [p, c] of Object.entries(files)) await fs.promises.writeFile(`${GIT_DIR}/${p}`, c, 'utf8');
}

/** Stage every added, changed or removed workbook file. */
async function stageAll(): Promise<void> {
  for (const [filepath, head, workdir, stage] of await git.statusMatrix({ fs, dir: GIT_DIR })) {
    if (workdir === 0) { if (head === 1 || stage !== 0) await git.remove({ fs, dir: GIT_DIR, filepath }); }
    else if (head !== 1 || workdir !== 1 || stage !== 1) await git.add({ fs, dir: GIT_DIR, filepath });
  }
}

export async function commitWorkbook(message: string, parents?: string[]): Promise<string> {
  await stageAll();
  const oid = await git.commit({ fs, dir: GIT_DIR, message, author: AUTHOR, ...(parents ? { parent: parents } : {}) });
  await flush(); return oid;
}

export async function createInitialWorkbookCommit(w: Workbook): Promise<string> {
  await writeWorkingWorkbook(w); return commitWorkbook('Initial commit');
}

export async function readCommitWorkbook(oid: string): Promise<Workbook> {
  try {
    const paths = (await git.listFiles({ fs, dir: GIT_DIR, ref: oid })).filter(p => p === 'workbook.json' || p === 'data.json' || /^tables\/[^/]+\.json$/.test(p));
    const files: Record<string, string> = {};
    for (const filepath of paths) { const { blob } = await git.readBlob({ fs, dir: GIT_DIR, oid, filepath }); files[filepath] = new TextDecoder().decode(blob); }
    return parseWorkbookFiles(files);
  } catch { throw new Error('Cannot read this commit snapshot.'); }
}

export async function createWorkbookMergeCommit(message: string, theirBranch: string): Promise<string> {
  const theirs = await git.resolveRef({ fs, dir: GIT_DIR, ref: theirBranch });
  const ours = await git.resolveRef({ fs, dir: GIT_DIR, ref: 'HEAD' });
  return commitWorkbook(message, [ours, theirs]);
}

export async function restoreWorkbookSnapshot(oid: string, expectedHead: string, expectedBranch: string): Promise<Workbook> {
  const target = await readCommitWorkbook(oid);
  const branch = await git.currentBranch({ fs, dir: GIT_DIR, fullname: false });
  const head = await git.resolveRef({ fs, dir: GIT_DIR, ref: 'HEAD' });
  if (branch !== expectedBranch || head !== expectedHead) throw new Error('The branch changed. Reopen the restore preview.');
  const current = await readWorkingWorkbook();
  if (JSON.stringify(serializeWorkbook(current)) === JSON.stringify(serializeWorkbook(target))) throw new Error('This snapshot already matches the current data.');
  await writeWorkingWorkbook(target);
  await commitWorkbook(`Restore snapshot ${oid.slice(0, 7)}`, [head]);
  return target;
}

export interface CellChange { oid: string; message: string; timestamp: number; isMerge: boolean; kind: 'added' | 'changed' | 'removed'; before: unknown; after: unknown }

/** Walk the first-parent chain from tip and report commits where this cell's value changed. */
export async function cellHistory(tip: string, table: string, rowId: string, field: string, limit = 200): Promise<CellChange[]> {
  const out: CellChange[] = [];
  const cache = new Map<string, Workbook | null>();
  const wb = async (oid: string) => { if (!cache.has(oid)) cache.set(oid, await readCommitWorkbook(oid).catch(() => null)); return cache.get(oid)!; };
  const val = (w: Workbook | null) => { const t = w?.tables[table]; const r = t?.rows.find(x => x.id === rowId); return { exists: !!r, value: r ? (field === 'id' ? r.id : r[field] ?? null) : undefined }; };
  let oid: string | undefined = tip;
  for (let i = 0; oid && i < limit; i++) {
    const c = await git.readCommit({ fs, dir: GIT_DIR, oid });
    const parent = c.commit.parent[0];
    const after = val(await wb(oid)), before = parent ? val(await wb(parent)) : { exists: false, value: undefined };
    if (after.exists !== before.exists || after.value !== before.value) {
      out.push({ oid, message: c.commit.message.trim(), timestamp: c.commit.author.timestamp * 1000, isMerge: c.commit.parent.length > 1,
        kind: !before.exists ? 'added' : !after.exists ? 'removed' : 'changed', before: before.value, after: after.value });
    }
    oid = parent;
  }
  return out;
}

/** Check out a branch and return the workbook it contains (works for legacy single-table and workbook layouts). */
export async function checkoutWorkbookBranch(name: string): Promise<Workbook> {
  await git.checkout({ fs, dir: GIT_DIR, ref: name, force: false });
  await flush();
  return readWorkingWorkbook();
}

export async function headSummary(): Promise<{ oid: string; message: string; timestamp: number } | null> {
  try {
    const oid = await git.resolveRef({ fs, dir: GIT_DIR, ref: 'HEAD' });
    const c = await git.readCommit({ fs, dir: GIT_DIR, oid });
    return { oid, message: c.commit.message.trim(), timestamp: c.commit.author.timestamp * 1000 };
  } catch { return null; }
}
