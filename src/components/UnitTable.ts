import type { UnitRow } from '../types/database.js';
import type { UnitSortKey } from '../types/ui.js';
import { esc } from '../utils/dom.js';

export function unitTableHTML(rows: UnitRow[], sortKey: UnitSortKey, dir: 1 | -1): string {
  const arrow = (k: UnitSortKey): string => (sortKey === k ? (dir === 1 ? ' ▲' : ' ▼') : '');
  const ariaSort = (k: UnitSortKey): string =>
    sortKey === k ? (dir === 1 ? 'ascending' : 'descending') : 'none';
  let html = `<div class="table-wrap"><table aria-label="Unit kompetensi, ${rows.length} baris"><thead><tr><th scope="col" style="width:48px">No</th>`;
  html += `<th scope="col" aria-sort="${ariaSort('kode')}" style="width:190px"><button type="button" data-sort="kode">Kode Unit${arrow('kode')}</button></th>`;
  html += `<th scope="col" aria-sort="${ariaSort('nama')}"><button type="button" data-sort="nama">Judul Unit Kompetensi${arrow('nama')}</button></th>`;
  html += '</tr></thead><tbody>';
  rows.forEach((u, idx) => {
    html += `<tr><td>${idx + 1}</td><td class="mono">${esc(u.kode)}</td><td>${esc(u.nama)}</td></tr>`;
  });
  html += '</tbody></table></div>';
  return html;
}

export function unitLoadingHTML(): string {
  return '<div class="loading" role="status"><div class="spinner" aria-hidden="true"></div><p class="mt-10">Memuat unit...</p></div>';
}

export function unitErrorHTML(message: string): string {
  return `<div class="empty" role="alert"><b>Gagal memuat unit</b><div>${esc(message)}</div><div class="mt-12"><button class="btn btn--primary" type="button" id="btnRetryUnits">Coba lagi</button></div></div>`;
}
