import { describe, it, expect } from 'vitest';
import { threeWayMerge, resolveConflicts } from './merge';
import type { SheetData, RowConflict } from './types';

describe('threeWayMerge', () => {
  it('should handle unchanged rows', () => {
    const data: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5 },
        { id: 'r2', name: 'Cursed Mirror', quantity: 3 }
      ]
    };
    
    const result = threeWayMerge(data, data, data);
    
    expect(result.success).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    expect(result.data?.rows).toHaveLength(2);
  });
  
  it('should merge independent field edits', () => {
    const base: SheetData = {
      columns: ['name', 'quantity', 'status'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5, status: 'active' }
      ]
    };
    
    const ours: SheetData = {
      columns: ['name', 'quantity', 'status'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 8, status: 'active' }
      ]
    };
    
    const theirs: SheetData = {
      columns: ['name', 'quantity', 'status'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5, status: 'retired' }
      ]
    };
    
    const result = threeWayMerge(base, ours, theirs);
    
    expect(result.success).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    expect(result.data?.rows[0]).toEqual({
      id: 'r1',
      name: 'Ghost Lantern',
      quantity: 8,
      status: 'retired'
    });
  });
  
  it('should detect edit/edit conflict on same field', () => {
    const base: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5 }
      ]
    };
    
    const ours: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 8 }
      ]
    };
    
    const theirs: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 10 }
      ]
    };
    
    const result = threeWayMerge(base, ours, theirs);
    
    expect(result.success).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].type).toBe('edit-edit');
    expect(result.conflicts[0].conflicts).toHaveLength(1);
    expect(result.conflicts[0].conflicts[0]).toEqual({
      field: 'quantity',
      baseValue: 5,
      oursValue: 8,
      theirsValue: 10
    });
  });
  
  it('should handle edit/delete conflict when we edit and they delete', () => {
    const base: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5 }
      ]
    };
    
    const ours: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 8 }
      ]
    };
    
    const theirs: SheetData = {
      columns: ['name', 'quantity'],
      rows: []
    };
    
    const result = threeWayMerge(base, ours, theirs);
    
    expect(result.success).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].type).toBe('edit-delete');
    expect(result.conflicts[0].oursRow).toBeDefined();
    expect(result.conflicts[0].theirsRow).toBeUndefined();
  });
  
  it('should handle edit/delete conflict when they edit and we delete', () => {
    const base: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5 }
      ]
    };
    
    const ours: SheetData = {
      columns: ['name', 'quantity'],
      rows: []
    };
    
    const theirs: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 10 }
      ]
    };
    
    const result = threeWayMerge(base, ours, theirs);
    
    expect(result.success).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].type).toBe('edit-delete');
    expect(result.conflicts[0].oursRow).toBeUndefined();
    expect(result.conflicts[0].theirsRow).toBeDefined();
  });
  
  it('should accept deletion when both sides agree', () => {
    const base: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5 }
      ]
    };
    
    const ours: SheetData = {
      columns: ['name', 'quantity'],
      rows: []
    };
    
    const theirs: SheetData = {
      columns: ['name', 'quantity'],
      rows: []
    };
    
    const result = threeWayMerge(base, ours, theirs);
    
    expect(result.success).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    expect(result.data?.rows).toHaveLength(0);
  });
  
  it('should accept deletion when one side deletes unchanged row', () => {
    const base: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5 }
      ]
    };
    
    const ours: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5 }
      ]
    };
    
    const theirs: SheetData = {
      columns: ['name', 'quantity'],
      rows: []
    };
    
    const result = threeWayMerge(base, ours, theirs);
    
    expect(result.success).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    expect(result.data?.rows).toHaveLength(0);
  });
  
  it('should handle add/add conflict with different content', () => {
    const base: SheetData = {
      columns: ['name', 'quantity'],
      rows: []
    };
    
    const ours: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5 }
      ]
    };
    
    const theirs: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Phantom Candle', quantity: 3 }
      ]
    };
    
    const result = threeWayMerge(base, ours, theirs);
    
    expect(result.success).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].type).toBe('add-add');
    expect(result.conflicts[0].conflicts.length).toBeGreaterThan(0);
  });
  
  it('should accept add/add when content is identical', () => {
    const base: SheetData = {
      columns: ['name', 'quantity'],
      rows: []
    };
    
    const ours: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5 }
      ]
    };
    
    const theirs: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5 }
      ]
    };
    
    const result = threeWayMerge(base, ours, theirs);
    
    expect(result.success).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    expect(result.data?.rows).toHaveLength(1);
  });
  
  it('should handle rows added only by one side', () => {
    const base: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5 }
      ]
    };
    
    const ours: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5 },
        { id: 'r2', name: 'Cursed Mirror', quantity: 2 }
      ]
    };
    
    const theirs: SheetData = {
      columns: ['name', 'quantity'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5 },
        { id: 'r3', name: 'Haunted Portrait', quantity: 1 }
      ]
    };
    
    const result = threeWayMerge(base, ours, theirs);
    
    expect(result.success).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    expect(result.data?.rows).toHaveLength(3);
    
    const ids = result.data!.rows.map(r => r.id).sort();
    expect(ids).toEqual(['r1', 'r2', 'r3']);
  });
  
  it('should merge complex scenario with multiple operations', () => {
    const base: SheetData = {
      columns: ['name', 'quantity', 'status'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5, status: 'active' },
        { id: 'r2', name: 'Cursed Mirror', quantity: 3, status: 'active' },
        { id: 'r3', name: 'Old Book', quantity: 10, status: 'active' }
      ]
    };
    
    const ours: SheetData = {
      columns: ['name', 'quantity', 'status'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 8, status: 'active' }, // edit quantity
        { id: 'r2', name: 'Cursed Mirror', quantity: 3, status: 'retired' }, // edit status
        // r3 deleted
        { id: 'r4', name: 'New Item', quantity: 1, status: 'active' } // added
      ]
    };
    
    const theirs: SheetData = {
      columns: ['name', 'quantity', 'status'],
      rows: [
        { id: 'r1', name: 'Ghost Lantern', quantity: 5, status: 'retired' }, // edit status
        { id: 'r2', name: 'Cursed Mirror', quantity: 3, status: 'active' }, // unchanged
        { id: 'r3', name: 'Old Book', quantity: 15, status: 'active' }, // edit quantity
        { id: 'r5', name: 'Another Item', quantity: 2, status: 'active' } // added
      ]
    };
    
    const result = threeWayMerge(base, ours, theirs);
    
    expect(result.success).toBe(false); // Should have edit/delete conflict on r3
    expect(result.conflicts.length).toBeGreaterThan(0);
    
    // Find the r3 conflict
    const r3Conflict = result.conflicts.find(c => c.rowId === 'r3');
    expect(r3Conflict).toBeDefined();
    expect(r3Conflict?.type).toBe('edit-delete');
  });
});

