import initSqlJs, { type SqlJsStatic } from 'sql.js';
import type { SheetData } from './types';
import { validateData } from './validate';
let pending: Promise<SqlJsStatic>;
const quote = (s: string) => '"' + s.replace(/"/g, '""') + '"';
export interface QueryResult { success: boolean; columns: string[]; values: (string|number|null|Uint8Array)[][]; error?: string }
export async function executeQuery(data: SheetData, query: string): Promise<QueryResult> {
 try {
  validateData(data);
  if (query.length > 10000 || !/^\s*SELECT\b/i.test(query)) throw new Error('Use one SELECT statement (maximum 10,000 characters)');
  // Deliberately conservative: semicolons are not accepted even inside strings.
  if (query.trim().replace(/;$/, '').includes(';')) throw new Error('Only one statement is supported');
  pending ||= initSqlJs({ locateFile: () => import.meta.env.BASE_URL + 'sql-wasm.wasm' });
  const SQL = await pending; const db = new SQL.Database();
  try {
   const cols = ['id', ...data.columns];
   db.run(`CREATE TABLE sheet (${cols.map(quote).join(',')})`);
   const insert = db.prepare(`INSERT INTO sheet VALUES (${cols.map(()=>'?').join(',')})`);
   for (const r of data.rows) insert.run(cols.map(c => typeof r[c] === 'boolean' ? Number(r[c]) : r[c] ?? null));
   insert.free(); db.run('PRAGMA query_only=ON');
   const stmt = db.prepare(query); const columns = stmt.getColumnNames(); const values: QueryResult['values'] = [];
   try { while (stmt.step()) { if (values.length >= 1000) throw new Error('More than 1,000 results. Add LIMIT 1000.'); values.push(stmt.get()); } } finally { stmt.free(); }
   return {success:true, columns, values};
  } finally { db.close(); }
 } catch (e) { return {success:false, columns:[], values:[], error: e instanceof Error ? e.message : String(e)}; }
}
