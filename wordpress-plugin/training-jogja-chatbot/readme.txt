=== TJ AI Chatbot ===
Contributors: trainingjogja
Tags: ai chatbot, chatbot, openrouter, rag, knowledge base
Requires at least: 6.3
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.3.6
License: GPLv2 or later

Chatbot AI Bahasa Indonesia — menjawab dari konten situs + Knowledge Base, tidak mengarang jawaban.

== Description ==

Chatbot AI untuk WordPress dengan pola RAG: setiap pertanyaan dicarikan dulu konteksnya dari Knowledge Base (prioritas) dan index konten situs (posts, pages, CPT), baru dijawab LLM (OpenAI / OpenRouter / OpenAI-compatible). Mode Grounded: jika tidak ada di referensi, bot jujur bilang tidak tahu.

Fitur: widget floating kanan bawah + shortcode [tj_chatbot], Bahasa Indonesia default, API key terenkripsi AES-256-GCM, rate limit + batas harian + cost guard bulanan, log percakapan + belum-terjawab (satu klik jadi Knowledge), hapus riwayat oleh visitor, import KB via TXT/MD/CSV.

== Installation ==

1. Upload folder `training-jogja-chatbot` ke `/wp-content/plugins/` (atau upload ZIP via Plugins → Add New → Upload).
2. Activate → menu TJ Chatbot.
3. Pengaturan → isi API Key → Tes Koneksi.
4. Index Konten → Jalankan Index.
5. Knowledge → tambah Q&A. Aktifkan Tampilkan sitewide.

== Changelog ==

= 1.3.6 =
Tanggal hari ini kini dikirim ke AI setiap percakapan, plus aturan wajib: jadwal yang sudah lewat tidak boleh lagi disebut sebagai jadwal terdekat, AI dilarang menulis URL (tombol daftar & kontak sudah ditambahkan sistem), dan pertanyaan biaya dijawab ringkas lalu ditanyakan jumlah peserta serta skemanya. Aturan ini dikirim terpisah dari System Prompt sehingga tetap berlaku pada instalasi lama yang setting-nya sudah tersimpan; bisa disesuaikan lewat filter tjcb_guardrails.

= 1.3.5 =
Nomor WhatsApp kini tampil sebagai nomor saja (0853 2888 3511) dan bisa diklik langsung ke WhatsApp — link wa.me tidak lagi ditampilkan mentah. Field Nomor WA di Pengaturan menerima nomor biasa maupun URL wa.me (dulu nomor berspasi rusak jadi "http://0853%202888%203511"); setting lama yang terlanjur rusak diperbaiki otomatis saat update. Chat juga mendukung tautan format [teks](url) dan menomorkan nomor telepon Indonesia secara otomatis.

= 1.3.4 =
Peningkatan tone & style: Temperature 0.2 → 0.85 (jawaban lebih variatif & natural), system prompt lebih santai & emotional, knowledge base hanya tampilkan nomor WA tanpa link.

= 1.3.3 =
Perbaikan rendering teks: support Markdown formatting (**bold**, *italic*, __bold__, _italic_) di pesan chatbot. Sebelumnya hanya menampilkan asterisk literal.

= 1.3.2 =
UI/UX improvement: tombol floating chat diperbesar (avatar 26px → 32px, text 14px → 15px, tinggi 52px → 64px) untuk visibility & prominence lebih baik di desktop websites.

= 1.3.1 =
Perbaikan hasil audit: model AI otomatis dinormalkan sesuai provider (dulu bisa gagal total kalau pindah ke OpenAI langsung), pencarian keyword & knowledge pindah ke BOOLEAN MODE + fallback LIKE per token (dulu kata pendek Bahasa Indonesia sering tak ketemu di NATURAL LANGUAGE MODE), vector search dibatasi & disaring lewat keyword dulu untuk index besar (dulu selalu scan sampai 2000 baris per chat), embedding pertanyaan di-cache 12 jam, batas harian kini berbasis cookie perangkat + jaringan sekaligus (dulu gampang reset cuma ganti IP/User-Agent) plus tambahan batas harian sitewide, proteksi origin REST diperketat (dulu request tanpa header Origin/Referer selalu lolos), pembuatan sesi dibatasi per jam, field Max tokens/Temperature/Rate limit/Batas sitewide kini muncul di Pengaturan, validasi upload Knowledge diperkuat, serta pemuatan textdomain untuk terjemahan.

= 1.3.0 =
Avatar bot bisa diganti (emoji atau upload dari Media) + nama bot bisa diganti, tampil di tombol floating & header chat. Preset model embedding LFM.

= 1.2.0 =
Default embedding gratis nvidia/nemotron-3-embed-1b:free (2048 dimensi, multilingual), preset datalist model, prefix query:/passage: otomatis untuk Nemotron, deteksi ganti model (vektor lama auto-hapus & generate ulang), tampilkan model vektor di Index Konten.

= 1.1.0 =
Tambah embedding model (pencarian semantik/vector): setting model embedding (default openai/text-embedding-3-small via OpenRouter), tombol Generate Embeddings di Index Konten, hybrid search (knowledge + vector + keyword). Migrasi DB otomatis.

= 1.0.0 =
Rilis awal.
