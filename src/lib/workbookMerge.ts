import { threeWayMerge, resolveConflicts } from './merge';
import type { RowConflict, SheetRow, SheetData } from './types';
import type { Workbook, TableData, ComputedColumn } from './workbook';
import { cloneWorkbook } from './workbook';

export interface TableConflict {
  table: string;
  conflict: RowConflict;
}

function mergeComputedColumns(
  baseCols: ComputedColumn[],
  oursCols: ComputedColumn[],
  theirsCols: ComputedColumn[],
  tableName: string,
  errors: string[]
): ComputedColumn[] {
  const baseMap = new Map(baseCols.map(c => [c.name, c.expr]));
  const oursMap = new Map(oursCols.map(c => [c.name, c.expr]));
  const theirsMap = new Map(theirsCols.map(c => [c.name, c.expr]));

  const allNames = new Set([
    ...baseCols.map(c => c.name),
    ...oursCols.map(c => c.name),
    ...theirsCols.map(c => c.name),
  ]);

  const result: ComputedColumn[] = [];

  for (const name of allNames) {
    const baseExpr = baseMap.get(name);
    const oursExpr = oursMap.get(name);
    const theirsExpr = theirsMap.get(name);

    if (baseExpr === undefined) {
      // New column: take from whichever side has it (both is fine if same)
      if (oursExpr !== undefined && theirsExpr !== undefined && oursExpr !== theirsExpr) {
        errors.push(
          `Table "${tableName}" computed column "${name}": both sides added with different expr`
        );
        continue;
      }
      const expr = oursExpr ?? theirsExpr!;
      result.push({ name, expr });
    } else {
      // Existed in base
      const oursChanged = oursExpr !== undefined && oursExpr !== baseExpr;
      const theirsChanged = theirsExpr !== undefined && theirsExpr !== baseExpr;
      const oursDeleted = oursExpr === undefined;
      const theirsDeleted = theirsExpr === undefined;

      if (oursDeleted && theirsDeleted) {
        // Both deleted — omit
        continue;
      }
      if (oursDeleted && theirsChanged) {
        errors.push(
          `Table "${tableName}" computed column "${name}": deleted on one side, changed on the other`
        );
        continue;
      }
      if (theirsDeleted && oursChanged) {
        errors.push(
          `Table "${tableName}" computed column "${name}": deleted on one side, changed on the other`
        );
        continue;
      }
      if (oursChanged && theirsChanged && oursExpr !== theirsExpr) {
        errors.push(
          `Table "${tableName}" computed column "${name}": both sides changed expr differently`
        );
        continue;
      }
      // Take the changed value, or base if neither changed
      const expr = oursChanged ? oursExpr! : theirsChanged ? theirsExpr! : baseExpr;
      result.push({ name, expr });
    }
  }

  return result;
}

