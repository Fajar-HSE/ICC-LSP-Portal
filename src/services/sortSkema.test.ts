import { describe, expect, it } from 'vitest';
import { sortSkemaItems } from './skema.js';
import type { SkemaItem } from '../types/database.js';

const items: SkemaItem[] = [
  { nama: 'K3 Umum', jml_lsp: 5, total_unit: 10, lsps: [] },
  { nama: 'Barista', jml_lsp: 2, total_unit: 30, lsps: [] },
  { nama: 'Digital Marketing', jml_lsp: 9, total_unit: 5, lsps: [] },
];

describe('sortSkemaItems', () => {
  it('sorts names A to Z by default', () => {
    expect(sortSkemaItems(items, 'nama-asc').map((s) => s.nama)).toEqual([
      'Barista',
      'Digital Marketing',
      'K3 Umum',
    ]);
  });

  it('sorts names Z to A', () => {
    expect(sortSkemaItems(items, 'nama-desc')[0]?.nama).toBe('K3 Umum');
  });

  it('sorts by most units first', () => {
    expect(sortSkemaItems(items, 'unit-desc')[0]?.nama).toBe('Barista');
  });

  it('does not mutate the input array', () => {
    const before = items.map((s) => s.nama);
    sortSkemaItems(items, 'unit-desc');
    expect(items.map((s) => s.nama)).toEqual(before);
  });
});
