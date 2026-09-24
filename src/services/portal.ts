import type { LspItem, LspRow, SkemaItem, SkemaRow } from '../types/database.js';
import type { LspFilter, SkemaSort } from '../types/ui.js';
import { normalizeName } from '../utils/format.js';
import { searchPage } from './search.js';
import { fetchAll, fetchWhere, getSupabaseConfig } from './supabase.js';
import { topLsp } from './lsp.js';
import { buildData, groupSkemaRows, sortSkemaItems } from './skema.js';

export interface PortalStats {
  total_lsp: number;
  aktif: number;
  habis: number;
  total_unit: number;
  skema_jenis: number;
  multi_lsp: number;
  latest_checked: string | null;
}

export interface SkemaSummary {
  nama: string;
  jml_lsp: number;
  total_unit: number;
}

export interface SkemaPage {
  total: number;
  items: SkemaSummary[];
}

export interface SuggestLsp {
  nama: string;
  status: string;
  jml_skema: number;
}

/** Panggil RPC PostgREST (GET). Lempar error jelas bila fungsi belum di-deploy. */
async function rpc<T>(fn: string, params: Record<string, string | number> = {}): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const query = qs.toString();
  const res = await fetch(`${url}/rest/v1/rpc/${fn}${query ? `?${query}` : ''}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`RPC ${fn} gagal: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function fetchPortalStats(): Promise<PortalStats> {
  return rpc<PortalStats>('portal_stats');
}

export function fetchTopLsp(status: LspFilter, limit: number): Promise<LspItem[]> {
  return rpc<LspItem[]>('top_lsp', { p_status: status, p_limit: limit });
}

export function fetchSkemaPage(sort: SkemaSort, page: number, size: number): Promise<SkemaPage> {
  return rpc<SkemaPage>('skema_page', { p_sort: sort, p_page: page, p_size: size });
}

export const FULL_LSP_SELECT = 'id,nama,jml_skema,status,no_sk,no_lisensi,last_checked';
export const FULL_SKEMA_SELECT = 'id,nama,id_skema,lsp_id,jml_unit';

interface LegacyCache {
  lspList: LspItem[];
  skemaList: SkemaItem[];
}

let legacy: LegacyCache | null = null;

/** Fallback bila RPC belum di-deploy: hitung dari unduhan penuh (sekali saja). */
async function ensureLegacy(): Promise<LegacyCache> {
  if (!legacy) {
    const [lspRows, skemaRows] = await Promise.all([
      fetchAll('lsp', FULL_LSP_SELECT),
      fetchAll('skema', FULL_SKEMA_SELECT),
    ]);
    const built = buildData(lspRows as unknown as LspRow[], skemaRows as unknown as SkemaRow[]);
    legacy = { lspList: built.lspList, skemaList: built.skemaList };
  }
  return legacy;
}

function deriveStats(lspList: LspItem[], skemaList: SkemaItem[], latest: string): PortalStats {
  const aktif = lspList.filter((l) => l.status === 'Lisensi Aktif').length;
  const habis = lspList.filter((l) => l.status === 'Masa Berlaku Habis').length;
  return {
    total_lsp: lspList.length,
    aktif,
    habis,
    total_unit: skemaList.reduce((s, o) => s + o.total_unit, 0),
    skema_jenis: skemaList.length,
    multi_lsp: skemaList.filter((s) => s.jml_lsp > 1).length,
    latest_checked: latest || null,
  };
}

/** Statistik home: RPC bila ada, warisan bila belum. */
export async function getStats(): Promise<PortalStats> {
  try {
    return await fetchPortalStats();
  } catch {
    const b = await ensureLegacy();
    const latest = b.lspList.reduce((m, l) => (l.last_checked > m ? l.last_checked : m), '');
    return deriveStats(b.lspList, b.skemaList, latest);
  }
}

/** Top LSP home: RPC bila ada, warisan bila belum. */
export async function getTopLsp(filter: LspFilter, limit = 6): Promise<LspItem[]> {
  try {
    return await fetchTopLsp(filter, limit);
  } catch {
    const b = await ensureLegacy();
    return topLsp(b.lspList, filter, limit);
  }
}

/** Halaman skema home: RPC bila ada, warisan bila belum. */
export async function getSkemaPage(sort: SkemaSort, page: number, size: number): Promise<SkemaPage> {
  try {
    return await fetchSkemaPage(sort, page, size);
  } catch {
    const b = await ensureLegacy();
    const sorted = sortSkemaItems(b.skemaList, sort);
    const safePage = Math.max(1, Math.floor(page));
    const start = (safePage - 1) * size;
    return {
      total: sorted.length,
      items: sorted
        .slice(start, start + size)
        .map(({ nama, jml_lsp, total_unit }) => ({ nama, jml_lsp, total_unit })),
    };
  }
}

function toLspItem(r: Record<string, unknown>): LspItem {
  return {
    id: Number(r['id'] ?? 0),
    nama: normalizeName(String(r['nama'] ?? '')),
    jml_skema: Number(r['jml_skema'] ?? 0),
    status: String(r['status'] ?? ''),
    no_sk: String(r['no_sk'] ?? ''),
    no_lisensi: String(r['no_lisensi'] ?? ''),
    last_checked: String(r['last_checked'] ?? ''),
  };
}

/** Satu baris LSP via pencocokan nama eksak (case-insensitive). */
export async function fetchLspByName(name: string): Promise<LspItem | null> {
  const rows = await fetchWhere('lsp', FULL_LSP_SELECT, `nama=ilike.${encodeURIComponent(name)}`, 5);
  const match = rows.find((r) => String(r['nama'] ?? '').toLowerCase() === name.toLowerCase());
  return match ? toLspItem(match) : null;
}

/** Daftar skema unik satu LSP + total unit, terurut abjad. */
export async function fetchLspSkemaNames(
  lspId: number,
): Promise<{ nama: string; units: number }[]> {
  const rows = await fetchWhere('skema', 'nama,jml_unit,lsp_id', `lsp_id=eq.${lspId}`);
  const agg = new Map<string, { nama: string; units: number }>();
  for (const r of rows) {
    if (Number(r['lsp_id'] ?? -1) !== lspId) continue;
    const nama = normalizeName(String(r['nama'] ?? ''));
    if (!nama) continue;
    const key = nama.toLowerCase();
    const cur = agg.get(key) ?? { nama, units: 0 };
    cur.units += Number(r['jml_unit'] ?? 0);
    agg.set(key, cur);
  }
  return [...agg.values()].sort((a, b) => a.nama.localeCompare(b.nama));
}

/** Satu grup skema lintas LSP + info LSP penyelenggara. */
export async function fetchSkemaGroup(
  name: string,
): Promise<{ group: SkemaItem | null; info: Map<number, LspItem> }> {
  const rows = (await fetchWhere(
    'skema',
    FULL_SKEMA_SELECT,
    `nama=ilike.${encodeURIComponent(name)}`,
  )) as unknown as SkemaRow[];
  const lspIds = [...new Set(rows.map((r) => r.lsp_id))];
  const info = new Map<number, LspItem>();
  if (lspIds.length > 0) {
    const lspRows = await fetchWhere('lsp', FULL_LSP_SELECT, `id=in.(${lspIds.join(',')})`);
    for (const r of lspRows) {
      const item = toLspItem(r);
      info.set(item.id, item);
    }
  }
  const lspMap: Record<number, string> = {};
  for (const [id, item] of info) lspMap[id] = item.nama;
  const group =
    groupSkemaRows(rows, lspMap).find((g) => g.nama.toLowerCase() === name.toLowerCase()) ?? null;
  return { group, info };
}

/** Id skema untuk satu LSP + nama eksak (untuk memuat unit). */
export async function fetchSkemaId(lspId: number, name: string): Promise<number | null> {
  const rows = await fetchWhere(
    'skema',
    'id,nama,lsp_id',
    `lsp_id=eq.${lspId}&nama=ilike.${encodeURIComponent(name)}`,
    5,
  );
  const match = rows.find(
    (r) =>
      Number(r['lsp_id'] ?? -1) === lspId &&
      String(r['nama'] ?? '').toLowerCase() === name.toLowerCase(),
  );
  return match ? Number(match['id']) : null;
}

/** Peta id → nama LSP untuk sekumpulan id (batch tunggal). */
export async function fetchLspMap(ids: number[]): Promise<Record<number, string>> {
  if (ids.length === 0) return {};
  const rows = await fetchWhere('lsp', 'id,nama', `id=in.(${ids.join(',')})`);
  const map: Record<number, string> = {};
  for (const r of rows) map[Number(r['id'])] = normalizeName(String(r['nama'] ?? ''));
  return map;
}

/** Saran autocomplete LSP dari server (nama + lisensi + SK). */
export async function suggestLsp(query: string, limit = 8): Promise<SuggestLsp[]> {
  const { rows } = await searchPage(
    'lsp',
    'nama,status,jml_skema',
    ['nama', 'no_lisensi', 'no_sk'],
    query,
    1,
    limit,
  );
  return rows.map((r) => ({
    nama: String(r['nama'] ?? ''),
    status: String(r['status'] ?? ''),
    jml_skema: Number(r['jml_skema'] ?? 0),
  }));
}

/** Saran nama skema unik dari server (tanpa hitung agregat per saran). */
export async function suggestSkema(query: string, limit = 8): Promise<string[]> {
  const { rows } = await searchPage('skema', 'nama', 'nama', query, 1, 50);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const nama = normalizeName(String(r['nama'] ?? ''));
    const key = nama.toLowerCase();
    if (!nama || seen.has(key)) continue;
    seen.add(key);
    out.push(nama);
    if (out.length >= limit) break;
  }
  return out;
}
