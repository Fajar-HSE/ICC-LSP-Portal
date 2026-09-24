import { describe, expect, it, vi } from 'vitest';
import { bindPrimaryTabs, heroHTML } from './HeroSearch.js';

function setup(mode: 'lsp' | 'skema' = 'lsp'): { box: HTMLElement; onMode: (m: 'lsp' | 'skema') => void } {
  const box = document.createElement('div');
  box.innerHTML = heroHTML(mode);
  document.body.innerHTML = '';
  document.body.appendChild(box);
  const onMode = vi.fn();
  bindPrimaryTabs(box, onMode);
  return { box, onMode };
}

function tabs(box: HTMLElement): HTMLButtonElement[] {
  return [...box.querySelectorAll<HTMLButtonElement>('.primary-actions button')];
}

describe('bindPrimaryTabs', () => {
  it('activates clicked tab and moves roving tabindex', () => {
    const { box, onMode } = setup('lsp');
    tabs(box)[1]?.click();
    expect(onMode).toHaveBeenCalledWith('skema', 'click');
    expect(tabs(box)[1]?.getAttribute('tabindex')).toBe('0');
    expect(tabs(box)[0]?.getAttribute('tabindex')).toBe('-1');
  });

  it('moves with ArrowRight and activates', () => {
    const { box, onMode } = setup('lsp');
    tabs(box)[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onMode).toHaveBeenCalledWith('skema', 'key');
    expect(document.activeElement).toBe(tabs(box)[1]);
  });

  it('moves with ArrowLeft and jumps with Home/End', () => {
    const { box, onMode } = setup('skema');
    tabs(box)[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(onMode).toHaveBeenCalledWith('lsp', 'key');
    tabs(box)[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(onMode).toHaveBeenCalledWith('skema', 'key');
    tabs(box)[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(onMode).toHaveBeenCalledTimes(3);
  });
});
