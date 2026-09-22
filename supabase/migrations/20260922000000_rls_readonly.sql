-- RLS: kunci baca-publik untuk portal, tulis hanya via service_role.
--
-- Cara pakai: Supabase Dashboard → SQL Editor → paste seluruh file → Run.
-- Berlaku atomik dalam satu transaksi: RLS aktif BERSAMAAN dengan policy
-- read, sehingga tidak ada jeda di mana anon diblokir baca.
-- service_role melewati RLS (bypass default) → pipeline sync tetap jalan
-- selama memakai SUPABASE_SERVICE_KEY, bukan anon key.
-- Setelah apply: rotasi anon key + service key di Project Settings,
-- karena kedua key lama pernah terekspos di history repo publik.

BEGIN;

ALTER TABLE lsp ENABLE ROW LEVEL SECURITY;
ALTER TABLE skema ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_kompetensi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_lsp" ON lsp;
CREATE POLICY "public_read_lsp" ON lsp
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_skema" ON skema;
CREATE POLICY "public_read_skema" ON skema
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_unit" ON unit_kompetensi;
CREATE POLICY "public_read_unit" ON unit_kompetensi
  FOR SELECT TO anon, authenticated USING (true);

-- Sengaja TIDAK ada policy INSERT/UPDATE/DELETE untuk anon/authenticated:
-- semua tulis dari client publik otomatis ditolak (42501).
-- Tulis pipeline memakai service_role yang bypass RLS.

COMMIT;
