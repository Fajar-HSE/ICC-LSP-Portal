import { bindHeader, headerHTML } from './components/Header.js';
import { heroHTML } from './components/HeroSearch.js';
import { hideAc, renderAcLsp, renderAcSkema } from './components/Autocomplete.js';
import { lspCardHTML } from './components/LspCard.js';
import { skemaCardHTML } from './components/SkemaCard.js';
import { bindPager, pagerHTML } from './components/Pagination.js';
import { lspProfileHTML } from './components/LspProfile.js';
import { skemaDetailHTML, skemaLspInfoHTML } from './components/SkemaDetail.js';
import { unitErrorHTML, unitLoadingHTML, unitTableHTML } from './components/UnitTable.js';
import { statsHTML } from './components/StatsBar.js';
import { toast } from './components/Toast.js';
import { buildData } from './services/skema.js';
import { filterLsp, searchLsp, topLsp } from './services/lsp.js';
import { fetchAll } from './services/supabase.js';
import { fetchUnitsBySkema, sortUnits } from './services/unit.js';
import { paginate } from './services/pagination.js';
import type { LspItem, LspRow, SkemaItem, SkemaRow, UnitRow } from './types/database.js';
import type { LspFilter, PrimaryMode, UnitSortKey } from './types/ui.js';
import { debounce, esc } from './utils/dom.js';
import { formatCount, formatDateID, slugify } from './utils/format.js';
import { announce } from './utils/a11y.js';

interface AppState {
  lspList: LspItem[];
  skemaList: SkemaItem[];
  skemaAllRows: SkemaRow[];
  lspMap: Record<number, string>;
  latestChecked: string;
  mode: PrimaryMode;
  lspFilter: LspFilter;
  skemaPage: number;
  lspSkemaNames: string[];
  lspSkemaPage: number;
  currentLspId: number | null;
  currentLspName: string;
  unitRows: UnitRow[];
  unitSortKey: UnitSortKey;
  unitSortDir: 1 | -1;
  skemaPageSize: number;
  lspPageSize: number;
}

const state: AppState = {
  lspList: [],
  skemaList: [],
  skemaAllRows: [],
  lspMap: {},
  latestChecked: '',
  mode: 'lsp',
  lspFilter: 'all',
  skemaPage: 1,
  lspSkemaNames: [],
  lspSkemaPage: 1,
  currentLspId: null,
  currentLspName: '',
  unitRows: [],
  unitSortKey: 'kode',
  unitSortDir: 1,
  skemaPageSize: 24,
  lspPageSize: 24,
};

let virtualRendered = 48;

export function renderApp(root: HTMLElement): void {
  root.innerHTML = `${headerHTML()}<div id="heroSlot"></div><div id="statsSlot"></div><main class="main" id="mainContent" tabindex="-1"><div class="loading" role="status"><div class="spinner"></div><p>Memuat data...</p></div></main><div class="footer">Indonesian Certification Center (ICC) — Data LSP BNSP • Portal Skema &amp; Unit Kompetensi</div>`;

  bindHeader(
    () => goHome(),
    () => {
      setMode('skema');
      document.getElementById('primarySearch')?.focus();
    },
  );
  renderHero();
  void loadData();
  window.addEventListener('hashchange', handleHash);
  window.setTimeout(handleHash, 800);
}

