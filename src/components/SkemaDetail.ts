import type { LspItem, SkemaItem } from '../types/database.js';
import { esc } from '../utils/dom.js';
import { formatDateID } from '../utils/format.js';

export function skemaDetailHTML(skema: SkemaItem): string {
  return `
  <button class="back" type="button" id="btnBackHome">← Kembali</button>
  <div class="card card--skema mt-12">
    <div class="card-top">
      <div>
        <div class="lbl">Skema Sertifikasi</div>
        <div class="h-detail">${esc(skema.nama)}</div>
        <div class="sub mt-6">Tersedia di ${skema.jml_lsp} LSP • total ${skema.total_unit} unit kompetensi</div>
      </div>
      <span class="badge badge--orange self-start">${skema.total_unit} unit</span>
    </div>
  </div>
  <div class="pills mt-14" role="tablist" aria-label="Pilih LSP penyelenggara">
    ${skema.lsps.map((o, idx) => `<button type="button" role="tab" aria-selected="false" data-idx="${idx}">${esc(o.lsp)} <span class="muted">(${o.jml_unit} unit)</span></button>`).join('')}
  </div>
  <div id="skemaLspInfo" class="mt-12"></div>
  <div id="skemaUnitTable" class="mt-12"></div>`;
}

export function skemaLspInfoHTML(nama: string, lsp: LspItem | undefined): string {
  const badge =
    lsp?.status === 'Lisensi Aktif'
      ? '<span class="badge badge--green">✓ Lisensi Aktif</span>'
      : lsp?.status === 'Masa Berlaku Habis'
        ? '<span class="badge badge--red">✕ Masa Berlaku Habis</span>'
        : '';
  return `
  <div class="card card--lsp">
    <div class="split">
      <div><div class="h-sm">${esc(nama)}</div><div class="sub">Lembaga Sertifikasi Profesi</div></div>
      ${badge}
    </div>
    <div class="kv">
      <div><label>No SK</label><b class="mono">${esc(lsp?.no_sk || '—')}</b></div>
      <div><label>No Lisensi</label><b class="mono">${esc(lsp?.no_lisensi || '—')}</b></div>
      <div><label>Terakhir diperiksa</label><b>${esc(formatDateID(lsp?.last_checked))}</b></div>
    </div>
  </div>`;
}
