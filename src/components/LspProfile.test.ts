import { describe, expect, it } from 'vitest';
import { lspProfileHTML } from './LspProfile.js';

describe('lspProfileHTML contact box', () => {
  it('points users to BNSP call center when LSP contact is unavailable', () => {
    const html = lspProfileHTML({
      id: 1,
      nama: 'LSP Contoh',
      jml_skema: 2,
      status: 'Lisensi Aktif',
      no_sk: 'SK-1',
      no_lisensi: 'LIS-1',
      last_checked: '',
    });
    expect(html).toContain('0812 8888 7014');
    expect(html).toContain('admin@bnsp.go.id');
    expect(html).toContain('https://bnsp.go.id/');
  });
});
