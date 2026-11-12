

export function Help() {
  return (
    <div className="help-content">
      <h2>About Sheetgeist</h2>
      <p>
        Sheetgeist is a local-first spreadsheet application that uses real Git for version control 
        and real SQLite for querying, all running entirely in your browser with no backend or cloud sync.
      </p>
      
      <h2>Key Features</h2>
      <ul>
        <li><strong>Real Git:</strong> Uses isomorphic-git to create actual Git commits, branches, and merge commits</li>
        <li><strong>Real SQLite:</strong> Uses sql.js to execute genuine SELECT queries against your data</li>
        <li><strong>Local Storage:</strong> All data is stored in your browser's IndexedDB. Sheet contents are not uploaded by the app; the static host still receives normal page and asset requests</li>
        <li><strong>Three-Way Merge:</strong> Deterministic field-level conflict detection for edit/edit, edit/delete, and add/add scenarios</li>
        <li><strong>CSV Import/Export:</strong> Bring your own data or export anytime</li>
      </ul>
      
      <h2>Git Workflow</h2>
      <ul>
        <li><strong>Branches:</strong> Create branches to work on different versions of your data</li>
        <li><strong>Commits:</strong> Save snapshots of your data with descriptive messages</li>
        <li><strong>Merge:</strong> Combine changes from different branches (may require conflict resolution)</li>
        <li><strong>History:</strong> View past commits as read-only snapshots</li>
        <li><strong>Dirty State:</strong> You cannot switch branches or merge when you have uncommitted changes</li>
      </ul>
      
      <h2>SQL Queries</h2>
      <ul>
        <li>Only <code>SELECT</code> queries are allowed for safety</li>
        <li>Your data is available in the <code>sheet</code> table</li>
        <li>All write operations (INSERT, UPDATE, DELETE, etc.) are blocked</li>
        <li>Use Ctrl/Cmd + Enter to execute queries quickly</li>
      </ul>
      
      <h2>Browser Storage Limitations</h2>
      <ul>
        <li><strong>Persistence:</strong> Data is stored in IndexedDB, which can be cleared by the browser</li>
        <li><strong>Quota:</strong> Storage quotas vary by browser and device; private browsing may discard data when closed</li>
        <li><strong>No Cloud Sync:</strong> Your data stays on this device only</li>
        <li><strong>Backup:</strong> Export your Git repository or CSV regularly to avoid data loss</li>
      </ul>
      
      <h2>Practical limits</h2><p>Prototype for small datasets: 5,000 rows, 50 fields, 2 MB CSV input and 1,000 SQL result rows. Query execution runs on the main thread; complex queries may freeze the page. Only a single SELECT is supported, with a conservative semicolon check. Schema-changing merges are rejected. This is not a full Excel replacement or multi-user collaboration service. Uncommitted edits are in memory until you commit.</p><h2>Dataset Reset</h2>
      <p>
        The "Reset demo repository" button will permanently delete all local data and reinitialize 
        with the demo haunted museum inventory. This cannot be undone. Always export your 
        repository first if you want to keep your work.
      </p>
      
      <h2>AI Assistance Disclosure</h2>
      <p>
        This application was built with AI assistance, including genuine Kiro CLI specs and implementation. Git and SQL use established open-source libraries; field-level merge is application code with regression tests. 
        No AI features are included in the application itself. Data operations are deterministic 
        and fully local.
      </p>
      
      <h2>Tech Stack</h2>
      <ul>
        <li><strong>Frontend:</strong> React 18, TypeScript, Vite</li>
        <li><strong>Git:</strong> isomorphic-git, @isomorphic-git/lightning-fs</li>
        <li><strong>SQL:</strong> sql.js (SQLite compiled to WebAssembly)</li>
        <li><strong>CSV:</strong> PapaParse</li>
        <li><strong>Archive:</strong> JSZip</li>
      </ul>
      
      <h2>License</h2>
      <p>
        Sheetgeist is open source software released under the MIT License.
      </p>
    </div>
  );
}
