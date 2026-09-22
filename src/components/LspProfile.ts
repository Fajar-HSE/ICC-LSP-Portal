import type { LspItem } from '../types/database.js';
import { esc } from '../utils/dom.js';
import { formatDateID } from '../utils/format.js';

export function lspProfileHTML(lsp: LspItem): string {
  const isActive = lsp.status === 'Lisensi Aktif';
  return `
  <button class="back" type="button" id="btnBackHome">← Kembali ke pencarian</button>
  <div class="profile-header" style="margin-top:12px">
    <div class="profile-top">
      <div>
        <div style="font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)">Lembaga Sertifikasi Profesi</div>
        <div style="font-family:Fraunces,serif;font-size:24px;font-weight:900;margin-top:4px">${esc(lsp.nama)}</div>
        <div class="sub" style="margin-top:4px">${lsp.jml_skema} skema sertifikasi • Terakhir diperiksa ${esc(formatDateID(lsp.last_checked))}</div>
      </div>
      <div style="text-align:right;display:grid;gap:8px;justify-items:end">
        <div>${isActive ? '<span class="badge badge--green" style="padding:8px 14px;font-size:12px">🟢 Aktif</span>' : '<span class="badge badge--red" style="padding:8px 14px;font-size:12px">🔴 Masa Berlaku Habis</span>'}</div>
        <div style="font-size:11px;color:var(--muted)">No. Lisensi<br /><b class="mono" style="color:var(--text)">${esc(lsp.no_lisensi || '—')}</b></div>
      </div>
    </div>
    <div class="kv">
      <div><label>Status Lisensi</label><b>${isActive ? '✓ Lisensi Aktif' : '✕ Masa Berlaku Habis'}</b></div>
      <div><label>No. SK</label><b class="mono">${esc(lsp.no_sk || '—')}</b></div>
      <div><label>Masa Berlaku</label><b>${isActive ? 'Aktif' : 'Perlu perpanjangan'}</b></div>
    </div>
  </div>
  <div class="section-head"><div><h2>Skema Sertifikasi</h2><p id="lspSkemaCount"></p></div></div>
  <div class="table-wrap"><table aria-label="Daftar skema ${esc(lsp.nama)}">
    <thead><tr><th scope="col">No</th><th scope="col">Nama Skema</th><th scope="col">Unit</th><th scope="col">Aksi</th></tr></thead>
    <tbody id="lspSkemaTableBody"></tbody>
  </table></div>
  <div id="lspSkemaPager"></div>`;
}
