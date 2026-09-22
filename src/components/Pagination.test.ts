import { describe, expect, it } from 'vitest';
import { pagerHTML } from './Pagination.js';

describe('pagerHTML', () => {
  it('marks current page with aria-current and active class', () => {
    const html = pagerHTML(3, 10, 'skema');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('>3</button>');
  });

  it('disables prev on first page and next on last page', () => {
    const first = pagerHTML(1, 5, 'x');
    expect(first).toContain('disabled');
    const last = pagerHTML(5, 5, 'x');
    expect(last).toContain('disabled');
  });

  it('windows page numbers around current (±2)', () => {
    const html = pagerHTML(5, 10, 'x');
    expect(html).toContain('>3</button>');
    expect(html).toContain('>7</button>');
    expect(html).not.toContain('>1</button>');
    expect(html).not.toContain('>10</button>');
  });
});
