import { esc } from '../utils/dom.js';

export function footerHTML(dataPer: string): string {
  return `
  <div class="footer">
    <div>Indonesian Certification Center (ICC) — Data LSP BNSP • Portal Skema &amp; Unit Kompetensi</div>
    <div class="footer-note">
      Data bersifat informatif dan bersumber dari publikasi
      <a href="https://bnsp.go.id/" target="_blank" rel="noopener">Badan Nasional Sertifikasi Profesi (BNSP)</a>.
      Status lisensi dapat berubah; pastikan keputusan penting dengan verifikasi langsung ke BNSP atau LSP terkait.
    </div>
    <div class="mt-6">Data per <b>${esc(dataPer)}</b></div>
  </div>`;
}
