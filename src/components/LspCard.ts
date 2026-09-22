import type { LspItem } from '../types/database.js';
import { esc } from '../utils/dom.js';

export function lspCardHTML(l: LspItem): string {
  const badge =
    l.status === 'Lisensi Aktif'
      ? '<span class="badge badge--green">✓ Aktif</span>'
      : l.status === 'Masa Berlaku Habis'
        ? '<span class="badge badge--red">✕ Habis</span>'
        : '';
  return `
  <article class="card card--lsp" data-lsp="${esc(l.nama)}" tabindex="0" role="button" aria-label="Lihat skema ${esc(l.nama)}">
    <div class="card-top"><h3>${esc(l.nama)}</h3><span class="badge badge--navy">${l.jml_skema} skema</span></div>
    <div class="sub">Lembaga Sertifikasi Profesi • ${esc(l.no_lisensi || 'No lisensi —')}</div>
    <div class="badges">${badge}<span class="badge">${esc(l.no_sk || 'No SK —')}</span></div>
  </article>`;
}