export function mergeWorkbooks(
  base: Workbook,
  ours: Workbook,
  theirs: Workbook
): { data: Workbook | null; conflicts: TableConflict[]; errors: string[] } {
  const conflicts: TableConflict[] = [];
  const errors: string[] = [];

  const baseTableSet = new Set(base.order);
  const oursTableSet = new Set(ours.order);
  const theirsTableSet = new Set(theirs.order);

  // Check for dropped tables (error — not supported)
  for (const name of base.order) {
    const inOurs = oursTableSet.has(name);
    const inTheirs = theirsTableSet.has(name);
    if (!inOurs || !inTheirs) {
      errors.push(
        `Table "${name}" was removed; dropping tables is not supported in workbook merge`
      );
    }
  }

  // Build result order: base order first, then ours-only additions, then theirs-only
  const resultOrder: string[] = [];
  for (const name of base.order) {
    resultOrder.push(name);
  }
  for (const name of ours.order) {
    if (!baseTableSet.has(name) && !resultOrder.includes(name)) {
      resultOrder.push(name);
    }
  }
  for (const name of theirs.order) {
    if (!baseTableSet.has(name) && !resultOrder.includes(name)) {
      resultOrder.push(name);
    }
  }

  const resultTables: Record<string, TableData> = {};

  for (const name of resultOrder) {
    const inBase = baseTableSet.has(name);
    const inOurs = oursTableSet.has(name);
    const inTheirs = theirsTableSet.has(name);

    if (inBase && (!inOurs || !inTheirs)) {
      // Dropped — error already pushed, skip
      continue;
    }

    if (!inBase && inOurs && !inTheirs) {
      // Added only in ours
      resultTables[name] = ours.tables[name];
      continue;
    }

    if (!inBase && !inOurs && inTheirs) {
      // Added only in theirs
      resultTables[name] = theirs.tables[name];
      continue;
    }

    if (!inBase && inOurs && inTheirs) {
      // Added in both — merge with empty base
      const oursTable = ours.tables[name];
      const theirsTable = theirs.tables[name];
      if (JSON.stringify(oursTable.columns) !== JSON.stringify(theirsTable.columns)) {
        errors.push(
          `Table "${name}": both sides added the table with different columns`
        );
        continue;
      }
      const emptyBase: SheetData = { rows: [], columns: oursTable.columns };
      try {
        const mr = threeWayMerge(emptyBase, oursTable, theirsTable);
        if (!mr.success) {
          for (const c of mr.conflicts) {
            conflicts.push({ table: name, conflict: c });
          }
        } else if (mr.data) {
          const mergedComputed = mergeComputedColumns(
            [],
            oursTable.computed,
            theirsTable.computed,
            name,
            errors
          );
          resultTables[name] = { ...mr.data, computed: mergedComputed };
        }
      } catch (e) {
        errors.push(`Table "${name}": ${e instanceof Error ? e.message : String(e)}`);
      }
      continue;
    }

    // All three have the table
    const baseTable = base.tables[name];
    const oursTable = ours.tables[name];
    const theirsTable = theirs.tables[name];

    // Merge computed columns
    const mergedComputed = mergeComputedColumns(
      baseTable.computed,
      oursTable.computed,
      theirsTable.computed,
      name,
      errors
    );

    // Merge row data
    try {
      const mr = threeWayMerge(baseTable, oursTable, theirsTable);
      if (!mr.success) {
        for (const c of mr.conflicts) {
          conflicts.push({ table: name, conflict: c });
        }
      } else if (mr.data) {
        resultTables[name] = { ...mr.data, computed: mergedComputed };
      }
    } catch (e) {
      errors.push(`Table "${name}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (errors.length > 0 || conflicts.length > 0) {
    return { data: null, conflicts, errors };
  }

  return {
    data: { order: Object.keys(resultTables), tables: resultTables },
    conflicts: [],
    errors: [],
  };
}

export function resolveWorkbookConflicts(
  conflicts: TableConflict[],
  choices: Record<string, Record<string, Record<string, 'ours' | 'theirs'>>>,
  base: Workbook,
  ours: Workbook,
  theirs: Workbook
): Workbook {
  // Group conflicts by table
  const byTable = new Map<string, RowConflict[]>();
  for (const tc of conflicts) {
    const list = byTable.get(tc.table) ?? [];
    list.push(tc.conflict);
    byTable.set(tc.table, list);
  }

  const baseTableSet = new Set(base.order);

  // Build result order
  const allTableNames = new Set([...base.order, ...ours.order, ...theirs.order]);
  const resultOrder: string[] = [];
  for (const name of base.order) resultOrder.push(name);
  for (const name of ours.order) {
    if (!baseTableSet.has(name) && !resultOrder.includes(name)) resultOrder.push(name);
  }
  for (const name of theirs.order) {
    if (!baseTableSet.has(name) && !resultOrder.includes(name)) resultOrder.push(name);
  }
  // Keep only tables that actually exist
  for (const name of allTableNames) {
    if (!resultOrder.includes(name)) resultOrder.push(name);
  }

  const resultTables: Record<string, TableData> = {};

  for (const t of resultOrder) {
    const tableConflicts = byTable.get(t);
    const oursTable = ours.tables[t];
    const theirsTable = theirs.tables[t];
    const baseTable = base.tables[t];

    if (!tableConflicts || tableConflicts.length === 0) {
      // No conflicts — merge normally
      if (baseTable && oursTable && theirsTable) {
        try {
          const mr = threeWayMerge(baseTable, oursTable, theirsTable);
          if (mr.success && mr.data) {
            const ignoreErrors: string[] = [];
            const mergedComputed = mergeComputedColumns(
              baseTable.computed,
              oursTable.computed,
              theirsTable.computed,
              t,
              ignoreErrors
            );
            resultTables[t] = { ...mr.data, computed: mergedComputed };
          } else if (oursTable) {
            resultTables[t] = oursTable;
          }
        } catch {
          if (oursTable) resultTables[t] = oursTable;
          else if (theirsTable) resultTables[t] = theirsTable;
        }
      } else if (oursTable) {
        resultTables[t] = oursTable;
      } else if (theirsTable) {
        resultTables[t] = theirsTable;
      }
    } else {
      // Resolve conflicts for this table
      const tableChoices = choices[t] ?? {};
      const resolutionMap = new Map(
        Object.entries(tableChoices).map(([rowId, fieldChoices]) => [
          rowId,
          new Map(Object.entries(fieldChoices) as [string, 'ours' | 'theirs'][]),
        ])
      );

      const resolvedRows: SheetRow[] = resolveConflicts(tableConflicts, resolutionMap);

      // Build patched ours with resolved rows replacing conflicting ones
      const conflictIds = new Set(tableConflicts.map(c => c.rowId));
      const baseOurs = oursTable ?? theirsTable!;
      const patchedRows = [
        ...baseOurs.rows.filter(r => !conflictIds.has(r.id)),
        ...resolvedRows,
      ];
      const patchedOurs: TableData = { ...cloneWorkbook({ order: [], tables: {} }).tables, ...baseOurs, rows: patchedRows };

      // Re-run merge with patched ours
      if (baseTable && theirsTable) {
        try {
          const mr = threeWayMerge(baseTable, patchedOurs, theirsTable);
          if (mr.success && mr.data) {
            const ignoreErrors: string[] = [];
            const mergedComputed = mergeComputedColumns(
              baseTable.computed,
              patchedOurs.computed,
              theirsTable.computed,
              t,
              ignoreErrors
            );
            resultTables[t] = { ...mr.data, computed: mergedComputed };
          } else {
            resultTables[t] = patchedOurs;
          }
        } catch {
          resultTables[t] = patchedOurs;
        }
      } else {
        resultTables[t] = patchedOurs;
      }
    }
  }

  return { order: Object.keys(resultTables), tables: resultTables };
}
