# ICC LSP Portal Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernisasi portal single-file `index.html` menjadi codebase modular TypeScript + Vite tanpa mengubah perilaku pencarian LSP/Skema/Unit yang sudah berjalan.

**Architecture:** Pertahankan SPA client-side + Supabase REST. Pecah `index.html` (~807 baris) menjadi `src/` modular: `types`, `services`, `utils`, `components`, `app`. Tambah lazy-load unit, virtualized list, cache, a11y WCAG 2.1 AA, Vitest + Playwright + CI.

**Tech Stack:** TypeScript 5.6 strict, Vite 6, Vitest 2 + jsdom, ESLint 9 + typescript-eslint, Prettier 3, Playwright (e2e), GitHub Actions, GitHub Pages (base `./`).

**Spec:** Pendekatan A (Incremental Modernization) — disetujui user 2026-09-22. Prioritas: (1) Fondasi modular+TS+build, (2) Performance lazy-load+virtual scroll, (3) Aksesibilitas WCAG 2.1 AA, (4) Testing unit+integration+CI.

## Global Constraints

- Static hosting GitHub Pages — `vite.config.ts` `base: './'`, output `dist/`, tidak ada SSR/server code.
- Env publik: `VITE_SB_URL` / `VITE_SB_KEY` (anon key saja); service key tidak boleh masuk client bundle.
- Jangan commit kredensial; contoh di `.env.example` saja.
- Perilaku existing dipertahankan: home top-6 LSP, filter all/aktif/habis, paginasi skema 24/page, detail LSP, detail skema per-LSP, tabel unit sortable kode/nama, autocomplete starts-with + includes max 8, hash routing `#/lsp/`, `#/skema/`, `#/search/`.
- Semua fungsi baru harus typed (no `any`), `noUnusedLocals`/`noUnusedParameters` on.
- Satu file satu tanggung jawab; tidak ada file >300 baris bila bisa dipecah.

---

### Task 1: Install deps + verifikasi scaffold config

**Files:**
- Modify: `package.json` (sudah ada, jangan ubah tanpa alasan)
- Existing: `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.env.example`

**Interfaces:**
- Consumes: npm registry
- Produces: `node_modules/` terinstal, `npm run typecheck/lint/test/build` bisa jalan

- [ ] **Step 1: Install dependencies**

```bash
npm ci
```

- [ ] **Step 2: Verifikasi typecheck berjalan (boleh gagal karena src/ belum ada — harus exit 0 atau error "no inputs" yang jelas, bukan crash config)**

Run: `npx tsc --noEmit`
Expected: PASS atau error terkontrol terkait src kosong

- [ ] **Step 3: Commit scaffold bila belum ter-commit**

```bash
git add package.json vite.config.ts tsconfig.json tsconfig.node.json vitest.config.ts eslint.config.js .prettierrc.json .env.example
git commit -m "chore: scaffold Vite+TS+Vitest+ESLint+Prettier"
```

---

### Task 2: Types + utils murni (TDD)

**Files:**
- Create: `src/types/database.ts`
- Create: `src/types/ui.ts`
- Create: `src/utils/format.ts`
- Create: `src/utils/dom.ts`
- Create: `src/utils/storage.ts`
- Test: `src/utils/format.test.ts`
- Test: `src/utils/dom.test.ts`
- Test: `src/utils/storage.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `formatCount(n: number): string` — `id-ID` locale
  - `formatDateID(iso: string | null | undefined): string` — `—` bila kosong
  - `slugify(s: string): string`, `deslugify(slug: string): string`
  - `esc(s: unknown): string`
  - `highlight(text: string, query: string): string` — wrap match dengan `<em>`, escape dulu
  - `chunk<T>(arr: T[], size: number): T[][]`
  - `debounce<T extends (...a: never[]) => void>(fn: T, ms: number): T`
  - `loadCache<T>(key: string): T | null`, `saveCache(key: string, v: unknown): void`

- [ ] **Step 1: Write failing test format**

```typescript
import { describe, expect, it } from 'vitest';
import { formatCount, formatDateID, slugify } from './format.js';

