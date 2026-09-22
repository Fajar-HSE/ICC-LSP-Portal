import { describe, expect, it } from 'vitest';
import { announce, focusMain } from './a11y.js';

describe('a11y focusMain', () => {
  it('moves keyboard focus to main content on view change', () => {
    document.body.innerHTML = '<main id="mainContent" tabindex="-1"></main>';
    focusMain();
    expect(document.activeElement?.id).toBe('mainContent');
  });

  it('does nothing when main is missing', () => {
    document.body.innerHTML = '';
    expect(() => focusMain()).not.toThrow();
  });
});

describe('a11y announce', () => {
  it('creates live region and sets message', async () => {
    announce('5 hasil ditemukan');
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const live = document.getElementById('a11y-live');
    expect(live).not.toBeNull();
    expect(live?.getAttribute('aria-live')).toBe('polite');
  });
});
