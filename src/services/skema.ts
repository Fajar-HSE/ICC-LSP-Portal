import type {
  LspItem,
  LspRow,
  SkemaItem,
  SkemaRow,
} from '../types/database.js';

export interface BuiltData {
  lspList: LspItem[];
  skemaList: SkemaItem[];
  lspMap: Record<number, string>;
  latestChecked: string;
}

export function buildData(lspRows: LspRow[], skemaRows: SkemaRow[]): BuiltData {
  const lspList: LspItem[] = lspRows.map((l) => ({
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

  // Hitung skema unik per LSP (nama unik, bukan row count)
  const lspSkemaSet: Record<string, Set<string>> = {};
  for (const s of skemaRows) {
    const key = String(s.lsp_id);
    if (!lspSkemaSet[key]) lspSkemaSet[key] = new Set();
    lspSkemaSet[key].add(s.nama);
  }
  for (const l of lspList) {
    const set = lspSkemaSet[String(l.id)];
    if (set) l.jml_skema = set.size;
  }

  // Group skema per nama (case-insensitive) lintas LSP
  const group = new Map<string, { nama: string; lsps: SkemaItem['lsps'] }>();
  for (const s of skemaRows) {
    const key = s.nama.toLowerCase();
    let g = group.get(key);
    if (!g) {
      g = { nama: s.nama, lsps: [] };
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

  const skemaList: SkemaItem[] = [...group.keys()]
    .sort()
    .map((key) => {
      const g = group.get(key);
      if (!g) throw new Error('unreachable');
      g.lsps.sort((a, b) => a.lsp.localeCompare(b.lsp));
      const total_unit = g.lsps.reduce((sum, o) => sum + o.jml_unit, 0);
      return { nama: g.nama, jml_lsp: g.lsps.length, total_unit, lsps: g.lsps };
    });

  return { lspList, skemaList, lspMap, latestChecked };
}
