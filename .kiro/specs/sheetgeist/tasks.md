# Sheetgeist Tasks

## Phase 1: Core Infrastructure (Sprint 1)
- [ ] Vite + React + TypeScript scaffold
- [ ] Grid component (row/col rendering, cell editing)
- [ ] CSV import/export with stable row IDs
- [ ] Type preservation (string/number/boolean)
- [ ] Validation rules per column

## Phase 2: Git Integration (Sprint 2)
- [ ] isomorphic-git wrapper with LightningFS
- [ ] Branch operations (create, list, switch, delete)
- [ ] Commit history with diffs
- [ ] Row-level diff rendering

## Phase 3: SQL Console (Sprint 3)
- [ ] sql.js WASM initialization
- [ ] Sanitized SELECT query runner
- [ ] Query history UI
- [ ] Schema introspection

## Phase 4: Merge System (Sprint 4)
- [ ] 3-way merge algorithm
- [ ] Deterministic conflict detection (deletion/edit, ID collisions)
- [ ] Conflict resolution UI (yours/theirs/base)
- [ ] Merge commit

## Phase 5: Polish (Sprint 5)
- [ ] ZIP export of Git history
- [ ] Merge tests (deletion/edit, unrelated, ID collision)
- [ ] Documentation

## Unknown Risks
- isomorphic-git + LightningFS performance with large repos
- sql.js WASM memory limits on large datasets
- IndexedDB quota limits for CSV storage
