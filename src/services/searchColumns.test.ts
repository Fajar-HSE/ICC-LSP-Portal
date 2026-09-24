import { describe, expect, it } from 'vitest';
import { buildSearchRequest, escapeIlike } from './search.js';

describe('search across columns', () => {
  it('builds or-query for license and SK numbers', () => {
    const req = buildSearchRequest(
      'lsp',
      'id,nama',
      ['nama', 'no_lisensi', 'no_sk'],
      'BNSP-LSP-070',
      1,
      12,
    );
    expect(req).not.toBeNull();
    expect(req?.path).toContain('or=');
    expect(req?.path).toContain('no_lisensi');
    expect(req?.path).toContain('no_sk');
  });

  it('keeps single-column behavior unchanged', () => {
    const req = buildSearchRequest('lsp', 'id,nama', 'nama', 'K3', 2, 12);
    expect(req?.path).not.toContain('or=');
    expect(req?.path).toContain('nama=ilike.');
    expect(req?.range).toBe('12-23');
  });

  it('strips or-syntax breakers from query', () => {
    expect(escapeIlike('K3 (Umum), "A"')).toBe('K3 Umum, A'.replace(/,/g, ''));
  });
});
