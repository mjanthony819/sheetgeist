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
