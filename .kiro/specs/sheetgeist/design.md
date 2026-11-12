# Sheetgeist Design

## Architecture
```
React Components
  └── Spreadsheet (ag-grid or custom grid)
  └── Git Explorer (branches, commits, diff)
  └── SQL Console (read-only SELECT)
  └── Merge Conflict UI (deterministic 3-way)
```

## Data Layers
- **Grid Layer**: CSV-in-memory → React state
- **Git Layer**: isomorphic-git + LightningFS (IndexedDB)
- **SQL Layer**: sql.js (WASM) with sanitized queries

## Core Patterns
- Single source of truth: Git repository state
- Row IDs: UUID v4, preserved through operations
- Validation: Schema definition + runtime checks
- SQL: Only SELECT, no DROP/DELETE/ALTER

## Conflict Resolution (3-way)
- Base version: LCA (lowest common ancestor)
- Yours: Current branch
- Theirs: Merging branch
- Deterministic: By row ID then column name

## File Structure
- `src/` - React app
  - `components/` - UI components
  - `lib/git.ts` - Git wrapper (isomorphic-git)
  - `lib/db.ts` - SQL wrapper (sql.js)
  - `lib/types.ts` - Shared types
- `public/` - Static assets

## UI Color Palette
- Background: `#1a1a1a` (charcoal)
- Accent Violet: `#7c3aed`
- Accent Mint: `#10b981`
- Text: `#e5e7eb`
