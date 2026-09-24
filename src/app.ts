import { bindHeader, headerHTML } from './components/Header.js';
import { bindPrimaryTabs, heroHTML } from './components/HeroSearch.js';
import { hideAc, renderAcLsp, renderAcSkema } from './components/Autocomplete.js';
import { lspCardHTML } from './components/LspCard.js';
import { skemaCardHTML } from './components/SkemaCard.js';
import { bindPager, pagerHTML } from './components/Pagination.js';
import { lspProfileHTML } from './components/LspProfile.js';
import { skemaDetailHTML, skemaLspInfoHTML } from './components/SkemaDetail.js';
import { unitErrorHTML, unitLoadingHTML, unitTableHTML } from './components/UnitTable.js';
import { statsHTML } from './components/StatsBar.js';
import { footerHTML } from './components/Footer.js';
import { toast } from './components/Toast.js';
import { groupSkemaRows } from './services/skema.js';
import { searchPage } from './services/search.js';
import { fetchUnitsBySkema, sortUnits } from './services/unit.js';
import { paginate } from './services/pagination.js';
import {
  fetchLspByName,
  fetchLspMap,
  fetchLspSkemaNames,
  fetchSkemaGroup,
  fetchSkemaId,
  getSkemaPage,
  getStats,
  getTopLsp,
  suggestLsp,
  suggestSkema,
  type PortalStats,
  type SkemaSummary,
} from './services/portal.js';
import type { LspItem, SkemaItem, SkemaRow, UnitRow } from './types/database.js';
import type { LspFilter, PrimaryMode, SkemaSort, UnitSortKey } from './types/ui.js';
import { debounce, esc } from './utils/dom.js';
import { deslugify, formatCount, formatDateID, slugify } from './utils/format.js';
import { announce, focusMain } from './utils/a11y.js';

interface LspSkemaEntry {
  nama: string;
  units: number;
}

interface AppState {
  stats: PortalStats | null;
  latestChecked: string;
  mode: PrimaryMode;
  lspFilter: LspFilter;
  skemaPage: number;
  homeSkemaTotal: number;
  lspSkemaEntries: LspSkemaEntry[];
  lspSkemaPage: number;
  currentLspId: number | null;
  currentLspName: string;
  unitRows: UnitRow[];
  unitSortKey: UnitSortKey;
  unitSortDir: 1 | -1;
  skemaPageSize: number;
  lspPageSize: number;
  skemaSort: SkemaSort;
}

const state: AppState = {
  stats: null,
  latestChecked: '',
  mode: 'lsp',
  lspFilter: 'all',
  skemaPage: 1,
  homeSkemaTotal: 0,
  lspSkemaEntries: [],
  lspSkemaPage: 1,
  currentLspId: null,
  currentLspName: '',
  unitRows: [],
  unitSortKey: 'kode',
  unitSortDir: 1,
  skemaPageSize: 24,
  lspPageSize: 24,
  skemaSort: 'nama-asc',
};

interface SkemaCtx {
  group: SkemaItem;
  info: Map<number, LspItem>;
}

let skemaCtx: SkemaCtx | null = null;

export function renderApp(root: HTMLElement): void {
  root.innerHTML = `${headerHTML()}<div id="heroSlot"></div><div id="statsSlot"></div><main class="main" id="mainContent" tabindex="-1"><div class="loading" role="status"><div class="spinner"></div><p>Memuat data...</p></div></main><div id="footerSlot">${footerHTML('—')}</div>`;

  bindHeader(() => goHome());
  renderHero();
  void loadData();
  window.addEventListener('hashchange', handleHash);
  window.setTimeout(handleHash, 800);
}

