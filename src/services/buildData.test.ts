import { describe, expect, it } from 'vitest';
import { buildData } from './skema.js';

describe('buildData', () => {
  it('groups skema by name across LSPs', () => {
    const { skemaList } = buildData(
      [
        {
          id: 1,
          nama: 'LSP A',
          jml_skema: 0,
          status: 'Lisensi Aktif',
          no_sk: '',
          no_lisensi: '',
          last_checked: '',
        },
      ],
      [
        { id: 10, nama: 'K3 Umum', id_skema: 'x', lsp_id: 1, jml_unit: 5 },
        { id: 11, nama: 'K3 Umum', id_skema: 'y', lsp_id: 1, jml_unit: 3 },
      ],
    );
    expect(skemaList).toHaveLength(1);
    expect(skemaList[0]?.nama).toBe('K3 Umum');
    expect(skemaList[0]?.total_unit).toBe(8);
  });

  it('deduplicates jml_skema per LSP by unique name', () => {
    const { lspList } = buildData(
      [
        {
          id: 1,
          nama: 'LSP A',
          jml_skema: 99,
          status: '',
          no_sk: '',
          no_lisensi: '',
          last_checked: '',
        },
      ],
      [
        { id: 10, nama: 'K3 Umum', id_skema: 'x', lsp_id: 1, jml_unit: 1 },
        { id: 11, nama: 'K3 Umum', id_skema: 'y', lsp_id: 1, jml_unit: 1 },
        { id: 12, nama: 'Barista', id_skema: 'z', lsp_id: 1, jml_unit: 1 },
      ],
    );
    expect(lspList[0]?.jml_skema).toBe(2);
  });
});
