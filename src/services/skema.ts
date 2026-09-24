import type {
  LspItem,
  LspRow,
  SkemaItem,
  SkemaRow,
} from '../types/database.js';
import type { SkemaSort } from '../types/ui.js';
import { normalizeName } from '../utils/format.js';

export interface BuiltData {
  lspList: LspItem[];
  skemaList: SkemaItem[];
  lspMap: Record<number, string>;
  latestChecked: string;
}

export function buildData(lspRows: LspRow[], skemaRows: SkemaRow[]): BuiltData {
  const cleanLsp = lspRows.map((l) => ({ ...l, nama: normalizeName(l.nama) }));
  const cleanSkema = skemaRows.map((s) => ({ ...s, nama: normalizeName(s.nama) }));
  const lspList: LspItem[] = cleanLsp.map((l) => ({
    id: l.id,
    nama: l.nama,
    jml_skema: l.jml_skema ?? 0,
    status: l.status ?? '',
    no_sk: l.no_sk ?? '',
    no_lisensi: l.no_lisensi ?? '',
    last_checked: l.last_checked ?? '',
  }));

  let latestChecked = '';
  for (const l of lspRows) {
    if (l.last_checked && l.last_checked > latestChecked) {
      latestChecked = l.last_checked;
    }
  }

  const lspMap: Record<number, string> = {};
  for (const l of lspList) lspMap[l.id] = l.nama;

  // Hitung skema unik per LSP (nama unik ternormalisasi, bukan row count)
  const lspSkemaSet: Record<string, Set<string>> = {};
  for (const s of cleanSkema) {
    const key = String(s.lsp_id);
    if (!lspSkemaSet[key]) lspSkemaSet[key] = new Set();
    lspSkemaSet[key].add(s.nama.toLowerCase());
  }
  for (const l of lspList) {
    const set = lspSkemaSet[String(l.id)];
    if (set) l.jml_skema = set.size;
  }

  const skemaList = groupSkemaRows(cleanSkema, lspMap);

  return { lspList, skemaList, lspMap, latestChecked };
}

/**
 * Kelompokkan baris skema per nama (case-insensitive + spasi ternormalisasi)
 * lintas LSP. Normalisasi di sini juga agar hasil pencarian server
 * (yang tidak lewat buildData) tampil rapi.
 */
export function groupSkemaRows(
  rows: SkemaRow[],
  lspMap: Record<number, string>,
): SkemaItem[] {
  const group = new Map<string, { nama: string; lsps: SkemaItem['lsps'] }>();
  for (const s of rows) {
    const nama = normalizeName(s.nama);
    const key = nama.toLowerCase();
    let g = group.get(key);
    if (!g) {
      g = { nama, lsps: [] };
      group.set(key, g);
    }
    g.lsps.push({
      lsp: lspMap[s.lsp_id] ?? 'Unknown',
      lsp_id: s.lsp_id,
      id_skema: s.id_skema,
      jml_unit: s.jml_unit ?? 0,
      skema_id: s.id,
    });
  }

  return [...group.keys()].sort().map((key) => {
    const g = group.get(key);
    if (!g) throw new Error('unreachable');
    g.lsps.sort((a, b) => a.lsp.localeCompare(b.lsp));
    const total_unit = g.lsps.reduce((sum, o) => sum + o.jml_unit, 0);
    return { nama: g.nama, jml_lsp: g.lsps.length, total_unit, lsps: g.lsps };
  });
}

/** Urutkan daftar skema untuk browsing; tidak mengubah array asli. */
export function sortSkemaItems(list: SkemaItem[], sort: SkemaSort): SkemaItem[] {
  const out = list.slice();
  if (sort === 'nama-desc') {
    out.sort((a, b) => b.nama.localeCompare(a.nama));
  } else if (sort === 'unit-desc') {
    out.sort((a, b) => b.total_unit - a.total_unit);
  } else {
    out.sort((a, b) => a.nama.localeCompare(b.nama));
  }
  return out;
}
