import { describe, expect, it } from 'vitest';
import { lspCardHTML } from './LspCard.js';
import { skemaCardHTML } from './SkemaCard.js';

const baseLsp = {
  id: 1,
  nama: 'LSP K3 Umum',
  jml_skema: 4,
  status: 'Lisensi Aktif',
  no_sk: 'SK-1',
  no_lisensi: 'LIS-1',
  last_checked: '',
};

describe('lspCardHTML', () => {
  it('escapes names to prevent XSS', () => {
    const html = lspCardHTML({ ...baseLsp, nama: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows green badge for active, red for expired', () => {
    expect(lspCardHTML(baseLsp)).toContain('badge--green');
    expect(lspCardHTML({ ...baseLsp, status: 'Masa Berlaku Habis' })).toContain('badge--red');
  });

  it('is keyboard-focusable with role button', () => {
    const html = lspCardHTML(baseLsp);
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
  });
});

describe('skemaCardHTML', () => {
  it('renders unit count and LSP count', () => {
    const html = skemaCardHTML({ nama: 'Barista', jml_lsp: 3, total_unit: 9, lsps: [] });
    expect(html).toContain('9 unit');
    expect(html).toContain('3 LSP');
  });
});
