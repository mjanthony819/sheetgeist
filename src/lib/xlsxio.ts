import * as XLSX from 'xlsx';
import type { Workbook, TableData } from './workbook';
import { validateData } from './validate';
import type { SheetRow } from './types';

export interface ImportReport {
  sheets: number;
  rows: number;
  formulaCells: number;
  skipped: string[];
  warnings: string[];
}

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_SHEETS = 10;
const MAX_ROWS = 5000;
const MAX_COLS = 50;

/** Slugify a sheet name to a valid table name */
function slugify(name: string, taken: Set<string>): string {
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!slug || /^\d/.test(slug)) slug = 'sheet_' + slug;
  slug = slug.substring(0, 40);
  if (!slug) slug = 'sheet';
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(slug + '_' + n)) n++;
  return slug + '_' + n;
}

/** Sanitize a header cell value to a valid column name */
function sanitizeHeader(
  raw: string | number | boolean | null,
  colIndex: number,
  existingHeaders: string[]
): string {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return `col_${colIndex + 1}`;
  }
  let name = String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!name || /^\d/.test(name)) name = `col_${colIndex + 1}`;
  // Forbidden names
  if (['__proto__', 'constructor', 'prototype'].includes(name)) {
    name = `col_${colIndex + 1}`;
  }
  // Handle duplicates
  if (existingHeaders.includes(name)) {
    let n = 2;
    while (existingHeaders.includes(`${name}_${n}`)) n++;
    name = `${name}_${n}`;
  }
  return name;
}

/** Extract a cell value with type info */
function extractCell(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  formulaCount: { n: number; noValue?: number },
  warningCount: { n: number }
): string | number | boolean | null {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell: XLSX.CellObject | undefined = ws[addr];
  if (!cell) return null;

  if (cell.f) { formulaCount.n++; if (cell.v === undefined || cell.v === null) formulaCount.noValue = (formulaCount.noValue ?? 0) + 1; }

  if (cell.t === 'e') {
    warningCount.n++;
    return null;
  }
  if (cell.t === 'd') {
    // Date — convert to ISO string
    const v = cell.v;
    if (v instanceof Date) return v.toISOString();
    return String(v);
  }
  if (cell.t === 'n') return typeof cell.v === 'number' ? cell.v : null;
  if (cell.t === 'b') return typeof cell.v === 'boolean' ? cell.v : null;
  if (cell.t === 's') return typeof cell.v === 'string' ? cell.v : String(cell.v ?? '');

  // fallback
  if (cell.v === undefined || cell.v === null) return null;
  return String(cell.v);
}

