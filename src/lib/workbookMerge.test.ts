import { describe, it, expect } from 'vitest';
import { mergeWorkbooks, resolveWorkbookConflicts } from './workbookMerge';
import type { Workbook, TableData } from './workbook';
import { cloneWorkbook } from './workbook';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTable(
  columns: string[],
  rows: { id: string; [k: string]: string | number | boolean | null }[]
): TableData {
  return { columns, rows, computed: [] };
}

/** Two-table workbook: items + exhibits */
function baseWorkbook(): Workbook {
  return {
    order: ['items', 'exhibits'],
    tables: {
      items: makeTable(['name', 'qty'], [
        { id: 'i1', name: 'Ghost Lantern', qty: 12 },
        { id: 'i2', name: 'Cursed Mirror', qty: 3 },
      ]),
      exhibits: makeTable(['title', 'hall'], [
        { id: 'e1', title: 'Victorian Spirits', hall: 'Hall A' },
      ]),
    },
  };
}

// ---------------------------------------------------------------------------
// mergeWorkbooks — independent edits on different tables merge clean
// ---------------------------------------------------------------------------

describe('mergeWorkbooks — independent table edits', () => {
  it('merges independent edits on different tables without conflict', () => {
    const base = baseWorkbook();

    const ours = cloneWorkbook(base);
    ours.tables['items'].rows[0].qty = 15; // edit items table only

    const theirs = cloneWorkbook(base);
    theirs.tables['exhibits'].rows[0].hall = 'Hall B'; // edit exhibits only

    const result = mergeWorkbooks(base, ours, theirs);

    expect(result.errors).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    expect(result.data).not.toBeNull();
    expect(result.data!.tables['items'].rows[0].qty).toBe(15);
    expect(result.data!.tables['exhibits'].rows[0].hall).toBe('Hall B');
  });

  it('merges additions in separate tables without conflict', () => {
    const base = baseWorkbook();

    const ours = cloneWorkbook(base);
    ours.tables['items'].rows.push({ id: 'i3', name: 'Phantom Portrait', qty: 7 });

    const theirs = cloneWorkbook(base);
    theirs.tables['exhibits'].rows.push({ id: 'e2', title: 'Cursed Reflections', hall: 'Hall B' });

    const result = mergeWorkbooks(base, ours, theirs);

    expect(result.errors).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    expect(result.data!.tables['items'].rows).toHaveLength(3);
    expect(result.data!.tables['exhibits'].rows).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// mergeWorkbooks — same-cell conflict surfaces with table name
// ---------------------------------------------------------------------------

describe('mergeWorkbooks — same-cell conflict includes table name', () => {
  it('surfaces a conflict with the correct table name when both sides edit the same cell', () => {
    const base = baseWorkbook();

    const ours = cloneWorkbook(base);
    ours.tables['items'].rows[0].qty = 20;

    const theirs = cloneWorkbook(base);
    theirs.tables['items'].rows[0].qty = 99;

    const result = mergeWorkbooks(base, ours, theirs);

    expect(result.data).toBeNull();
    expect(result.conflicts.length).toBeGreaterThan(0);
    // The conflict must carry the table name
    const conflict = result.conflicts[0];
    expect(conflict.table).toBe('items');
    expect(conflict.conflict.rowId).toBe('i1');
    expect(conflict.conflict.type).toBe('edit-edit');
  });

  it('surfaces conflict in the exhibits table when both sides change the same exhibit field', () => {
    const base = baseWorkbook();

    const ours = cloneWorkbook(base);
    ours.tables['exhibits'].rows[0].hall = 'Gallery';

    const theirs = cloneWorkbook(base);
    theirs.tables['exhibits'].rows[0].hall = 'Hall C';

    const result = mergeWorkbooks(base, ours, theirs);

    expect(result.conflicts.some(c => c.table === 'exhibits')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mergeWorkbooks — deleted table is an error
// ---------------------------------------------------------------------------

describe('mergeWorkbooks — deleted table is an error', () => {
  it('returns an error when ours drops a table that was in base', () => {
    const base = baseWorkbook();

    const ours = cloneWorkbook(base);
    // Drop exhibits from ours
    ours.order = ['items'];
    delete ours.tables['exhibits'];

    const theirs = cloneWorkbook(base);

    const result = mergeWorkbooks(base, ours, theirs);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('exhibits'))).toBe(true);
    expect(result.data).toBeNull();
  });

  it('returns an error when theirs drops a table that was in base', () => {
    const base = baseWorkbook();

    const ours = cloneWorkbook(base);

    const theirs = cloneWorkbook(base);
    theirs.order = ['items'];
    delete theirs.tables['exhibits'];

    const result = mergeWorkbooks(base, ours, theirs);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.data).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mergeWorkbooks — computed-def both-changed error
// ---------------------------------------------------------------------------

describe('mergeWorkbooks — computed column both-changed error', () => {
  it('errors when both sides change a computed column expression differently', () => {
    const base: Workbook = {
      order: ['items'],
      tables: {
        items: {
          columns: ['qty', 'price'],
          rows: [{ id: 'r1', qty: 5, price: 100 }],
          computed: [{ name: 'total', expr: 'qty * price' }],
        },
      },
    };

    const ours = cloneWorkbook(base);
    ours.tables['items'].computed[0].expr = 'qty * price * 1.1'; // ours changes it

    const theirs = cloneWorkbook(base);
    theirs.tables['items'].computed[0].expr = 'qty * price * 2'; // theirs changes it differently

    const result = mergeWorkbooks(base, ours, theirs);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('total'))).toBe(true);
    expect(result.data).toBeNull();
  });

  it('succeeds when both sides change a computed column to the same expression', () => {
    const base: Workbook = {
      order: ['items'],
      tables: {
        items: {
          columns: ['qty', 'price'],
          rows: [{ id: 'r1', qty: 5, price: 100 }],
          computed: [{ name: 'total', expr: 'qty * price' }],
        },
      },
    };

    const ours = cloneWorkbook(base);
    ours.tables['items'].computed[0].expr = 'qty * price * 1.1';

    const theirs = cloneWorkbook(base);
    theirs.tables['items'].computed[0].expr = 'qty * price * 1.1'; // same change

    const result = mergeWorkbooks(base, ours, theirs);

    expect(result.errors).toHaveLength(0);
    expect(result.data).not.toBeNull();
    expect(result.data!.tables['items'].computed[0].expr).toBe('qty * price * 1.1');
  });
});

// ---------------------------------------------------------------------------
// resolveWorkbookConflicts — applies per-table choices
// ---------------------------------------------------------------------------

describe('resolveWorkbookConflicts', () => {
  it('applies ours choice to resolve a conflicting field', () => {
    const base = baseWorkbook();

    const ours = cloneWorkbook(base);
    ours.tables['items'].rows[0].qty = 20;

    const theirs = cloneWorkbook(base);
    theirs.tables['items'].rows[0].qty = 99;

    const { conflicts } = mergeWorkbooks(base, ours, theirs);
    expect(conflicts.length).toBeGreaterThan(0);

    // Choose ours (20) for the qty field on row i1
    const choices: Record<string, Record<string, Record<string, 'ours' | 'theirs'>>> = {
      items: { i1: { qty: 'ours' } },
    };

    const resolved = resolveWorkbookConflicts(conflicts, choices, base, ours, theirs);
    const row = resolved.tables['items'].rows.find(r => r.id === 'i1');
    expect(row).toBeDefined();
    expect(row!.qty).toBe(20);
  });

  it('applies theirs choice to resolve a conflicting field', () => {
    const base = baseWorkbook();

    const ours = cloneWorkbook(base);
    ours.tables['items'].rows[0].qty = 20;

    const theirs = cloneWorkbook(base);
    theirs.tables['items'].rows[0].qty = 99;

    const { conflicts } = mergeWorkbooks(base, ours, theirs);

    const choices: Record<string, Record<string, Record<string, 'ours' | 'theirs'>>> = {
      items: { i1: { qty: 'theirs' } },
    };

    const resolved = resolveWorkbookConflicts(conflicts, choices, base, ours, theirs);
    const row = resolved.tables['items'].rows.find(r => r.id === 'i1');
    expect(row!.qty).toBe(99);
  });

  it('preserves non-conflicting tables unchanged after resolution', () => {
    const base = baseWorkbook();

    const ours = cloneWorkbook(base);
    ours.tables['items'].rows[0].qty = 20;

    const theirs = cloneWorkbook(base);
    theirs.tables['items'].rows[0].qty = 99;
    // exhibits is untouched on both sides

    const { conflicts } = mergeWorkbooks(base, ours, theirs);

    const choices: Record<string, Record<string, Record<string, 'ours' | 'theirs'>>> = {
      items: { i1: { qty: 'ours' } },
    };

    const resolved = resolveWorkbookConflicts(conflicts, choices, base, ours, theirs);
    // exhibits table should be preserved
    expect(resolved.tables['exhibits'].rows[0].hall).toBe('Hall A');
  });

  it('handles multi-table workbooks with conflicts only in one table', () => {
    const base = baseWorkbook();

    const ours = cloneWorkbook(base);
    ours.tables['items'].rows[1].qty = 10; // conflict in items/i2
    ours.tables['exhibits'].rows[0].hall = 'Gallery'; // independent edit in exhibits

    const theirs = cloneWorkbook(base);
    theirs.tables['items'].rows[1].qty = 50; // conflict in items/i2
    // exhibits unchanged in theirs

    const { conflicts } = mergeWorkbooks(base, ours, theirs);

    expect(conflicts.some(c => c.table === 'items')).toBe(true);

    const choices: Record<string, Record<string, Record<string, 'ours' | 'theirs'>>> = {
      items: { i2: { qty: 'theirs' } },
    };

    const resolved = resolveWorkbookConflicts(conflicts, choices, base, ours, theirs);
    const i2 = resolved.tables['items'].rows.find(r => r.id === 'i2');
    expect(i2!.qty).toBe(50);
    // The independent exhibits edit from ours should survive
    expect(resolved.tables['exhibits'].rows[0].hall).toBe('Gallery');
  });
});
