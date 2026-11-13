# Sheetgeist Steering

**Project**: Sheetgeist  
**Category**: Kiroween 2026 Frankenstein  
**Status**: Planning  
**Last Updated**: 2026-11-13

## Vision
A local-first spreadsheet that uses real Git for version control and real SQLite for querying—no backend, no cloud sync.

## Non-Goals (Explicit)
- Multi-user collaboration
- Real-time sync
- AI-assisted editing
- Payment/monetization
- Mobile app
- Desktop app

## Success Criteria
- CSV import/export works
- User can create branches, edit, commit, switch branches
- Read-only SQL SELECT queries execute against grid data
- Merge conflict UI handles row-level conflicts deterministically
- Git history exports as ZIP

## Known Unknowns
- Performance of isomorphic-git with 10k+ rows
- sql.js memory limits for large CSVs
- Browser IndexedDB quota behavior

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Grid**: ag-Grid Community or custom (lightweight)
- **Git**: isomorphic-git + LightningFS (IndexedDB)
- **SQL**: sql.js (WASM build)
- **UI**: Custom CSS (charcoal + violet/mint accents)

## AI Usage Plan
- Generated boilerplate and scaffolding
- Documentation writing
- Unknown risk investigation

## Kiro Usage
- Requirements/specs authoring
- Task tracking
- Architecture planning

## Upgrade Round — Kiroween 2026

**Goal**: Multi-table workbook upgrade.

### New capabilities
- Multiple named tables per workbook (1–10), each a full SheetData with optional computed columns.
- Computed columns: SQLite scalar expressions evaluated as VIRTUAL GENERATED columns (NOT Excel formulas).
- Table summaries: count/sum/avg/min/max per numeric column via SQLite.
- XLSX import/export via vendored SheetJS 0.20.3 (Apache-2.0); imported formulas use cached values only.
- Per-table three-way merge reusing existing `threeWayMerge`.
- Provenance sheet in XLSX export.

### Upgrade limits
- Max 10 tables. Per-table limits inherited: 5 000 rows, 50 columns.
- Dropping tables in a merge is an error (not supported).
- No Excel formula evaluation, no Excel compatibility claim.
- No new runtime dependencies (sql.js and xlsx already present).
