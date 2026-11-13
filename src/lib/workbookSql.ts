import initSqlJs, { type SqlJsStatic, type Database } from 'sql.js';
import type { Workbook } from './workbook';
export type { QueryResult } from './sql';
import type { QueryResult } from './sql';

type SqlJsInitOptions = Parameters<typeof initSqlJs>[0];

let cachedSql: Promise<SqlJsStatic> | undefined;

/** Tests (Node) inject their own initializer; the browser build always loads the bundled WASM asset. */
export function configureSql(init: () => Promise<SqlJsStatic>): void { cachedSql = init(); }

async function getSql(options?: SqlJsInitOptions): Promise<SqlJsStatic> {
  if (options) return initSqlJs(options);
  cachedSql ||= initSqlJs({ locateFile: () => import.meta.env.BASE_URL + 'sql-wasm.wasm' });
  return cachedSql;
}

const quote = (s: string) => '"' + s.replace(/"/g, '""') + '"';

async function buildDb(w: Workbook, SQL: SqlJsStatic): Promise<Database> {
  const db = new SQL.Database();
  try {
    for (const tableName of w.order) {
      const table = w.tables[tableName];
      const dataCols = ['id', ...table.columns];
      const computedCols = table.computed;

      // Build column definitions
      const colDefs: string[] = dataCols.map(c => quote(c)) // no declared type: keep numbers as numbers (TEXT affinity would sort and compare them as strings);
      for (const cc of computedCols) {
        colDefs.push(`${quote(cc.name)} GENERATED ALWAYS AS (${cc.expr}) VIRTUAL`);
      }

      db.run(`CREATE TABLE ${quote(tableName)} (${colDefs.join(', ')})`);

      // Insert data rows (only non-computed columns)
      const insertCols = dataCols.map(quote).join(', ');
      const placeholders = dataCols.map(() => '?').join(', ');
      const insert = db.prepare(
        `INSERT INTO ${quote(tableName)} (${insertCols}) VALUES (${placeholders})`
      );
      for (const row of table.rows) {
        insert.run(
          dataCols.map(c =>
            typeof row[c] === 'boolean' ? Number(row[c]) : row[c] ?? null
          )
        );
      }
      insert.free();
    }
    db.run('PRAGMA query_only=ON');
  } catch (e) {
    db.close();
    throw e;
  }
  return db;
}

export async function runWorkbookQuery(
  w: Workbook,
  query: string,
  initOptions?: SqlJsInitOptions
): Promise<QueryResult> {
  try {
    if (query.length > 10000 || !/^\s*SELECT\b/i.test(query)) {
      throw new Error('Use one SELECT statement (maximum 10,000 characters)');
    }
    if (query.trim().replace(/;$/, '').includes(';')) {
      throw new Error('Only one statement is supported');
    }
    const SQL = await getSql(initOptions);
    const db = await buildDb(w, SQL);
    try {
      const stmt = db.prepare(query);
      const columns = stmt.getColumnNames();
      const values: QueryResult['values'] = [];
      try {
        while (stmt.step()) {
          if (values.length >= 1000) {
            throw new Error('More than 1,000 results. Add LIMIT 1000.');
          }
          values.push(stmt.get());
        }
      } finally {
        stmt.free();
      }
      return { success: true, columns, values };
    } finally {
      db.close();
    }
  } catch (e) {
    return {
      success: false,
      columns: [],
      values: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function summarizeTable(
  w: Workbook,
  table: string,
  initOptions?: SqlJsInitOptions
): Promise<
  { column: string; count: number; sum: number | null; avg: number | null; min: number | null; max: number | null }[]
> {
  const tableData = w.tables[table];
  if (!tableData) return [];

  // Find numeric data columns: every non-null value is a number
  const numericDataCols = tableData.columns.filter(col => {
    const values = tableData.rows.map(r => r[col]).filter(v => v !== null && v !== undefined);
    return values.length > 0 && values.every(v => typeof v === 'number');
  });

  // Include all computed columns (they might be numeric)
  const computedColNames = tableData.computed.map(c => c.name);
  const allNumericCols = [...numericDataCols, ...computedColNames];

  if (allNumericCols.length === 0) return [];

  try {
    const SQL = await getSql(initOptions);
    const db = await buildDb(w, SQL);
    try {
      const selectParts = allNumericCols.map(
        col =>
          `COUNT(${quote(col)}) AS ${quote('cnt_' + col)},` +
          `SUM(${quote(col)}) AS ${quote('sum_' + col)},` +
          `AVG(${quote(col)}) AS ${quote('avg_' + col)},` +
          `MIN(${quote(col)}) AS ${quote('min_' + col)},` +
          `MAX(${quote(col)}) AS ${quote('max_' + col)}`
      );
      const query = `SELECT ${selectParts.join(', ')} FROM ${quote(table)}`;
      const stmt = db.prepare(query);
      const results: ReturnType<typeof summarizeTable> extends Promise<infer T> ? T : never = [];
      try {
        if (stmt.step()) {
          const row = stmt.get();
          for (let i = 0; i < allNumericCols.length; i++) {
            const col = allNumericCols[i];
            const base = i * 5;
            results.push({
              column: col,
              count: (row[base] as number) ?? 0,
              sum: row[base + 1] as number | null,
              avg: row[base + 2] as number | null,
              min: row[base + 3] as number | null,
              max: row[base + 4] as number | null,
            });
          }
        }
      } finally {
        stmt.free();
      }
      return results;
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

export async function checkComputed(
  w: Workbook,
  initOptions?: SqlJsInitOptions
): Promise<{ table: string; name: string; error: string }[]> {
  const errors: { table: string; name: string; error: string }[] = [];

  // Try building the whole DB first to catch expression errors at CREATE TABLE time
  let SQL: SqlJsStatic;
  try {
    SQL = await getSql(initOptions);
  } catch (e) {
    return [{ table: '', name: '', error: e instanceof Error ? e.message : String(e) }];
  }

  // Check per-table, per computed column
  for (const tableName of w.order) {
    const table = w.tables[tableName];
    if (table.computed.length === 0) continue;

    // Try to build a mini DB with just this table
    let db: Database | undefined;
    try {
      db = await buildDb(w, SQL);
    } catch (e) {
      // The whole build failed — attribute to the first computed column of this table
      for (const cc of table.computed) {
        errors.push({
          table: tableName,
          name: cc.name,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      continue;
    }

    try {
      for (const cc of table.computed) {
        try {
          const stmt = db.prepare(`SELECT ${quote(cc.name)} FROM ${quote(tableName)} LIMIT 1`);
          try {
            stmt.step();
          } finally {
            stmt.free();
          }
        } catch (e) {
          errors.push({
            table: tableName,
            name: cc.name,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    } finally {
      db.close();
    }
  }

  return errors;
}
