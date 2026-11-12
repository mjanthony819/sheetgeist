import { validateData } from './validate';
import type { SheetData, SheetRow, RowConflict, MergeResult, FieldConflict } from './types';

/**
 * Pure three-way merge algorithm for spreadsheet rows.
 * Handles edit/edit, edit/delete, and add/add conflicts deterministically.
 * 
 * @param base - Common ancestor state
 * @param ours - Current branch state
 * @param theirs - Branch to merge in
 * @returns MergeResult with merged data or conflicts
 */
export function threeWayMerge(base: SheetData, ours: SheetData, theirs: SheetData): MergeResult {
  validateData(base); validateData(ours); validateData(theirs);
  if (JSON.stringify(base.columns) !== JSON.stringify(ours.columns) || JSON.stringify(base.columns) !== JSON.stringify(theirs.columns)) throw new Error('Schema-changing merges are not supported. Match columns before merging.');
  const conflicts: RowConflict[] = [];
  const mergedRows: SheetRow[] = [];
  const allColumns = new Set<string>([...base.columns, ...ours.columns, ...theirs.columns]);
  
  // Index rows by ID for O(1) lookup
  const baseMap = new Map(base.rows.map(r => [r.id, r]));
  const oursMap = new Map(ours.rows.map(r => [r.id, r]));
  const theirsMap = new Map(theirs.rows.map(r => [r.id, r]));
  
  // Get all unique row IDs across all versions
  const allRowIds = new Set([
    ...base.rows.map(r => r.id),
    ...ours.rows.map(r => r.id),
    ...theirs.rows.map(r => r.id)
  ]);
  
  for (const rowId of allRowIds) {
    const baseRow = baseMap.get(rowId);
    const oursRow = oursMap.get(rowId);
    const theirsRow = theirsMap.get(rowId);
    
    const result = mergeRow(rowId, baseRow, oursRow, theirsRow, Array.from(allColumns));
    
    if (result.conflict) {
      conflicts.push(result.conflict);
    } else if (result.row) {
      mergedRows.push(result.row);
    }
  }
  
  if (conflicts.length > 0) {
    return {
      success: false,
      data: null,
      conflicts
    };
  }
  
  return {
    success: true,
    data: {
      rows: mergedRows,
      columns: Array.from(allColumns).filter(c => c !== 'id')
    },
    conflicts: []
  };
}

interface RowMergeResult {
  row?: SheetRow;
  conflict?: RowConflict;
}

function mergeRow(
  rowId: string,
  baseRow: SheetRow | undefined,
  oursRow: SheetRow | undefined,
  theirsRow: SheetRow | undefined,
  allColumns: string[]
): RowMergeResult {
  // Case 1: Row unchanged (present in all three or absent in all three)
  if (rowsEqual(baseRow, oursRow) && rowsEqual(baseRow, theirsRow)) {
    return { row: oursRow || theirsRow };
  }
  
  // Case 2: Row only in ours (added by us)
  if (!baseRow && oursRow && !theirsRow) {
    return { row: oursRow };
  }
  
  // Case 3: Row only in theirs (added by them)
  if (!baseRow && !oursRow && theirsRow) {
    return { row: theirsRow };
  }
  
  // Case 4: Add/add conflict - same ID added in both branches
  if (!baseRow && oursRow && theirsRow) {
    if (rowsEqual(oursRow, theirsRow)) {
      return { row: oursRow }; // Same content, no conflict
    }
    const fieldConflicts = findFieldConflicts(undefined, oursRow, theirsRow, allColumns);
    return {
      conflict: {
        rowId,
        type: 'add-add',
        conflicts: fieldConflicts,
        oursRow,
        theirsRow,
        baseRow: undefined
      }
    };
  }
  
  // Case 5: Row deleted by us
  if (baseRow && !oursRow && theirsRow) {
    if (rowsEqual(baseRow, theirsRow)) {
      // They didn't change it, deletion wins
      return {};
    } else {
      // Edit/delete conflict
      return {
        conflict: {
          rowId,
          type: 'edit-delete',
          conflicts: [],
          oursRow: undefined,
          theirsRow,
          baseRow
        }
      };
    }
  }
  
  // Case 6: Row deleted by them
  if (baseRow && oursRow && !theirsRow) {
    if (rowsEqual(baseRow, oursRow)) {
      // We didn't change it, deletion wins
      return {};
    } else {
      // Edit/delete conflict
      return {
        conflict: {
          rowId,
          type: 'edit-delete',
          conflicts: [],
          oursRow,
          theirsRow: undefined,
          baseRow
        }
      };
    }
  }
  
  // Case 7: Row present in all three - check for edit/edit conflicts
  if (baseRow && oursRow && theirsRow) {
    const mergedRow: SheetRow = { id: rowId };
    const fieldConflicts: FieldConflict[] = [];
    
    for (const field of allColumns) {
      if (field === 'id') continue;
      
      const baseValue = baseRow[field] ?? null;
      const oursValue = oursRow[field] ?? null;
      const theirsValue = theirsRow[field] ?? null;
      
      // No changes to this field
      if (valuesEqual(baseValue, oursValue) && valuesEqual(baseValue, theirsValue)) {
        mergedRow[field] = oursValue;
        continue;
      }
      
      // We changed, they didn't
      if (!valuesEqual(baseValue, oursValue) && valuesEqual(baseValue, theirsValue)) {
        mergedRow[field] = oursValue;
        continue;
      }
      
      // They changed, we didn't
      if (valuesEqual(baseValue, oursValue) && !valuesEqual(baseValue, theirsValue)) {
        mergedRow[field] = theirsValue;
        continue;
      }
      
      // Both changed to the same value
      if (valuesEqual(oursValue, theirsValue)) {
        mergedRow[field] = oursValue;
        continue;
      }
      
      // Edit/edit conflict - both changed to different values
      fieldConflicts.push({
        field,
        baseValue,
        oursValue,
        theirsValue
      });
    }
    
    if (fieldConflicts.length > 0) {
      return {
        conflict: {
          rowId,
          type: 'edit-edit',
          conflicts: fieldConflicts,
          oursRow,
          theirsRow,
          baseRow
        }
      };
    }
    
    return { row: mergedRow };
  }
  
  // Shouldn't reach here
  return {};
}

