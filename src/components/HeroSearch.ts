import type { PrimaryMode } from '../types/ui.js';

export function heroHTML(mode: PrimaryMode, lastUpdated: string): string {
  const isLsp = mode === 'lsp';
  return `
  <section class="hero--engine" aria-labelledby="heroTitle">
    <div class="kicker"><i aria-hidden="true"></i> Search Engine Sertifikasi Kompetensi Indonesia • Live BNSP</div>
    <h2 id="heroTitle">Temukan <em>LSP</em> &amp; Skema Sertifikasi BNSP</h2>
    <p class="subhero"><b>295+ LSP</b> · <b>Ribuan Skema</b> · <b>Ribuan Unit Kompetensi</b> — Portal data LSP &amp; Skema Indonesia. Data BNSP live &amp; terverifikasi.</p>
    <div class="primary-actions" role="tablist" aria-label="Apa yang ingin Anda cari?">
      <button type="button" role="tab" aria-selected="${isLsp}" class="${isLsp ? 'active' : ''}" data-mode="lsp">🏢 Cari LSP</button>
      <button type="button" role="tab" aria-selected="${!isLsp}" class="${!isLsp ? 'active' : ''}" data-mode="skema">📜 Cari Skema Sertifikasi</button>
    </div>
    <div class="search-single">
      <span aria-hidden="true" style="font-size:16px;opacity:.6;margin-left:6px">🔎</span>
      <input id="primarySearch" type="text" role="combobox" aria-expanded="false" aria-controls="acPrimary" aria-autocomplete="list"
        placeholder="${isLsp ? 'Cari LSP — misal: K3, Digital, Pariwisata, Migas...' : 'Cari Skema Sertifikasi — misal: Digital Marketing, K3 Umum, Barista...'}" autocomplete="off" aria-label="Pencarian utama" />
      <button class="btn-search" type="button" id="btnPrimarySearch">Cari</button>
      <div id="acPrimary" class="ac" role="listbox" aria-label="Saran pencarian" style="top:calc(100% + 8px);left:8px;right:8px"></div>
    </div>
    <div class="trust">
      <span><i aria-hidden="true">✓</i> Data LSP BNSP</span>
      <span><i aria-hidden="true">✓</i> Terverifikasi BNSP</span>
      <span><i aria-hidden="true">✓</i> Update Berkala</span>
      <span>Last update: <b id="lastUpdatedLabel">${lastUpdated || '—'}</b></span>
    </div>
  </section>`;
}
