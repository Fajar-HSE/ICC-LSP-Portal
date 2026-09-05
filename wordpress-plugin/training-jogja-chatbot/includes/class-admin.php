<?php
if (!defined('ABSPATH')) exit;

class TJCB_Admin {
    public static function init() {
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_init', [__CLASS__, 'save']);
        add_action('wp_ajax_tjcb_crawl', [__CLASS__, 'ajax_crawl']);
        add_action('wp_ajax_tjcb_embed', [__CLASS__, 'ajax_embed']);
        add_action('wp_ajax_tjcb_test', [__CLASS__, 'ajax_test']);
        add_action('admin_post_tjcb_kb_save', [__CLASS__, 'handle_kb_save']);
        add_action('admin_post_tjcb_kb_del', [__CLASS__, 'handle_kb_del']);
        add_action('admin_post_tjcb_kb_import', [__CLASS__, 'handle_kb_import']);
        add_action('admin_post_tjcb_un2kb', [__CLASS__, 'handle_un2kb']);
    }
    public static function menu() {
        add_menu_page('TJ Chatbot', 'TJ Chatbot', 'manage_options', 'tjcb', [__CLASS__, 'page_dash'], 'dashicons-format-chat', 60);
        add_submenu_page('tjcb', 'Knowledge', 'Knowledge', 'manage_options', 'tjcb-kb', [__CLASS__, 'page_kb']);
        add_submenu_page('tjcb', 'Index Konten', 'Index Konten', 'manage_options', 'tjcb-idx', [__CLASS__, 'page_idx']);
        add_submenu_page('tjcb', 'Percakapan', 'Percakapan', 'manage_options', 'tjcb-conv', [__CLASS__, 'page_conv']);
        add_submenu_page('tjcb', 'Pengaturan', 'Pengaturan', 'manage_options', 'tjcb-set', [__CLASS__, 'page_set']);
    }
    private static function head($t) { echo '<div class="wrap"><h1>' . esc_html($t) . '</h1>'; }
    private static function foot() { echo '</div>'; }

