import type { SheetData } from './types';
import type { Workbook } from './workbook';

/**
 * Generate synthetic haunted museum inventory dataset with stable IDs
 */
export function generateHauntedMuseumInventory(): SheetData {
  const items = [
    { id: 'item-001', name: 'Ghost Lantern', category: 'Lighting', quantity: 12, status: 'active', location: 'Hall A', year_acquired: 1887 },
    { id: 'item-002', name: 'Cursed Mirror', category: 'Furniture', quantity: 3, status: 'active', location: 'Hall B', year_acquired: 1902 },
    { id: 'item-003', name: 'Phantom Portrait', category: 'Art', quantity: 7, status: 'active', location: 'Gallery', year_acquired: 1845 },
    { id: 'item-004', name: 'Haunted Music Box', category: 'Musical', quantity: 5, status: 'retired', location: 'Storage', year_acquired: 1923 },
    { id: 'item-005', name: 'Spectral Clock', category: 'Timepiece', quantity: 2, status: 'active', location: 'Hall A', year_acquired: 1899 },
    { id: 'item-006', name: 'Ectoplasm Jar', category: 'Specimen', quantity: 18, status: 'active', location: 'Laboratory', year_acquired: 1934 },
    { id: 'item-007', name: 'Possessed Doll', category: 'Toy', quantity: 9, status: 'quarantine', location: 'Vault', year_acquired: 1956 },
    { id: 'item-008', name: 'Witch\'s Grimoire', category: 'Book', quantity: 4, status: 'active', location: 'Library', year_acquired: 1673 },
    { id: 'item-009', name: 'Vampire Chalice', category: 'Tableware', quantity: 6, status: 'active', location: 'Hall B', year_acquired: 1789 },
    { id: 'item-010', name: 'Wraith Candelabra', category: 'Lighting', quantity: 8, status: 'active', location: 'Hall A', year_acquired: 1854 },
    { id: 'item-011', name: 'Banshee Bell', category: 'Musical', quantity: 3, status: 'active', location: 'Gallery', year_acquired: 1912 },
    { id: 'item-012', name: 'Spirit Board', category: 'Game', quantity: 15, status: 'active', location: 'Hall C', year_acquired: 1891 },
    { id: 'item-013', name: 'Phantom Photograph', category: 'Art', quantity: 22, status: 'active', location: 'Gallery', year_acquired: 1920 },
    { id: 'item-014', name: 'Cursed Jewelry Box', category: 'Furniture', quantity: 4, status: 'retired', location: 'Storage', year_acquired: 1935 },
    { id: 'item-015', name: 'Séance Table', category: 'Furniture', quantity: 2, status: 'active', location: 'Hall C', year_acquired: 1888 },
    { id: 'item-016', name: 'Ghostly Gramophone', category: 'Musical', quantity: 1, status: 'active', location: 'Hall B', year_acquired: 1901 },
    { id: 'item-017', name: 'Poltergeist Stone', category: 'Mineral', quantity: 11, status: 'active', location: 'Laboratory', year_acquired: 1967 },
    { id: 'item-018', name: 'Enchanted Quill', category: 'Writing', quantity: 7, status: 'active', location: 'Library', year_acquired: 1742 },
    { id: 'item-019', name: 'Shadow Sculpture', category: 'Art', quantity: 5, status: 'active', location: 'Gallery', year_acquired: 1978 },
    { id: 'item-020', name: 'Haunted Hatbox', category: 'Storage', quantity: 3, status: 'quarantine', location: 'Vault', year_acquired: 1948 }
  ];
  
  const columns = ['name', 'category', 'quantity', 'status', 'location', 'year_acquired'];
  
  return {
    rows: items,
    columns
  };
}

/**
 * Generate a multi-table museum workbook for demonstration purposes.
 * Includes items (with computed total_value_usd), exhibits, and loans tables.
 */
export function generateMuseumWorkbook(): Workbook {
  // items — extend the haunted museum inventory with unit_value_usd
  const unitValues: Record<string, number> = {
    'item-001': 450, 'item-002': 2200, 'item-003': 1800, 'item-004': 350,
    'item-005': 3500, 'item-006': 120, 'item-007': 980, 'item-008': 8500,
    'item-009': 4200, 'item-010': 1600, 'item-011': 750, 'item-012': 95,
    'item-013': 320, 'item-014': 480, 'item-015': 5600, 'item-016': 2800,
    'item-017': 65, 'item-018': 3200, 'item-019': 7400, 'item-020': 190,
  };
  const baseInventory = generateHauntedMuseumInventory();
  const itemRows = baseInventory.rows.map(r => ({
    ...r,
    unit_value_usd: unitValues[r.id] ?? 0,
  }));

  const exhibitsRows = [
    { id: 'exh-001', title: 'Spirits of the Victorian Age', hall: 'Hall A', visitors_per_week: 340 },
    { id: 'exh-002', title: 'Cursed Reflections', hall: 'Hall B', visitors_per_week: 215 },
    { id: 'exh-003', title: 'The Haunted Gallery', hall: 'Gallery', visitors_per_week: 480 },
    { id: 'exh-004', title: 'Science of the Uncanny', hall: 'Laboratory', visitors_per_week: 190 },
    { id: 'exh-005', title: 'Forbidden Knowledge', hall: 'Library', visitors_per_week: 275 },
    { id: 'exh-006', title: 'Rituals and Rites', hall: 'Hall C', visitors_per_week: 160 },
    { id: 'exh-007', title: 'The Vault Collection', hall: 'Vault', visitors_per_week: 95 },
  ];

  const loansRows = [
    { id: 'loan-001', item_id: 'item-003', borrower: 'Blackwood Museum', due_year: 2027, status: 'active' },
    { id: 'loan-002', item_id: 'item-008', borrower: 'Grimoire Archive', due_year: 2026, status: 'active' },
    { id: 'loan-003', item_id: 'item-012', borrower: 'Paranormal Society', due_year: 2025, status: 'returned' },
    { id: 'loan-004', item_id: 'item-016', borrower: 'Edison Sound Museum', due_year: 2027, status: 'active' },
    { id: 'loan-005', item_id: 'item-002', borrower: 'Mirror Arts Foundation', due_year: 2028, status: 'active' },
    { id: 'loan-006', item_id: 'item-009', borrower: 'Gothic Collections', due_year: 2026, status: 'overdue' },
    { id: 'loan-007', item_id: 'item-018', borrower: 'Manuscript Library', due_year: 2027, status: 'active' },
  ];

  return {
    order: ['items', 'exhibits', 'loans'],
    tables: {
      items: {
        rows: itemRows,
        columns: ['name', 'category', 'quantity', 'status', 'location', 'year_acquired', 'unit_value_usd'],
        computed: [{ name: 'total_value_usd', expr: 'quantity * unit_value_usd' }],
      },
      exhibits: {
        rows: exhibitsRows,
        columns: ['title', 'hall', 'visitors_per_week'],
        computed: [],
      },
      loans: {
        rows: loansRows,
        columns: ['item_id', 'borrower', 'due_year', 'status'],
        computed: [],
      },
    },
  };
}