function findFieldConflicts(
  baseRow: SheetRow | undefined,
  oursRow: SheetRow,
  theirsRow: SheetRow,
  allColumns: string[]
): FieldConflict[] {
  const conflicts: FieldConflict[] = [];
  
  for (const field of allColumns) {
    if (field === 'id') continue;
    
    const baseValue = baseRow ? (baseRow[field] ?? null) : null;
    const oursValue = oursRow[field] ?? null;
    const theirsValue = theirsRow[field] ?? null;
    
    if (!valuesEqual(oursValue, theirsValue)) {
      conflicts.push({
        field,
        baseValue,
        oursValue,
        theirsValue
      });
    }
  }
  
  return conflicts;
}

function rowsEqual(a: SheetRow | undefined, b: SheetRow | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  
  if (keysA.length !== keysB.length) return false;
  if (keysA.join(',') !== keysB.join(',')) return false;
  
  for (const key of keysA) {
    if (!valuesEqual(a[key], b[key])) return false;
  }
  
  return true;
}

function valuesEqual(a: string | number | boolean | null, b: string | number | boolean | null): boolean {
  return a === b;
}

/**
 * Resolve conflicts by choosing one side for each conflicting field.
 * 
 * @param conflicts - Array of row conflicts
 * @param resolutions - Map of rowId -> field -> 'ours' | 'theirs'
 * @returns Resolved rows
 */
export function resolveConflicts(
  conflicts: RowConflict[],
  resolutions: Map<string, Map<string, 'ours' | 'theirs'>>
): SheetRow[] {
  const resolvedRows: SheetRow[] = [];
  
  for (const conflict of conflicts) {
    const resolution = resolutions.get(conflict.rowId);
    if (!resolution) throw new Error('Resolve every conflict before merging');
    
    if (conflict.type === 'edit-delete') {
      // For edit-delete, choose to keep or delete the entire row
      const keepRow = resolution.get('_row');
      if (!keepRow) throw new Error('Choose which row version to keep');
      if (keepRow === 'ours' && conflict.oursRow) {
        resolvedRows.push(conflict.oursRow);
      } else if (keepRow === 'theirs' && conflict.theirsRow) {
        resolvedRows.push(conflict.theirsRow);
      }
      // If neither, row is deleted
    } else {
      // For edit-edit and add-add, resolve field by field
      const row: SheetRow = { id: conflict.rowId };
      
      if (conflict.type === 'add-add' || conflict.type === 'edit-edit') {
        const oursRow = conflict.oursRow!;
        const theirsRow = conflict.theirsRow!;
        
        // Get all fields from both versions
        const allFields = new Set([
          ...Object.keys(oursRow),
          ...Object.keys(theirsRow)
        ]);
        
        for (const field of allFields) {
          if (field === 'id') continue;
          
          const isConflict = conflict.conflicts.some(c => c.field === field);
          const choice = resolution.get(field);
          if (isConflict && !choice) throw new Error('Resolve every conflicting field');
          if (choice === 'ours') {
            row[field] = oursRow[field];
          } else if (choice === 'theirs') {
            row[field] = theirsRow[field];
          } else {
            const base = conflict.baseRow?.[field] ?? null;
            const ours = oursRow[field] ?? null;
            const theirs = theirsRow[field] ?? null;
            row[field] = ours === base ? theirs : ours;
          }
        }
      }
      
      resolvedRows.push(row);
    }
  }
  
  return resolvedRows;
}
