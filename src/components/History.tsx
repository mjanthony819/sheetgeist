import { useState, useEffect } from 'react';
import { getCommitLog, readCommitData } from '../lib/git';
import type { CommitInfo } from '../lib/types';
import type { SheetData } from '../lib/types';
import { SpreadsheetGrid } from './SpreadsheetGrid';

export function History() {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [commitData, setCommitData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadHistory();
  }, []);
  
  const loadHistory = async () => {
    try {
      const log = await getCommitLog(50);
      setCommits(log);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelectCommit = async (commit: CommitInfo) => {
    setSelectedCommit(commit);
    try {
      const data = await readCommitData(commit.oid);
      setCommitData(data);
    } catch (error) {
      console.error('Failed to read commit data:', error);
    }
  };
  
  if (loading) {
    return <div style={{ padding: '20px' }}>Loading history...</div>;
  }
  
  if (commits.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        No commits yet. Make your first commit to see history.
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: '300px', borderRight: '1px solid var(--color-border)', overflow: 'auto' }}>
        <div className="history-list">
          {commits.map(commit => (
            <button
              key={commit.oid}
              className={`commit-card ${selectedCommit?.oid === commit.oid ? 'active' : ''}`}
              onClick={() => handleSelectCommit(commit)}
            >
              <div className="commit-message">{commit.message}</div>
              <div className="commit-meta">
                <div>{commit.author}</div>
                <div>{new Date(commit.timestamp).toLocaleString()}</div>
                <div className="commit-oid">{commit.oid.slice(0, 7)}</div>
                {commit.parents.length > 1 && (
                  <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-accent)' }}>
                    Merge commit
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
      
      <div style={{ flex: 1, overflow: 'auto' }}>
        {selectedCommit && commitData ? (
          <div>
            <div style={{ padding: '16px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                {selectedCommit.message}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                <div>Commit {selectedCommit.oid.slice(0, 7)}</div>
                <div>{selectedCommit.author} · {new Date(selectedCommit.timestamp).toLocaleString()}</div>
              </div>
              <div style={{ marginTop: '12px', padding: '8px', background: 'var(--color-canvas)', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                ℹ️ This is a read-only view of historical data
              </div>
            </div>
            <SpreadsheetGrid data={commitData} onChange={() => {}} readOnly />
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Select a commit to view its data
          </div>
        )}
      </div>
    </div>
  );
}
