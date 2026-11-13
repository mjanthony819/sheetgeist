import type { SheetData } from './types';
import { validateData } from './validate';

export interface ComputedColumn {
  name: string;
  expr: string;
}

export interface TableData extends SheetData {
  computed: ComputedColumn[];
}

export interface Workbook {
  order: string[];
  tables: Record<string, TableData>;
}

const TABLE_NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;
const COL_NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;
const FORBIDDEN_EXPR_KEYWORDS = [
  'select', 'attach', 'pragma', 'load_extension', 'insert', 'update',
  'delete', 'drop', 'create', 'alter', 'vacuum', 'replace',
];
const MAX_EXPR_LEN = 300;

function validateTableName(name: string): void {
  if (!TABLE_NAME_RE.test(name)) {
    throw new Error(`Invalid table name: "${name}". Must match /^[a-z][a-z0-9_]{0,39}$/`);
  }
}

function validateComputedColumn(col: unknown, dataColumns: string[], existing: string[]): void {
  if (!col || typeof col !== 'object') throw new Error('Computed column must be an object');
  const c = col as Record<string, unknown>;
  if (typeof c.name !== 'string' || !COL_NAME_RE.test(c.name)) {
    throw new Error(`Invalid computed column name: "${c.name}"`);
  }
  if (c.name === 'id') throw new Error('Computed column cannot be named "id"');
  if (dataColumns.includes(c.name)) {
    throw new Error(`Computed column name "${c.name}" collides with a data column`);
  }
  if (existing.includes(c.name)) {
    throw new Error(`Duplicate computed column name: "${c.name}"`);
  }
  if (typeof c.expr !== 'string' || c.expr.trim() === '') {
    throw new Error(`Computed column "${c.name}" has empty expr`);
  }
  if (c.expr.length > MAX_EXPR_LEN) {
    throw new Error(`Computed column "${c.name}" expr exceeds ${MAX_EXPR_LEN} characters`);
  }
  if (c.expr.includes(';')) {
    throw new Error(`Computed column "${c.name}" expr contains forbidden ";" character`);
  }
  if (c.expr.includes('--')) {
    throw new Error(`Computed column "${c.name}" expr contains forbidden "--" sequence`);
  }
  if (c.expr.includes('/*')) {
    throw new Error(`Computed column "${c.name}" expr contains forbidden "/*" sequence`);
  }
  for (const kw of FORBIDDEN_EXPR_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(c.expr)) {
      throw new Error(`Computed column "${c.name}" expr contains forbidden keyword "${kw}"`);
    }
  }
}

export function validateWorkbook(w: unknown): asserts w is Workbook {
  if (!w || typeof w !== 'object') throw new Error('Workbook must be an object');
  const wb = w as Record<string, unknown>;

  if (!Array.isArray(wb.order)) throw new Error('Workbook.order must be an array');
  if (!wb.tables || typeof wb.tables !== 'object' || Array.isArray(wb.tables)) {
    throw new Error('Workbook.tables must be an object');
  }
  const tables = wb.tables as Record<string, unknown>;
  const tableKeys = Object.keys(tables);

  if (tableKeys.length < 1 || tableKeys.length > 10) {
    throw new Error(`Workbook must have 1–10 tables, got ${tableKeys.length}`);
  }
  if (wb.order.length !== tableKeys.length) {
    throw new Error('Workbook.order length must match number of tables');
  }

  const orderSet = new Set(wb.order as string[]);
  if (orderSet.size !== wb.order.length) throw new Error('Workbook.order contains duplicate names');
  for (const name of wb.order as string[]) {
    if (!tableKeys.includes(name)) {
      throw new Error(`Workbook.order contains "${name}" which is not in tables`);
    }
  }
  for (const key of tableKeys) {
    if (!orderSet.has(key)) {
      throw new Error(`Table "${key}" is in tables but not in order`);
    }
  }

  for (const name of tableKeys) {
    validateTableName(name);
    const table = tables[name] as Record<string, unknown>;
    // validate the SheetData portion
    validateData(table);
    // validate computed array
    if (!Array.isArray(table.computed)) {
      throw new Error(`Table "${name}".computed must be an array`);
    }
    const seenComputedNames: string[] = [];
    const dataColumns = (table as SheetData).columns;
    for (const col of table.computed as unknown[]) {
      validateComputedColumn(col, dataColumns, seenComputedNames);
      seenComputedNames.push((col as ComputedColumn).name);
    }
  }
}

export function serializeWorkbook(w: Workbook): Record<string, string> {
  const files: Record<string, string> = {};

  const computedMap: Record<string, ComputedColumn[]> = {};
  for (const name of w.order) {
    computedMap[name] = w.tables[name].computed;
  }

  files['workbook.json'] =
    JSON.stringify({ version: 2, order: w.order, computed: computedMap }, null, 2) + '\n';

  for (const name of w.order) {
    const table = w.tables[name];
    files[`tables/${name}.json`] =
      JSON.stringify({ rows: table.rows, columns: table.columns }, null, 2) + '\n';
  }

  return files;
}

export function parseWorkbookFiles(files: Record<string, string>): Workbook {
  // Legacy: data.json present but no workbook.json
  if (!files['workbook.json'] && files['data.json']) {
    const sheetData = JSON.parse(files['data.json']) as SheetData;
    return {
      order: ['sheet'],
      tables: { sheet: { ...sheetData, computed: [] } },
    };
  }

  if (!files['workbook.json']) {
    throw new Error('Missing workbook.json (and no legacy data.json found)');
  }

  const meta = JSON.parse(files['workbook.json']) as {
    version: number;
    order: string[];
    computed: Record<string, ComputedColumn[]>;
  };

  const tables: Record<string, TableData> = {};
  for (const name of meta.order) {
    const key = `tables/${name}.json`;
    if (!files[key]) {
      throw new Error(`Missing file "${key}" for table "${name}"`);
    }
    const sheetData = JSON.parse(files[key]) as SheetData;
    tables[name] = { ...sheetData, computed: meta.computed[name] ?? [] };
  }

  return { order: meta.order, tables };
}

export function cloneWorkbook(w: Workbook): Workbook {
  return JSON.parse(JSON.stringify(w)) as Workbook;
}

export function emptyTable(columns: string[]): TableData {
  return { rows: [], columns, computed: [] };
}
