import type { SheetData } from './types';

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
