import type { LspItem, SkemaItem } from '../types/database.js';
import { searchLsp } from '../services/lsp.js';

export function searchLspItems(list: LspItem[], q: string, limit = 8): LspItem[] {
  return searchLsp(list, q, limit);
}

export function searchSkemaItems(list: SkemaItem[], q: string, limit = 8): SkemaItem[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const starts = list.filter((s) => s.nama.toLowerCase().startsWith(query));
  const includes = list.filter(
    (s) => s.nama.toLowerCase().includes(query) && !s.nama.toLowerCase().startsWith(query),
  );
  return starts.concat(includes).slice(0, limit);
}