function renderHero(): void {
  const slot = document.getElementById('heroSlot');
  if (!slot) return;
  slot.innerHTML = heroHTML(state.mode, formatDateID(state.latestChecked));
  slot.querySelectorAll<HTMLButtonElement>('.primary-actions button').forEach((b) => {
    b.addEventListener('click', () => setMode(b.getAttribute('data-mode') === 'skema' ? 'skema' : 'lsp'));
  });
  const input = document.getElementById('primarySearch') as HTMLInputElement | null;
  const ac = document.getElementById('acPrimary');
  const btn = document.getElementById('btnPrimarySearch');
  if (!input || !ac) return;

  const onInput = debounce(() => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      hideAc(ac, input);
      return;
    }
    if (state.mode === 'lsp') {
      renderAcLsp(ac, input, searchLsp(state.lspList, q, 8), (nama) => {
        hideAc(ac, input);
        input.value = nama;
        showLsp(nama);
      });
    } else {
      const starts = state.skemaList.filter((s) => s.nama.toLowerCase().startsWith(q)).slice(0, 6);
      const inc = state.skemaList
        .filter((s) => s.nama.toLowerCase().includes(q) && !s.nama.toLowerCase().startsWith(q))
        .slice(0, 4);
      const matches = starts.concat(inc).slice(0, 8);
      renderAcSkema(ac, input, matches, (nama) => {
        hideAc(ac, input);
        input.value = nama;
        searchSkemaAndPickLsp(nama);
      });
    }
  }, 150);

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', (e) => {
    const items = ac.querySelectorAll<HTMLElement>('.ac-item');
    const selected = ac.querySelector<HTMLElement>('.ac-item.selected');
    let idx = [...items].indexOf(selected as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      idx = Math.min(idx + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('selected', i === idx));
      items[idx]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx = Math.max(idx - 1, -1);
      items.forEach((el, i) => el.classList.toggle('selected', i === idx));
      if (idx === -1) input.focus();
      else items[idx]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const sel = ac.querySelector<HTMLElement>('.ac-item.selected') ?? items[0];
      if (sel) (sel as HTMLElement).click();
      else doPrimarySearch();
    } else if (e.key === 'Escape') {
      hideAc(ac, input);
    }
  });
  input.addEventListener('focus', () => {
    if (input.value.trim()) onInput();
  });
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (!t.closest('.search-single')) hideAc(ac, input);
  });
  btn?.addEventListener('click', doPrimarySearch);
}

function setMode(mode: PrimaryMode): void {
  state.mode = mode;
  try {
    history.replaceState(null, '', `#/${mode}`);
  } catch {
    /* abaikan */
  }
  renderHero();
  document.getElementById('primarySearch')?.focus();
}

function doPrimarySearch(): void {
  const input = document.getElementById('primarySearch') as HTMLInputElement | null;
  const q = input?.value.trim() ?? '';
  if (!q) return;
  if (state.mode === 'lsp') {
    const m = state.lspList.find((l) => l.nama.toLowerCase() === q.toLowerCase());
    if (m) showLsp(m.nama);
    else showSearchResults('lsp', q);
  } else {
    const s = state.skemaList.find((x) => x.nama.toLowerCase() === q.toLowerCase());
    if (s) searchSkemaAndPickLsp(s.nama);
    else showSearchResults('skema', q);
  }
}

async function loadData(): Promise<void> {
  try {
    const [lspRows, skemaRows] = await Promise.all([
      fetchAll('lsp', 'id,nama,jml_skema,status,no_sk,no_lisensi,last_checked'),
      fetchAll('skema', 'id,nama,id_skema,lsp_id,jml_unit'),
    ]);
    const built = buildData(lspRows as unknown as LspRow[], skemaRows as unknown as SkemaRow[]);
    state.lspList = built.lspList;
    state.skemaList = built.skemaList;
    state.lspMap = built.lspMap;
    state.latestChecked = built.latestChecked;
    state.skemaAllRows = skemaRows as unknown as SkemaRow[];
    renderStats();
    const heroDate = document.getElementById('lastUpdatedLabel');
    if (heroDate) heroDate.textContent = formatDateID(state.latestChecked);
    renderHome();
    announce(`Data dimuat: ${state.lspList.length} LSP, ${state.skemaList.length} skema`);
  } catch (e) {
    const main = document.getElementById('mainContent');
    if (main) {
      main.innerHTML = `<div class="empty" role="alert"><b>Gagal memuat data</b><div>${esc(e instanceof Error ? e.message : String(e))}</div><div style="margin-top:12px"><button class="btn btn--primary" type="button" id="btnRetryLoad">Coba lagi</button></div></div>`;
      document.getElementById('btnRetryLoad')?.addEventListener('click', () => void loadData());
    }
    toast('Gagal memuat data. Periksa koneksi lalu coba lagi.', 'error');
  }
}

function renderStats(): void {
  const slot = document.getElementById('statsSlot');
  if (!slot) return;
  const aktif = state.lspList.filter((l) => l.status === 'Lisensi Aktif').length;
  const habis = state.lspList.filter((l) => l.status === 'Masa Berlaku Habis').length;
  const unitTotal = state.skemaList.reduce((s, o) => s + o.total_unit, 0);
  slot.innerHTML = statsHTML({
    totalLsp: String(state.lspList.length),
    totalSkema: String(state.skemaList.length),
    totalUnit: formatCount(unitTotal),
    multiLsp: String(state.skemaList.filter((s) => s.jml_lsp > 1).length),
    detail: `${aktif} Aktif • ${habis} Habis`,
    unitSub: `${formatCount(unitTotal)} unit`,
    aktif: String(aktif),
    habis: String(habis),
  });
}

