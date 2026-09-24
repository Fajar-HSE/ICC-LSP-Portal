import { expect, test } from '@playwright/test';

const LSP_ROWS = [
  { id: 1, nama: 'LSP K3 Umum', jml_skema: 2, status: 'Lisensi Aktif', no_sk: 'SK-1', no_lisensi: 'LIS-1', last_checked: '2026-08-05T00:00:00.000Z' },
];

const SKEMA_ROWS = [
  { id: 10, nama: 'K3 Umum', id_skema: 'x', lsp_id: 1, jml_unit: 2 },
  { id: 11, nama: 'Barista', id_skema: 'y', lsp_id: 1, jml_unit: 1 },
];

const UNITS: Record<string, { kode: string; nama: string }[]> = {
  '10': [
    { kode: 'KKK.00.01', nama: 'Menerapkan K3' },
    { kode: 'KKK.00.02', nama: 'Melapor Insiden' },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/rpc/portal_stats*', (route) =>
    route.fulfill({
      json: {
        total_lsp: 1,
        aktif: 1,
        habis: 0,
        total_unit: 3,
        skema_jenis: 2,
        multi_lsp: 0,
        latest_checked: '2026-08-05T00:00:00.000Z',
      },
    }),
  );
  await page.route('**/rest/v1/rpc/top_lsp*', (route) => route.fulfill({ json: LSP_ROWS }));
  await page.route('**/rest/v1/rpc/skema_page*', (route) =>
    route.fulfill({
      json: {
        total: 2,
        items: [
          { nama: 'K3 Umum', jml_lsp: 1, total_unit: 2 },
          { nama: 'Barista', jml_lsp: 1, total_unit: 1 },
        ],
      },
    }),
  );
  await page.route('**/rest/v1/lsp*', (route) => route.fulfill({ json: LSP_ROWS }));
  await page.route('**/rest/v1/skema*', (route) => route.fulfill({ json: SKEMA_ROWS }));
  await page.route('**/rest/v1/unit_kompetensi*', (route) => {
    const url = new URL(route.request().url());
    const match = url.search.match(/skema_id=eq\.(\d+)/);
    const id = match?.[1] ?? '10';
    return route.fulfill({ json: UNITS[id] ?? [] });
  });
});

test('home renders stats and top LSP', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Temukan LSP/ })).toBeVisible();
  await expect(page.getByText('LSP K3 Umum').first()).toBeVisible();
});

test('search LSP autocomplete and open profile', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('Pencarian utama');
  await input.fill('K3');
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.getByRole('option').first().click();
  await expect(page.getByText('Lembaga Sertifikasi Profesi').first()).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
});

test('open skema and sort units', async ({ page }) => {
  await page.goto('/');
  await page.locator('#skemaGrid').getByRole('button', { name: /K3 Umum/ }).click();
  await expect(page.getByText('Tersedia di 1 LSP').first()).toBeVisible();
  await page.getByRole('tab').first().click();
  await expect(page.getByText('Menerapkan K3')).toBeVisible();
  await page.getByRole('button', { name: /Judul Unit Kompetensi/ }).click();
  await expect(page.getByText('Melapor Insiden')).toBeVisible();
});

test('keyboard: skip-link and search focus', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByText('Lewati ke konten utama')).toBeFocused();
});
