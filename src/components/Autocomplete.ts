import { esc, highlight } from '../utils/dom.js';
import { announce } from '../utils/a11y.js';

export interface AcLspRow {
  nama: string;
  status: string;
  jml_skema: number;
}

export interface AcSkemaRow {
  nama: string;
  jml_lsp: number;
  total_unit: number;
}

export function renderAcLsp(container: HTMLElement, input: HTMLInputElement, matches: AcLspRow[], onPick: (nama: string) => void): void {
  if (matches.length === 0) {
    container.innerHTML = '<div class="ac-empty">Tidak ada LSP — coba kata lain</div>';
    container.classList.add('show');
    input.setAttribute('aria-expanded', 'true');
    return;
  }
  container.innerHTML = matches
    .map(
      (m) =>
        `<div class="ac-item" role="option" tabindex="-1" data-nama="${esc(m.nama)}"><span><b>${highlight(m.nama, input.value)}</b><small>${esc(m.status || '')} • ${m.jml_skema} skema</small></span></div>`,
    )
    .join('');
  container.classList.add('show');
  input.setAttribute('aria-expanded', 'true');
  announce(`${matches.length} saran LSP ditemukan`);
  container.querySelectorAll<HTMLElement>('.ac-item').forEach((el) => {
    el.addEventListener('click', () => onPick(el.getAttribute('data-nama') ?? ''));
  });
}

export function renderAcSkema(container: HTMLElement, input: HTMLInputElement, matches: AcSkemaRow[], onPick: (nama: string) => void): void {
  if (matches.length === 0) {
    container.innerHTML = '<div class="ac-empty">Tidak ada Skema — coba kata lain</div>';
    container.classList.add('show');
    input.setAttribute('aria-expanded', 'true');
    return;
  }
  container.innerHTML = matches
    .map((m) => {
      const meta =
        m.jml_lsp > 0 ? `<small>${m.jml_lsp} LSP • ${m.total_unit} unit</small>` : '<small>Lihat penyelenggara →</small>';
      const tag = m.jml_lsp > 0 ? `<span class="tag">${m.jml_lsp} LSP</span>` : '';
      return `<div class="ac-item" role="option" tabindex="-1" data-nama="${esc(m.nama)}"><span><b>${highlight(m.nama, input.value)}</b>${meta}</span>${tag}</div>`;
    })
    .join('');
  container.classList.add('show');
  input.setAttribute('aria-expanded', 'true');
  announce(`${matches.length} saran skema ditemukan`);
  container.querySelectorAll<HTMLElement>('.ac-item').forEach((el) => {
    el.addEventListener('click', () => onPick(el.getAttribute('data-nama') ?? ''));
  });
}

export function hideAc(container: HTMLElement, input: HTMLInputElement): void {
  container.classList.remove('show');
  input.setAttribute('aria-expanded', 'false');
}
