const FALLBACK_URL = 'https://ziybqtcdphuzhfoahopr.supabase.co';

export function getSupabaseConfig(): { url: string; key: string } {
  const url = (import.meta.env['VITE_SB_URL'] as string | undefined) ?? FALLBACK_URL;
  const key = (import.meta.env['VITE_SB_KEY'] as string | undefined) ?? '';
  return { url, key };
}

export async function fetchAll(
  table: string,
  select: string,
  pageSize = 1000,
): Promise<Record<string, unknown>[]> {
  const { url, key } = getSupabaseConfig();
  const results: Record<string, unknown>[] = [];
  let start = 0;

  for (;;) {
    const end = start + pageSize - 1;
    const res = await fetch(
      `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          Range: `${start}-${end}`,
        },
      },
    );
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
