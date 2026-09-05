<?php
if (!defined('ABSPATH')) exit;

/** Pengaturan + default.
 *  Catatan: string default sengaja TIDAK dibungkus __() karena fungsi ini bisa
 *  terpanggil sebelum init (WP 6.7+ memperingatkan translasi yang dimuat terlalu awal). */
function tjcb_get_settings() {
    $def = [
        'provider'      => 'openrouter', // openai | openrouter | custom
        'api_key_enc'   => '',
        'custom_base'   => '',
        'model'         => 'openai/gpt-4o-mini',
        'max_tokens'    => 800,
        'temperature'   => 0.85,
        'response_lang' => 'id', // id | auto
        'system_prompt' => "Kamu adalah Asisten Training Jogja yang ramah dan membantu. Anda berbicara seperti orang yang peduli dan berpengalaman, bukan robot.\n\nPanduan jawaban:\n- Jawab berdasarkan informasi yang tersedia di situs\n- Gunakan bahasa santai, hangat, dan natural (contoh: 'Oke', 'Nah gini', 'Sebenarnya')\n- Jika tidak tahu, akui jujur: 'Hmm, itu belum ada di data saya' atau 'Tanya ke team kami aja'\n- Arahkan ke WhatsApp 0853 2888 3511 jika perlu info lebih detail\n- Hindari mengarang harga, jadwal, atau link\n- Jawab dalam Bahasa Indonesia, singkat tapi helpful",
        'welcome'       => 'Halo! Mau tanya jadwal, biaya, syarat, atau pendaftaran pelatihan apa?',
        'presets'       => "Jadwal pelatihan 2026?|Biaya sertifikasi BNSP?|Syarat ikut Ahli K3?|Cara daftar?",
        'grounded'      => 1,
        'notfound_msg'  => 'Hmm, itu belum ada di data saya. Tanya ke team kami langsung ya — WA: 0853 2888 3511 atau email info@hseskillup.com.',
        'daily_cap'     => 50,
        'global_cap'    => 500,
        'rate_per_min'  => 10,
        'cost_guard'    => 1,
        'cost_budget'   => 10.0,
        'save_history'  => 1,
        'retention'     => 90,
        'sitewide'      => 1,
        'wa_link'       => 'https://wa.me/6285328883511',
        'daftar_link'   => 'https://amcicccrm.my.id/registrasi',
        'bot_name'      => 'Asisten Training Jogja',
        'bot_avatar'    => '💬',
        'bot_avatar_img' => '',
        'embed_enabled' => 1,
        'embed_model'   => 'nvidia/nemotron-3-embed-1b:free',
    ];
    return wp_parse_args((array) get_option(TJCB_OPT, []), $def);
}

/**
 * Samakan format nama model dengan provider yang dipakai.
 * OpenAI langsung tidak mengenal slug ala OpenRouter ("openai/gpt-4o-mini", ":free"),
 * sebaliknya OpenRouter butuh prefix vendor.
 */
function tjcb_normalize_model($model, $provider) {
    $model = trim((string) $model);
    if ($model === '') return $model;
    if ($provider === 'openai') {
        $slash = strrpos($model, '/');
        if ($slash !== false) $model = substr($model, $slash + 1);
        $colon = strpos($model, ':');
        if ($colon !== false) $model = substr($model, 0, $colon);
    } elseif ($provider === 'openrouter' && strpos($model, '/') === false) {
        if (preg_match('/^(gpt-|o1|o3|o4|chatgpt|text-embedding-)/i', $model)) $model = 'openai/' . $model;
    }
    return $model;
}
function tjcb_chat_model($s) { return tjcb_normalize_model($s['model'], $s['provider']); }
function tjcb_embed_model($s) { return tjcb_normalize_model($s['embed_model'], $s['provider']); }

/** Enkripsi API key (AES-256-GCM, kunci dari wp_salt) */
function tjcb_encrypt($plain) {
    if ($plain === '' || !function_exists('openssl_encrypt')) return $plain;
    $key = hash('sha256', wp_salt('auth'), true);
    $iv  = random_bytes(12);
    $tag = '';
    $ct  = openssl_encrypt($plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, 'tjcb_' . parse_url(home_url(), PHP_URL_HOST));
    if ($ct === false) return '';
    return 'encg:' . base64_encode($iv . $tag . $ct);
}
function tjcb_decrypt($stored) {
    if ($stored === '' || strpos($stored, 'encg:') !== 0 || !function_exists('openssl_decrypt')) return $stored;
    $raw = base64_decode(substr($stored, 5), true);
    if ($raw === false || strlen($raw) < 29) return '';
    $key = hash('sha256', wp_salt('auth'), true);
    $iv  = substr($raw, 0, 12); $tag = substr($raw, 12, 16); $ct = substr($raw, 28);
    $pt  = openssl_decrypt($ct, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, 'tjcb_' . parse_url(home_url(), PHP_URL_HOST));
    return $pt === false ? '' : $pt;
}

