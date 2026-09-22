import type { LspItem } from '../types/database.js';
import type { LspFilter } from '../types/ui.js';
import { fetchAll, getSupabaseConfig } from './supabase.js';

export function filterLsp(list: LspItem[], filter: LspFilter): LspItem[] {
  if (filter === 'aktif') return list.filter((l) => l.status === 'Lisensi Aktif');
  if (filter === 'habis') return list.filter((l) => l.status === 'Masa Berlaku Habis');
  return list;
}

export function topLsp(list: LspItem[], filter: LspFilter, limit = 6): LspItem[] {
  return filterLsp(list, filter)
    .slice()
    .sort((a, b) => b.jml_skema - a.jml_skema)
    .slice(0, limit);
}

export function searchLsp(list: LspItem[], query: string, limit = 8): LspItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = list.filter((l) => l.nama.toLowerCase().startsWith(q));
  const includes = list.filter(
    (l) => l.nama.toLowerCase().includes(q) && !l.nama.toLowerCase().startsWith(q),
  );
  return starts.concat(includes).slice(0, limit);
}

export async function loadLspRows(): Promise<Record<string, unknown>[]> {
  const { url, key } = getSupabaseConfig();
  void url;
  void key;
  return fetchAll('lsp', 'id,nama,jml_skema,status,no_sk,no_lisensi,last_checked');
}
