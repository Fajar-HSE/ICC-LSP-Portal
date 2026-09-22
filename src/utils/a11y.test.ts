import { describe, expect, it } from 'vitest';
import { announce } from './a11y.js';

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