function renderHome(): void {
  const main = document.getElementById('mainContent');
  if (!main) return;
  const cntAktif = state.lspList.filter((l) => l.status === 'Lisensi Aktif').length;
  const cntHabis = state.lspList.filter((l) => l.status === 'Masa Berlaku Habis').length;
  const top = topLsp(state.lspList, state.lspFilter, 6);

  let html = `<div class="section-head"><div><h2>LSP dengan Skema Terbanyak</h2><p>Top 6 • klik kartu untuk lihat skema</p></div>`;
  html += `<div class="filter" role="group" aria-label="Filter status LSP"><button type="button" class="${state.lspFilter === 'all' ? 'active' : ''}" data-filter="all" ${state.lspFilter === 'all' ? 'aria-pressed="true"' : ''}>Semua (${state.lspList.length})</button><button type="button" class="${state.lspFilter === 'aktif' ? 'active' : ''}" data-filter="aktif">Aktif (${cntAktif})</button><button type="button" class="${state.lspFilter === 'habis' ? 'active' : ''}" data-filter="habis">Habis (${cntHabis})</button></div></div>`;
  html += '<div class="card-grid" id="topLspGrid">';
  if (top.length === 0) html += '<div class="empty" style="grid-column:1/-1"><b>Tidak ada LSP</b><div>Filter tidak cocok.</div></div>';
  html += top.map((l) => lspCardHTML(l)).join('');
  html += '</div>';
  html += `<div class="section-head"><div><h2>Skema Tersedia</h2><p>${state.skemaList.length} jenis skema • tersedia di LSP terverifikasi</p></div></div><div class="card-grid" id="skemaGrid"></div><div id="skemaSentinel" aria-hidden="true"></div><div id="skemaPager"></div>`;
  main.innerHTML = html;

  main.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => {
    b.addEventListener('click', () => {
      state.lspFilter = (b.getAttribute('data-filter') ?? 'all') as LspFilter;
      renderHome();
    });
  });
  bindCards(main);
  state.skemaPage = 1;
  virtualRendered = 48;
  renderSkemaWindowed();
}

function bindCards(scope: HTMLElement): void {
  scope.querySelectorAll<HTMLElement>('[data-lsp]').forEach((el) => {
    const open = (): void => showLsp(el.getAttribute('data-lsp') ?? '');
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-skema]').forEach((el) => {
    const open = (): void => searchSkemaAndPickLsp(el.getAttribute('data-skema') ?? '');
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
}

// Performance: virtual window + sentinel (progressive render), fallback pager tetap ada.
function renderSkemaWindowed(): void {
  const grid = document.getElementById('skemaGrid');
  const pager = document.getElementById('skemaPager');
  const sentinel = document.getElementById('skemaSentinel');
  if (!grid || !pager) return;
  const { pageItems, totalPages } = paginate(state.skemaList, state.skemaPage, state.skemaPageSize);
  const windowed = pageItems.slice(0, virtualRendered);
  grid.innerHTML = windowed.map((s) => skemaCardHTML(s)).join('');
  bindCards(grid);
  pager.innerHTML = pagerHTML(state.skemaPage, totalPages, 'skema');
  bindPager(pager, (p) => {
    state.skemaPage = Math.min(Math.max(1, p), totalPages);
    virtualRendered = 48;
    renderSkemaWindowed();
    document.getElementById('skemaGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  if (sentinel && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && virtualRendered < pageItems.length) {
        virtualRendered += 24;
        renderSkemaWindowed();
      }
    });
    io.observe(sentinel);
  }
}

function showSearchResults(type: 'lsp' | 'skema', q: string): void {
  const main = document.getElementById('mainContent');
  if (!main) return;
  const query = q.toLowerCase();
  if (type === 'lsp') {
    const matches = state.lspList.filter((l) => l.nama.toLowerCase().includes(query)).slice(0, 24);
    main.innerHTML = `<button class="back" type="button" id="btnBackHome">← Kembali</button><div class="section-head"><div><h2>Hasil pencarian LSP</h2><p>${matches.length} hasil untuk “${esc(q)}”</p></div></div><div class="card-grid">${matches.map((l) => lspCardHTML(l)).join('') || '<div class="empty">Tidak ditemukan</div>'}</div>`;
  } else {
    const matches = state.skemaList.filter((s) => s.nama.toLowerCase().includes(query)).slice(0, 24);
    main.innerHTML = `<button class="back" type="button" id="btnBackHome">← Kembali</button><div class="section-head"><div><h2>Hasil pencarian Skema</h2><p>${matches.length} hasil untuk “${esc(q)}”</p></div></div><div class="card-grid">${matches.map((s) => skemaCardHTML(s)).join('') || '<div class="empty">Tidak ditemukan</div>'}</div>`;
  }
  document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
  bindCards(main);
  announce(`Hasil pencarian: ${q}`);
}

