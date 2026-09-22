export interface StatsData {
  totalLsp: string;
  totalSkema: string;
  totalUnit: string;
  multiLsp: string;
  detail: string;
  unitSub: string;
  aktif: string;
  habis: string;
}

export function statsHTML(s: StatsData): string {
  return `
  <section class="stats--proof" aria-label="Statistik kredibilitas">
    <div class="stat-mini-proof"><b>${s.totalLsp}</b><span>Total LSP</span></div>
    <div class="stat-mini-proof"><b>${s.totalSkema}</b><span>Jenis Skema</span></div>
    <div class="stat-mini-proof"><b>${s.totalUnit}</b><span>Unit Kompetensi</span></div>
    <div class="stat-mini-proof"><b style="font-size:13px">${s.multiLsp}</b><span>Skema di &gt;1 LSP</span></div>
  </section>
  <div style="max-width:880px;margin:8px auto 0;padding:0 24px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;font-size:11px;color:var(--muted)">
    <span class="inline-badge">${s.detail}</span>
    <span class="inline-badge">${s.unitSub}</span>
    <span class="badge" style="background:var(--green-soft);border-color:#B7F0D1;color:#065F46">✓ ${s.aktif} Aktif</span>
    <span class="badge" style="background:var(--red-soft);border-color:#FFD1DC;color:#9F1239">✕ ${s.habis} Habis</span>
  </div>`;
}
