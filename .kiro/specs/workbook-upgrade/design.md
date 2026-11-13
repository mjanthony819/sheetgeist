# Workbook Upgrade Design

## New types (`src/lib/workbook.ts`)
```
ComputedColumn { name: string; expr: string }
TableData extends SheetData { computed: ComputedColumn[] }
Workbook { order: string[]; tables: Record<string, TableData> }
```

## Module map
| Module | Responsibility |
|---|---|
| `workbook.ts` | Types, validateWorkbook, serializeWorkbook, parseWorkbookFiles, cloneWorkbook, emptyTable |
| `dataset.ts` | Add `generateMuseumWorkbook()` alongside existing inventory generator |
| `workbookSql.ts` | `runWorkbookQuery`, `summarizeTable`, `checkComputed` via sql.js |
| `workbookMerge.ts` | `mergeWorkbooks`, `resolveWorkbookConflicts` using existing `threeWayMerge` |
| `xlsxio.ts` | `importXlsx`, `exportXlsx` using vendored SheetJS |

## Serialization (`serializeWorkbook`)
- `workbook.json` → `{version:2, order, computed:{tableName:[...]}}`
- `tables/<name>.json` → `{rows, columns}` (identical shape to SheetData)
- Legacy: if `workbook.json` missing but `data.json` present → wrap as single table `'sheet'`

## SQL (`workbookSql.ts`)
- Each table → `CREATE TABLE "name" (...)` with quoted column names
- Computed cols → `GENERATED ALWAYS AS (expr) VIRTUAL`
- Same query-only, single-SELECT, 1 000-row limits as existing `sql.ts`
- In vitest (node) auto-detects missing `import.meta.env.BASE_URL`; loads wasm binary from
  `node_modules/sql.js/dist/sql-wasm.wasm` via `createRequire` + `readFileSync`

## XLSX import
`XLSX.read(buf, {type:'array', cellDates:true})` → manual cell parsing for full type control.
Sheet names slugified to valid table names; hidden sheets skipped; formula cells counted.

## XLSX export
AOA rows with explicit `{t:'s', v}` cell objects for all string values → safe against
formula injection. One sheet per table, then `Provenance` sheet.
