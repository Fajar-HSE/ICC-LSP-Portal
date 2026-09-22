import { beforeEach, describe, expect, it } from 'vitest';
import { loadCache, saveCache } from './storage.js';

beforeEach(() => {
  localStorage.clear();
});

describe('storage cache', () => {
  it('saves and loads JSON values', () => {
    saveCache('unit:10', [{ kode: 'A', nama: 'B' }]);
    expect(loadCache('unit:10')).toEqual([{ kode: 'A', nama: 'B' }]);
  });

  it('returns null for missing keys', () => {
    expect(loadCache('missing-key')).toBeNull();
  });

  it('returns null for corrupted JSON', () => {
    localStorage.setItem('bad', '{not-json');
    expect(loadCache('bad')).toBeNull();
  });
});
