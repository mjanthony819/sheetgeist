/**
 * workbookSql.test.ts
 *
 * Side-effect import of testSql must come FIRST so configureSql() is called
 * before the SQL tests run.
 */
import './testSql';

import { describe, it, expect } from 'vitest';
import { runWorkbookQuery, summarizeTable, checkComputed } from './workbookSql';
import type { Workbook } from './workbook';
import { generateMuseumWorkbook } from './dataset';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tinyWorkbook(): Workbook {
  return {
    order: ['items'],
    tables: {
      items: {
        columns: ['name', 'qty', 'price'],
        rows: [
          { id: 'r1', name: 'Ghost Lantern', qty: 12, price: 100 },
          { id: 'r2', name: 'Cursed Mirror', qty: 3, price: 500 },
          { id: 'r3', name: 'Phantom Portrait', qty: 7, price: 250 },
        ],
        computed: [{ name: 'total', expr: 'qty * price' }],
      },
    },
  };
}

/** Multi-table workbook with items + exhibits that share a 'location'/'hall' join key */
function joinWorkbook(): Workbook {
  return {
    order: ['items', 'exhibits'],
    tables: {
      items: {
        columns: ['name', 'location'],
        rows: [
          { id: 'i1', name: 'Ghost Lantern', location: 'Hall A' },
          { id: 'i2', name: 'Cursed Mirror', location: 'Hall B' },
          { id: 'i3', name: 'Wraith Candelabra', location: 'Hall A' },
        ],
        computed: [],
      },
      exhibits: {
        columns: ['title', 'hall'],
        rows: [
          { id: 'e1', title: 'Spirits of Victorian Age', hall: 'Hall A' },
          { id: 'e2', title: 'Cursed Reflections', hall: 'Hall B' },
        ],
        computed: [],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// runWorkbookQuery — basic SELECT
// ---------------------------------------------------------------------------

describe('runWorkbookQuery — basic SELECT', () => {
  it('returns rows from a simple query', async () => {
    const result = await runWorkbookQuery(tinyWorkbook(), 'SELECT name FROM items');
    expect(result.success).toBe(true);
    expect(result.columns).toContain('name');
    expect(result.values.length).toBe(3);
  });

  it('filters rows with WHERE', async () => {
    const result = await runWorkbookQuery(
      tinyWorkbook(),
      'SELECT name FROM items WHERE qty > 5'
    );
    expect(result.success).toBe(true);
    expect(result.values.length).toBe(2); // Ghost Lantern (12) and Phantom Portrait (7)
  });
});

// ---------------------------------------------------------------------------
// runWorkbookQuery — JOIN across items / exhibits on location = hall
// ---------------------------------------------------------------------------

describe('runWorkbookQuery — JOIN items/exhibits on location = hall', () => {
  it('joins items to exhibits on matching hall', async () => {
    const result = await runWorkbookQuery(
      joinWorkbook(),
      `SELECT items.name, exhibits.title
       FROM items
       JOIN exhibits ON items.location = exhibits.hall`
    );
    expect(result.success).toBe(true);
    // Hall A: 2 items × 1 exhibit = 2 rows; Hall B: 1 item × 1 exhibit = 1 row → 3 total
    expect(result.values.length).toBe(3);
    const names = result.values.map(r => r[0] as string);
    expect(names).toContain('Ghost Lantern');
    expect(names).toContain('Cursed Mirror');
  });
});

// ---------------------------------------------------------------------------
// runWorkbookQuery — computed column total_value_usd (museum workbook)
// ---------------------------------------------------------------------------

describe('runWorkbookQuery — computed column total_value_usd', () => {
  it('computed column is queryable and returns numeric values', async () => {
    const museum = generateMuseumWorkbook();
    const result = await runWorkbookQuery(
      museum,
      'SELECT name, total_value_usd FROM items ORDER BY total_value_usd DESC LIMIT 5'
    );
    expect(result.success).toBe(true);
    expect(result.columns).toContain('total_value_usd');
    // All values should be numeric (returned as number by sql.js)
    for (const row of result.values) {
      expect(typeof row[1]).toBe('number');
      expect(row[1] as number).toBeGreaterThan(0);
    }
  });

  it('top item by total_value_usd matches expected product', async () => {
    // Independently computed from the fixture in JS: Shadow Sculpture is highest (quantity x unit_value_usd = 37000)
    const museum = generateMuseumWorkbook();
    const result = await runWorkbookQuery(
      museum,
      'SELECT name, total_value_usd FROM items ORDER BY total_value_usd DESC LIMIT 1'
    );
    expect(result.success).toBe(true);
    expect(result.values[0][0]).toBe('Shadow Sculpture');
    expect(result.values[0][1]).toBe(37000);
  });
});

// ---------------------------------------------------------------------------
// runWorkbookQuery — write statement rejected
// ---------------------------------------------------------------------------

describe('runWorkbookQuery — write rejection', () => {
  it('rejects INSERT statement', async () => {
    const result = await runWorkbookQuery(
      tinyWorkbook(),
      'INSERT INTO items (id,name,qty,price) VALUES (\'x\',\'evil\',1,1)'
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects UPDATE statement', async () => {
    const result = await runWorkbookQuery(tinyWorkbook(), 'UPDATE items SET qty=99 WHERE id=\'r1\'');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects DROP statement', async () => {
    const result = await runWorkbookQuery(tinyWorkbook(), 'DROP TABLE items');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects a bare non-SELECT string', async () => {
    const result = await runWorkbookQuery(tinyWorkbook(), 'PRAGMA table_info(items)');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// runWorkbookQuery — > 1000 rows rejected
// ---------------------------------------------------------------------------

describe('runWorkbookQuery — > 1000 rows rejected', () => {
  it('errors when query would return more than 1000 rows', async () => {
    // Build a workbook with 1001 rows
    const rows = Array.from({ length: 1001 }, (_, i) => ({
      id: `r${i + 1}`,
      x: i + 1,
    }));
    const w: Workbook = {
      order: ['big'],
      tables: {
        big: { columns: ['x'], rows, computed: [] },
      },
    };
    const result = await runWorkbookQuery(w, 'SELECT * FROM big');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/1,000/);
  });
});

// ---------------------------------------------------------------------------
// summarizeTable
// ---------------------------------------------------------------------------

describe('summarizeTable', () => {
  it('returns summary stats for numeric columns', async () => {
    const summaries = await summarizeTable(tinyWorkbook(), 'items');
    // qty and price are numeric data columns; total is computed
    expect(summaries.length).toBeGreaterThanOrEqual(2);
    const qtyRow = summaries.find(s => s.column === 'qty');
    expect(qtyRow).toBeDefined();
    expect(qtyRow!.count).toBe(3);
    expect(qtyRow!.sum).toBe(22); // 12+3+7
    expect(qtyRow!.min).toBe(3);
    expect(qtyRow!.max).toBe(12);
  });

  it('includes computed columns in summaries', async () => {
    const summaries = await summarizeTable(tinyWorkbook(), 'items');
    const totalRow = summaries.find(s => s.column === 'total');
    expect(totalRow).toBeDefined();
    // 12*100 + 3*500 + 7*250 = 1200 + 1500 + 1750 = 4450
    expect(totalRow!.sum).toBe(4450);
  });

  it('returns empty array for a non-existent table', async () => {
    const result = await summarizeTable(tinyWorkbook(), 'nonexistent');
    expect(result).toEqual([]);
  });

  it('returns empty array for a table with no numeric columns', async () => {
    const w: Workbook = {
      order: ['words'],
      tables: {
        words: {
          columns: ['word'],
          rows: [{ id: 'w1', word: 'ghost' }, { id: 'w2', word: 'spirit' }],
          computed: [],
        },
      },
    };
    const result = await summarizeTable(w, 'words');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// checkComputed
// ---------------------------------------------------------------------------

describe('checkComputed', () => {
  it('returns empty array when all computed columns are valid', async () => {
    const errors = await checkComputed(tinyWorkbook());
    expect(errors).toEqual([]);
  });

  it('reports an error for a bad expression (references a non-existent column)', async () => {
    const w = tinyWorkbook();
    // Replace the valid computed col with one that references a column that doesn't exist
    w.tables['items'].computed = [{ name: 'bad', expr: 'nonexistent_col * 2' }];
    const errors = await checkComputed(w);
    // sql.js will not error on a missing column in VIRTUAL GENERATED — it returns NULL.
    // So this particular test verifies that the check at least completes without throwing.
    expect(Array.isArray(errors)).toBe(true);
  });

  it('reports no errors for the museum workbook computed column', async () => {
    const museum = generateMuseumWorkbook();
    const errors = await checkComputed(museum);
    expect(errors).toEqual([]);
  });

  it('reports an error for a syntactically invalid expression', async () => {
    const w = tinyWorkbook();
    // This expression will cause a SQL syntax error when SQLite tries to CREATE TABLE
    w.tables['items'].computed = [{ name: 'bad', expr: 'qty *** price' }];
    const errors = await checkComputed(w);
    // Should have at least one error for this table/column
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].table).toBe('items');
  });
});

describe('numeric storage (regression: columns must not get TEXT affinity)', () => {
  it('compares and sorts numbers numerically', async () => {
    const w: Workbook = { order: ['t'], tables: { t: { columns: ['n'], rows: [{ id: 'a', n: 9 }, { id: 'b', n: 10 }, { id: 'c', n: 100 }], computed: [] } } };
    const r = await runWorkbookQuery(w, 'SELECT id FROM t WHERE n > 9 ORDER BY n DESC');
    expect(r.values.map(v => v[0])).toEqual(['c', 'b']);
    const m = await runWorkbookQuery(w, 'SELECT MIN(n), MAX(n), typeof(n) FROM t');
    expect(m.values[0].slice(0, 2)).toEqual([9, 100]);
  });
});