function showLsp(name: string): void {
  const lsp = state.lspList.find((l) => l.nama === name);
  if (!lsp) return;
  try {
    history.pushState(null, '', `#/lsp/${encodeURIComponent(slugify(name))}`);
    document.title = `${name} — LSP BNSP | ICC Portal`;
  } catch {
    /* abaikan */
  }
  const rows = state.skemaAllRows.filter((s) => s.lsp_id === lsp.id);
  const names = [...new Set(rows.map((s) => s.nama))].sort();
  state.lspSkemaNames = names;
  state.lspSkemaPage = 1;
  state.currentLspId = lsp.id;
  state.currentLspName = lsp.nama;

  const main = document.getElementById('mainContent');
  if (!main) return;
  main.innerHTML = lspProfileHTML(lsp);
  document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
  renderLspSkemaTable();
}

function renderLspSkemaTable(): void {
  const tbody = document.getElementById('lspSkemaTableBody');
  const pager = document.getElementById('lspSkemaPager');
  const count = document.getElementById('lspSkemaCount');
  if (!tbody || !pager || state.currentLspId === null) return;
  const { pageItems, totalPages } = paginate(state.lspSkemaNames, state.lspSkemaPage, state.lspPageSize);
  if (count) count.textContent = `${state.lspSkemaNames.length} skema • halaman ${state.lspSkemaPage}/${totalPages}`;
  tbody.innerHTML = pageItems
    .map((nama, i) => {
      let totalUnit = 0;
      let skemaId: number | null = null;
      for (const r of state.skemaAllRows) {
        if (r.nama === nama && r.lsp_id === state.currentLspId) {
          totalUnit += r.jml_unit ?? 0;
          skemaId = r.id;
        }
      }
      const no = (state.lspSkemaPage - 1) * state.lspPageSize + i + 1;
      return `<tr><td>${no}</td><td>${esc(nama)}</td><td class="mono">${totalUnit}</td><td><button class="btn btn--sm" type="button" data-skema="${esc(nama)}" data-id="${skemaId ?? ''}">Lihat unit</button></td></tr>`;
    })
    .join('');
  tbody.querySelectorAll<HTMLButtonElement>('[data-skema]').forEach((b) => {
    b.addEventListener('click', () => showLspSkemaUnits(b.getAttribute('data-skema') ?? ''));
  });
  pager.innerHTML = pagerHTML(state.lspSkemaPage, totalPages, 'skema LSP');
  bindPager(pager, (p) => {
    state.lspSkemaPage = p;
    renderLspSkemaTable();
  });
}

function showLspSkemaUnits(name: string): void {
  const skema = state.skemaAllRows.find((s) => s.lsp_id === state.currentLspId && s.nama === name);
  if (!skema) return;
  const main = document.getElementById('mainContent');
  if (!main) return;
  main.innerHTML = `<button class="back" type="button" id="btnBackLsp">← Kembali ke skema</button>
  <div class="card card--skema" style="margin-top:12px"><div class="card-top"><div><div style="font-size:11px;font-weight:800;color:var(--muted)">UNIT KOMPETENSI</div><div style="font-family:Fraunces,serif;font-size:20px;font-weight:900;margin-top:4px">${esc(skema.nama)}</div><div class="sub" style="margin-top:4px">${esc(state.currentLspName)} • ${skema.jml_unit ?? 0} unit</div></div><span class="badge badge--orange">${skema.jml_unit ?? 0} unit</span></div></div>
  <div id="skemaUnitTable" style="margin-top:12px">${unitLoadingHTML()}</div>`;
  document.getElementById('btnBackLsp')?.addEventListener('click', () => showLsp(state.currentLspName));
  void loadUnits(skema.id);
}

async function loadUnits(skemaId: number): Promise<void> {
  const box = document.getElementById('skemaUnitTable');
  if (!box) return;
  try {
    const units = await fetchUnitsBySkema(skemaId);
    state.unitRows = units;
    state.unitSortKey = 'kode';
    state.unitSortDir = 1;
    renderUnitTable();
    announce(`${units.length} unit kompetensi dimuat`);
  } catch (e) {
    box.innerHTML = unitErrorHTML(e instanceof Error ? e.message : String(e));
    document.getElementById('btnRetryUnits')?.addEventListener('click', () => {
      box.innerHTML = unitLoadingHTML();
      void loadUnits(skemaId);
    });
  }
}

