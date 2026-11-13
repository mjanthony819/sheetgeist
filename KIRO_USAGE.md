# Actual Kiro usage

Created 13 November 2026 during the Kiroween submission period.

1. Kiro CLI generated initial requirements, design and task files in `.kiro/specs/sheetgeist` and product steering in `.kiro/steering/product.md`.
2. Kiro's implementation run created the TypeScript data model, pure three-way merge algorithm and 14 initial merge tests, isomorphic-git/LightningFS repository layer, sql.js query layer, PapaParse CSV boundary, JSZip export, synthetic fixture and UI components/styles.
3. Kiro read the updated UI steering and used the owner's blue/pink light-mode direction. The project retained all root `.kiro` files, which are not ignored.
4. A service throttle stopped that implementation before the main application entry was complete. Later AI-assisted integration wired the application and reviewed the actual code rather than claiming Kiro completed everything.
5. Review found and fixed a conflict-resolution bug that discarded an independent change, CSV snapshot type/multiline loss, a remote WASM dependency, browser Buffer requirements and delayed IndexedDB persistence. Seven additional regression tests and browser end-to-end checks were added.

## Spec-driven work versus ad hoc implementation

The spec made three constraints explicit before implementation: real Git rather than a snapshot imitation, local SQLite rather than a simulated query parser, and conflict-safe merging rather than last-write-wins. It also set honest non-goals: no cloud collaboration or runtime AI. Review enforced these constraints by inspecting the exported Git repository with standard Git and querying merged values through SQLite.

## Features actually used

Kiro CLI, project steering and spec/task files were used. No custom agents, hooks, MCP integrations, Crew workflows or property-based testing were used. Unit and browser regression tests are not described as property-based tests. No fabricated logs, screenshots or Kiro feature claims are included.

Later user-directed expansion: a new workbench visual design with mobile record editing, typed commit differences and full-snapshot restoration as a new commit were implemented and independently tested after the Kiro build. These additions are not attributed to the earlier Kiro run.

## Workbook upgrade (13 November 2026)

Account: Kiro Free plan (no upgrade, trial or card). The usage page showed 6.43 of 50 credits before the upgrade and 12.32 of 50 after the first run; after both Kiro runs it showed 17.4 of 50 (checked 13 November 2026, 4:34 PM IST). Credits reset 12/01.

What Kiro CLI actually wrote (two runs, model "auto"):
- Run 1: `.kiro/specs/workbook-upgrade/{requirements,design,tasks}.md`, an addition to `.kiro/steering/product.md`, and first versions of `src/lib/workbook.ts`, `workbookSql.ts`, `workbookMerge.ts`, `xlsxio.ts` and the museum workbook fixture in `dataset.ts`. The service then replied "The request was throttled by the service" before tests were written.
- Run 2: `testSql.ts`, `workbook.test.ts`, `workbookSql.test.ts`, `workbookMerge.test.ts`, and a zip-signature check in `xlsxio.ts`. It was throttled again mid-run. I did not retry or work around the throttle.

What was done outside Kiro (by the AI-assisted integration pass under M J Anthony's direction):
- Vendoring and checking SheetJS 0.20.3; Git storage for workbooks (`gitWorkbook.ts`) and legacy `data.json` migration; the full UI rewrite (App, History, SheetView, CellHistory, QueryStudio, grid, Help, CSS).
- Bug fixes found by tests: Kiro's SQL tables used TEXT column affinity, so comparisons, ORDER BY and MIN/MAX on numbers were lexicographic (fixed, regression test added); a Node-only import broke the browser bundle (fixed with an injected loader); one wrong test expectation corrected against an independent calculation.
- Import hardening (formula non-evaluation reporting, Provenance and computed-column skipping, `id_original`, sheet-rename warnings, size check), `xlsxio.test.ts`, and the Playwright browser suites.

Not used: custom agents, hooks, MCP, Crew, property-based tests. Tests are ordinary example-based tests.
