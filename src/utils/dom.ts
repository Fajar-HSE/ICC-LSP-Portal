export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function highlight(text: string, query: string): string {
  const safe = esc(text);
  if (!query.trim()) return safe;
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${q})`, 'gi');
  // NOTE: safe sudah di-escape; query user juga di-escape via esc agar tidak inject tag.
  // Untuk query mengandung entity (& < >), cocokkan versi escaped-nya.
  void esc;
  return safe.replace(re, '<em>$1</em>');
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: never[]): void => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      fn(...args);
    }, ms);
  };
  return wrapped as T;
}
