import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSearchRequest,
  escapeIlike,
  parseContentRange,
  searchPage,
} from './search.js';

describe('escapeIlike', () => {
  it('strips wildcard asterisks to prevent pattern injection', () => {
    expect(escapeIlike('K3 * Umum')).toBe('K3  Umum');
  });

  it('trims whitespace', () => {
    expect(escapeIlike('  Barista ')).toBe('Barista');
  });
});

describe('buildSearchRequest', () => {
  it('builds ilike path with correct range window', () => {
    const req = buildSearchRequest('lsp', 'id,nama', 'nama', 'K3', 2, 12);
    expect(req).not.toBeNull();
    expect(req?.path).toContain('nama=ilike.');
    expect(req?.path).toContain(encodeURIComponent('K3'));
    expect(req?.range).toBe('12-23');
  });

  it('returns null for empty query', () => {
    expect(buildSearchRequest('lsp', 'id', 'nama', '   ', 1, 12)).toBeNull();
    expect(buildSearchRequest('lsp', 'id', 'nama', '***', 1, 12)).toBeNull();
  });
});

describe('parseContentRange', () => {
  it('extracts total from Content-Range', () => {
    expect(parseContentRange('0-11/295')).toBe(295);
    expect(parseContentRange('*/0')).toBe(0);
  });

  it('returns null for missing header', () => {
    expect(parseContentRange(null)).toBeNull();
  });
});

describe('searchPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends Range + count headers and returns rows with total', async () => {
    const stub = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 1 }]), {
        status: 200,
        headers: { 'Content-Range': '0-0/1' },
      }),
    );
    vi.stubGlobal('fetch', stub);
    const { rows, total } = await searchPage('lsp', 'id', 'nama', 'K3', 1, 12);
    expect(rows).toEqual([{ id: 1 }]);
    expect(total).toBe(1);
    const [, init] = stub.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Range']).toBe('0-11');
    expect(headers['Prefer']).toBe('count=exact');
  });

  it('throws readable error on non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 401 })));
    await expect(searchPage('lsp', 'id', 'nama', 'K3', 1, 12)).rejects.toThrow('401');
  });
});
