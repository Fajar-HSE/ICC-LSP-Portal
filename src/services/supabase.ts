const FALLBACK_URL = 'https://ziybqtcdphuzhfoahopr.supabase.co';

// Anon key publik (public by design untuk client-side, RLS read-only).
// Env VITE_SB_KEY menimpa bila diset; fallback ini menjaga deploy statis
// tetap jalan tanpa secrets — perilaku sama seperti index.html lama.
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppeWJxdGNkcGh1emhmb2Fob3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3ODQ0NTUsImV4cCI6MjEwMDM2MDQ1NX0.pksC4kqaO3YIjqc2RQEEJnDiYYwu-HoT9vVoFRRi64I';

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
