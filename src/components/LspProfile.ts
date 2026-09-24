import type { LspItem } from '../types/database.js';
import { esc } from '../utils/dom.js';
import { formatDateID } from '../utils/format.js';

export function lspProfileHTML(lsp: LspItem): string {
  const isActive = lsp.status === 'Lisensi Aktif';
  return `
  <button class="back" type="button" id="btnBackHome">← Kembali ke pencarian</button>
  <div class="profile-header mt-12">
    <div class="profile-top">
      <div>
        <div class="lbl">Lembaga Sertifikasi Profesi</div>
        <div class="h-profile">${esc(lsp.nama)}</div>
        <div class="sub mt-4">${lsp.jml_skema} skema sertifikasi • Terakhir diperiksa ${esc(formatDateID(lsp.last_checked))}</div>
      </div>
      <div class="profile-side">
        <div>${isActive ? '<span class="badge badge--green badge--lg">🟢 Aktif</span>' : '<span class="badge badge--red badge--lg">🔴 Masa Berlaku Habis</span>'}</div>
        <div><span class="lbl">No. Lisensi</span><br /><b class="mono txt">${esc(lsp.no_lisensi || '—')}</b></div>
      </div>
    </div>
    <div class="kv">
      <div><label>Status Lisensi</label><b>${isActive ? '✓ Lisensi Aktif' : '✕ Masa Berlaku Habis'}</b></div>
      <div><label>No. SK</label><b class="mono">${esc(lsp.no_sk || '—')}</b></div>
      <div><label>Masa Berlaku</label><b>${isActive ? 'Aktif' : 'Perlu perpanjangan'}</b></div>
    </div>
  </div>
  <div class="card card--lsp mt-12"><div class="sub"><b>Butuh kontak LSP ini?</b> Data kontak tidak tersedia di data terbuka BNSP. Hubungi Call Center BNSP <b class="mono">0812 8888 7014</b> / <a href="mailto:admin@bnsp.go.id">admin@bnsp.go.id</a> atau kunjungi <a href="https://bnsp.go.id/" target="_blank" rel="noopener">bnsp.go.id</a>.</div></div>
  <div class="section-head"><div><h2>Skema Sertifikasi</h2><p id="lspSkemaCount"></p></div></div>
  <div class="table-wrap"><table aria-label="Daftar skema ${esc(lsp.nama)}">
    <thead><tr><th scope="col">No</th><th scope="col">Nama Skema</th><th scope="col">Unit</th><th scope="col">Aksi</th></tr></thead>
    <tbody id="lspSkemaTableBody"></tbody>
  </table></div>
  <div id="lspSkemaPager"></div>`;
}
