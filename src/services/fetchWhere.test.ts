import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWhere } from './supabase.js';

describe('fetchWhere', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appends the filter to the REST url and pages through', async () => {
    const stub = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1 }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', stub);
    const rows = await fetchWhere('skema', 'id,nama', 'lsp_id=eq.1', 1000);
    expect(rows).toEqual([{ id: 1 }]);
    const [url] = stub.mock.calls[0] as [string];
    expect(url).toContain('/rest/v1/skema?');
    expect(url).toContain('lsp_id=eq.1');
  });
});
