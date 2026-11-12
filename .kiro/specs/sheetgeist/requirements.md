# Sheetgeist Requirements

**Project**: Sheetgeist - Git-backed spreadsheet for local-first data work

## Core Features
- Browser-only spreadsheet with real Git (isomorphic-git + LightningFS IndexedDB)
- Real SQLite queries (sql.js WASM) for read-only SELECT
- CSV import/export, stable unique row IDs
- Validation rules per column
- Type preservation (string/number/boolean)

## Git Workflow
- Branch create/switch/delete
- Commit history with diffs
- Three-way merge with deterministic conflict UI
- Merge CSV snapshots row/field level
- Export Git history as ZIP

## UI/UX
- Simple polished charcoal UI with violet/mint accents
- React + TypeScript + Vite
- No backend, no runtime AI, no API keys, no personal data

## Explicit Exclusions
- No multi-user cloud sync
- No offline-first caching (stretch goal only)
- No backend services

## Merge Test Cases
1. **Deletion/edit conflict**: Row deleted in A, edited in B
2. **Unrelated branch**: Parallel edits on different rows/columns
3. **ID collisions**: Duplicate row IDs on merge
