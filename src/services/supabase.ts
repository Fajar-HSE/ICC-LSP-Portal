const FALLBACK_URL = 'https://ziybqtcdphuzhfoahopr.supabase.co';

// Publishable key (sb_publishable_...): dirancang publik untuk client-side,
// setara anon key, tunduk pada RLS read-only.
// Env VITE_SB_KEY menimpa bila diset; fallback ini menjaga deploy statis
// dan dev lokal tetap jalan tanpa secrets.
const FALLBACK_KEY = 'sb_publishable_0yUKTSy_QGWYgJrggRC5TA_M71e5fA_';

export function getSupabaseConfig(): { url: string; key: string } {
  const envUrl = import.meta.env['VITE_SB_URL'] as string | undefined;
  const envKey = import.meta.env['VITE_SB_KEY'] as string | undefined;
  const url = envUrl && envUrl.length > 0 ? envUrl : FALLBACK_URL;
  const key = envKey && envKey.length > 0 ? envKey : FALLBACK_KEY;
  return { url, key };
}

export async function fetchAll(
  table: string,
  select: string,
  pageSize = 1000,
): Promise<Record<string, unknown>[]> {
  return fetchWhere(table, select, '', pageSize);
}

/**
 * fetchAll + filter PostgREST mentah (mis. `lsp_id=eq.1`).
 * Dipakai untuk query tercakup (satu LSP, satu nama) agar tidak
 * mengunduh seluruh tabel.
 */
export async function fetchWhere(
  table: string,
  select: string,
  filter: string,
  pageSize = 1000,
): Promise<Record<string, unknown>[]> {
  const { url, key } = getSupabaseConfig();
  const results: Record<string, unknown>[] = [];
  let start = 0;
  const base = `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}${filter ? `&${filter}` : ''}`;

  for (;;) {
    const end = start + pageSize - 1;
    const res = await fetch(base, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        Range: `${start}-${end}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Supabase ${table} gagal: ${res.status}`);
    }
    const data = (await res.json()) as Record<string, unknown>[];
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < pageSize) break;
    start += pageSize;
  }
  return results;
}
