-- Agregat server untuk portal: statistik, top LSP, halaman skema.
-- Menggantikan unduhan seluruh tabel ke browser (G: performa).
-- Cara pakai: Supabase Dashboard → SQL Editor → paste → Run.
-- Idempoten (CREATE OR REPLACE). Butuh SELECT policy RLS yang sudah ada
-- (migrasi 20260922000000_rls_readonly): fungsi berjalan sebagai pemanggil.

CREATE OR REPLACE FUNCTION portal_stats()
RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'total_lsp', (SELECT count(*) FROM lsp),
    'aktif', (SELECT count(*) FROM lsp WHERE status = 'Lisensi Aktif'),
    'habis', (SELECT count(*) FROM lsp WHERE status = 'Masa Berlaku Habis'),
    'total_unit', (SELECT coalesce(sum(jml_unit), 0) FROM skema),
    'skema_jenis', (SELECT count(*) FROM (SELECT DISTINCT lower(nama) FROM skema) t),
    'multi_lsp', (SELECT count(*) FROM (SELECT lower(nama) FROM skema GROUP BY 1 HAVING count(DISTINCT lsp_id) > 1) t),
    'latest_checked', (SELECT max(last_checked) FROM lsp)
  );
$$;

CREATE OR REPLACE FUNCTION top_lsp(p_status text DEFAULT 'all', p_limit int DEFAULT 6)
RETURNS TABLE (
  id int,
  nama text,
  jml_skema bigint,
  status text,
  no_sk text,
  no_lisensi text,
  last_checked timestamptz
)
LANGUAGE sql STABLE AS $$
  SELECT
    l.id,
    l.nama,
    (SELECT count(*) FROM (SELECT DISTINCT lower(s.nama) FROM skema s WHERE s.lsp_id = l.id) t),
    l.status,
    l.no_sk,
    l.no_lisensi,
    l.last_checked
  FROM lsp l
  WHERE p_status = 'all'
    OR (p_status = 'aktif' AND l.status = 'Lisensi Aktif')
    OR (p_status = 'habis' AND l.status = 'Masa Berlaku Habis')
  ORDER BY 3 DESC, l.nama ASC
  LIMIT greatest(p_limit, 1);
$$;

CREATE OR REPLACE FUNCTION skema_page(
  p_sort text DEFAULT 'nama-asc',
  p_page int DEFAULT 1,
  p_size int DEFAULT 24
)
RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH g AS (
  SELECT lower(s.nama) AS key,
         min(s.nama) AS nama,
         count(DISTINCT s.lsp_id)::int AS jml_lsp,
         coalesce(sum(s.jml_unit), 0)::int AS total_unit
  FROM skema s
  GROUP BY 1
),
cnt AS (SELECT count(*) AS total FROM g)
  SELECT jsonb_build_object(
    'total', (SELECT total FROM cnt),
    'items', coalesce((SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT nama, jml_lsp, total_unit FROM g
        ORDER BY
          CASE WHEN p_sort = 'nama-desc' THEN nama END DESC,
          CASE WHEN p_sort = 'unit-desc' THEN total_unit END DESC,
          CASE WHEN p_sort NOT IN ('nama-desc', 'unit-desc') THEN nama END ASC
        LIMIT greatest(p_size, 1) OFFSET (greatest(p_page, 1) - 1) * greatest(p_size, 1)
      ) t), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION portal_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION top_lsp(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION skema_page(text, int, int) TO anon, authenticated;