/** Identitas visitor dari jaringan (hash, bukan IP mentah) */
function tjcb_visitor_hash() {
    $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $ip = trim(explode(',', $ip)[0]);
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    return hash('sha256', $ip . '|' . $ua . '|' . wp_salt('auth'));
}

/**
 * Identitas perangkat dari cookie httpOnly. Dipakai berdampingan dengan
 * tjcb_visitor_hash() supaya batas harian tidak lolos hanya karena ganti IP/User-Agent.
 */
function tjcb_client_id() {
    $name = 'tjcb_cid';
    if (!empty($_COOKIE[$name]) && preg_match('/^[a-f0-9]{32}$/', $_COOKIE[$name])) {
        return $_COOKIE[$name];
    }
    $new = md5(wp_generate_uuid4() . wp_salt('auth') . microtime(true));
    if (!headers_sent()) {
        setcookie($name, $new, [
            'expires'  => time() + 30 * DAY_IN_SECONDS,
            'path'     => COOKIEPATH ? COOKIEPATH : '/',
            'domain'   => COOKIE_DOMAIN,
            'secure'   => is_ssl(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        $_COOKIE[$name] = $new;
    }
    return $new;
}

/** Token sesi HMAC */
function tjcb_make_token($sid) {
    $exp = time() + 86400;
    $sig = hash_hmac('sha256', $sid . '.' . $exp, wp_salt('auth'));
    return base64_encode($sid . '.' . $exp . '.' . $sig);
}
function tjcb_check_token($token, $sid) {
    $d = base64_decode($token, true);
    if (!$d) return false;
    $p = explode('.', $d);
    if (count($p) !== 3 || $p[0] !== $sid) return false;
    if ((int) $p[1] < time()) return false;
    return hash_equals(hash_hmac('sha256', $p[0] . '.' . $p[1], wp_salt('auth')), $p[2]);
}

/** Base URL provider */
function tjcb_provider_base($s) {
    if ($s['provider'] === 'openai') return 'https://api.openai.com/v1';
    if ($s['provider'] === 'custom') return rtrim($s['custom_base'], '/');
    return 'https://openrouter.ai/api/v1'; // openrouter
}

/** Estimasi biaya USD per 1K token (chat) — angka kasar untuk cost guard */
function tjcb_price_per_1k($model) {
    $m = strtolower($model);
    if (strpos($m, ':free') !== false) return 0.0;
    if (strpos($m, 'gpt-4o-mini') !== false) return 0.0003;
    if (strpos($m, 'gpt-4o') !== false) return 0.005;
    if (strpos($m, 'gemini-2') !== false || strpos($m, 'flash') !== false) return 0.0004;
    if (strpos($m, 'haiku') !== false) return 0.0005;
    return 0.002;
}

/** Awal bulan / hari ini menurut zona waktu situs (bukan UTC server) */
function tjcb_site_time() { return (int) current_time('timestamp'); }
function tjcb_month_start() { return date('Y-m-01 00:00:00', tjcb_site_time()); }

/** Stopword Bahasa Indonesia untuk menyaring token pencarian */
function tjcb_stopwords() {
    return apply_filters('tjcb_stopwords', [
        'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'pada', 'adalah', 'itu', 'ini',
        'atau', 'apa', 'apakah', 'bagaimana', 'gimana', 'berapa', 'kapan', 'dimana', 'mana',
        'saya', 'aku', 'kami', 'kita', 'anda', 'kamu', 'ada', 'bisa', 'dapat', 'akan', 'sudah',
        'juga', 'saja', 'agar', 'oleh', 'dalam', 'tidak', 'bukan', 'nya', 'mau', 'ingin',
        'tolong', 'mohon', 'kalau', 'kalo', 'buat', 'tentang', 'gitu', 'dong', 'sih', 'the',
        'a', 'an', 'of', 'is', 'to', 'for', 'and', 'or',
    ]);
}

/** Pecah pertanyaan jadi token bermakna (lowercase, tanpa stopword, unik) */
function tjcb_tokens($q, $min_len = 2) {
    $q = function_exists('mb_strtolower') ? mb_strtolower((string) $q, 'UTF-8') : strtolower((string) $q);
    $q = preg_replace('/[^\p{L}\p{N}\s\-]+/u', ' ', $q);
    $parts = preg_split('/[\s\-]+/u', trim((string) $q), -1, PREG_SPLIT_NO_EMPTY);
    $stop = array_flip(tjcb_stopwords());
    $out = [];
    foreach ((array) $parts as $p) {
        if (mb_strlen($p) < $min_len || isset($stop[$p])) continue;
        $out[$p] = 1;
    }
    return array_keys($out);
}

/**
 * Query FULLTEXT BOOLEAN MODE.
 * NATURAL LANGUAGE MODE memakai stopword & ambang panjang kata bawaan MySQL (Inggris),
 * sehingga kata kunci pendek/berimbuhan Bahasa Indonesia sering hilang. Prefix-match (kata*)
 * membuat "pelatihan" tetap cocok dengan "pelatihannya".
 */
function tjcb_boolean_query($q) {
    $terms = [];
    foreach (array_slice(tjcb_tokens($q), 0, 12) as $w) {
        $w = str_replace(['+', '-', '>', '<', '(', ')', '~', '*', '"', '@'], '', $w);
        if ($w === '') continue;
        $terms[] = mb_strlen($w) >= 3 ? $w . '*' : $w;
    }
    return implode(' ', $terms);
}

/**
 * Embedding via endpoint OpenAI-compatible (/embeddings).
 * $texts = array string. Return ['vectors' => [[float..],..]] atau ['error' => msg].
 */
function tjcb_embed($texts, $s) {
    $key = tjcb_decrypt($s['api_key_enc']);
    if ($key === '') return ['error' => __('API key belum diisi. Buka TJ Chatbot → Pengaturan.', 'tj-chatbot')];
    $texts = array_values(array_filter(array_map(function ($t) { return mb_substr(trim((string) $t), 0, 6000); }, (array) $texts)));
    if (empty($texts)) return ['error' => __('Teks kosong.', 'tj-chatbot')];
    $r = wp_remote_post(tjcb_provider_base($s) . '/embeddings', [
        'timeout' => 60,
        'headers' => [
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . $key,
            'HTTP-Referer' => home_url('/'),
            'X-Title' => get_bloginfo('name'),
        ],
        'body' => wp_json_encode(['model' => tjcb_embed_model($s), 'input' => $texts]),
    ]);
    if (is_wp_error($r)) return ['error' => __('Gagal embedding: ', 'tj-chatbot') . $r->get_error_message()];
    $code = wp_remote_retrieve_response_code($r);
    $j = json_decode(wp_remote_retrieve_body($r), true);
    if ($code < 200 || $code >= 300 || empty($j['data'])) {
        return ['error' => $j['error']['message'] ?? sprintf(__('Embedding HTTP %d', 'tj-chatbot'), (int) $code)];
    }
    usort($j['data'], function ($a, $b) { return ($a['index'] ?? 0) - ($b['index'] ?? 0); });
    $vecs = [];
    foreach ($j['data'] as $d) { if (!empty($d['embedding'])) $vecs[] = $d['embedding']; }
    if (count($vecs) !== count($texts)) return ['error' => __('Jumlah vektor tidak cocok.', 'tj-chatbot')];
    return ['vectors' => $vecs];
}

/** Prefix query/passage untuk model keluarga Nemotron (sesuai anjuran NVIDIA). */
function tjcb_embed_prepare($text, $role, $model) {
    if (stripos((string) $model, 'nemotron') !== false) {
        return ($role === 'query' ? 'query: ' : 'passage: ') . $text;
    }
    return $text;
}

/**
 * Vektor disimpan sebagai float32 base64 ("b64:"), bukan JSON:
 * ~4x lebih kecil dan jauh lebih cepat di-decode saat pencarian.
 * Format JSON lama tetap bisa dibaca supaya tidak perlu generate ulang.
 */
function tjcb_vec_encode($vec) {
    $bin = '';
    foreach ((array) $vec as $f) $bin .= pack('g', (float) $f);
    return 'b64:' . base64_encode($bin);
}
function tjcb_vec_decode($stored) {
    if (!is_string($stored) || $stored === '') return null;
    if (strncmp($stored, 'b64:', 4) === 0) {
        $raw = base64_decode(substr($stored, 4), true);
        if ($raw === false || strlen($raw) < 4) return null;
        $v = unpack('g*', $raw);
        return is_array($v) ? array_values($v) : null;
    }
    $v = json_decode($stored, true);
    return is_array($v) ? $v : null;
}

/** Embedding pertanyaan + cache 12 jam (pertanyaan berulang tidak memanggil API lagi) */
function tjcb_embed_query_cached($query, $s) {
    $model = tjcb_embed_model($s);
    $ck = 'tjcb_qe_' . md5($model . '|' . mb_strtolower(trim($query)));
    $hit = get_transient($ck);
    if (is_string($hit) && $hit !== '') {
        $v = tjcb_vec_decode($hit);
        if ($v) return $v;
    }
    $e = tjcb_embed([tjcb_embed_prepare($query, 'query', $model)], $s);
    if (isset($e['error']) || empty($e['vectors'][0])) return null;
    set_transient($ck, tjcb_vec_encode($e['vectors'][0]), 12 * HOUR_IN_SECONDS);
    return $e['vectors'][0];
}

/** Cosine similarity dua vektor */
function tjcb_cosine($a, $b) {
    $dot = 0.0; $na = 0.0; $nb = 0.0;
    $n = min(count($a), count($b));
    for ($i = 0; $i < $n; $i++) { $dot += $a[$i] * $b[$i]; $na += $a[$i] * $a[$i]; $nb += $b[$i] * $b[$i]; }
    if ($na <= 0 || $nb <= 0) return 0.0;
    return $dot / (sqrt($na) * sqrt($nb));
}
