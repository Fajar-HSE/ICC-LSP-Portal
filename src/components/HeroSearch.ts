import type { PrimaryMode } from '../types/ui.js';

export type TabSource = 'click' | 'key';

export function heroHTML(mode: PrimaryMode): string {
  const isLsp = mode === 'lsp';
  return `
  <section class="hero--engine" aria-labelledby="heroTitle">
    <div class="kicker"><i aria-hidden="true"></i> Search Engine Sertifikasi Kompetensi Indonesia • Data BNSP diperbarui mingguan</div>
    <h2 id="heroTitle">Temukan <em>LSP</em> &amp; Skema Sertifikasi BNSP</h2>
    <p class="subhero"><b id="heroLspCount">…</b> LSP · <b id="heroSkemaCount">…</b> skema · <b id="heroUnitCount">…</b> unit kompetensi — Portal data LSP &amp; Skema Indonesia. Sumber data: BNSP, diperbarui mingguan.</p>
    <div class="primary-actions" role="tablist" aria-label="Apa yang ingin Anda cari?">
      <button type="button" role="tab" aria-selected="${isLsp}" aria-controls="searchPanel" tabindex="${isLsp ? '0' : '-1'}" class="${isLsp ? 'active' : ''}" data-mode="lsp">🏢 Cari LSP</button>
      <button type="button" role="tab" aria-selected="${!isLsp}" aria-controls="searchPanel" tabindex="${!isLsp ? '0' : '-1'}" class="${!isLsp ? 'active' : ''}" data-mode="skema">📜 Cari Skema Sertifikasi</button>
    </div>
    <div class="search-single" id="searchPanel">
      <span class="search-ico" aria-hidden="true">🔎</span>
      <input id="primarySearch" type="text" role="combobox" aria-expanded="false" aria-controls="acPrimary" aria-autocomplete="list"
        placeholder="${isLsp ? 'Cari LSP — nama atau no. lisensi/SK...' : 'Cari Skema Sertifikasi — misal: Digital Marketing, K3 Umum, Barista...'}" autocomplete="off" aria-label="Pencarian utama" />
      <button class="btn-search" type="button" id="btnPrimarySearch">Cari</button>
      <div id="acPrimary" class="ac" role="listbox" aria-label="Saran pencarian" style="top:calc(100% + 8px);left:8px;right:8px"></div>
    </div>
    <div class="trust">
      <span><i aria-hidden="true">✓</i> Sumber data: <a href="https://bnsp.go.id/" target="_blank" rel="noopener">BNSP</a></span>
      <span><i aria-hidden="true">✓</i> Diperbarui mingguan</span>
    </div>
  </section>`;
}

/**
 * Pola tabs APG: klik mengaktifkan; panah kiri/kanan, Home, End
 * memindahkan + mengaktifkan dengan roving tabindex.
 */
export function bindPrimaryTabs(
  slot: HTMLElement,
  onMode: (mode: PrimaryMode, source: TabSource) => void,
): void {
  const btns = [...slot.querySelectorAll<HTMLButtonElement>('.primary-actions button')];
  const modes = btns.map((b) => (b.getAttribute('data-mode') === 'skema' ? 'skema' : 'lsp'));
  const activate = (idx: number, source: TabSource): void => {
    if (btns.length === 0) return;
    const i = ((idx % btns.length) + btns.length) % btns.length;
    btns.forEach((b, j) => {
      const active = j === i;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
      b.setAttribute('tabindex', active ? '0' : '-1');
    });
    btns[i]?.focus();
    const m: PrimaryMode = modes[i] ?? 'lsp';
    onMode(m, source);
  };
  btns.forEach((b, i) => {
    b.addEventListener('click', () => activate(i, 'click'));
  });
  slot.addEventListener('keydown', (e) => {
    if (!(e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End')) return;
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.primary-actions')) return;
    e.preventDefault();
    const cur = btns.findIndex((b) => b.classList.contains('active'));
    if (e.key === 'ArrowRight') activate(cur + 1, 'key');
    else if (e.key === 'ArrowLeft') activate(cur - 1, 'key');
    else if (e.key === 'Home') activate(0, 'key');
    else activate(btns.length - 1, 'key');
  });
}
