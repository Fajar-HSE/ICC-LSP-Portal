export function pagerHTML(current: number, total: number, kind: string): string {
  let html = `<div class="pager" role="navigation" aria-label="Paginasi ${kind}">`;
  html += `<button type="button" data-page="${current - 1}"${current <= 1 ? ' disabled' : ''} aria-label="Halaman sebelumnya">← Sebelumnya</button>`;
  const from = Math.max(1, current - 2);
  const to = Math.min(total, current + 2);
  for (let p = from; p <= to; p++) {
    html += `<button type="button" data-page="${p}" class="${p === current ? 'active' : ''}"${p === current ? ' aria-current="page"' : ''}>${p}</button>`;
  }
  html += `<button type="button" data-page="${current + 1}"${current >= total ? ' disabled' : ''} aria-label="Halaman berikutnya">Berikutnya →</button>`;
  html += '</div>';
  return html;
}

export function bindPager(container: HTMLElement, onPage: (page: number) => void): void {
  container.querySelectorAll<HTMLButtonElement>('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = Number(btn.getAttribute('data-page'));
      if (Number.isFinite(page)) onPage(page);
    });
  });
}