describe('resolveConflicts', () => {
  it('should resolve edit/edit conflicts by choosing fields', () => {
    const conflicts: RowConflict[] = [{
      rowId: 'r1',
      type: 'edit-edit',
      conflicts: [
        { field: 'quantity', baseValue: 5, oursValue: 8, theirsValue: 10 }
      ],
      oursRow: { id: 'r1', name: 'Ghost Lantern', quantity: 8 },
      theirsRow: { id: 'r1', name: 'Ghost Lantern', quantity: 10 },
      baseRow: { id: 'r1', name: 'Ghost Lantern', quantity: 5 }
    }];
    
    const resolutions = new Map([
      ['r1', new Map([['quantity', 'theirs' as const]])]
    ]);
    
    const resolved = resolveConflicts(conflicts, resolutions);
    
    expect(resolved).toHaveLength(1);
    expect(resolved[0].quantity).toBe(10);
  });
  
  it('should resolve edit/delete conflicts by keeping or deleting row', () => {
    const conflicts: RowConflict[] = [{
      rowId: 'r1',
      type: 'edit-delete',
      conflicts: [],
      oursRow: { id: 'r1', name: 'Ghost Lantern', quantity: 8 },
      theirsRow: undefined,
      baseRow: { id: 'r1', name: 'Ghost Lantern', quantity: 5 }
    }];
    
    const resolutions = new Map([
      ['r1', new Map([['_row', 'ours' as const]])]
    ]);
    
    const resolved = resolveConflicts(conflicts, resolutions);
    
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toEqual({ id: 'r1', name: 'Ghost Lantern', quantity: 8 });
  });
  
  it('should delete row when edit/delete resolved to delete', () => {
    const conflicts: RowConflict[] = [{
      rowId: 'r1',
      type: 'edit-delete',
      conflicts: [],
      oursRow: undefined,
      theirsRow: { id: 'r1', name: 'Ghost Lantern', quantity: 10 },
      baseRow: { id: 'r1', name: 'Ghost Lantern', quantity: 5 }
    }];
    
    const resolutions = new Map([
      ['r1', new Map([['_row', 'ours' as const]])] // Choose ours = delete
    ]);
    
    const resolved = resolveConflicts(conflicts, resolutions);
    
    expect(resolved).toHaveLength(0);
  });
});
