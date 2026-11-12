# Sheetgeist

A local-first spreadsheet workbench that stitches real Git, SQLite and an editable grid together. Make an experiment on a branch, query its data, then merge changes field by field without losing the history.

Built for Kiroween 2026, Frankenstein category. Synthetic museum inventory is a demonstration fixture, not real customer data.

## Run

Node.js 22 or later recommended.

```sh
npm ci
npm run dev
npm test -- --run
npm run build
npm run preview
```

No API key, backend, paid subscription or account is needed to use the app. The SQLite WASM asset is bundled locally. The first page load still needs the static host; offline caching is not implemented.

## Try it

1. Change a quantity and commit a snapshot with a meaningful message.
2. Create a branch named `exhibition` and change the quantity plus a location. Commit.
3. Switch to `main`, change the same quantity to a different value, and commit.
4. Preview merging `exhibition` into `main`. Choose a quantity. The independent location change is retained.
5. Query `SELECT name, quantity, location FROM sheet ORDER BY quantity DESC LIMIT 10`.
6. Export the Git repository, unzip it, and inspect `git log --all --graph` and `git fsck --full` using regular Git.

## Architecture

- React + TypeScript render an editable grid and branch/history/merge workbench.
- isomorphic-git writes real objects, refs, index and commits to LightningFS in IndexedDB.
- Git snapshots are canonical `data.json` files, preserving scalar types and multiline strings. CSV is an import/export boundary, not the storage format.
- Three-way merge uses the shared Git ancestor, matches rows by stable text IDs, and resolves conflicting fields explicitly. Successful merges create actual two-parent commits.
- sql.js executes SELECT queries against a temporary in-memory SQLite table. Queries do not modify Git snapshots.
- Export downloads a ZIP containing the real `.git` repository and canonical data, not a mock history array.

## Limits and tradeoffs

Small-data prototype: at most 5,000 rows, 50 fields, 2 MB CSV input and 1,000 query result rows. Storage is browser-local, not permanent or synchronized. Clearing site data, private browsing or browser eviction can remove the repository. Export backups regularly. Uncommitted edits remain in memory until committed. CSV import infers basic numbers and booleans; CSV itself cannot preserve a full schema, and exported formula-looking values are escaped for spreadsheet safety.

Only one SELECT statement is accepted. Semicolons inside SQL strings are conservatively rejected. Query-only mode is enabled in SQLite after loading the dataset. Queries run on the main thread; expensive SQL can freeze the page. This is not a hardened environment for untrusted SQL or a high-volume analytical database.

Schema-changing merges and unrelated histories are rejected. There is no remote Git sync, account system, collaborative editing, spreadsheet formulas or Excel-format import. The static host receives ordinary page/asset requests; sheet contents are not uploaded by this app.

## Verification

21 unit/regression tests cover merge scenarios and input validation. A separate browser check exercised edits, commits, branch isolation, conflicting merges, preservation of an independent field edit, actual SQLite results, write rejection, reload persistence and Git export. The exported repository was inspected with regular `git fsck` and `git log`, including its two-parent merge. These checks are prototype evidence, not a claim of production reliability or a formal security audit.

## Kiro and AI assistance

This project was created during the Kiroween submission window with AI assistance under M J Anthony's direction. Kiro CLI authored the initial requirements, design, tasks and steering files in the root `.kiro` directory, then implemented merge/tests, Git and SQLite layers, CSV/archive code and UI components. Subsequent AI-assisted integration and independent testing fixed concrete defects and completed the application. See [KIRO_USAGE.md](KIRO_USAGE.md). There are no runtime AI features, and the project does not claim Anthony hand-wrote all generated code.

## License

MIT. Dependencies retain their own licenses.
