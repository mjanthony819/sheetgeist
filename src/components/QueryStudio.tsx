import React, { useState } from 'react';
import { executeQuery, type QueryResult } from '../lib/sql';
import type { SheetData } from '../lib/types';

interface Props {
  data: SheetData;
}

export function QueryStudio({ data }: Props) {
  const [query, setQuery] = useState('SELECT * FROM sheet LIMIT 10');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  
  const handleExecute = async () => {
    setLoading(true);
    const res = await executeQuery(data, query);
    setResult(res);
    setLoading(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };
  
  return (
    <div className="query-studio">
      <div className="query-editor">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label htmlFor="sql-query" className="form-label">SQL Query (SELECT only)</label>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Ctrl/Cmd + Enter to execute
          </span>
        </div>
        <textarea id="sql-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="SELECT * FROM sheet WHERE status = 'active'"
        />
        <button
          className="btn btn-primary"
          onClick={handleExecute}
          disabled={loading || !query.trim()}
        >
          {loading ? 'Executing...' : 'Execute Query'}
        </button>
      </div>
      
      {result && (
        <div className="query-result">
          {result.success ? (
            <>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                {result.values.length} row{result.values.length !== 1 ? 's' : ''} returned
              </div>
              <div className="result-table-container">
                <table className="result-table">
                  <thead>
                    <tr>
                      {result.columns.map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.values.map((row, idx) => (
                      <tr key={idx}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx}>{cell === null ? <span style={{ color: 'var(--color-text-muted)' }}>NULL</span> : String(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="error-box">
              <strong>Error:</strong> {result.error}
            </div>
          )}
        </div>
      )}
      
      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 'auto' }}>
        <p><strong>Available table:</strong> sheet</p>
        <p><strong>Columns:</strong> id, {data.columns.join(', ')}</p>
        <p><strong>Note:</strong> Only SELECT queries are permitted. Write operations are disabled for safety.</p>
      </div>
    </div>
  );
}
