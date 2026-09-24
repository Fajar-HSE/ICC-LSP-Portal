import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPortalStats,
  fetchSkemaPage,
  fetchTopLsp,
  suggestLsp,
  suggestSkema,
} from './portal.js';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('portal RPC', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchPortalStats calls rpc/portal_stats', async () => {
    const stub = vi.fn().mockResolvedValue(json({ total_lsp: 1252, aktif: 1 }));
    vi.stubGlobal('fetch', stub);
    const stats = await fetchPortalStats();
    expect(stats.total_lsp).toBe(1252);
    const [url] = stub.mock.calls[0] as [string];
    expect(url).toContain('/rest/v1/rpc/portal_stats');
  });

  it('fetchTopLsp forwards status and limit params', async () => {
    const stub = vi.fn().mockResolvedValue(json([]));
    vi.stubGlobal('fetch', stub);
    await fetchTopLsp('aktif', 6);
    const [url] = stub.mock.calls[0] as [string];
    expect(url).toContain('p_status=aktif');
    expect(url).toContain('p_limit=6');
  });

  it('fetchSkemaPage returns envelope with total and items', async () => {
    const stub = vi
      .fn()
      .mockResolvedValue(json({ total: 6431, items: [{ nama: 'Barista', jml_lsp: 2, total_unit: 9 }] }));
    vi.stubGlobal('fetch', stub);
    const page = await fetchSkemaPage('unit-desc', 2, 24);
    expect(page.total).toBe(6431);
    expect(page.items[0]?.nama).toBe('Barista');
    const [url] = stub.mock.calls[0] as [string];
    expect(url).toContain('/rest/v1/rpc/skema_page');
  });

  it('throws readable error when RPC is missing (functions not deployed)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: 'Not Found' }, 404)));
    await expect(fetchPortalStats()).rejects.toThrow('portal_stats');
  });

  it('suggestLsp maps rows to autocomplete shape', async () => {
    const stub = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ nama: 'LSP A', status: 'Lisensi Aktif', jml_skema: 3 }]), {
        status: 200,
        headers: { 'Content-Range': '0-0/1' },
      }),
    );
    vi.stubGlobal('fetch', stub);
    const out = await suggestLsp('lsp');
    expect(out).toEqual([{ nama: 'LSP A', status: 'Lisensi Aktif', jml_skema: 3 }]);
  });

  it('suggestSkema dedupes names case-insensitively, max 8', async () => {
    const rows = [
      { nama: ' K3 Umum ' },
      { nama: 'k3 umum' },
      { nama: 'Barista' },
    ];
    const stub = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(rows), {
        status: 200,
        headers: { 'Content-Range': '0-2/3' },
      }),
    );
    vi.stubGlobal('fetch', stub);
    expect(await suggestSkema('k3')).toEqual(['K3 Umum', 'Barista']);
  });
});
