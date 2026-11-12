
import type { SheetData, SheetRow } from '../lib/types';

interface Props {
  data: SheetData;
  onChange: (data: SheetData) => void;
  readOnly?: boolean;
}

export function SpreadsheetGrid({ data, onChange, readOnly = false }: Props) {

  
  const handleCellChange = (rowId: string, column: string, value: string) => {
    const newRows = data.rows.map(row => {
      if (row.id === rowId) {
        return { ...row, [column]: typeof row[column] === 'number' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : typeof row[column] === 'boolean' && /^(true|false)$/.test(value) ? value === 'true' : value };
      }
      return row;
    });
    
    onChange({ ...data, rows: newRows });
  };
  
  const handleAddRow = () => {
    const newRow: SheetRow = {
      id: crypto.randomUUID(),
      ...Object.fromEntries(data.columns.map(col => [col, null]))
    };
    
    onChange({
      ...data,
      rows: [...data.rows, newRow]
    });
  };
  
  const handleDeleteRow = (rowId: string) => {
    onChange({
      ...data,
      rows: data.rows.filter(row => row.id !== rowId)
    });
  };
  
  if (data.rows.length === 0) {
    return (
      <div className="grid-container">
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          No data. {!readOnly && <button className="btn btn-primary" onClick={handleAddRow}>Add First Row</button>}
        </div>
      </div>
    );
  }
  
  return (
    <div className="grid-container">
      <div className="spreadsheet">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              {data.columns.map(col => (
                <th key={col}>{col}</th>
              ))}
              {!readOnly && <th style={{ width: '60px' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.rows.map(row => (
              <tr key={row.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {row.id}
                </td>
                {data.columns.map(col => (
                  <td key={`${row.id}-${col}`}>
                    {readOnly ? (
                      <span>{String(row[col] ?? '')}</span>
                    ) : (
                      <input
                        type="text"
                        value={String(row[col] ?? '')}
                        onChange={(e) => handleCellChange(row.id, col, e.target.value)}
                        aria-label={`${row.id} ${col}`}
                      />
                    )}
                  </td>
                ))}
                {!readOnly && (
                  <td>
                    <button
                      className="btn btn-icon"
                      onClick={() => handleDeleteRow(row.id)}
                      title="Delete row"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div style={{ marginTop: '12px' }}>
          <button className="btn btn-secondary" onClick={handleAddRow}>
            + Add Row
          </button>
        </div>
      )}
    </div>
  );
}
