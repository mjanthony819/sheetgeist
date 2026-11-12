export interface SheetRow {
  id: string; // Stable row ID
  [key: string]: string | number | boolean | null;
}

export interface SheetData {
  rows: SheetRow[];
  columns: string[];
}

export type ConflictType = 'edit-edit' | 'edit-delete' | 'add-add';

export interface FieldConflict {
  field: string;
  baseValue: string | number | boolean | null;
  oursValue: string | number | boolean | null;
  theirsValue: string | number | boolean | null;
}

export interface RowConflict {
  rowId: string;
  type: ConflictType;
  conflicts: FieldConflict[];
  oursRow?: SheetRow;
  theirsRow?: SheetRow;
  baseRow?: SheetRow;
}

export interface MergeResult {
  success: boolean;
  data: SheetData | null;
  conflicts: RowConflict[];
}

export interface CommitInfo {
  oid: string;
  message: string;
  author: string;
  timestamp: number;
  parents: string[];
}

export interface BranchInfo {
  name: string;
  oid: string;
}
