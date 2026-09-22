import type { SkemaItem } from '../types/database.js';
import { esc } from '../utils/dom.js';

export function skemaCardHTML(s: SkemaItem): string {
  return `
  <article class="card card--skema" data-skema="${esc(s.nama)}" tabindex="0" role="button" aria-label="Lihat penyelenggara skema ${esc(s.nama)}">
    <div class="card-top"><h3>${esc(s.nama)}</h3><span class="badge badge--orange">${s.total_unit} unit</span></div>
    <div class="sub">${s.jml_lsp} LSP penyelenggara</div>
    <div class="badges"><span class="badge">${s.jml_lsp} LSP</span></div>
  </article>`;
}
