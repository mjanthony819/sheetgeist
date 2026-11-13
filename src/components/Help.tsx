

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
        <li><strong>Workbook of related tables:</strong> Several tables in one repository. Each table is its own file in Git, so history, branches and merges work per table</li>
        <li><strong>Computed columns:</strong> A column defined by a SQLite expression over the same row, for example <code>quantity * unit_value_usd</code>. These are SQLite expressions, not Excel formulas, and make no Excel-compatibility claim. The definition is versioned; the values are recalculated</li>
        <li><strong>Totals:</strong> Count, sum, average, minimum and maximum for every fully numeric column, computed by SQLite</li>
        <li><strong>Excel files:</strong> Import and export .xlsx with the vendored SheetJS Community Edition 0.20.3 (Apache-2.0). Import reads saved cell values; formulas are not evaluated or kept, and the import report counts them. Export writes one sheet per table plus a Provenance sheet (branch, HEAD commit, whether uncommitted edits are included)</li>
        <li><strong>Cell history:</strong> Click a cell to list the commits on the current branch that changed it, with before and after values</li>
        <li><strong>CSV Import/Export:</strong> CSV import replaces the rows and columns of the table you are viewing; export writes that table</li>
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
        <li>Every table is a SQL table with its own name (for example <code>items</code>, <code>exhibits</code>, <code>loans</code>), so you can JOIN them. Computed columns are queryable. Older single-table repositories open as a table named <code>sheet</code></li>
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
        with the demo museum workbook. This cannot be undone. Always export your 
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
        <li><strong>Excel files:</strong> SheetJS Community Edition 0.20.3 (Apache-2.0), vendored tarball from the SheetJS CDN</li>
      </ul>
      
      <h2>License</h2>
      <p>
        Sheetgeist is open source software released under the MIT License.
      </p>
    </div>
  );
}