    public static function page_dash() {
        self::head(__('TJ Chatbot — Dashboard', 'tj-chatbot'));
        $st = TJCB_Usage::stats_month();
        $ix = TJCB_Crawler::stats();
        global $wpdb; $t = $wpdb->prefix;
        $kb = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$t}tjcb_knowledge WHERE is_active=1");
        $un = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$t}tjcb_unanswered WHERE done=0");
        echo '<p>' . esc_html__('Chatbot Bahasa Indonesia — RAG konten situs + Knowledge Base. Install: aktifkan Tampilkan sitewide di Pengaturan, atau pasang shortcode [tj_chatbot] (kompatibel Elementor via widget Shortcode/HTML).', 'tj-chatbot') . '</p>';
        echo '<table class="widefat" style="max-width:640px"><tbody>';
        foreach ([
            __('Percakapan bulan ini', 'tj-chatbot') => $st['conv'],
            __('Pesan user bulan ini', 'tj-chatbot') => $st['msg'],
            __('Estimasi biaya AI MTD (USD)', 'tj-chatbot') => '$' . number_format($st['cost'], 4),
            __('Dokumen terindex', 'tj-chatbot') => $ix['docs'],
            __('Potongan (chunks)', 'tj-chatbot') => $ix['chunks'],
            __('Knowledge aktif', 'tj-chatbot') => $kb,
            __('Belum terjawab (perlu KB baru)', 'tj-chatbot') => $un,
        ] as $k => $v) echo '<tr><td>' . esc_html($k) . '</td><td><b>' . esc_html((string) $v) . '</b></td></tr>';
        echo '</tbody></table><h2>' . esc_html__('Langkah cepat', 'tj-chatbot') . '</h2><ol>
            <li>' . esc_html__('Pengaturan → isi API key (OpenRouter/OpenAI) → Tes Koneksi.', 'tj-chatbot') . '</li>
            <li>' . esc_html__('Index Konten → Jalankan Index (crawl posts, pages, CPT).', 'tj-chatbot') . '</li>
            <li>' . esc_html__('Knowledge → tambah Q&A jadwal/biaya/WA.', 'tj-chatbot') . '</li>
            <li>' . esc_html__('Aktifkan Grounded (anti-ngarang) + batas harian.', 'tj-chatbot') . '</li></ol>';
        self::foot();
    }

    public static function page_kb() {
        global $wpdb; $t = $wpdb->prefix . 'tjcb_knowledge';
        self::head('Knowledge Base');
        echo '<p>Q&A di sini punya <b>prioritas tertinggi</b> saat menjawab. Cocok untuk jadwal, biaya, syarat, link daftar.</p>';
        echo '<h2>Tambah baru</h2><form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">
            <input type="hidden" name="action" value="tjcb_kb_save">' . wp_nonce_field('tjcb_kb', '_n', true, false) . '
            <table class="form-table"><tr><th>Pertanyaan</th><td><input name="q" required style="width:100%" maxlength="255"></td></tr>
            <tr><th>Jawaban</th><td><textarea name="a" rows="4" style="width:100%" required></textarea></td></tr>
            <tr><th>Prioritas</th><td><label><input type="checkbox" name="p" value="1"> Prioritas (selalu disuntik ke konteks)</label></td></tr></table>
            <p><button class="button button-primary">Simpan</button></p></form>';
        $rows = $wpdb->get_results("SELECT * FROM $t ORDER BY priority DESC, id DESC LIMIT 200");
        echo '<h2>Daftar (' . count($rows) . ')</h2><table class="widefat"><thead><tr><th>Pertanyaan</th><th>Jawaban</th><th>Prio</th><th>Aksi</th></tr></thead><tbody>';
        foreach ($rows as $r) {
            $del = wp_nonce_url(admin_url('admin-post.php?action=tjcb_kb_del&id=' . $r->id), 'tjcb_kb_del' . $r->id);
            echo '<tr><td>' . esc_html($r->question) . '</td><td>' . esc_html(mb_substr($r->answer, 0, 160)) . '</td><td>' . ($r->priority ? '★' : '') . '</td>
                <td><a href="' . esc_url($del) . '" onclick="return confirm(\'Hapus?\')">Hapus</a></td></tr>';
        }
        echo '</tbody></table>';
        // Import TXT/MD/CSV sederhana (Q|A per baris untuk CSV)
        echo '<h2>Import file (TXT / MD / CSV “pertanyaan|jawaban” per baris)</h2>
            <form method="post" enctype="multipart/form-data" action="' . esc_url(admin_url('admin-post.php')) . '">
            <input type="hidden" name="action" value="tjcb_kb_import">' . wp_nonce_field('tjcb_kb', '_n', true, false) . '
            <input type="file" name="f" accept=".txt,.md,.csv" required> <button class="button">Import</button></form>';
        self::foot();
    }
    public static function handle_kb_save() {
        check_admin_referer('tjcb_kb', '_n');
        if (!current_user_can('manage_options')) wp_die('No access');
        global $wpdb;
        $q = isset($_POST['q']) ? sanitize_text_field(wp_unslash($_POST['q'])) : '';
        $a = isset($_POST['a']) ? sanitize_textarea_field(wp_unslash($_POST['a'])) : '';
        $wpdb->insert($wpdb->prefix . 'tjcb_knowledge', [
            'question' => $q, 'answer' => $a,
            'priority' => !empty($_POST['p']) ? 1 : 0, 'is_active' => 1, 'updated_at' => current_time('mysql')]);
        wp_redirect(admin_url('admin.php?page=tjcb-kb')); exit;
    }
    public static function handle_kb_del() {
        $id = absint($_GET['id'] ?? 0);
        check_admin_referer('tjcb_kb_del' . $id);
        if (!current_user_can('manage_options')) wp_die('No access');
        global $wpdb; $wpdb->delete($wpdb->prefix . 'tjcb_knowledge', ['id' => $id]);
        wp_redirect(admin_url('admin.php?page=tjcb-kb')); exit;
    }
    public static function handle_kb_import() {
        check_admin_referer('tjcb_kb', '_n');
        if (!current_user_can('manage_options')) wp_die('No access');
        $f = $_FILES['f'] ?? null;
        if (!$f || !isset($f['error']) || $f['error'] !== UPLOAD_ERR_OK) wp_die(esc_html__('Upload gagal. Coba lagi.', 'tj-chatbot'));
        if (!is_uploaded_file($f['tmp_name'])) wp_die(esc_html__('Upload tidak valid.', 'tj-chatbot'));
        if ($f['size'] > 1048576) wp_die(esc_html__('File terlalu besar (maks 1MB).', 'tj-chatbot'));
        $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['txt', 'md', 'csv'], true)) wp_die(esc_html__('Format harus txt/md/csv.', 'tj-chatbot'));
        $txt = file_get_contents($f['tmp_name']);
        if ($txt === false) wp_die(esc_html__('Gagal membaca file.', 'tj-chatbot'));
        global $wpdb;
        if ($ext === 'csv') {
            foreach (explode("\n", $txt) as $line) {
                $p = str_getcsv(trim($line), '|');
                if (count($p) >= 2 && trim($p[0]) !== '') {
                    $wpdb->insert($wpdb->prefix . 'tjcb_knowledge', ['question' => mb_substr(trim($p[0]), 0, 255), 'answer' => trim($p[1]), 'priority' => 0, 'is_active' => 1, 'updated_at' => current_time('mysql')]);
                }
            }
        } else {
            $wpdb->insert($wpdb->prefix . 'tjcb_knowledge', ['question' => 'Dokumen: ' . sanitize_file_name($f['name']), 'answer' => mb_substr($txt, 0, 20000), 'priority' => 0, 'is_active' => 1, 'updated_at' => current_time('mysql')]);
        }
        wp_redirect(admin_url('admin.php?page=tjcb-kb')); exit;
    }

    public static function page_idx() {
        self::head('Index Konten Situs');
        $ix = TJCB_Crawler::stats();
        echo '<p>Index: <b>' . $ix['docs'] . ' dokumen / ' . $ix['chunks'] . ' potongan / ' . $ix['vecs'] . ' vektor embedding</b> (model vektor: <code>' . esc_html($ix['vec_model']) . '</code>) dari posts, pages, dan CPT publik (termasuk CPT <code>training</code> bila ada). Konten berubah → index ulang, lalu generate ulang embedding.</p>';
        echo '<p><button id="tjcb-crawl" class="button button-primary">1. Jalankan Index</button>
            <button id="tjcb-embed" class="button">2. Generate Embeddings</button> <span id="tjcb-msg"></span></p>
        <p><small>Embedding memakai model di Pengaturan (default gratis <code>nvidia/nemotron-3-embed-1b:free</code> via OpenRouter — multilingual termasuk Indonesia; free tier rate-limited, kalau gagal tinggal klik lagi, progres tersimpan). Sekali generate per konten; pencarian chat jadi semantik (paham makna, bukan cuma kata sama).</small></p>
        <script>document.getElementById("tjcb-crawl").onclick=function(){var b=this;b.disabled=true;var off=0;
            function go(){fetch(ajaxurl,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
            body:"action=tjcb_crawl&_ajax_nonce=" + encodeURIComponent("' . wp_create_nonce('tjcb_crawl') . '") + "&offset="+off})
            .then(r=>r.json()).then(j=>{document.getElementById("tjcb-msg").textContent="Offset "+off+" — "+j.chunks+" potongan baru";
            if(j.done){b.disabled=false;location.reload();}else{off+=30;go();}});} go();};</script>';
        echo '<script>document.getElementById("tjcb-embed").onclick=function(){var b=this;b.disabled=true;
            function go(){fetch(ajaxurl,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
            body:"action=tjcb_embed&_ajax_nonce=' . wp_create_nonce('tjcb_embed') . '"})
            .then(r=>r.json()).then(j=>{if(!j.success){document.getElementById("tjcb-msg").textContent="Gagal: "+j.data;b.disabled=false;return;}
            document.getElementById("tjcb-msg").textContent="Embedding: "+j.data.embedded+" (sisa "+j.data.remaining+")";
            if(j.data.done){b.disabled=false;location.reload();}else{go();}});} go();};</script>';
        self::foot();
    }
    public static function ajax_embed() {
        check_ajax_referer('tjcb_embed');
        if (!current_user_can('manage_options')) wp_send_json_error('No access');
        $r = TJCB_Crawler::embed_pending(40);
        if (isset($r['error'])) wp_send_json_error($r['error']);
        wp_send_json_success($r);
    }
    public static function ajax_crawl() {
        check_ajax_referer('tjcb_crawl');
        if (!current_user_can('manage_options')) wp_send_json_error('No access');
        wp_send_json(TJCB_Crawler::crawl(absint($_POST['offset'] ?? 0)));
    }

    public static function page_conv() {
        global $wpdb; $t = $wpdb->prefix;
        self::head('Percakapan & Belum Terjawab');
        $rows = $wpdb->get_results("SELECT c.id, c.session_id, c.created_at, COUNT(m.id) n FROM {$t}tjcb_conversations c LEFT JOIN {$t}tjcb_messages m ON m.conversation_id=c.id GROUP BY c.id ORDER BY c.id DESC LIMIT 30");
        echo '<h2>30 percakapan terakhir</h2><table class="widefat"><thead><tr><th>ID</th><th>Waktu</th><th>Pesan</th><th>Aksi</th></tr></thead><tbody>';
        foreach ($rows as $r) echo '<tr><td>' . $r->id . '</td><td>' . esc_html($r->created_at) . '</td><td>' . $r->n . '</td>
            <td><a href="' . esc_url(admin_url('admin.php?page=tjcb-conv&view=' . $r->id)) . '">Lihat</a></td></tr>';
        echo '</tbody></table>';
        if (!empty($_GET['view'])) {
            $msgs = $wpdb->get_results($wpdb->prepare("SELECT role, content, created_at FROM {$t}tjcb_messages WHERE conversation_id=%d ORDER BY id ASC LIMIT 100", absint($_GET['view'])));
            echo '<h2>Isi percakapan</h2>';
            foreach ($msgs as $m) echo '<p><b>' . esc_html($m->role) . '</b> <small>' . esc_html($m->created_at) . '</small><br>' . esc_html(mb_substr($m->content, 0, 1500)) . '</p>';
        }
        $un = $wpdb->get_results("SELECT * FROM {$t}tjcb_unanswered WHERE done=0 ORDER BY times DESC LIMIT 50");
        echo '<h2>Belum terjawab — jadikan Knowledge</h2><table class="widefat"><thead><tr><th>Pertanyaan</th><th>x</th><th>Aksi</th></tr></thead><tbody>';
        foreach ($un as $u) {
            $add = wp_nonce_url(admin_url('admin-post.php?action=tjcb_un2kb&id=' . $u->id), 'tjcb_un2kb' . $u->id);
            echo '<tr><td>' . esc_html($u->question) . '</td><td>' . $u->times . '</td><td><a href="' . esc_url($add) . '">+ Jadi Knowledge (isi jawaban)</a></td></tr>';
        }
        echo '</tbody></table>';
        self::foot();
    }
    public static function handle_un2kb() {
        $id = absint($_GET['id'] ?? 0);
        check_admin_referer('tjcb_un2kb' . $id);
        if (!current_user_can('manage_options')) wp_die('No access');
        global $wpdb; $t = $wpdb->prefix;
        $u = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$t}tjcb_unanswered WHERE id=%d", $id));
        if ($u) {
            $wpdb->insert("{$t}tjcb_knowledge", ['question' => $u->question, 'answer' => '(ISI JAWABAN DI SINI)', 'priority' => 0, 'is_active' => 0, 'updated_at' => current_time('mysql')]);
            $wpdb->update("{$t}tjcb_unanswered", ['done' => 1], ['id' => $id]);
        }
        wp_redirect(admin_url('admin.php?page=tjcb-kb')); exit;
    }

    public static function page_set() {
        self::head('Pengaturan');
        wp_enqueue_media();
        $s = tjcb_get_settings();
        echo '<form method="post" action="options.php">';
        settings_fields('tjcb_group');
        echo '<h2>AI Provider</h2><table class="form-table">
            <tr><th>Provider</th><td><select id="tjcb-provider" name="' . TJCB_OPT . '[provider]">
            <option value="openrouter"' . selected($s['provider'], 'openrouter', false) . '>OpenRouter (100+ model)</option>
            <option value="openai"' . selected($s['provider'], 'openai', false) . '>OpenAI</option>
            <option value="custom"' . selected($s['provider'], 'custom', false) . '>OpenAI-Compatible (base URL sendiri)</option>
            </select></td></tr>
            <tr><th>API Key</th><td><input type="password" id="tjcb-apikey" name="' . TJCB_OPT . '[api_key]" value="" placeholder="' . (tjcb_decrypt($s['api_key_enc']) !== '' ? '(tersimpan, terenkripsi)' : 'sk-or-...') . '" style="width:340px"> <small>disimpan terenkripsi AES-256-GCM. Kosongkan = tidak diubah.</small></td></tr>
            <tr><th>Base URL (custom)</th><td><input id="tjcb-base" name="' . TJCB_OPT . '[custom_base]" value="' . esc_attr($s['custom_base']) . '" style="width:340px" placeholder="https://.../v1"></td></tr>
            <tr><th>Model</th><td><input id="tjcb-model" name="' . TJCB_OPT . '[model]" value="' . esc_attr($s['model']) . '" style="width:340px"> <small>cth: openai/gpt-4o-mini</small>
            <button type="button" class="button" id="tjcb-test">Tes Koneksi</button> <span id="tjcb-testmsg"></span></td></tr>
            <tr><th>Embedding (semantik)</th><td><label><input type="checkbox" name="' . TJCB_OPT . '[embed_enabled]" value="1"' . checked($s['embed_enabled'], 1, false) . '> Aktifkan pencarian semantik (vector)</label><br>
            <input id="tjcb-embedmodel" name="' . TJCB_OPT . '[embed_model]" list="tjcb-embedlist" value="' . esc_attr($s['embed_model']) . '" style="width:340px">
            <datalist id="tjcb-embedlist">
            <option value="nvidia/nemotron-3-embed-1b:free">nvidia/nemotron-3-embed-1b:free (Gratis via OpenRouter)</option>
            <option value="liquid/lfm-2.5-embedding-350m:free">liquid/lfm-2.5-embedding-350m:free (Gratis, TIDAK dukung Bahasa Indonesia)</option>
            <option value="openai/text-embedding-3-small">openai/text-embedding-3-small (OpenRouter, berbayar murah)</option>
            <option value="text-embedding-3-small">text-embedding-3-small (OpenAI langsung)</option>
            </datalist>
            <br><small>Gratis = model NVIDIA Nemotron 3 Embed (2048 dimensi, multilingual termasuk Indonesia, rate-limited). Ganti model → vektor lama otomatis dihapus & generate ulang.</small></td></tr>
            <tr><th>Bahasa jawaban</th><td><select name="' . TJCB_OPT . '[response_lang]">            <option value="id"' . selected($s['response_lang'], 'id', false) . '>Bahasa Indonesia</option>
            <option value="auto"' . selected($s['response_lang'], 'auto', false) . '>Otomatis (ikut bahasa user)</option></select></td></tr>
            <tr><th>System prompt</th><td><textarea name="' . TJCB_OPT . '[system_prompt]" rows="6" style="width:100%">' . esc_textarea($s['system_prompt']) . '</textarea></td></tr>
            <tr><th>Max tokens jawaban</th><td><input type="number" name="' . TJCB_OPT . '[max_tokens]" value="' . (int) $s['max_tokens'] . '" style="width:100px" min="100" max="4000"> <small>100–4000</small></td></tr>
            <tr><th>Temperature</th><td><input type="number" step="0.1" name="' . TJCB_OPT . '[temperature]" value="' . esc_attr($s['temperature']) . '" style="width:100px" min="0" max="2"> <small>0 = konsisten, 2 = kreatif. Disarankan rendah (0–0.3) untuk mode Grounded.</small></td></tr>
            </table>
            <h2>Anti-ngarang & Biaya</h2><table class="form-table">
            <tr><th>Grounded</th><td><label><input type="checkbox" name="' . TJCB_OPT . '[grounded]" value="1"' . checked($s['grounded'], 1, false) . '> Hanya jawab dari konten/KB, jika tidak ada → pesan “tidak tersedia”</label></td></tr>
            <tr><th>Rate limit</th><td><input type="number" name="' . TJCB_OPT . '[rate_per_min]" value="' . (int) $s['rate_per_min'] . '" style="width:80px"> pesan/menit per pengunjung</td></tr>
            <tr><th>Batas harian/pengunjung</th><td><input type="number" name="' . TJCB_OPT . '[daily_cap]" value="' . (int) $s['daily_cap'] . '" style="width:80px"> pesan/hari</td></tr>
            <tr><th>Batas harian sitewide</th><td><input type="number" name="' . TJCB_OPT . '[global_cap]" value="' . (int) $s['global_cap'] . '" style="width:80px"> pesan/hari (semua pengunjung, 0 = tanpa batas). <small>Pengaman kalau batas per-pengunjung dilewati (ganti IP/perangkat).</small></td></tr>
            <tr><th>Budget bulanan (USD)</th><td><input type="number" step="0.5" name="' . TJCB_OPT . '[cost_budget]" value="' . esc_attr($s['cost_budget']) . '" style="width:80px">
            <label><input type="checkbox" name="' . TJCB_OPT . '[cost_guard]" value="1"' . checked($s['cost_guard'], 1, false) . '> Aktifkan cost guard</label></td></tr>
            <tr><th>Simpan riwayat</th><td><label><input type="checkbox" name="' . TJCB_OPT . '[save_history]" value="1"' . checked($s['save_history'], 1, false) . '> Simpan percakapan</label>
            &nbsp; Retensi <input type="number" name="' . TJCB_OPT . '[retention]" value="' . (int) $s['retention'] . '" style="width:70px"> hari</td></tr>
            </table>
            <h2>Tampilan</h2><table class="form-table">
            <tr><th>Nama bot</th><td><input name="' . TJCB_OPT . '[bot_name]" value="' . esc_attr($s['bot_name']) . '" style="width:340px"></td></tr>
            <tr><th>Avatar</th><td>
            <span id="tjcb-avaprev" style="font-size:28px;vertical-align:middle">' . ($s['bot_avatar_img'] ? '<img src="' . esc_url($s['bot_avatar_img']) . '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;vertical-align:middle">' : esc_html($s['bot_avatar'])) . '</span>
            <input name="' . TJCB_OPT . '[bot_avatar]" value="' . esc_attr($s['bot_avatar']) . '" style="width:70px" maxlength="8" title="Emoji/karakter"> <small>emoji, cth 💬 🤖</small><br>
            <input id="tjcb-avaimg" name="' . TJCB_OPT . '[bot_avatar_img]" value="' . esc_attr($s['bot_avatar_img']) . '" style="width:340px" placeholder="atau URL gambar…">
            <button type="button" class="button" id="tjcb-avabtn">Pilih dari Media</button>
            <button type="button" class="button" id="tjcb-avadel">Hapus gambar</button>
            <br><small>Gambar (logo/maskot, disarankan persegi ≤512px) mengalahkan emoji bila diisi.</small></td></tr>
            <tr><th>Sitewide floating</th><td><label><input type="checkbox" name="' . TJCB_OPT . '[sitewide]" value="1"' . checked($s['sitewide'], 1, false) . '> Tampilkan di semua halaman (pojok kanan bawah)</label>
            <br><small>Atau pasang shortcode <code>[tj_chatbot]</code> di Elementor (Shortcode/HTML widget).</small></td></tr>
            <tr><th>Sapaan</th><td><input name="' . TJCB_OPT . '[welcome]" value="' . esc_attr($s['welcome']) . '" style="width:100%"></td></tr>
            <tr><th>Preset (pisah |)</th><td><input name="' . TJCB_OPT . '[presets]" value="' . esc_attr($s['presets']) . '" style="width:100%"></td></tr>
            <tr><th>Nomor WA / Link Daftar</th><td><input name="' . TJCB_OPT . '[wa_link]" value="' . esc_attr($s['wa_link']) . '" style="width:49%" placeholder="0853 2888 3511"> <input name="' . TJCB_OPT . '[daftar_link]" value="' . esc_attr($s['daftar_link']) . '" style="width:49%"><p class="description">Isi nomor WA biasa (mis. 0853 2888 3511) atau URL wa.me — otomatis dinormalkan. Di chat yang tampil hanya nomornya, klik langsung ke WhatsApp.</p></td></tr>
            </table>';
        submit_button();
        echo '</form><script>document.getElementById("tjcb-test").onclick=function(){var m=document.getElementById("tjcb-testmsg");m.textContent="Menghubungi...";var fd="action=tjcb_test&_ajax_nonce=' . wp_create_nonce('tjcb_test') . '&provider="+encodeURIComponent(document.getElementById("tjcb-provider").value)+"&api_key="+encodeURIComponent(document.getElementById("tjcb-apikey").value)+"&custom_base="+encodeURIComponent(document.getElementById("tjcb-base").value)+"&model="+encodeURIComponent(document.getElementById("tjcb-model").value);fetch(ajaxurl,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:fd}).then(function(r){return r.json();}).then(function(j){m.textContent=j.success?j.data:"Gagal: "+j.data;});};</script>';
        echo '<script>(function(){var btn=document.getElementById("tjcb-avabtn"),inp=document.getElementById("tjcb-avaimg"),del=document.getElementById("tjcb-avadel"),prev=document.getElementById("tjcb-avaprev"),frame=null;
            if(btn&&window.wp&&wp.media){btn.onclick=function(e){e.preventDefault();
            if(frame){frame.open();return;}
            frame=wp.media({title:"Pilih Avatar Bot",button:{text:"Pakai gambar ini"},multiple:false,library:{type:"image"}});
            frame.on("select",function(){var a=frame.state().get("selection").first().toJSON();
            var url=(a.sizes&&a.sizes.thumbnail&&a.sizes.thumbnail.url)||a.url;
            inp.value=url;prev.innerHTML="<img src=\""+url.replace(/"/g,"")+"\" style=\"width:40px;height:40px;border-radius:50%;object-fit:cover;vertical-align:middle\">";});
            frame.open();};}
            if(del){del.onclick=function(e){e.preventDefault();inp.value="";};}}());</script>';
        self::foot();
    }
    public static function save() {
        register_setting('tjcb_group', TJCB_OPT, ['sanitize_callback' => [__CLASS__, 'sanitize']]);
    }
    public static function sanitize($in) {
        $old = tjcb_get_settings();
        $o = [];
        $o['provider'] = in_array($in['provider'] ?? '', ['openai', 'openrouter', 'custom'], true) ? $in['provider'] : 'openrouter';
        $o['api_key_enc'] = !empty($in['api_key']) ? tjcb_encrypt(sanitize_text_field($in['api_key'])) : $old['api_key_enc'];
        $o['custom_base'] = esc_url_raw($in['custom_base'] ?? '');
        $o['model'] = tjcb_normalize_model(sanitize_text_field($in['model'] ?? 'openai/gpt-4o-mini'), $o['provider']);
        $o['embed_enabled'] = !empty($in['embed_enabled']) ? 1 : 0;
        $o['embed_model'] = tjcb_normalize_model(sanitize_text_field($in['embed_model'] ?? 'nvidia/nemotron-3-embed-1b:free'), $o['provider']);
        $o['max_tokens'] = max(100, min(4000, absint($in['max_tokens'] ?? $old['max_tokens'])));
        $o['temperature'] = isset($in['temperature']) ? max(0, min(2, (float) $in['temperature'])) : (float) $old['temperature'];
        $o['response_lang'] = in_array($in['response_lang'] ?? '', ['id', 'auto'], true) ? $in['response_lang'] : 'id';
        $o['system_prompt'] = sanitize_textarea_field($in['system_prompt'] ?? $old['system_prompt']);
        $o['welcome'] = sanitize_text_field($in['welcome'] ?? $old['welcome']);
        $o['presets'] = sanitize_text_field($in['presets'] ?? $old['presets']);
        $o['grounded'] = !empty($in['grounded']) ? 1 : 0;
        $o['notfound_msg'] = $old['notfound_msg'];
        $o['daily_cap'] = max(1, absint($in['daily_cap'] ?? 50));
        $o['global_cap'] = max(0, absint($in['global_cap'] ?? $old['global_cap']));
        $o['rate_per_min'] = max(1, absint($in['rate_per_min'] ?? $old['rate_per_min']));
        $o['cost_guard'] = !empty($in['cost_guard']) ? 1 : 0;
        $o['cost_budget'] = max(0, (float) ($in['cost_budget'] ?? 10));
        $o['save_history'] = !empty($in['save_history']) ? 1 : 0;
        $o['retention'] = max(7, absint($in['retention'] ?? 90));
        $o['sitewide'] = !empty($in['sitewide']) ? 1 : 0;
        $wa = trim((string) ($in['wa_link'] ?? $old['wa_link']));
        $o['wa_link'] = preg_match('~^https?://~i', $wa) ? esc_url_raw($wa) : tjcb_wa_url($wa);
        $o['daftar_link'] = esc_url_raw($in['daftar_link'] ?? $old['daftar_link']);
        $o['bot_name'] = sanitize_text_field($in['bot_name'] ?? $old['bot_name']);
        $o['bot_avatar'] = mb_substr(sanitize_text_field($in['bot_avatar'] ?? $old['bot_avatar']), 0, 8);
        $img = esc_url_raw(trim($in['bot_avatar_img'] ?? ''));
        if ($img !== '' && !preg_match('#^https?://#i', $img)) $img = '';
        $o['bot_avatar_img'] = $img;
        return $o;
    }
    public static function ajax_test() {
        check_ajax_referer('tjcb_test');
        if (!current_user_can('manage_options')) wp_send_json_error('No access');
        $s = tjcb_get_settings();
        // Pakai nilai yang sedang diketik di form (tanpa harus Simpan dulu)
        if (isset($_POST['provider']) && in_array($_POST['provider'], ['openai', 'openrouter', 'custom'], true)) {
            $s['provider'] = $_POST['provider'];
        }
        if (isset($_POST['custom_base'])) $s['custom_base'] = esc_url_raw(wp_unslash($_POST['custom_base']));
        if (!empty($_POST['model'])) $s['model'] = sanitize_text_field(wp_unslash($_POST['model']));
        if (!empty($_POST['api_key'])) {
            $s['api_key_enc'] = tjcb_encrypt(sanitize_text_field(wp_unslash($_POST['api_key'])));
        }
        $r = TJCB_Provider::test($s);
        if (isset($r['ok'])) wp_send_json_success($r['ok'] . ' Jangan lupa klik Simpan Perubahan.');
        wp_send_json_error($r['error']);
    }
}
