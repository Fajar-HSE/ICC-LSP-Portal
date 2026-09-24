-- v3: normalisasi NAMA + gabung DUPLIKAT (perbaikan error 23505).
--
-- Latar: error "duplicate key (lsp_id, nama)" membuktikan ada 2+ baris skema
-- di LSP yang sama yang namanya identik setelah spasi dibersihkan
-- (mis. 'Operasi...' vs ' Operasi...'). UPDATE langsung tabrakan dengan
-- constraint UNIQUE(lsp_id, nama), jadi duplikat harus digabung DULU.
--
-- Strategi per grup duplikat: pemenang = id terkecil.
--   - Unit dengan kode unik pindah ke pemenang.
--   - Unit yang kodenya sudah ada di pemenang dibuang (duplikat sejati).
--   - jml_unit pemenang dihitung ulang dari unit yang benar-benar ada.
-- Perbaikan typo pun dibuat merge-aware (tidak pernah UPDATE buta).
-- Sifat: idempoten (aman diulang), satu transaksi (gagal = nol perubahan).

BEGIN;

-- 1. Merge skema duplikat per (lsp_id, nama bersih).
DO $$
DECLARE
  r RECORD;
  win INT;
  losers INT[];
BEGIN
  FOR r IN
    SELECT lsp_id,
           regexp_replace(trim(nama), '\s+', ' ', 'g') AS clean,
           array_agg(id ORDER BY id) AS ids
    FROM skema
    GROUP BY 1, 2
    HAVING count(*) > 1
  LOOP
    win := r.ids[1];
    losers := r.ids[2:array_length(r.ids, 1)];
    UPDATE unit_kompetensi u
    SET skema_id = win
    WHERE u.skema_id = ANY(losers)
      AND NOT EXISTS (
        SELECT 1 FROM unit_kompetensi u2
        WHERE u2.skema_id = win AND u2.kode = u.kode
      );
    DELETE FROM unit_kompetensi WHERE skema_id = ANY(losers);
    DELETE FROM skema WHERE id = ANY(losers);
    UPDATE skema
    SET nama = r.clean,
        jml_unit = (SELECT count(*) FROM unit_kompetensi WHERE skema_id = win)
    WHERE id = win;
  END LOOP;
END $$;

-- 2. Betulkan 2 typo terkonfirmasi, merge-aware:
--    bila ejaan benar sudah ada di LSP yang sama, gabung ke sana.
DO $$
DECLARE
  r RECORD;
  correct TEXT;
  target_id INT;
BEGIN
  FOR r IN
    SELECT id, lsp_id, nama FROM skema
    WHERE nama IN ('ADMINISTRATIVE ASSISSTANT', '3D Ilustration Artist')
  LOOP
    correct := CASE r.nama
      WHEN 'ADMINISTRATIVE ASSISSTANT' THEN 'ADMINISTRATIVE ASSISTANT'
      ELSE '3D Illustration Artist'
    END;
    SELECT s.id INTO target_id FROM skema s
    WHERE s.lsp_id = r.lsp_id AND s.nama = correct AND s.id <> r.id
    LIMIT 1;
    IF FOUND THEN
      UPDATE unit_kompetensi u
      SET skema_id = target_id
      WHERE u.skema_id = r.id
        AND NOT EXISTS (
          SELECT 1 FROM unit_kompetensi u2
          WHERE u2.skema_id = target_id AND u2.kode = u.kode
        );
      DELETE FROM unit_kompetensi WHERE skema_id = r.id;
      DELETE FROM skema WHERE id = r.id;
      UPDATE skema
      SET jml_unit = (SELECT count(*) FROM unit_kompetensi WHERE skema_id = target_id)
      WHERE id = target_id;
    ELSE
      UPDATE skema SET nama = correct WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- 3. Merge lagi (jaring pengaman; normalnya tidak menemukan apa-apa).
DO $$
DECLARE
  r RECORD;
  win INT;
  losers INT[];
BEGIN
  FOR r IN
    SELECT lsp_id,
           regexp_replace(trim(nama), '\s+', ' ', 'g') AS clean,
           array_agg(id ORDER BY id) AS ids
    FROM skema
    GROUP BY 1, 2
    HAVING count(*) > 1
  LOOP
    win := r.ids[1];
    losers := r.ids[2:array_length(r.ids, 1)];
    UPDATE unit_kompetensi u
    SET skema_id = win
    WHERE u.skema_id = ANY(losers)
      AND NOT EXISTS (
        SELECT 1 FROM unit_kompetensi u2
        WHERE u2.skema_id = win AND u2.kode = u.kode
      );
    DELETE FROM unit_kompetensi WHERE skema_id = ANY(losers);
    DELETE FROM skema WHERE id = ANY(losers);
    UPDATE skema
    SET nama = r.clean,
        jml_unit = (SELECT count(*) FROM unit_kompetensi WHERE skema_id = win)
    WHERE id = win;
  END LOOP;
END $$;

-- 4. Normalisasi final (kini dijamin bebas tabrakan).
UPDATE skema
SET nama = regexp_replace(trim(nama), '\s+', ' ', 'g')
WHERE nama IS DISTINCT FROM regexp_replace(trim(nama), '\s+', ' ', 'g');

UPDATE lsp
SET nama = regexp_replace(trim(nama), '\s+', ' ', 'g')
WHERE nama IS DISTINCT FROM regexp_replace(trim(nama), '\s+', ' ', 'g');

COMMIT;
