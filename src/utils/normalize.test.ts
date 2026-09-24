import { describe, expect, it } from 'vitest';
import { normalizeName } from './format.js';

describe('normalizeName', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeName('  FOOD & BEVERAGE HEAD WAITER ')).toBe('FOOD & BEVERAGE HEAD WAITER');
  });

  it('collapses double spaces into one', () => {
    expect(normalizeName('PENGORGANISASIAN  PROGRAM PELATIHAN KERJA')).toBe(
      'PENGORGANISASIAN PROGRAM PELATIHAN KERJA',
    );
  });

  it('leaves clean names untouched', () => {
    expect(normalizeName('K3 Umum')).toBe('K3 Umum');
  });
});
