import { describe, expect, it } from 'vitest';
import { footerHTML } from './Footer.js';

describe('footerHTML', () => {
  it('names BNSP as source with link and shows data date', () => {
    const html = footerHTML('05 Agu 2026');
    expect(html).toContain('https://bnsp.go.id/');
    expect(html).toContain('Data per');
    expect(html).toContain('05 Agu 2026');
  });

  it('carries an informational-use disclaimer', () => {
    const html = footerHTML('—');
    expect(html).toContain('informatif');
    expect(html).toContain('verifikasi');
  });
});
