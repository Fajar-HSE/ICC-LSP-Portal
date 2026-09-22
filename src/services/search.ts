import { getSupabaseConfig } from './supabase.js';

export interface SearchRequest {
  path: string;
  range: string;
}

export interface SearchResult {
  rows: Record<string, unknown>[];
  total: number;
}

/** Bersihkan wildcard ilike agar query user tidak jadi pola berbahaya. */
export function escapeIlike(q: string): string {
  return q.replace(/\*/g, '').trim();
}

export function buildSearchRequest(
  table: string,
  select: string,
  column: string,
  query: string,
  page: number,
  pageSize: number,
): SearchRequest | null {
  const q = escapeIlike(query);
  if (!q) return null;
  const safePage = Math.max(1, Math.floor(page));
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize - 1;
  const params = new URLSearchParams({
    select,
    [column]: `ilike.*${q}*`,
    order: `${column}.asc`,
  });
  return { path: `${table}?${params.toString()}`, range: `${start}-${end}` };
}

export function parseContentRange(header: string | null): number | null {
  if (!header) return null;
  const m = /\/(\d+)$/.exec(header.trim());
  return m?.[1] === undefined ? null : Number(m[1]);
}

export async function searchPage(
  table: string,
  select: string,
  column: string,
  query: string,
  page: number,
  pageSize: number,
): Promise<SearchResult> {
  const req = buildSearchRequest(table, select, column, query, page, pageSize);
  if (!req) return { rows: [], total: 0 };
  const { url, key } = getSupabaseConfig();
  const res = await fetch(`${url}/rest/v1/${req.path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      Prefer: 'count=exact',
      Range: req.range,
    },
  });
  if (!res.ok) {
    throw new Error(`Pencarian ${table} gagal: ${res.status}`);
  }
  const rows = (await res.json()) as Record<string, unknown>[];
  const total = parseContentRange(res.headers.get('Content-Range')) ?? rows.length;
  return { rows, total };
}
