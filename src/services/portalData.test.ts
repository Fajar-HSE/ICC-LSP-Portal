import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchLspByName,
  fetchLspMap,
  fetchLspSkemaNames,
  fetchSkemaGroup,
  fetchSkemaId,
  getSkemaPage,
  getStats,
  getTopLsp,
} from './portal.js';

const LSP_ROWS = [
  {
    id: 1,
    nama: 'LSP A',
    jml_skema: 0,
    status: 'Lisensi Aktif',
    no_sk: 'SK-1',
    no_lisensi: 'LIS-1',
    last_checked: '2026-08-05T00:00:00.000Z',
  },
  {
    id: 2,
    nama: 'LSP B',
    jml_skema: 0,
    status: 'Masa Berlaku Habis',
    no_sk: 'SK-2',
    no_lisensi: 'LIS-2',
    last_checked: '2026-07-01T00:00:00.000Z',
  },
];

const SKEMA_ROWS = [
  { id: 10, nama: 'K3 Umum', id_skema: 'x', lsp_id: 1, jml_unit: 5 },
  { id: 11, nama: 'K3 Umum', id_skema: 'y', lsp_id: 2, jml_unit: 3 },
  { id: 12, nama: 'Barista', id_skema: 'z', lsp_id: 2, jml_unit: 4 },
];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status });
}

function route(url: string): Response {
  if (url.includes('/rpc/')) return json({ message: 'Not Found' }, 404);
  if (url.includes('/rest/v1/lsp')) return json(LSP_ROWS);
  if (url.includes('/rest/v1/skema')) return json(SKEMA_ROWS);
  return json([]);
}

describe('portal data with RPC available', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getStats returns the RPC envelope', async () => {
    const payload = {
      total_lsp: 1252,
      aktif: 785,
      habis: 464,
      total_unit: 107638,
      skema_jenis: 6431,
      multi_lsp: 100,
      latest_checked: '2026-09-21T00:00:00.000Z',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(payload)));
    expect(await getStats()).toEqual(payload);
  });
});

describe('portal data fallback without RPC', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getStats derives counts from full tables', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => Promise.resolve(route(url))),
    );
    const stats = await getStats();
    expect(stats.total_lsp).toBe(2);
    expect(stats.aktif).toBe(1);
    expect(stats.habis).toBe(1);
    expect(stats.total_unit).toBe(12);
    expect(stats.skema_jenis).toBe(2);
    expect(stats.multi_lsp).toBe(1);
    expect(stats.latest_checked).toBe('2026-08-05T00:00:00.000Z');
  });

  it('getTopLsp fallback respects the status filter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => Promise.resolve(route(url))),
    );
    const aktif = await getTopLsp('aktif', 6);
    expect(aktif.map((l) => l.nama)).toEqual(['LSP A']);
    const habis = await getTopLsp('habis', 6);
    expect(habis.map((l) => l.nama)).toEqual(['LSP B']);
  });

  it('getSkemaPage fallback sorts and paginates locally', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => Promise.resolve(route(url))),
    );
    const page = await getSkemaPage('unit-desc', 1, 1);
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.nama).toBe('K3 Umum');
  });
});

describe('scoped detail queries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchLspByName returns the first exact match', async () => {
    const stub = vi.fn().mockImplementation((url: string) => Promise.resolve(route(url)));
    vi.stubGlobal('fetch', stub);
    const lsp = await fetchLspByName('LSP A');
    expect(lsp?.id).toBe(1);
    const [url] = stub.mock.calls[0] as [string];
    expect(url).toContain('nama=ilike.');
  });

  it('fetchLspByName returns null when missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([])));
    expect(await fetchLspByName('Tidak Ada')).toBeNull();
  });

  it('fetchLspSkemaNames aggregates units per unique name, sorted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => Promise.resolve(route(url))),
    );
    const entries = await fetchLspSkemaNames(1);
    expect(entries).toEqual([{ nama: 'K3 Umum', units: 5 }]);
  });

  it('fetchSkemaGroup groups rows and resolves LSP info', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => Promise.resolve(route(url))),
    );
    const { group, info } = await fetchSkemaGroup('K3 Umum');
    expect(group?.jml_lsp).toBe(2);
    expect(group?.total_unit).toBe(8);
    expect(info.get(1)?.nama).toBe('LSP A');
    expect(info.get(2)?.nama).toBe('LSP B');
  });

  it('fetchSkemaGroup returns null group for unknown names', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([])));
    const { group } = await fetchSkemaGroup('Zzz');
    expect(group).toBeNull();
  });

  it('fetchSkemaId returns the skema id for an LSP', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => Promise.resolve(route(url))),
    );
    expect(await fetchSkemaId(1, 'K3 Umum')).toBe(10);
    expect(await fetchSkemaId(1, 'Tidak Ada')).toBeNull();
  });

  it('fetchLspMap builds id to name records', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => Promise.resolve(route(url))),
    );
    expect(await fetchLspMap([1, 2])).toEqual({ 1: 'LSP A', 2: 'LSP B' });
    expect(await fetchLspMap([])).toEqual({});
  });
});
