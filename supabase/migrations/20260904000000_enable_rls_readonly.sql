-- Aktifkan Row Level Security agar anon key (tertanam publik di index.html) hanya bisa
-- SELECT, tidak bisa INSERT/UPDATE/DELETE. Semua penulisan data (scraper/CI) harus
-- pakai service_role key (otomatis bypass RLS), bukan anon key.

ALTER TABLE lsp ENABLE ROW LEVEL SECURITY;
ALTER TABLE skema ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_kompetensi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read lsp" ON lsp
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Public read skema" ON skema
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Public read unit_kompetensi" ON unit_kompetensi
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Tidak ada policy INSERT/UPDATE/DELETE untuk anon/authenticated → ditolak default.
-- service_role (dipakai update_db.py & sync_units.py via SUPABASE_SERVICE_KEY) selalu
-- bypass RLS, jadi pipeline sinkronisasi data tetap berjalan normal.
