import type { SheetData } from './types';
export function validateData(value: unknown): asserts value is SheetData {
  const d = value as SheetData;
  if (!d || !Array.isArray(d.rows) || !Array.isArray(d.columns)) throw new Error('Invalid spreadsheet shape');
  if (d.rows.length > 5000 || d.columns.length > 50) throw new Error('Limit: 5,000 rows and 50 columns');
  if (d.columns.some(c => typeof c !== 'string' || !c.trim() || c === 'id' || c.length > 80 || ['__proto__','constructor','prototype'].includes(c)) || new Set(d.columns).size !== d.columns.length) throw new Error('Invalid or duplicate column names');
  const ids = new Set();
  for (const row of d.rows) {
    if (!row || typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id)) throw new Error('Every row needs a unique non-empty text id');
    ids.add(row.id);
    for (const [k,v] of Object.entries(row)) {
      if (k !== 'id' && !d.columns.includes(k)) throw new Error('Row contains unknown column');
      if (v !== null && !['string','number','boolean'].includes(typeof v)) throw new Error('Cells must be text, number, boolean or null');
      if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('Numbers must be finite');
      if (typeof v === 'string' && v.length > 10000) throw new Error('Cell exceeds 10,000 characters');
    }
  }
}