export function importXlsx(
  buf: ArrayBuffer | Uint8Array
): { workbook: Workbook; report: ImportReport } {
  // Size check
  const byteLen = buf instanceof ArrayBuffer ? buf.byteLength : buf.byteLength;
  if (byteLen > MAX_BYTES) {
    throw new Error('XLSX input exceeds 2 MB limit');
  }

  // Validate magic bytes: XLSX is a ZIP archive and must start with PK\x03\x04 (50 4B 03 04)
  // or PK\x05\x06 (empty archive). Without this check, SheetJS silently returns a blank
  // workbook for arbitrary garbage input rather than throwing.
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  const isPkZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
    (bytes[2] === 0x05 ? bytes[3] === 0x06 : bytes[2] === 0x07 ? bytes[3] === 0x08 : bytes[3] === 0x04);
  if (!isPkZip) {
    throw new Error('Invalid or corrupt XLSX file: missing ZIP/XLSX magic bytes');
  }

  // Parse
  let xlsxWb: XLSX.WorkBook;
  try {
    xlsxWb = XLSX.read(buf, { type: 'array', cellDates: true });
  } catch (e) {
    throw new Error(
      'Invalid or corrupt XLSX file: ' + (e instanceof Error ? e.message : String(e))
    );
  }

  const report: ImportReport = {
    sheets: 0,
    rows: 0,
    formulaCells: 0,
    skipped: [],
    warnings: [],
  };

  // Identify hidden sheets
  const hiddenSet = new Set<string>();
  if (xlsxWb.Workbook?.Sheets) {
    for (let i = 0; i < xlsxWb.Workbook.Sheets.length; i++) {
      const s = xlsxWb.Workbook.Sheets[i];
      if (s && (s.Hidden === 1 || s.Hidden === 2)) {
        hiddenSet.add(xlsxWb.SheetNames[i]);
      }
    }
  }

  for (const name of xlsxWb.SheetNames) {
    if (hiddenSet.has(name)) {
      report.skipped.push(name);
    }
  }

  const visibleSheetNames = xlsxWb.SheetNames.filter(n => !hiddenSet.has(n));

  if (visibleSheetNames.length > MAX_SHEETS) {
    throw new Error(
      `XLSX has more than ${MAX_SHEETS} sheets (limit is ${MAX_SHEETS})`
    );
  }

  const order: string[] = [];
  const tables: Record<string, TableData> = {};
  const takenNames = new Set<string>();

  for (const sheetName of visibleSheetNames) {
    const ws = xlsxWb.Sheets[sheetName];
    if (sheetName === 'Provenance' && /Label/i.test(String(ws['A1']?.v ?? ''))) {
      report.skipped.push('Provenance (Sheetgeist export metadata, not imported as data)');
      continue;
    }
    const ref = ws['!ref'];
    if (!ref) {
      report.warnings.push(`Sheet "${sheetName}" is empty, skipped`);
      continue;
    }

    const range = XLSX.utils.decode_range(ref);
    const numDataRows = range.e.r - range.s.r; // rows after header
    const numCols = range.e.c - range.s.c + 1;

    if (numDataRows <= 0) {
      report.warnings.push(`Sheet "${sheetName}" has no data rows, skipped`);
      continue;
    }
    if (numDataRows > MAX_ROWS) {
      throw new Error(
        `Sheet "${sheetName}" has ${numDataRows} data rows, exceeding the ${MAX_ROWS} row limit`
      );
    }
    if (numCols > MAX_COLS) {
      throw new Error(
        `Sheet "${sheetName}" has ${numCols} columns, exceeding the ${MAX_COLS} column limit`
      );
    }

    // Parse headers (row 0)
    const headers: string[] = [];
    const rawHeaders: string[] = [];
    const formulaCount: { n: number; noValue?: number } = { n: 0 };
    const warningCount = { n: 0 };

    for (let c = range.s.c; c <= range.e.c; c++) {
      const raw = extractCell(ws, range.s.r, c, formulaCount, warningCount);
      rawHeaders.push(String(raw ?? ''));
      headers.push(sanitizeHeader(raw, c - range.s.c, headers));
    }

    // Find id column
    const idColIdx = headers.indexOf('id');

    // Parse data rows
    const rows: SheetRow[] = [];
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const rowObj: Record<string, string | number | boolean | null> = {};
      for (let c = range.s.c; c <= range.e.c; c++) {
        const colName = headers[c - range.s.c];
        rowObj[colName] = extractCell(ws, r, c, formulaCount, warningCount);
      }
      rows.push(rowObj as SheetRow);
    }

    report.formulaCells += formulaCount.n;
    if (warningCount.n > 0) {
      report.warnings.push(
        `Sheet "${sheetName}": ${warningCount.n} error cell(s) imported as null`
      );
    }

    // Determine row ids
    let useIdColumn = false;
    if (idColIdx >= 0) {
      const idValues = rows.map(r => r['id']);
      const allNonEmpty = idValues.every(v => v !== null && v !== undefined && String(v).trim() !== '');
      const unique = new Set(idValues.map(v => String(v))).size === idValues.length;
      useIdColumn = allNonEmpty && unique;
    }

    // An 'id' column that cannot be used as row id (blank or duplicate values) is kept as data, never dropped.
    const keepIdAs = idColIdx >= 0 && !useIdColumn ? 'id_original' : null;
    if (keepIdAs) report.warnings.push(`Sheet "${sheetName}": the id column has blank or duplicate values, so row ids were generated and the original values kept in column ${keepIdAs}`);
    const computedIdx = new Set(rawHeaders.map((h, i) => / \(computed\)$/.test(h) ? i : -1).filter(i => i >= 0));
    const computedExports = [...computedIdx].map(i => rawHeaders[i]);
    const skipHeaders = new Set([...computedIdx].map(i => headers[i]));
    if (computedExports.length) report.warnings.push(`Sheet "${sheetName}": column(s) ${computedExports.join(', ')} look like Sheetgeist computed values and were skipped; re-add the computed column definition instead`);
    if (formulaCount.noValue) report.warnings.push(`Sheet "${sheetName}": ${formulaCount.noValue} formula cell(s) had no saved value and were imported as empty`);
    const dataColumns = headers.filter(h => h !== 'id' && !skipHeaders.has(h)).concat(keepIdAs ? [keepIdAs] : []);
    const finalRows: SheetRow[] = rows.map((r, i) => {
      const id = useIdColumn ? String(r['id']) : `r${i + 1}`;
      const row: SheetRow = { id };
      for (const col of dataColumns) {
        row[col] = col === keepIdAs ? (r['id'] ?? null) : (r[col] ?? null);
      }
      return row;
    });

    // Validate
    const sheetData = { rows: finalRows, columns: dataColumns };
    validateData(sheetData);

    const tableName = slugify(sheetName, takenNames);
    takenNames.add(tableName);
    if (tableName !== sheetName) report.warnings.push(`Sheet "${sheetName}" became table ${tableName}`);

    const tableData: TableData = { ...sheetData, computed: [] };
    order.push(tableName);
    tables[tableName] = tableData;
    report.sheets++;
    report.rows += finalRows.length;
  }

  return {
    workbook: { order, tables },
    report,
  };
}

