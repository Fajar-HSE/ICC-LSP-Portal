-- Create tables for LSP Directory

CREATE TABLE IF NOT EXISTS lsp (
    id SERIAL PRIMARY KEY,
    nama TEXT NOT NULL UNIQUE,
    jml_skema INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS skema (
    id SERIAL PRIMARY KEY,
    nama TEXT NOT NULL,
    id_skema TEXT,
    lsp_id INTEGER NOT NULL REFERENCES lsp(id) ON DELETE CASCADE,
    jml_unit INTEGER NOT NULL DEFAULT 0,
    UNIQUE(lsp_id, nama)
);

CREATE TABLE IF NOT EXISTS unit_kompetensi (
    id SERIAL PRIMARY KEY,
    kode TEXT NOT NULL,
    nama TEXT NOT NULL,
    skema_id INTEGER NOT NULL REFERENCES skema(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lsp_nama ON lsp(nama);
CREATE INDEX IF NOT EXISTS idx_skema_nama ON skema(nama);
CREATE INDEX IF NOT EXISTS idx_unit_kode ON unit_kompetensi(kode);
CREATE INDEX IF NOT EXISTS idx_skema_lsp_id ON skema(lsp_id);
CREATE INDEX IF NOT EXISTS idx_unit_skema_id ON unit_kompetensi(skema_id);
