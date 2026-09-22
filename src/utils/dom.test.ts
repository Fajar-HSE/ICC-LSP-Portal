import { describe, expect, it } from 'vitest';
import { debounce, esc, highlight } from './dom.js';

describe('dom esc', () => {
  it('escapes HTML entities', () => {
    expect(esc('<b>"&"</b>')).toBe('&lt;b&gt;&quot;&amp;&quot;&lt;/b&gt;');
  });

  it('handles non-string input', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc(123)).toBe('123');
  });
});

describe('dom highlight', () => {
  it('wraps query matches with em', () => {
    const out = highlight('LSP K3 Umum', 'k3');
    expect(out).toContain('<em>');
    expect(out).toContain('K3');
  });

  it('escapes before highlighting to prevent XSS', () => {
    const out = highlight('<script>alert(1)</script>', 'script');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;');
  });

  it('returns escaped text when query empty', () => {
    expect(highlight('<b>hi</b>', '')).toBe('&lt;b&gt;hi&lt;/b&gt;');
  });
});

describe('dom debounce', () => {
  it('delays function calls', async () => {
    let calls = 0;
    const fn = debounce(() => {
      calls += 1;
    }, 20);
    fn();
    fn();
    fn();
    expect(calls).toBe(0);
    await new Promise((r) => setTimeout(r, 40));
    expect(calls).toBe(1);
  });
});
