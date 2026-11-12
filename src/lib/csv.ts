import Papa from 'papaparse';
import type { SheetData, SheetRow } from './types';
import { validateData } from './validate';

/**
 * Parse CSV file into SheetData with stable row IDs
 */
export async function importCSV(file: File): Promise<SheetData> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: (field) => field !== 'id',
      complete: (results) => {
        try {
          if (results.errors.length > 0) {
            throw new Error('Invalid CSV: ' + results.errors[0].message);
          }
          
          const rows: SheetRow[] = results.data.map((row, index) => {
            // Use existing ID if present, otherwise generate one
            const id = row.id ? String(row.id) : `row-${index}-${crypto.randomUUID()}`;
            
            const sheetRow: SheetRow = { id };
            
            for (const [key, value] of Object.entries(row)) {
              if (key !== 'id') {
                sheetRow[key] = value;
              }
            }
            
            return sheetRow;
          });
          
          // Get all unique columns (excluding id)
          const columnSet = new Set<string>();
          for (const row of rows) {
            for (const key of Object.keys(row)) {
              if (key !== 'id') {
                columnSet.add(key);
              }
            }
          }
          
          const columns = (results.meta.fields || Array.from(columnSet)).filter(c=>c!=='id');
          
          const data = { rows, columns }; validateData(data); resolve(data);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

/**
 * Export SheetData to CSV string
 */
export function exportCSV(data: SheetData): string {
  const columns = ['id', ...data.columns];
  
  const csvData = data.rows.map(row => {
    const csvRow: Record<string, any> = {};
    for (const col of columns) {
      csvRow[col] = row[col] ?? '';
    }
    return csvRow;
  });
  
  return Papa.unparse(csvData, {
    columns,
    header: true, escapeFormulae: true
  });
}

/**
 * Download CSV file
 */
export function downloadCSV(data: SheetData, filename: string = 'data.csv'): void {
  const csv = exportCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
