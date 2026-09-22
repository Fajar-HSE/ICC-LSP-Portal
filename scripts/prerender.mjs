// Prerender halaman statis per LSP & skema untuk SEO (crawler tidak mengeksekusi
// hash routing SPA). Dijalankan setelah `vite build`: menulis dist/lsp/*,
// dist/skema/*, dist/sitemap.xml, dist/robots.txt.
// Sumber key: duplikat dari src/services/supabase.ts (anon key publik).
// Fail-soft: bila fetch gagal, tulis robots + sitemap home-only agar build
// tidak pernah merah karena tahap SEO.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SB_URL = process.env.VITE_SB_URL || 'https://ziybqtcdphuzhfoahopr.supabase.co';
const SB_KEY =
  process.env.VITE_SB_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppeWJxdGNkcGh1emhmb2Fob3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3ODQ0NTUsImV4cCI6MjEwMDM2MDQ1NX0.pksC4kqaO3YIjqc2RQEEJnDiYYwu-HoT9vVoFRRi64I';
const SITE = (process.env.SITE_BASE || 'https://fajar-hse.github.io/ICC-LSP-Portal').replace(/\/$/, '');
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell({ title, desc, url, body }) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} | ICC LSP Portal</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${esc(url)}" />
</head>
<body style="font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:24px;line-height:1.6">
${body}
<hr />
<p><a href="${SITE}/">← ICC LSP Portal</a> • Data bersumber dari <a href="https://bnsp.go.id/">BNSP</a>, bersifat informatif.</p>
</body>
</html>`;
}

async function fetchAll(table, select) {
  const out = [];
  let start = 0;
  const pageSize = 1000;
  for (;;) {
    const end = start + pageSize - 1;
    const res = await fetch(`${SB_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Accept: 'application/json', Range: `${start}-${end}` },
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
    const rows = await res.json();
    if (!rows.length) break;
    out.push(...rows);
    if (rows.length < pageSize) break;
    start += pageSize;
  }
  return out;
}

function writeRobotsSitemap(urls) {
  writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
  const items = urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n');
  writeFileSync(
    join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`,
  );
}

const usedSlugs = new Set();

function uniqueSlug(base) {
  let slug = base || 'unknown';
  let n = 2;
  while (usedSlugs.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  usedSlugs.add(slug);
  return slug;
}

async function main() {
  try {
    const [lspRows, skemaRows] = await Promise.all([
      fetchAll('lsp', 'id,nama,status,no_sk,no_lisensi,last_checked'),
      fetchAll('skema', 'id,nama,lsp_id,jml_unit'),
    ]);
    const lspName = new Map(lspRows.map((l) => [l.id, l.nama]));
    const urls = [`${SITE}/`];

    for (const l of lspRows) {
      const slug = uniqueSlug(slugify(l.nama));
      const skema = skemaRows
        .filter((s) => s.lsp_id === l.id)
        .sort((a, b) => String(a.nama).localeCompare(String(b.nama)));
      const list = skema
        .map((s) => `<li><a href="${SITE}/skema/${slugify(s.nama)}/">${esc(s.nama)}</a> (${s.jml_unit ?? 0} unit)</li>`)
        .join('\n');
      const url = `${SITE}/lsp/${slug}/`;
      urls.push(url);
      const body = `<p><a href="${SITE}/">ICC LSP Portal</a> / LSP</p>
<h1>${esc(l.nama)}</h1>
<p>Status: <strong>${esc(l.status || '—')}</strong> • No. SK: ${esc(l.no_sk || '—')} • No. Lisensi: ${esc(l.no_lisensi || '—')}</p>
<h2>Skema sertifikasi (${skema.length})</h2>
<ul>${list || '<li>—</li>'}</ul>
<p><a href="${SITE}/#/lsp/${slug}">Buka di aplikasi interaktif →</a></p>`;
      const dir = join(DIST, 'lsp', slug);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'index.html'),
        shell({ title: l.nama, desc: `Profil ${l.nama} — ${skema.length} skema sertifikasi BNSP.`, url, body }),
      );
    }

    const seen = new Map();
    for (const s of skemaRows) {
      const key = String(s.nama).toLowerCase();
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(s);
    }
    for (const rows of seen.values()) {
      const slug = uniqueSlug(slugify(rows[0].nama));
      const totalUnit = rows.reduce((n, r) => n + (r.jml_unit ?? 0), 0);
      const list = rows
        .map(
          (r) =>
            `<li><a href="${SITE}/lsp/${slugify(lspName.get(r.lsp_id) ?? 'unknown')}/">${esc(lspName.get(r.lsp_id) ?? 'Unknown')}</a> (${r.jml_unit ?? 0} unit)</li>`,
        )
        .join('\n');
      const url = `${SITE}/skema/${slug}/`;
      urls.push(url);
      const body = `<p><a href="${SITE}/">ICC LSP Portal</a> / Skema</p>
<h1>Skema ${esc(rows[0].nama)}</h1>
<p>Tersedia di ${rows.length} LSP • total ${totalUnit} unit kompetensi.</p>
<h2>LSP penyelenggara</h2>
<ul>${list}</ul>
<p><a href="${SITE}/#/skema/${slug}">Buka di aplikasi interaktif →</a></p>`;
      const dir = join(DIST, 'skema', slug);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'index.html'),
        shell({ title: `Skema ${rows[0].nama}`, desc: `Skema ${rows[0].nama} tersedia di ${rows.length} LSP.`, url, body }),
      );
    }

    writeRobotsSitemap(urls);
    console.log(`prerender OK: ${lspRows.length} LSP, ${seen.size} skema, ${urls.length} URLs`);
  } catch (e) {
    console.warn(`prerender SKIP (fail-soft): ${e instanceof Error ? e.message : String(e)}`);
    writeRobotsSitemap([`${SITE}/`]);
  }
}

await main();