function renderUnitTable(): void {
  const box = document.getElementById('skemaUnitTable');
  if (!box) return;
  const rows = sortUnits(state.unitRows, state.unitSortKey, state.unitSortDir);
  box.innerHTML = unitTableHTML(rows, state.unitSortKey, state.unitSortDir);
  box.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach((b) => {
    b.addEventListener('click', () => {
      const key = (b.getAttribute('data-sort') ?? 'kode') as UnitSortKey;
      if (state.unitSortKey === key) state.unitSortDir = state.unitSortDir === 1 ? -1 : 1;
      else {
        state.unitSortKey = key;
        state.unitSortDir = 1;
      }
      renderUnitTable();
    });
  });
}

function searchSkemaAndPickLsp(name: string): void {
  const skema = state.skemaList.find((s) => s.nama === name);
  if (!skema) return;
  try {
    history.pushState(null, '', `#/skema/${encodeURIComponent(slugify(name))}`);
    document.title = `${name} — Skema | ICC Portal`;
  } catch {
    /* abaikan */
  }
  const main = document.getElementById('mainContent');
  if (!main) return;
  main.innerHTML = skemaDetailHTML(skema);
  document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
  const buttons = [...main.querySelectorAll<HTMLButtonElement>('.pills button')];
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-idx'));
      showSkemaDetail(name, idx, btn);
    });
  });
  if (buttons.length === 1 && buttons[0]) buttons[0].click();
}

function showSkemaDetail(skemaName: string, lspIdx: number, btnEl: HTMLButtonElement | null): void {
  const skema = state.skemaList.find((s) => s.nama === skemaName);
  const opt = skema?.lsps[lspIdx];
  if (!skema || !opt) return;
  document.querySelectorAll('.pills button').forEach((p) => {
    p.classList.remove('active');
    p.setAttribute('aria-selected', 'false');
  });
  btnEl?.classList.add('active');
  btnEl?.setAttribute('aria-selected', 'true');
  const infoEl = document.getElementById('skemaLspInfo');
  if (infoEl) {
    const lsp = state.lspList.find((l) => l.id === opt.lsp_id);
    infoEl.innerHTML = skemaLspInfoHTML(lsp?.nama ?? opt.lsp, lsp);
  }
  const box = document.getElementById('skemaUnitTable');
  if (box) box.innerHTML = unitLoadingHTML();
  fetchUnitsBySkema(opt.skema_id)
    .then((units) => {
      state.unitRows = units;
      state.unitSortKey = 'kode';
      state.unitSortDir = 1;
      renderUnitTable();
    })
    .catch((e: unknown) => {
      const errBox = document.getElementById('skemaUnitTable');
      if (errBox) {
        errBox.innerHTML = unitErrorHTML(e instanceof Error ? e.message : String(e));
        document.getElementById('btnRetryUnits')?.addEventListener('click', () => showSkemaDetail(skemaName, lspIdx, btnEl));
      }
    });
}

function goHome(): void {
  state.lspFilter = 'all';
  state.mode = 'lsp';
  try {
    history.pushState(null, '', window.location.pathname);
    document.title = 'ICC LSP Portal — Search Engine Sertifikasi Kompetensi Indonesia | LSP & Skema';
  } catch {
    /* abaikan */
  }
  renderHero();
  renderHome();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleHash(): void {
  if (state.lspList.length === 0) return;
  const hash = window.location.hash || '';
  if (hash.startsWith('#/lsp/')) {
    const slug = decodeURIComponent(hash.replace('#/lsp/', '')).replace(/-/g, ' ');
    const found = state.lspList.find(
      (l) => l.nama.toLowerCase() === slug.toLowerCase() || slugify(l.nama) === slugify(slug),
    );
    if (found) showLsp(found.nama);
  } else if (hash.startsWith('#/skema/')) {
    const slug = decodeURIComponent(hash.replace('#/skema/', '')).replace(/-/g, ' ');
    const found = state.skemaList.find((s) => s.nama.toLowerCase() === slug.toLowerCase());
    if (found) searchSkemaAndPickLsp(found.nama);
  }
}

// Expose untuk filterLsp lama bila ada sisa onclick inline (tidak dipakai di template baru)
void filterLsp;
