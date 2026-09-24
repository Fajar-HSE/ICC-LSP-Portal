-- Bersihkan nama kotor yang terbukti tampil di UI:
-- spasi depan/belakang + spasi ganda, dan dua typo yang terkonfirmasi
-- (ADMINISTRATIVE ASSISSTANT, 3D Ilustration Artist).
-- Idempoten: aman dijalankan berulang (WHERE hanya menyentuh baris kotor).

UPDATE skema
SET nama = regexp_replace(trim(nama), '\s+', ' ', 'g')
WHERE nama IS DISTINCT FROM regexp_replace(trim(nama), '\s+', ' ', 'g');

UPDATE lsp
SET nama = regexp_replace(trim(nama), '\s+', ' ', 'g')
WHERE nama IS DISTINCT FROM regexp_replace(trim(nama), '\s+', ' ', 'g');

UPDATE skema
SET nama = 'ADMINISTRATIVE ASSISTANT'
WHERE nama = 'ADMINISTRATIVE ASSISSTANT';

UPDATE skema
SET nama = '3D Illustration Artist'
WHERE nama = '3D Ilustration Artist';
