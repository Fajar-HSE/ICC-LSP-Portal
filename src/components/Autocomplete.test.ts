import { describe, expect, it } from 'vitest';
import { renderAcSkema } from './Autocomplete.js';

describe('renderAcSkema without aggregates', () => {
  it('hides zero counts and invites opening the detail', () => {
    const box = document.createElement('div');
    const input = document.createElement('input');
    input.value = 'k3';
    let picked = '';
    renderAcSkema(box, input, [{ nama: 'K3 Umum', jml_lsp: 0, total_unit: 0 }], (n) => {
      picked = n;
    });
    expect(box.innerHTML).not.toContain('0 LSP');
    expect(box.innerHTML).toContain('Lihat penyelenggara');
    box.querySelector<HTMLElement>('.ac-item')?.click();
    expect(picked).toBe('K3 Umum');
  });
});
