import { describe, it, expect } from 'vitest';
import {
  validateWorkbook,
  serializeWorkbook,
  parseWorkbookFiles,
  cloneWorkbook,
  emptyTable,
} from './workbook';
import type { Workbook, TableData } from './workbook';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minimalWorkbook(): Workbook {
  return {
    order: ['items'],
    tables: {
      items: {
        columns: ['name', 'qty'],
        rows: [{ id: 'r1', name: 'Ghost Lantern', qty: 12 }],
        computed: [],
      },
    },
  };
}

function twoTableWorkbook(): Workbook {
  return {
    order: ['items', 'loans'],
    tables: {
      items: {
        columns: ['name', 'qty'],
        rows: [{ id: 'r1', name: 'Ghost Lantern', qty: 12 }],
        computed: [{ name: 'total', expr: 'qty * 2' }],
      },
      loans: {
        columns: ['item_id', 'borrower'],
        rows: [{ id: 'l1', item_id: 'r1', borrower: 'Archive' }],
        computed: [],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// validateWorkbook — table name rules
// ---------------------------------------------------------------------------

describe('validateWorkbook — table name rules', () => {
  it('accepts a valid workbook', () => {
    expect(() => validateWorkbook(minimalWorkbook())).not.toThrow();
  });

  it('rejects a table name that starts with a digit', () => {
    const w = minimalWorkbook();
    w.order = ['1items'];
    w.tables = { '1items': w.tables['items'] };
    expect(() => validateWorkbook(w)).toThrow(/Invalid table name/);
  });

  it('rejects a table name with uppercase letters', () => {
    const w = minimalWorkbook();
    w.order = ['Items'];
    w.tables = { Items: w.tables['items'] };
    expect(() => validateWorkbook(w)).toThrow(/Invalid table name/);
  });

  it('rejects a table name that is too long (> 40 chars)', () => {
    const longName = 'a'.repeat(41);
    const w = minimalWorkbook();
    w.order = [longName];
    w.tables = { [longName]: w.tables['items'] };
    expect(() => validateWorkbook(w)).toThrow(/Invalid table name/);
  });

  it('allows a table name with underscores and digits after first char', () => {
    const w = minimalWorkbook();
    w.order = ['items_2024'];
    w.tables = { items_2024: w.tables['items'] };
    expect(() => validateWorkbook(w)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateWorkbook — __proto__ and reserved column names
// ---------------------------------------------------------------------------

describe('validateWorkbook — __proto__ column rejection', () => {
  it('rejects __proto__ as a column name', () => {
    const w = minimalWorkbook();
    // Build a table with __proto__ column — bypass normal Object spread
    const badTable = {
      columns: ['__proto__'],
      rows: [],
      computed: [],
    };
    w.tables['items'] = badTable as TableData;
    expect(() => validateWorkbook(w)).toThrow();
  });

  it('rejects constructor as a column name', () => {
    const w = minimalWorkbook();
    w.tables['items'] = {
      columns: ['constructor'],
      rows: [],
      computed: [],
    };
    expect(() => validateWorkbook(w)).toThrow();
  });

  it('rejects prototype as a column name', () => {
    const w = minimalWorkbook();
    w.tables['items'] = {
      columns: ['prototype'],
      rows: [],
      computed: [],
    };
    expect(() => validateWorkbook(w)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateWorkbook — computed column expr guards
// ---------------------------------------------------------------------------

describe('validateWorkbook — computed expr guards', () => {
  function makeWithExpr(expr: string): Workbook {
    const w = minimalWorkbook();
    w.tables['items'].computed = [{ name: 'total', expr }];
    return w;
  }

  it('rejects expr containing SELECT keyword', () => {
    expect(() => validateWorkbook(makeWithExpr('(SELECT 1)'))).toThrow(/forbidden keyword/i);
  });

  it('rejects expr containing semicolons', () => {
    expect(() => validateWorkbook(makeWithExpr('qty; DROP TABLE items'))).toThrow(/forbidden ";" character/i);
  });

  it('rejects expr containing -- comment sequence', () => {
    expect(() => validateWorkbook(makeWithExpr('qty -- comment'))).toThrow(/forbidden "--" sequence/i);
  });

  it('rejects expr containing /* comment sequence', () => {
    expect(() => validateWorkbook(makeWithExpr('qty /* comment */'))).toThrow(/forbidden "\/\*" sequence/i);
  });

  it('rejects expr containing INSERT keyword', () => {
    expect(() => validateWorkbook(makeWithExpr('INSERT INTO t VALUES (1)'))).toThrow(/forbidden keyword/i);
  });

  it('rejects expr containing ATTACH keyword', () => {
    expect(() => validateWorkbook(makeWithExpr('ATTACH DATABASE \'/tmp/x.db\' AS x'))).toThrow(
      /forbidden keyword/i
    );
  });

  it('rejects expr containing load_extension keyword', () => {
    expect(() =>
      validateWorkbook(makeWithExpr('load_extension(\'/evil.so\')'))
    ).toThrow(/forbidden keyword/i);
  });

  it('accepts a safe arithmetic expr', () => {
    expect(() => validateWorkbook(makeWithExpr('qty * unit_value'))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateWorkbook — table count limits
// ---------------------------------------------------------------------------

describe('validateWorkbook — table count limits', () => {
  it('rejects a workbook with 0 tables', () => {
    expect(() => validateWorkbook({ order: [], tables: {} })).toThrow(/1–10 tables/);
  });

  it('rejects a workbook with 11 tables', () => {
    const order: string[] = [];
    const tables: Record<string, TableData> = {};
    for (let i = 1; i <= 11; i++) {
      const name = `table${i}`;
      order.push(name);
      tables[name] = { columns: ['x'], rows: [], computed: [] };
    }
    expect(() => validateWorkbook({ order, tables })).toThrow(/1–10 tables/);
  });

  it('accepts exactly 10 tables', () => {
    const order: string[] = [];
    const tables: Record<string, TableData> = {};
    for (let i = 1; i <= 10; i++) {
      const name = `t${i}`;
      order.push(name);
      tables[name] = { columns: ['x'], rows: [], computed: [] };
    }
    expect(() => validateWorkbook({ order, tables })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateWorkbook — order vs tables mismatch
// ---------------------------------------------------------------------------

describe('validateWorkbook — order mismatch', () => {
  it('rejects when order contains a name not in tables', () => {
    const w = minimalWorkbook();
    w.order = ['items', 'missing'];
    expect(() => validateWorkbook(w)).toThrow();
  });

  it('rejects when tables has a key not in order', () => {
    const w = minimalWorkbook();
    w.tables['extra'] = { columns: ['x'], rows: [], computed: [] };
    expect(() => validateWorkbook(w)).toThrow();
  });

  it('rejects duplicate names in order', () => {
    const w = minimalWorkbook();
    w.order = ['items', 'items'];
    expect(() => validateWorkbook(w)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// serializeWorkbook / parseWorkbookFiles round trip
// ---------------------------------------------------------------------------

describe('serializeWorkbook / parseWorkbookFiles round trip', () => {
  it('serializes then parses a single-table workbook back to equal', () => {
    const original = minimalWorkbook();
    const files = serializeWorkbook(original);

    expect(files['workbook.json']).toBeTruthy();
    expect(files['tables/items.json']).toBeTruthy();

    const parsed = parseWorkbookFiles(files);
    expect(parsed.order).toEqual(original.order);
    expect(parsed.tables['items'].columns).toEqual(original.tables['items'].columns);
    expect(parsed.tables['items'].rows).toEqual(original.tables['items'].rows);
  });

  it('round-trips a two-table workbook with computed columns', () => {
    const original = twoTableWorkbook();
    const files = serializeWorkbook(original);
    const parsed = parseWorkbookFiles(files);

    expect(parsed.order).toEqual(original.order);
    expect(parsed.tables['items'].computed).toEqual(original.tables['items'].computed);
    expect(parsed.tables['loans'].rows).toEqual(original.tables['loans'].rows);
  });

  it('workbook.json has version 2', () => {
    const files = serializeWorkbook(minimalWorkbook());
    const meta = JSON.parse(files['workbook.json']) as { version: number };
    expect(meta.version).toBe(2);
  });

  it('throws on missing workbook.json with no data.json', () => {
    expect(() => parseWorkbookFiles({})).toThrow(/Missing workbook.json/);
  });

  it('throws when a table file is missing', () => {
    const files = serializeWorkbook(twoTableWorkbook());
    delete files['tables/loans.json'];
    expect(() => parseWorkbookFiles(files)).toThrow(/Missing file/);
  });
});

// ---------------------------------------------------------------------------
// Legacy data.json wrap
// ---------------------------------------------------------------------------

describe('parseWorkbookFiles — legacy data.json', () => {
  it('wraps a legacy data.json as a single table named "sheet"', () => {
    const legacyData = {
      columns: ['name', 'qty'],
      rows: [{ id: 'r1', name: 'Ghost Lantern', qty: 5 }],
    };
    const files = { 'data.json': JSON.stringify(legacyData) };
    const wb = parseWorkbookFiles(files);

    expect(wb.order).toEqual(['sheet']);
    expect(wb.tables['sheet'].columns).toEqual(legacyData.columns);
    expect(wb.tables['sheet'].rows).toEqual(legacyData.rows);
    expect(wb.tables['sheet'].computed).toEqual([]);
  });

  it('workbook.json takes precedence over legacy data.json when both present', () => {
    const modern = minimalWorkbook();
    const files = serializeWorkbook(modern);
    // Add an unrelated data.json — should be ignored
    files['data.json'] = JSON.stringify({
      columns: ['x'],
      rows: [{ id: 'z1', x: 'legacy' }],
    });
    const wb = parseWorkbookFiles(files);
    // Should parse the modern workbook, not the legacy table
    expect(wb.order).toEqual(['items']);
  });
});

// ---------------------------------------------------------------------------
// cloneWorkbook / emptyTable
// ---------------------------------------------------------------------------

describe('cloneWorkbook', () => {
  it('returns a deep clone (mutations do not affect original)', () => {
    const original = minimalWorkbook();
    const clone = cloneWorkbook(original);
    clone.tables['items'].rows[0].name = 'CHANGED';
    expect(original.tables['items'].rows[0].name).toBe('Ghost Lantern');
  });
});

describe('emptyTable', () => {
  it('creates a table with zero rows and specified columns', () => {
    const t = emptyTable(['name', 'qty']);
    expect(t.rows).toHaveLength(0);
    expect(t.columns).toEqual(['name', 'qty']);
    expect(t.computed).toEqual([]);
  });
});