function renderHero(): void {
  const slot = document.getElementById('heroSlot');
  if (!slot) return;
  slot.innerHTML = heroHTML(state.mode);
  bindPrimaryTabs(slot, (m, source) => setMode(m, source === 'click'));
  const input = document.getElementById('primarySearch') as HTMLInputElement | null;
  const ac = document.getElementById('acPrimary');
  const btn = document.getElementById('btnPrimarySearch');
  if (!input || !ac) return;

  // Autocomplete selalu dari server: tanpa unduhan dataset penuh.
  const onInput = debounce(() => {
    const raw = input.value.trim();
    if (!raw) {
      hideAc(ac, input);
      return;
    }
    if (state.mode === 'lsp') {
      void suggestLsp(raw, 8)
        .then((matches) => {
          if (input.value.trim() !== raw) return;
          renderAcLsp(ac, input, matches, (nama) => {
            hideAc(ac, input);
            input.value = nama;
            showLsp(nama);
          });
        })
        .catch(() => hideAc(ac, input));
    } else {
      void suggestSkema(raw, 8)
        .then((names) => {
          if (input.value.trim() !== raw) return;
          renderAcSkema(
            ac,
            input,
            names.map((nama) => ({ nama, jml_lsp: 0, total_unit: 0 })),
            (nama) => {
              hideAc(ac, input);
              input.value = nama;
              searchSkemaAndPickLsp(nama);
            },
          );
        })
        .catch(() => hideAc(ac, input));
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

function setMode(mode: PrimaryMode, focusSearch = true): void {
  state.mode = mode;
  try {
    history.replaceState(null, '', `#/${mode}`);
  } catch {
    /* abaikan */
  }
  renderHero();
  if (focusSearch) {
    document.getElementById('primarySearch')?.focus();
  } else {
    document
      .querySelector<HTMLButtonElement>(`.primary-actions button[data-mode="${mode}"]`)
      ?.focus();
  }
}

function doPrimarySearch(): void {
  const input = document.getElementById('primarySearch') as HTMLInputElement | null;
  const q = input?.value.trim() ?? '';
  if (!q) return;
  // Selalu lewat hasil pencarian server (data tidak lagi di memori).
  // Navigasi langsung tetap tersedia via pilihan autocomplete.
  showSearchResults(state.mode, q);
}

async function loadData(): Promise<void> {
  try {
    // Agregat dari server (RPC): tanpa unduhan seluruh tabel.
    // Bila RPC belum di-deploy, getStats jatuh ke jalur warisan otomatis.
    const stats = await getStats();
    state.stats = stats;
    state.latestChecked = stats.latest_checked ?? '';
    renderStats();
    await renderHome();
    announce(`Data dimuat: ${stats.total_lsp} LSP, ${stats.skema_jenis} skema`);
  } catch (e) {
    const main = document.getElementById('mainContent');
    if (main) {
      main.innerHTML = `<div class="empty" role="alert"><b>Gagal memuat data</b><div>${esc(e instanceof Error ? e.message : String(e))}</div><div class="mt-12"><button class="btn btn--primary" type="button" id="btnRetryLoad">Coba lagi</button></div></div>`;
      document.getElementById('btnRetryLoad')?.addEventListener('click', () => void loadData());
    }
    toast('Gagal memuat data. Periksa koneksi lalu coba lagi.', 'error');
  }
}

function renderStats(): void {
  const slot = document.getElementById('statsSlot');
  if (!slot || !state.stats) return;
  const s = state.stats;
  slot.innerHTML = statsHTML({
    totalLsp: String(s.total_lsp),
    totalSkema: String(s.skema_jenis),
    totalUnit: formatCount(s.total_unit),
    multiLsp: String(s.multi_lsp),
    detail: `${s.aktif} Aktif • ${s.habis} Habis`,
    unitSub: `${formatCount(s.total_unit)} unit`,
    dataPer: formatDateID(state.latestChecked),
  });
  const setHeroCount = (id: string, value: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setHeroCount('heroLspCount', `${formatCount(s.total_lsp)}+`);
  setHeroCount('heroSkemaCount', `${formatCount(s.skema_jenis)}+`);
  setHeroCount('heroUnitCount', `${formatCount(s.total_unit)}+`);
  const footer = document.getElementById('footerSlot');
  if (footer) footer.innerHTML = footerHTML(formatDateID(state.latestChecked));
}

async function renderHome(): Promise<void> {
  const main = document.getElementById('mainContent');
  if (!main || !state.stats) return;
  const s = state.stats;

  let html = `<div class="section-head"><div><h2>LSP dengan Skema Terbanyak</h2><p>Top 6 • klik kartu untuk lihat skema</p></div>`;
  const pressed = (f: LspFilter): string => (state.lspFilter === f ? 'true' : 'false');
  html += `<div class="filter" role="group" aria-label="Filter status LSP"><button type="button" class="${state.lspFilter === 'all' ? 'active' : ''}" data-filter="all" aria-pressed="${pressed('all')}">Semua (${s.total_lsp})</button><button type="button" class="${state.lspFilter === 'aktif' ? 'active' : ''}" data-filter="aktif" aria-pressed="${pressed('aktif')}">Aktif (${s.aktif})</button><button type="button" class="${state.lspFilter === 'habis' ? 'active' : ''}" data-filter="habis" aria-pressed="${pressed('habis')}">Habis (${s.habis})</button></div></div>`;
  html += '<div class="card-grid" id="topLspGrid"><div class="loading" role="status"><div class="spinner" aria-hidden="true"></div></div></div>';
  const sel = (v: SkemaSort): string => (state.skemaSort === v ? ' selected' : '');
  html += `<div class="section-head"><div><h2>Skema Tersedia</h2><p>${s.skema_jenis} jenis skema • tersedia di LSP terverifikasi</p></div><div class="section-actions"><label class="sr-only" for="skemaSort">Urutkan skema</label><select id="skemaSort" class="btn" aria-label="Urutkan skema"><option value="nama-asc"${sel('nama-asc')}>Nama A–Z</option><option value="nama-desc"${sel('nama-desc')}>Nama Z–A</option><option value="unit-desc"${sel('unit-desc')}>Unit terbanyak</option></select></div></div><div class="card-grid" id="skemaGrid"><div class="loading" role="status"><div class="spinner" aria-hidden="true"></div></div></div><div id="skemaPager"></div>`;
  main.innerHTML = html;
  document.getElementById('skemaSort')?.addEventListener('change', (e) => {
    state.skemaSort = (e.target as HTMLSelectElement).value as SkemaSort;
    state.skemaPage = 1;
    void renderSkemaPage();
  });

  main.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => {
    b.addEventListener('click', () => {
      state.lspFilter = (b.getAttribute('data-filter') ?? 'all') as LspFilter;
      void renderHome();
    });
  });
  state.skemaPage = 1;
  await Promise.all([refreshHomeTop(), renderSkemaPage()]);
}

async function refreshHomeTop(): Promise<void> {
  const grid = document.getElementById('topLspGrid');
  if (!grid) return;
  try {
    const top = await getTopLsp(state.lspFilter, 6);
    grid.innerHTML =
      top.map((l) => lspCardHTML(l)).join('') ||
      '<div class="empty" style="grid-column:1/-1"><b>Tidak ada LSP</b><div>Filter tidak cocok.</div></div>';
    bindCards(grid);
  } catch {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1" role="alert"><b>Gagal memuat LSP</b><div class="mt-12"><button class="btn btn--primary" type="button" id="btnRetryTop">Coba lagi</button></div></div>`;
    document.getElementById('btnRetryTop')?.addEventListener('click', () => void refreshHomeTop());
  }
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

function toSkemaCard(s: SkemaSummary): string {
  return skemaCardHTML({ nama: s.nama, jml_lsp: s.jml_lsp, total_unit: s.total_unit, lsps: [] });
}

async function renderSkemaPage(): Promise<void> {
  const grid = document.getElementById('skemaGrid');
  const pager = document.getElementById('skemaPager');
  if (!grid || !pager) return;
  try {
    const { total, items } = await getSkemaPage(state.skemaSort, state.skemaPage, state.skemaPageSize);
    state.homeSkemaTotal = total;
    const totalPages = Math.max(1, Math.ceil(total / state.skemaPageSize));
    grid.innerHTML = items.map(toSkemaCard).join('');
    bindCards(grid);
    pager.innerHTML = pagerHTML(state.skemaPage, totalPages, 'skema');
    bindPager(pager, (p) => {
      state.skemaPage = Math.min(Math.max(1, p), totalPages);
      void renderSkemaPage();
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('skemaGrid')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  } catch {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1" role="alert"><b>Gagal memuat skema</b><div class="mt-12"><button class="btn btn--primary" type="button" id="btnRetrySkema">Coba lagi</button></div></div>`;
    document.getElementById('btnRetrySkema')?.addEventListener('click', () => void renderSkemaPage());
  }
}

interface SearchView {
  type: 'lsp' | 'skema';
  q: string;
  page: number;
}

let searchView: SearchView | null = null;
const SEARCH_PAGE_SIZE = 12;
// Batas baris skema yang ditarik per pencarian agar payload tetap ringan.
// Bila total melebihi ini, tampilkan peringatan eksplisit (anti truncasi senyap).
const SEARCH_SKEMA_ROW_CAP = 200;

// Hasil pencarian diambil dari server (ilike + paginasi), bukan filter
// seluruh dataset di memori — jumlah total akurat via count=exact.
function showSearchResults(type: 'lsp' | 'skema', q: string): void {
  searchView = { type, q, page: 1 };
  void renderSearchView();
}

async function renderSearchView(): Promise<void> {
  const main = document.getElementById('mainContent');
  if (!main || !searchView) return;
  const { type, q, page } = searchView;
  const title = type === 'lsp' ? 'Hasil pencarian LSP' : 'Hasil pencarian Skema';
  main.innerHTML = `<button class="back" type="button" id="btnBackHome">← Kembali</button><div class="section-head"><div><h2>${title}</h2><p>Mencari “${esc(q)}”…</p></div></div><div class="loading" role="status"><div class="spinner" aria-hidden="true"></div></div>`;
  document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
  try {
    if (type === 'lsp') {
      // Cari di nama, nomor lisensi, dan nomor SK sekaligus.
      const { rows, total } = await searchPage(
        'lsp',
        'id,nama,jml_skema,status,no_sk,no_lisensi,last_checked',
        ['nama', 'no_lisensi', 'no_sk'],
        q,
        page,
        SEARCH_PAGE_SIZE,
      );
      const items = rows as unknown as LspItem[];
      const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
      main.innerHTML = `<button class="back" type="button" id="btnBackHome">← Kembali</button><div class="section-head"><div><h2>${title}</h2><p>${total} hasil untuk “${esc(q)}” • halaman ${page}/${totalPages}</p></div></div><div class="card-grid">${items.map((l) => lspCardHTML(l)).join('') || '<div class="empty" style="grid-column:1/-1"><b>Tidak ditemukan</b><div>Coba kata kunci lain.</div></div>'}</div><div id="searchPager"></div>`;
      document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
      bindCards(main);
      const pager = document.getElementById('searchPager');
      if (pager && totalPages > 1) {
        pager.innerHTML = pagerHTML(page, totalPages, 'hasil pencarian');
        bindPager(pager, (p) => {
          if (searchView) {
            searchView.page = p;
            void renderSearchView();
          }
        });
      }
    } else {
      const { rows, total } = await searchPage(
        'skema',
        'id,nama,id_skema,lsp_id,jml_unit',
        'nama',
        q,
        1,
        SEARCH_SKEMA_ROW_CAP,
      );
      const truncated = total > rows.length;
      const skemaRows = rows as unknown as SkemaRow[];
      const lspIds = [...new Set(skemaRows.map((r) => r.lsp_id))];
      const grouped = groupSkemaRows(skemaRows, await fetchLspMap(lspIds));
      const { pageItems, totalPages } = paginate(grouped, page, SEARCH_PAGE_SIZE);
      const warn = truncated
        ? `<div class="empty" role="note"><b>Hasil dibatasi ${rows.length} dari ${total} baris cocok</b><div>Persempit kata kunci untuk hasil yang lengkap.</div></div>`
        : '';
      main.innerHTML = `<button class="back" type="button" id="btnBackHome">← Kembali</button><div class="section-head"><div><h2>${title}</h2><p>${grouped.length} jenis skema (dari ${total} baris cocok) untuk “${esc(q)}”</p></div></div>${warn}<div class="card-grid">${pageItems.map((s) => skemaCardHTML(s)).join('') || '<div class="empty" style="grid-column:1/-1"><b>Tidak ditemukan</b><div>Coba kata kunci lain.</div></div>'}</div><div id="searchPager"></div>`;
      document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
      bindCards(main);
      const pager = document.getElementById('searchPager');
      if (pager && totalPages > 1) {
        pager.innerHTML = pagerHTML(page, totalPages, 'hasil pencarian');
        bindPager(pager, (p) => {
          if (searchView) {
            searchView.page = p;
            void renderSearchView();
          }
        });
      }
    }
    focusMain();
    announce(`${title}: ${q}`);
  } catch (e) {
    main.innerHTML = `<button class="back" type="button" id="btnBackHome">← Kembali</button><div class="empty" role="alert"><b>Pencarian gagal</b><div>${esc(e instanceof Error ? e.message : String(e))}</div><div class="mt-12"><button class="btn btn--primary" type="button" id="btnRetrySearch">Coba lagi</button></div></div>`;
    document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
    document.getElementById('btnRetrySearch')?.addEventListener('click', () => void renderSearchView());
  }
}

function showLsp(name: string): void {
  try {
    history.pushState(null, '', `#/lsp/${encodeURIComponent(slugify(name))}`);
    document.title = `${name} — LSP BNSP | ICC Portal`;
  } catch {
    /* abaikan */
  }
  const main = document.getElementById('mainContent');
  if (!main) return;
  main.innerHTML = `<button class="back" type="button" id="btnBackHome">← Kembali ke pencarian</button><div class="loading" role="status"><div class="spinner" aria-hidden="true"></div><p class="mt-10">Memuat profil LSP…</p></div>`;
  document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
  void (async () => {
    try {
      const lsp = await fetchLspByName(name);
      if (!lsp) {
        main.innerHTML = `<button class="back" type="button" id="btnBackHome">← Kembali ke pencarian</button><div class="empty"><b>LSP tidak ditemukan</b><div>“${esc(name)}” tidak ada di data.</div></div>`;
        document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
        return;
      }
      state.lspSkemaEntries = await fetchLspSkemaNames(lsp.id);
      state.lspSkemaPage = 1;
      state.currentLspId = lsp.id;
      state.currentLspName = lsp.nama;
      main.innerHTML = lspProfileHTML(lsp);
      document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
      renderLspSkemaTable();
      focusMain();
      announce(`Profil ${lsp.nama}, ${state.lspSkemaEntries.length} skema`);
    } catch (e) {
      main.innerHTML = `<button class="back" type="button" id="btnBackHome">← Kembali ke pencarian</button><div class="empty" role="alert"><b>Gagal memuat profil</b><div>${esc(e instanceof Error ? e.message : String(e))}</div><div class="mt-12"><button class="btn btn--primary" type="button" id="btnRetryProfile">Coba lagi</button></div></div>`;
      document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
      document.getElementById('btnRetryProfile')?.addEventListener('click', () => showLsp(name));
    }
  })();
}

function renderLspSkemaTable(): void {
  const tbody = document.getElementById('lspSkemaTableBody');
  const pager = document.getElementById('lspSkemaPager');
  const count = document.getElementById('lspSkemaCount');
  if (!tbody || !pager || state.currentLspId === null) return;
  const { pageItems, totalPages } = paginate(
    state.lspSkemaEntries,
    state.lspSkemaPage,
    state.lspPageSize,
  );
  if (count)
    count.textContent = `${state.lspSkemaEntries.length} skema • halaman ${state.lspSkemaPage}/${totalPages}`;
  tbody.innerHTML = pageItems
    .map((entry, i) => {
      const no = (state.lspSkemaPage - 1) * state.lspPageSize + i + 1;
      return `<tr><td>${no}</td><td>${esc(entry.nama)}</td><td class="mono">${entry.units}</td><td><button class="btn btn--sm" type="button" data-skema="${esc(entry.nama)}">Lihat unit</button></td></tr>`;
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
  if (state.currentLspId === null) return;
  const lspId = state.currentLspId;
  const main = document.getElementById('mainContent');
  if (!main) return;
  main.innerHTML = `<button class="back" type="button" id="btnBackLsp">← Kembali ke skema</button><div class="loading" role="status"><div class="spinner" aria-hidden="true"></div></div>`;
  document.getElementById('btnBackLsp')?.addEventListener('click', () => showLsp(state.currentLspName));
  void (async () => {
    try {
      const skemaId = await fetchSkemaId(lspId, name);
      if (skemaId === null) {
        main.innerHTML = `<button class="back" type="button" id="btnBackLsp">← Kembali ke skema</button><div class="empty"><b>Skema tidak ditemukan</b></div>`;
        document.getElementById('btnBackLsp')?.addEventListener('click', () => showLsp(state.currentLspName));
        return;
      }
      const units = await fetchUnitsBySkema(skemaId);
      main.innerHTML = `<button class="back" type="button" id="btnBackLsp">← Kembali ke skema</button>
  <div class="card card--skema mt-12"><div class="card-top"><div><div class="lbl">UNIT KOMPETENSI</div><div class="h-unit">${esc(name)}</div><div class="sub mt-4">${esc(state.currentLspName)} • ${units.length} unit</div></div><span class="badge badge--orange">${units.length} unit</span></div></div>
  <div id="skemaUnitTable" class="mt-12"></div>`;
      document.getElementById('btnBackLsp')?.addEventListener('click', () => showLsp(state.currentLspName));
      state.unitRows = units;
      state.unitSortKey = 'kode';
      state.unitSortDir = 1;
      renderUnitTable();
      announce(`${units.length} unit kompetensi dimuat`);
    } catch (e) {
      main.innerHTML = `<button class="back" type="button" id="btnBackLsp">← Kembali ke skema</button><div class="empty" role="alert"><b>Gagal memuat unit</b><div>${esc(e instanceof Error ? e.message : String(e))}</div><div class="mt-12"><button class="btn btn--primary" type="button" id="btnRetryUnits2">Coba lagi</button></div></div>`;
      document.getElementById('btnBackLsp')?.addEventListener('click', () => showLsp(state.currentLspName));
      document.getElementById('btnRetryUnits2')?.addEventListener('click', () => showLspSkemaUnits(name));
    }
  })();
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
  try {
    history.pushState(null, '', `#/skema/${encodeURIComponent(slugify(name))}`);
    document.title = `${name} — Skema | ICC Portal`;
  } catch {
    /* abaikan */
  }
  const main = document.getElementById('mainContent');
  if (!main) return;
  main.innerHTML = `<button class="back" type="button" id="btnBackHome">← Kembali</button><div class="loading" role="status"><div class="spinner" aria-hidden="true"></div><p class="mt-10">Memuat skema…</p></div>`;
  document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
  void (async () => {
    try {
      const { group, info } = await fetchSkemaGroup(name);
      if (!group) {
        main.innerHTML = `<button class="back" type="button" id="btnBackHome">← Kembali</button><div class="empty"><b>Skema tidak ditemukan</b><div>“${esc(name)}” tidak ada di data.</div></div>`;
        document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
        return;
      }
      skemaCtx = { group, info };
      main.innerHTML = skemaDetailHTML(group);
      document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
      const buttons = [...main.querySelectorAll<HTMLButtonElement>('.pills button')];
      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-idx'));
          showSkemaDetail(group.nama, idx, btn);
        });
      });
      if (buttons.length === 1 && buttons[0]) buttons[0].click();
      focusMain();
      announce(`Skema ${group.nama}, tersedia di ${group.jml_lsp} LSP`);
    } catch (e) {
      main.innerHTML = `<button class="back" type="button" id="btnBackHome">← Kembali</button><div class="empty" role="alert"><b>Gagal memuat skema</b><div>${esc(e instanceof Error ? e.message : String(e))}</div><div class="mt-12"><button class="btn btn--primary" type="button" id="btnRetrySkemaDetail">Coba lagi</button></div></div>`;
      document.getElementById('btnBackHome')?.addEventListener('click', () => goHome());
      document.getElementById('btnRetrySkemaDetail')?.addEventListener('click', () => searchSkemaAndPickLsp(name));
    }
  })();
}

function showSkemaDetail(skemaName: string, lspIdx: number, btnEl: HTMLButtonElement | null): void {
  if (skemaCtx?.group.nama !== skemaName) return;
  const skema = skemaCtx.group;
  const opt = skema.lsps[lspIdx];
  if (!opt) return;
  document.querySelectorAll('.pills button').forEach((p) => {
    p.classList.remove('active');
    p.setAttribute('aria-selected', 'false');
  });
  btnEl?.classList.add('active');
  btnEl?.setAttribute('aria-selected', 'true');
  const infoEl = document.getElementById('skemaLspInfo');
  if (infoEl) {
    const lsp = skemaCtx.info.get(opt.lsp_id);
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
  void renderHome();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  focusMain();
}

function handleHash(): void {
  if (!state.stats) return;
  const hash = window.location.hash || '';
  if (hash.startsWith('#/lsp/')) {
    void resolveLspSlug(decodeURIComponent(hash.replace('#/lsp/', '')));
  } else if (hash.startsWith('#/skema/')) {
    void resolveSkemaSlug(decodeURIComponent(hash.replace('#/skema/', '')));
  }
}

/** Deep-link slug → nama eksak bila cocok, saran teratas bila tidak. */
async function resolveLspSlug(slug: string): Promise<void> {
  const deslug = deslugify(slug);
  try {
    const exact = await fetchLspByName(deslug);
    if (exact) {
      showLsp(exact.nama);
      return;
    }
    const sug = await suggestLsp(deslug, 1);
    if (sug[0]) showLsp(sug[0].nama);
  } catch {
    /* abaikan: tetap di home */
  }
}

async function resolveSkemaSlug(slug: string): Promise<void> {
  const deslug = deslugify(slug);
  try {
    const { group } = await fetchSkemaGroup(deslug);
    if (group) {
      searchSkemaAndPickLsp(group.nama);
      return;
    }
    const sug = await suggestSkema(deslug, 1);
    if (sug[0]) searchSkemaAndPickLsp(sug[0]);
  } catch {
    /* abaikan: tetap di home */
  }
}
