import type { LspItem, SkemaItem } from '../types/database.js';
import { esc } from '../utils/dom.js';
import { formatDateID } from '../utils/format.js';

export function skemaDetailHTML(skema: SkemaItem): string {
  return `
  <button class="back" type="button" id="btnBackHome">← Kembali</button>
  <div class="card card--skema" style="margin-top:12px">
    <div class="card-top">
      <div>
        <div style="font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)">Skema Sertifikasi</div>
        <div style="font-family:Fraunces,serif;font-size:22px;font-weight:900;margin-top:4px">${esc(skema.nama)}</div>
        <div class="sub" style="margin-top:6px">Tersedia di ${skema.jml_lsp} LSP • total ${skema.total_unit} unit kompetensi</div>
      </div>
      <span class="badge badge--orange" style="align-self:start">${skema.total_unit} unit</span>
    </div>
  </div>
  <div style="margin-top:14px" class="pills" role="tablist" aria-label="Pilih LSP penyelenggara">
    ${skema.lsps.map((o, idx) => `<button type="button" role="tab" aria-selected="false" data-idx="${idx}">${esc(o.lsp)} <span style="color:var(--muted)">(${o.jml_unit} unit)</span></button>`).join('')}
  </div>
  <div id="skemaLspInfo" style="margin-top:12px"></div>
  <div id="skemaUnitTable" style="margin-top:12px"></div>`;
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
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div><div style="font-size:16px;font-weight:900">${esc(nama)}</div><div class="sub">Lembaga Sertifikasi Profesi</div></div>
      ${badge}
    </div>
    <div class="kv" style="margin-bottom:0">
      <div><label>No SK</label><b class="mono">${esc(lsp?.no_sk || '—')}</b></div>
      <div><label>No Lisensi</label><b class="mono">${esc(lsp?.no_lisensi || '—')}</b></div>
      <div><label>Terakhir diperiksa</label><b>${esc(formatDateID(lsp?.last_checked))}</b></div>
    </div>
  </div>`;
}
