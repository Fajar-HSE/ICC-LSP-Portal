import { describe, expect, it } from 'vitest';
import { paginate } from './pagination.js';

describe('paginate', () => {
  it('returns correct window and total pages', () => {
    const items = [1, 2, 3, 4, 5];
    const { pageItems, totalPages } = paginate(items, 2, 2);
    expect(pageItems).toEqual([3, 4]);
    expect(totalPages).toBe(3);
  });

  it('clamps out-of-range pages', () => {
    const { pageItems } = paginate([1, 2, 3], 99, 2);
    expect(pageItems).toEqual([3]);
  });
});
