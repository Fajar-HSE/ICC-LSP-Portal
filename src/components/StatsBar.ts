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
    <div class="stat-mini-proof"><b class="fs-13">${s.multiLsp}</b><span>Skema di &gt;1 LSP</span></div>
  </section>
  <div class="proof-meta">
    <span class="inline-badge">${s.detail}</span>
    <span class="inline-badge">${s.unitSub}</span>
    <span class="badge badge--green">✓ ${s.aktif} Aktif</span>
    <span class="badge badge--red">✕ ${s.habis} Habis</span>
  </div>`;
}
