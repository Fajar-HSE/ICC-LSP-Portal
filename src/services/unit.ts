import type { UnitRow } from '../types/database.js';
import { loadCache, saveCache } from '../utils/storage.js';
import { getSupabaseConfig } from './supabase.js';

const CACHE_TTL_MS = 10 * 60 * 1000;

interface UnitCacheEntry {
  at: number;
  units: UnitRow[];
}

export function sortUnits(rows: UnitRow[], key: 'kode' | 'nama', dir: 1 | -1): UnitRow[] {
  return rows
    .slice()
    .sort((a, b) => {
      const va = String(a[key] ?? '').toLowerCase();
      const vb = String(b[key] ?? '').toLowerCase();
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return 0;
    });
}

export async function fetchUnitsBySkema(skemaId: number): Promise<UnitRow[]> {
  const cacheKey = `unit:${skemaId}`;
  const cached = loadCache<UnitCacheEntry>(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.units;
  }

  const { url, key } = getSupabaseConfig();
  const res = await fetch(
    `${url}/rest/v1/unit_kompetensi?select=kode,nama&skema_id=eq.${skemaId}&order=kode.asc`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Gagal memuat unit: ${res.status}`);
  }
  const units = (await res.json()) as UnitRow[];
  saveCache(cacheKey, { at: Date.now(), units } satisfies UnitCacheEntry);
  return units;
}