describe('format', () => {
  it('formatCount uses id-ID', () => {
    expect(formatCount(55518)).toBe((55518).toLocaleString('id-ID'));
  });
  it('formatDateID dash on empty', () => {
    expect(formatDateID(null)).toBe('—');
    expect(formatDateID('')).toBe('—');
  });
  it('slugify lowercases and dashes', () => {
    expect(slugify('LSP K3 Umum')).toBe('lsp-k3-umum');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/format.test.ts`
Expected: FAIL with "Cannot find module './format.js'"

- [ ] **Step 3: Write minimal implementation `src/types/database.ts`**

```typescript
export interface LspRow {
  id: number;
  nama: string;
  jml_skema: number | null;
  status: string | null;
  no_sk: string | null;
  no_lisensi: string | null;
  last_checked: string | null;
}

export interface SkemaRow {
  id: number;
  nama: string;
  id_skema: string | null;
  lsp_id: number;
  jml_unit: number | null;
}

export interface UnitRow {
  kode: string;
  nama: string;
}

export interface LspItem {
  id: number;
  nama: string;
  jml_skema: number;
  status: string;
  no_sk: string;
  no_lisensi: string;
  last_checked: string;
}

export interface SkemaLspOption {
  lsp: string;
  lsp_id: number;
  id_skema: string | null;
  jml_unit: number;
  skema_id: number;
}

export interface SkemaItem {
  nama: string;
  jml_lsp: number;
  total_unit: number;
  lsps: SkemaLspOption[];
}
```

- [ ] **Step 4: Write `src/types/ui.ts`**

```typescript
export type PrimaryMode = 'lsp' | 'skema';
export type LspFilter = 'all' | 'aktif' | 'habis';
export type UnitSortKey = 'kode' | 'nama';
```

- [ ] **Step 5: Write `src/utils/format.ts` + `dom.ts` + `storage.ts`, jalankan test sampai PASS**

Run: `npx vitest run src/utils/format.test.ts src/utils/dom.test.ts src/utils/storage.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types src/utils
git commit -m "feat: add typed domain models and pure utils with tests"
```

---

### Task 3: Services Supabase typed (TDD, mock fetch)

**Files:**
- Create: `src/services/supabase.ts`
- Create: `src/services/lsp.ts`
- Create: `src/services/skema.ts`
- Create: `src/services/unit.ts`
- Test: `src/services/buildData.test.ts`
- Test: `src/services/pagination.test.ts`

**Interfaces:**
- Consumes: `src/types/database.ts`, `src/utils/*`
- Produces:
  - `getSupabaseConfig(): { url: string; key: string }`
  - `fetchAll(table: string, select: string, pageSize?: number): Promise<Record<string, unknown>[]>`
  - `fetchUnitsBySkema(skemaId: number): Promise<UnitRow[]>`
  - `buildData(lspRows: LspRow[], skemaRows: SkemaRow[]): { lspList: LspItem[]; skemaList: SkemaItem[]; lspMap: Record<number, string> }`
  - `paginate<T>(items: T[], page: number, pageSize: number): { pageItems: T[]; totalPages: number }`

- [ ] **Step 1: Write failing test buildData (grouping skema per nama, hitung jml_skema unik per LSP)**

```typescript
import { describe, expect, it } from 'vitest';
import { buildData } from '../services/skema.js';

describe('buildData', () => {
  it('groups skema by name across LSPs', () => {
    const { skemaList } = buildData(
      [{ id: 1, nama: 'LSP A', jml_skema: 0, status: 'Lisensi Aktif', no_sk: '', no_lisensi: '', last_checked: '' }],
      [
        { id: 10, nama: 'K3 Umum', id_skema: 'x', lsp_id: 1, jml_unit: 5 },
        { id: 11, nama: 'K3 Umum', id_skema: 'y', lsp_id: 1, jml_unit: 3 },
      ],
    );
    expect(skemaList).toHaveLength(1);
    expect(skemaList[0]?.nama).toBe('K3 Umum');
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `npx vitest run src/services/buildData.test.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implement `supabase.ts` (Range pagination 0-999 loop, Bearer anon, Accept json), `lsp.ts`, `skema.ts` (pure buildData dipindah dari index.html L481-531), `unit.ts` (fetch + order kode.asc, cache 10 mnt via storage.ts)**

- [ ] **Step 4: Run tests PASS**

Run: `npx vitest run src/services`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services
git commit -m "feat: add typed Supabase services with unit cache"
```

---

### Task 4: Components + App shell (pecah index.html)

**Files:**
- Create: `src/styles/variables.css`, `base.css`, `components.css`, `layout.css`
- Create: `src/components/Header.ts`, `HeroSearch.ts`, `StatsBar.ts`, `LspCard.ts`, `SkemaCard.ts`, `Pagination.ts`, `Autocomplete.ts`, `LspProfile.ts`, `SkemaDetail.ts`, `UnitTable.ts`, `Toast.ts`
- Create: `src/hooks/useDebounce.ts`, `usePagination.ts`, `useSearch.ts`
- Create: `src/app.ts`, `src/main.ts`, `src/vite-env.d.ts`
- Modify: `index.html` → entry tipis (div#app + script /src/main.ts)

**Interfaces:**
- Consumes: Task 2 + Task 3
- Produces: `renderApp(root: HTMLElement): void`, tiap component `(props) => string` (HTML string) + `bind*` untuk events; tidak ada global `var` bocor ke window kecuali yang dibutuhkan inline onclick lama (harus dihapus)

- [ ] **Step 1: Ekstrak CSS dari index.html L12-294 apa adanya ke 4 file styles (tanpa ubah visual), import di main.ts**

- [ ] **Step 2: Port JS per fungsi: state, fetchAll→services, buildData→services, renderHome, autocomplete (debounce 150ms), showLsp, searchSkemaAndPickLsp, showSkemaDetail, renderUnitTable sortable, pagination windowed ±2, hash routing, goHome**

- [ ] **Step 3: Lazy-load unit: fetch hanya saat detail skema dibuka; tampilkan spinner + retry button; cache `unit:<skemaId>` 10 menit**

- [ ] **Step 4: Virtual scroll sederhana untuk grid skema >100 item: render window 48 + IntersectionObserver sentinel (fallback: paginasi 24 tetap jalan)**

- [ ] **Step 5: Verifikasi build**

Run: `npm run typecheck && npm run build`
Expected: PASS, `dist/index.html` ada

- [ ] **Step 6: Commit**

```bash
git add src/components src/hooks src/app.ts src/main.ts src/styles index.html
git commit -m "feat: modularize portal into typed components with lazy units"
```

---

### Task 5: Aksesibilitas WCAG 2.1 AA

**Files:**
- Modify: `src/components/*`, `src/app.ts`, `index.html` (lang, skip-link, meta)
- Create: `src/utils/a11y.ts`
- Test: `src/utils/a11y.test.ts`

**Interfaces:**
- Consumes: Task 4
- Produces: `announce(msg: string): void` (aria-live), `trapFocus(container: HTMLElement): () => void`

- [ ] **Step 1: Tambah skip-link, `<main id=main>`, `aria-label` search, `role=listbox/option` autocomplete, `aria-selected`, `aria-expanded`, focus-visible outline, kontras teks muted ≥4.5:1, tombol clear `aria-label`, tabel unit pakai `<th scope>`, sortable pakai `<button aria-sort>`**

- [ ] **Step 2: Keyboard: ArrowUp/Down + Enter + Escape di autocomplete, focus kembali ke input setelah pilih, announce jumlah hasil via aria-live**

- [ ] **Step 3: Verifikasi manual checklist + `npx vite preview` + tab-order test**

- [ ] **Step 4: Commit**

```bash
git add src/components src/utils/a11y.ts src/utils/a11y.test.ts index.html
git commit -m "a11y: WCAG 2.1 AA for search, autocomplete, tables, focus"
```

---

### Task 6: CI + E2E + docs

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `playwright.config.ts`, `e2e/search.spec.ts`
- Modify: `package.json` (tambah script `e2e`, dep `@playwright/test`)
- Create: `docs/superpowers/specs/2026-09-22-icc-lsp-design.md` (ringkas, opsional bila waktu mepet)

**Interfaces:**
- Consumes: Task 1-5
- Produces: CI hijau: lint + typecheck + test + build; e2e: home render, cari LSP, buka skema, tabel unit sort

- [ ] **Step 1: Tulis workflow**

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
```

- [ ] **Step 2: Tambah Playwright spec 4 critical paths (gunakan baseURL localhost, mock Supabase via route fulfill agar tidak tergantung network)**

- [ ] **Step 3: Jalankan lokal `npm run lint && npm run typecheck && npm run test && npm run build` — semua PASS**

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml playwright.config.ts e2e package.json
git commit -m "ci: add lint-typecheck-test-build plus Playwright e2e"
```
