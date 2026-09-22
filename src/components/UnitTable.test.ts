import { describe, expect, it } from 'vitest';
import { unitErrorHTML, unitTableHTML } from './UnitTable.js';

const rows = [
  { kode: 'B.02', nama: 'Beta' },
  { kode: 'A.01', nama: 'Alpha' },
];

describe('unitTableHTML', () => {
  it('announces sort direction via aria-sort', () => {
    const html = unitTableHTML(rows, 'kode', 1);
    expect(html).toContain('aria-sort="ascending"');
    expect(unitTableHTML(rows, 'nama', -1)).toContain('aria-sort="descending"');
  });

  it('numbers rows sequentially', () => {
    const html = unitTableHTML(rows, 'kode', 1);
    expect(html).toContain('<td>1</td>');
    expect(html).toContain('<td>2</td>');
  });

  it('escapes unit names', () => {
    const html = unitTableHTML([{ kode: 'X', nama: '<b>x</b>' }], 'kode', 1);
    expect(html).not.toContain('<b>x</b>');
  });
});

describe('unitErrorHTML', () => {
  it('exposes retry button for recovery', () => {
    expect(unitErrorHTML('boom')).toContain('id="btnRetryUnits"');
  });
});
