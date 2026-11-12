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
