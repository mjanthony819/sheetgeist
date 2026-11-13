# Workbook Upgrade Requirements

**Round**: Kiroween 2026 upgrade — Frankenstein
**Date**: 2026-11-13

## R1 Multiple tables
A Workbook holds 1–10 named tables. Table names: `/^[a-z][a-z0-9_]{0,39}$/`.
Each table is a `TableData` (extends `SheetData` with a `computed` array). An `order` array
lists table names in display order. Per-table row/column limits inherited from `validateData`
(5 000 rows, 50 columns).

## R2 Computed columns
Each table may declare computed columns: a `name` and a SQLite scalar `expr`. Expressions are
**NOT** Excel formulas; no Excel compatibility is claimed. They are evaluated by SQLite as
`GENERATED ALWAYS AS (expr) VIRTUAL` columns. Forbidden in expressions: the SQL keywords
`SELECT ATTACH PRAGMA LOAD_EXTENSION INSERT UPDATE DELETE DROP CREATE ALTER VACUUM REPLACE`
(case-insensitive word match), plus semicolons `;`, line comments `--`, and block comment
openers `/*`. Max 300 chars.

## R3 Table summaries
`count / sum / avg / min / max` of every numeric column (data or computed) via SQLite.

## R4 XLSX import/export
Uses vendored SheetJS 0.20.3 (Apache-2.0, already installed as `xlsx`). Limits: 2 MB, 10
non-hidden sheets, 5 000 rows and 50 columns per sheet. Imported formulas are **not**
evaluated — cached cell values are imported and a report counts formula cells. Export: one
sheet per table plus a `Provenance` sheet. String cells beginning with `= + - @` are written
as string-type cells (never formulas). Dates become ISO date strings on import.

## R5 Per-table three-way merge
Reuses the existing `threeWayMerge` from `src/lib/merge.ts` for each table. A table added
on only one side is taken verbatim. Dropping a table (present in base, absent in ours or
theirs) is an unsupported operation reported as an error string. Computed column definitions
are three-way merged per name.

## R6 Provenance export
The XLSX export accepts caller-supplied `{label, value}` pairs written to a `Provenance`
sheet for audit / history tagging.

## Honest limits
- Max 10 tables; per-table 5 000 rows / 50 columns.
- Computed expressions are validated syntactically (banned keywords/chars) but not
  semantically before the first SQL execution.
- Dropping tables in a merge is not supported.
- Schema-changing merges remain unsupported (inherited from `threeWayMerge`).
- No browser storage, no network, no Excel formula evaluation.
