export function formatCount(n: number): string {
  return n.toLocaleString('id-ID');
}

export function formatDateID(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

export function deslugify(slug: string): string {
  return slug.replace(/-/g, ' ');
}

/** Rapikan nama: pangkas spasi tepi + jadikan spasi ganda satu spasi. */
export function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr.slice()];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
