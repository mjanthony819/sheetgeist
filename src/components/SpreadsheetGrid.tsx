
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
      <div className="grid-hint"><span className="desktop-hint">{readOnly ? 'Historical snapshot · read only' : 'Click a cell to edit · commit to save'}</span><span className="phone-hint">{readOnly ? 'Historical snapshot · read only' : 'Tap a record to edit · commit to save'}</span><span>Scroll to explore all fields →</span></div><div className={`spreadsheet ${readOnly ? '' : 'editable-desktop'}`}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              {data.columns.map(col => (
                <th key={col}>{col.replace(/_/g,' ')}</th>
              ))}
              {!readOnly && <th style={{ width: '60px' }}></th>}
            </tr>
          </thead>
          <tbody>
            {data.rows.map(row => (
              <tr key={row.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {row.id}
                </td>
                {data.columns.map(col => (
                  <td key={`${row.id}-${col}`} data-column={col} data-value={String(row[col] ?? '')}>
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
                      title="Delete row" aria-label={`Delete ${row.id}`}
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
      {!readOnly && <div className="mobile-records">{data.rows.map(row=><details className="record-card" key={row.id}><summary><span>{String(row.name ?? row.id)}<small>{row.id}</small></span>{row.quantity !== undefined && <span className="record-quantity">{String(row.quantity)} units</span>}<span className="record-chevron">+</span></summary><div className="record-fields">{data.columns.map(col=><label key={col}>{col.replace(/_/g,' ')}<input value={String(row[col] ?? '')} aria-label={`mobile ${row.id} ${col}`} onChange={e=>handleCellChange(row.id,col,e.target.value)}/></label>)}</div><button className="record-delete" aria-label={`mobile Delete ${row.id}`} onClick={()=>handleDeleteRow(row.id)}>Delete record</button></details>)}</div>}
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
