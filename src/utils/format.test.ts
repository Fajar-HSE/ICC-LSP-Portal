import { describe, expect, it } from 'vitest';
import { chunk, deslugify, formatCount, formatDateID, slugify } from './format.js';

describe('format', () => {
  it('formatCount uses id-ID locale', () => {
    expect(formatCount(55518)).toBe((55518).toLocaleString('id-ID'));
  });

  it('formatDateID returns dash on empty', () => {
    expect(formatDateID(null)).toBe('—');
    expect(formatDateID('')).toBe('—');
    expect(formatDateID(undefined)).toBe('—');
  });

  it('formatDateID formats valid ISO to id-ID date', () => {
    const out = formatDateID('2026-08-05T00:00:00.000Z');
    expect(out).not.toBe('—');
    expect(out.length).toBeGreaterThan(4);
  });

  it('slugify lowercases, dashes, strips invalid', () => {
    expect(slugify('LSP K3 Umum')).toBe('lsp-k3-umum');
    expect(slugify('  Digital   Marketing!! ')).toBe('digital-marketing');
  });

  it('deslugify dashes to spaces', () => {
    expect(deslugify('lsp-k3-umum')).toBe('lsp k3 umum');
  });

  it('chunk splits arrays', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
