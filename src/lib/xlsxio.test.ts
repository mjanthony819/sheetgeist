import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { importXlsx, exportXlsx } from './xlsxio';
import { generateMuseumWorkbook } from './dataset';
import type { Workbook } from './workbook';

const sheetsToBytes = (sheets: Record<string, (string | number | boolean | null)[][]>, hidden: string[] = []) => {
  const wb = XLSX.utils.book_new();
  for (const [n, aoa] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), n);
  if (hidden.length) wb.Workbook = { Sheets: Object.keys(sheets).map(n => ({ Hidden: hidden.includes(n) ? 1 : 0 })) } as never;
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
};

describe('xlsx export and import', () => {
  it('round-trips the museum workbook with types, skipping Provenance and computed value columns', () => {
    const w = generateMuseumWorkbook();
    const bytes = exportXlsx(w, [{ label: 'Branch', value: 'main' }], { items: { total_value_usd: w.tables.items.rows.map(r => (r.quantity as number) * (r.unit_value_usd as number)) } });
    const { workbook, report } = importXlsx(bytes);
    expect(workbook.order).toEqual(['items', 'exhibits', 'loans']);
    expect(workbook.tables.items.rows).toEqual(w.tables.items.rows);
    expect(workbook.tables.items.columns).toEqual(w.tables.items.columns);
    expect(workbook.tables.items.computed).toEqual([]);
    expect(report.skipped.join(' ')).toMatch(/Provenance/);
    expect(report.warnings.join(' ')).toMatch(/total_value_usd \(computed\)/);
  });
  it('keeps text that looks like a formula as text', () => {
    const w: Workbook = { order: ['t'], tables: { t: { columns: ['v'], rows: [{ id: 'a', v: '=1+1' }, { id: 'b', v: '@SUM(A1)' }], computed: [] } } };
    const wbk = XLSX.read(exportXlsx(w, []), { type: 'array' });
    expect(wbk.Sheets['t']['B2'].f).toBeUndefined();
    expect(wbk.Sheets['t']['B2'].t).toBe('s');
    expect(importXlsx(exportXlsx(w, [])).workbook.tables.t.rows[0].v).toBe('=1+1');
  });
  it('preserves numbers, booleans and strings', () => {
    const w: Workbook = { order: ['t'], tables: { t: { columns: ['n', 'b', 's'], rows: [{ id: 'a', n: 1.5, b: true, s: '1' }], computed: [] } } };
    expect(importXlsx(exportXlsx(w, [])).workbook.tables.t.rows[0]).toEqual({ id: 'a', n: 1.5, b: true, s: '1' });
  });
});

describe('xlsx import safety', () => {
  it('rejects garbage and oversized input', () => {
    expect(() => importXlsx(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(/Invalid|corrupt/i);
    expect(() => importXlsx(new Uint8Array(2_200_000))).toThrow(/2 MB/);
  });
  it('rejects more than 10 visible sheets', () => {
    const sheets: Record<string, string[][]> = {};
    for (let i = 0; i < 11; i++) sheets['s' + i] = [['a'], ['1']];
    expect(() => importXlsx(sheetsToBytes(sheets as never))).toThrow(/sheets/);
  });
  it('skips hidden sheets and says so', () => {
    const { workbook, report } = importXlsx(sheetsToBytes({ shown: [['a'], [1]], secret: [['b'], [2]] }, ['secret']));
    expect(workbook.order).toEqual(['shown']);
    expect(report.skipped).toContain('secret');
  });
  it('counts formula cells and imports cached values only', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['a', 'b'], [2, 0]]);
    ws['B2'] = { t: 'n', f: 'A2*21', v: 42 };
    const nov = XLSX.utils.aoa_to_sheet([['a', 'b'], [2, 0]]); nov['B2'] = { t: 'n', f: 'A2*21' } as never;
    XLSX.utils.book_append_sheet(wb, ws, 'calc'); XLSX.utils.book_append_sheet(wb, nov, 'nocache');
    const { workbook, report } = importXlsx(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })));
    expect(report.formulaCells).toBe(2);
    expect(workbook.tables.calc.rows[0].b).toBe(42);
    expect(workbook.tables.calc.computed).toEqual([]);
    expect(report.warnings.join(' ')).toMatch(/no saved value/);
  });
  it('never drops an unusable id column and never lets __proto__ become a column', () => {
    const { workbook, report } = importXlsx(sheetsToBytes({ t: [['id', '__proto__', 'x'], ['', 1, 2], ['', 3, 4]] }));
    expect(workbook.tables.t.rows.map(r => r.id)).toEqual(['r1', 'r2']);
    expect(workbook.tables.t.columns).toContain('id_original');
    expect(workbook.tables.t.columns).not.toContain('__proto__');
    expect(report.warnings.join(' ')).toMatch(/id column/);
  });
  it('reports renamed sheets', () => {
    const { workbook, report } = importXlsx(sheetsToBytes({ 'My Sheet!': [['a'], [1]] }));
    expect(workbook.order).toEqual(['my_sheet']);
    expect(report.warnings.join(' ')).toMatch(/became table my_sheet/);
  });
});
