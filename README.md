# Sheetgeist

A local-first spreadsheet workbench that stitches real Git, SQLite and an editable grid together. A workbook holds several related tables with computed columns, per-cell history, joins, and .xlsx import/export. Make an experiment on a branch, query its data, then merge changes field by field without losing the history.

Built for Kiroween 2026, Frankenstein category. Synthetic museum inventory is a demonstration fixture, not real customer data.

## Live release

- App: https://mjanthony819.github.io/sheetgeist/
- Narrated, captioned demo (2:09): https://youtu.be/pqz4zhF7YZo
- Source: https://github.com/mjanthony819/sheetgeist

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
5. Open History to inspect the changed rows and typed before/after field values against a commit's first parent. Restore a prior snapshot as a new commit without deleting history. Dirty edits and no-op restores are blocked.
6. Query `SELECT name, quantity, location FROM sheet ORDER BY quantity DESC LIMIT 10`.
7. Export the Git repository, unzip it, and inspect `git log --all --graph` and `git fsck --full` using regular Git.

## Architecture

- React + TypeScript render an editable grid and branch/history/merge workbench.
- isomorphic-git writes real objects, refs, index and commits to LightningFS in IndexedDB.
- Workbooks are stored in Git as `workbook.json` (table list, computed-column definitions) plus one `tables/<name>.json` per table. Older single-table repos (`data.json`) still open, as a table named `sheet`, with history intact. Snapshots keep scalar types and multiline strings. Older note: the original single-table format used canonical `data.json` files, preserving scalar types and multiline strings. CSV is an import/export boundary, not the storage format.
- Three-way merge uses the shared Git ancestor, matches rows by stable text IDs, and resolves conflicting fields explicitly. Successful merges create actual two-parent commits.
- History computes typed row/field diffs, labels schema changes and first-parent merge comparisons, and supports a confirmed full-snapshot restore as a new commit rather than a hard reset.
- sql.js executes SELECT queries against temporary in-memory SQLite tables, one per workbook table, so joins work. Columns are declared without type affinity so numbers compare and sort as numbers.
- Computed columns are SQLite expressions (for example `quantity * unit_value_usd`) evaluated in sql.js. They are stored as definitions, not values. This is not a spreadsheet formula engine; there is no A1 notation, no recalculation graph and no Excel compatibility claim.
- Cell history walks first-parent commits for one cell (table, row id, field) and lists each change.
- Merge is per table; conflicts name the table, row and field, and independent edits are kept.
- .xlsx import and export use SheetJS 0.20.3 (Apache-2.0), vendored from https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz (sha256 8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8) in `vendor/`, because the npm registry copy is stale.
- The import never evaluates formulas. For formula cells only the cached value saved in the file is imported, and the import report says so and counts formula cells with no cached value (imported as empty). Export writes computed columns as values and adds a Provenance sheet; on re-import the Provenance sheet and "(computed)" columns are skipped with a warning. A column named `id` that cannot be used as the row id is kept as `id_original`. Renamed sheets are reported. Queries do not modify Git snapshots.
- Export downloads a ZIP containing the real `.git` repository and canonical data, not a mock history array.

## Limits and tradeoffs

Small-data prototype: at most 5,000 rows, 50 fields, 2 MB CSV input and 1,000 query result rows. Storage is browser-local, not permanent or synchronized. Clearing site data, private browsing or browser eviction can remove the repository. Export backups regularly. Uncommitted edits remain in memory until committed. CSV import infers basic numbers and booleans; CSV itself cannot preserve a full schema, and exported formula-looking values are escaped for spreadsheet safety.

Only one SELECT statement is accepted. Semicolons inside SQL strings are conservatively rejected. Query-only mode is enabled in SQLite after loading the dataset. Queries run on the main thread; expensive SQL can freeze the page. This is not a hardened environment for untrusted SQL or a high-volume analytical database.

Schema-changing merges and unrelated histories are rejected. The diff UI displays up to 200 changed rows; export for full inspection. Restore checks the previewed branch/tip but does not provide cross-tab locking or crash-atomic writes. Avoid concurrent writes in several tabs. There is no remote Git sync, account system, collaborative editing or spreadsheet formula engine. .xlsx import reads values only (no formulas, styles, charts, macros or merged-cell layout), is capped at 2 MB, and checks the file's zip signature. SheetJS parsing of untrusted files is not hardened by this project; no security claim is made. The static host receives ordinary page/asset requests; sheet contents are not uploaded by this app.

## Verification

105 unit/regression tests (34 from the first release plus 71 for the workbook upgrade) cover workbook storage, joins, computed columns, per-table merge, xlsx round trips and import warnings, as well as merge scenarios, typed diffs, restore planning and input validation. Browser checks against the deployed release exercised edits, commits, branch isolation, conflicting merges, preservation of an independent field edit, actual SQLite results, write rejection, reload persistence and Git export, plus typed diffs, restore preview/cancel/new-commit semantics and phone record editing. The exported repository was inspected with regular `git fsck` and `git log`, including its two-parent merge. A 25-check Playwright suite (`tests-e2e/ui.py`) and a legacy-migration check (`tests-e2e/legacy.py`) exercise the workbook in a real browser at desktop and 390px widths. These checks are prototype evidence, not a claim of production reliability or a formal security audit.

## Kiro and AI assistance

This project was created during the Kiroween submission window with AI assistance under M J Anthony's direction. Kiro CLI authored the initial requirements, design, tasks and steering files in the root `.kiro` directory, then implemented merge/tests, Git and SQLite layers, CSV/archive code and UI components. Subsequent AI-assisted integration and independent testing fixed concrete defects and completed the application. The workbook upgrade (13 November 2026) was also started with Kiro CLI, which wrote its spec and the first versions of the workbook, SQL, merge and xlsx modules and some tests before the Kiro service throttled it twice. The remainder, plus bug fixes found by tests, was done outside Kiro. Exact split in [KIRO_USAGE.md](KIRO_USAGE.md). There are no runtime AI features, and the project does not claim Anthony hand-wrote all generated code.

## License

MIT. Dependencies retain their own licenses.

The bundled Inter variable font is by the Inter Project authors, under the SIL Open Font License (public/fonts/OFL.txt).