/** Create a safe cell object — strings always use t:'s' to prevent formula injection */
function safeCell(v: string | number | boolean | null): XLSX.CellObject | '' {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return { t: 's', v };
  if (typeof v === 'number') return { t: 'n', v };
  if (typeof v === 'boolean') return { t: 'b', v };
  return '';
}

type AoaCell = string | number | boolean | null | XLSX.CellObject;

export function exportXlsx(
  w: Workbook,
  provenance: { label: string; value: string }[],
  computedValues?: Record<string, Record<string, (string | number | boolean | null)[]>>
): Uint8Array {
  const wb = XLSX.utils.book_new();

  for (const tableName of w.order) {
    const table = w.tables[tableName];
    const tableComputedValues = computedValues?.[tableName];

    // Build header row
    const dataHeaders = ['id', ...table.columns];
    const computedHeaders = tableComputedValues
      ? table.computed.map(cc => `${cc.name} (computed)`)
      : [];
    const allHeaders = [...dataHeaders, ...computedHeaders];

    const aoa: AoaCell[][] = [allHeaders.map(h => ({ t: 's', v: h } as XLSX.CellObject))];

    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      const rowCells: AoaCell[] = dataHeaders.map(h => safeCell(row[h] ?? null));

      if (tableComputedValues) {
        for (const cc of table.computed) {
          const vals = tableComputedValues[cc.name];
          rowCells.push(safeCell(vals?.[i] ?? null));
        }
      }

      aoa.push(rowCells);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const sheetName = tableName.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // Provenance sheet
  const provAoa: AoaCell[][] = [
    [{ t: 's', v: 'Label' }, { t: 's', v: 'Value' }],
    ...provenance.map(p => [
      { t: 's', v: p.label } as XLSX.CellObject,
      { t: 's', v: p.value } as XLSX.CellObject,
    ]),
  ];
  const provWs = XLSX.utils.aoa_to_sheet(provAoa);
  XLSX.utils.book_append_sheet(wb, provWs, 'Provenance');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array;
}
