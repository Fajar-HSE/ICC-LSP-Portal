<?php
if (!defined('ABSPATH')) exit;

class TJCB_REST {
    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'routes']);
    }
    public static function routes() {
        register_rest_route('tjcb/v1', '/session', [
            'methods' => 'POST', 'callback' => [__CLASS__, 'session'],
            'permission_callback' => '__return_true',
        ]);
        register_rest_route('tjcb/v1', '/chat', [
            'methods' => 'POST', 'callback' => [__CLASS__, 'chat'],
            'permission_callback' => '__return_true',
            'args' => [
                'session_id' => ['sanitize_callback' => 'sanitize_text_field'],
                'token'      => ['sanitize_callback' => 'sanitize_text_field'],
                'message'    => ['sanitize_callback' => function ($v) { return mb_substr(wp_strip_all_tags((string) $v), 0, 2000); }],
            ],
        ]);
        register_rest_route('tjcb/v1', '/history/delete', [
            'methods' => 'POST', 'callback' => [__CLASS__, 'del_history'],
            'permission_callback' => '__return_true',
        ]);
    }

    /**
     * Browser SELALU mengirim header Origin pada request POST lintas maupun sama origin,
     * jadi request POST tanpa Origin/Referer sama sekali bukan berasal dari widget ini.
     * Situs yang berada di belakang proxy yang membuang header bisa melonggarkan lewat
     * filter tjcb_allow_missing_origin.
     */
    private static function same_origin() {
        $host = strtolower((string) parse_url(home_url(), PHP_URL_HOST));
        foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $h) {
            $val = isset($_SERVER[$h]) ? trim((string) $_SERVER[$h]) : '';
            if ($val === '') continue;
            $vhost = strtolower((string) parse_url($val, PHP_URL_HOST));
            return $vhost !== '' && $vhost === $host;
        }
        return (bool) apply_filters('tjcb_allow_missing_origin', false);
    }
    private static function forbidden() {
        return new WP_Error('forbidden', __('Asal permintaan tidak dikenal.', 'tj-chatbot'), ['status' => 403]);
    }

    public static function session() {
        if (!self::same_origin()) return self::forbidden();
        // Batasi pembuatan sesi agar token tidak bisa diborong untuk melewati kuota harian
        $k = 'tjcb_ses_' . md5(tjcb_visitor_hash());
        $n = (int) get_transient($k);
        $max = (int) apply_filters('tjcb_session_per_hour', 30);
        if ($n >= $max) {
            return new WP_Error('too_many', __('Terlalu banyak sesi baru. Coba lagi nanti.', 'tj-chatbot'), ['status' => 429]);
        }
        set_transient($k, $n + 1, HOUR_IN_SECONDS);
        tjcb_client_id(); // pasang cookie perangkat untuk perhitungan kuota
        $sid = wp_generate_uuid4();
        return ['session_id' => $sid, 'token' => tjcb_make_token($sid)];
    }

    public static function chat($req) {
        if (!self::same_origin()) return self::forbidden();
        $s = tjcb_get_settings();
        $sid = $req->get_param('session_id');
        $tok = $req->get_param('token');
        $msg = trim((string) $req->get_param('message'));
        if (!$sid || !tjcb_check_token((string) $tok, $sid)) {
            return new WP_Error('bad_session', __('Sesi tidak valid. Muat ulang halaman.', 'tj-chatbot'), ['status' => 403]);
        }
        if (mb_strlen($msg) < 2) {
            return ['reply' => __('Silakan tulis pertanyaan tentang jadwal, biaya, syarat, atau pendaftaran.', 'tj-chatbot')];
        }
        // Sapaan ringan tanpa panggil AI (hemat biaya)
        if (preg_match('/^(halo|hai|hi|pagi|siang|sore|malam|assalamualaikum|test|tes|ping)\b/iu', $msg)) {
            return ['reply' => $s['welcome'], 'tools' => [], 'sources' => []];
        }
        $gate = TJCB_Usage::check($s);
        if ($gate !== true) return ['reply' => $gate, 'tools' => ['limit']];
        if (!empty($s['cost_guard']) && TJCB_Usage::cost_mtd() >= (float) $s['cost_budget']) {
            return ['reply' => __('Layanan AI bulan ini mencapai batas. Silakan hubungi CS via WhatsApp 0853 2888 3511.', 'tj-chatbot'), 'tools' => ['cost-guard']];
        }
        // Retrieval: knowledge + index
        $ctx = TJCB_Crawler::search($msg, 5);
        if (!empty($s['grounded']) && empty($ctx)) {
            self::save_turn($sid, $msg, $s['notfound_msg'], 0, 0, tjcb_chat_model($s));
            self::log_unanswered($msg);
            TJCB_Usage::hit();
            return ['reply' => $s['notfound_msg'], 'tools' => ['grounded'], 'sources' => []];
        }
        $ref = '';
        $sources = [];
        foreach ($ctx as $c) { $ref .= "\n[Sumber: {$c['src']}]\n{$c['text']}\n"; $sources[] = $c['src']; }
        $lang_rule = ($s['response_lang'] === 'auto')
            ? 'Balas dalam bahasa yang dipakai user.'
            : 'Selalu jawab SELURUHNYA dalam Bahasa Indonesia.';
        $messages = [
            ['role' => 'system', 'content' => $s['system_prompt'] . "\n" . $lang_rule . "\n\nINFORMASI REFERENSI (sumber utama, jangan tambah fakta di luar ini):\n" . mb_substr($ref, 0, 6000)],
        ];
        foreach (self::history($sid, 6) as $h) $messages[] = $h;
        $messages[] = ['role' => 'user', 'content' => $msg];
        $res = TJCB_Provider::chat($messages, $s);
        if (isset($res['error'])) {
            return ['reply' => ($res['error'] === 'QUOTA'
                ? __('Batas pemakaian AI tercapai, coba lagi nanti atau hubungi CS via WhatsApp.', 'tj-chatbot')
                : $res['error'])];
        }
        self::save_turn($sid, $msg, $res['text'], $res['in'], $res['out'], tjcb_chat_model($s));
        TJCB_Usage::hit();
        $reply = $res['text'] . "\n\n👉 " . __('Daftar: ', 'tj-chatbot') . $s['daftar_link'] . ' | ' . __('Konsultasi: ', 'tj-chatbot') . $s['wa_link'];
        return ['reply' => $reply, 'tools' => ['retrieval', 'llm'], 'sources' => array_values(array_unique($sources))];
    }

    private static function conv_id($sid) {
        global $wpdb;
        $t = $wpdb->prefix . 'tjcb_conversations';
        $id = $wpdb->get_var($wpdb->prepare("SELECT id FROM $t WHERE session_id=%s", $sid));
        if ($id) return (int) $id;
        $wpdb->insert($t, ['session_id' => $sid, 'visitor_hash' => tjcb_visitor_hash(), 'created_at' => current_time('mysql')]);
        return (int) $wpdb->insert_id;
    }
    private static function save_turn($sid, $user, $bot, $tin, $tout, $model) {
        global $wpdb;
        $s = tjcb_get_settings();
        if (empty($s['save_history'])) return;
        $t = $wpdb->prefix . 'tjcb_messages';
        $cid = self::conv_id($sid);
        $now = current_time('mysql');
        $wpdb->insert($t, ['conversation_id' => $cid, 'role' => 'user', 'content' => mb_substr($user, 0, 4000), 'created_at' => $now]);
        $wpdb->insert($t, ['conversation_id' => $cid, 'role' => 'assistant', 'content' => mb_substr($bot, 0, 8000), 'tokens_in' => $tin, 'tokens_out' => $tout, 'model' => $model, 'created_at' => $now]);
    }
    private static function history($sid, $n) {
        global $wpdb;
        $t = $wpdb->prefix;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT role, content FROM {$t}tjcb_messages m JOIN {$t}tjcb_conversations c ON c.id=m.conversation_id WHERE c.session_id=%s ORDER BY m.id DESC LIMIT %d",
            $sid, $n * 2));
        $rows = array_reverse($rows ?: []);
        $out = [];
        foreach ($rows as $r) $out[] = ['role' => $r->role === 'assistant' ? 'assistant' : 'user', 'content' => mb_substr($r->content, 0, 1500)];
        return $out;
    }
    private static function log_unanswered($msg) {
        global $wpdb;
        $t = $wpdb->prefix . 'tjcb_unanswered';
        $q = mb_substr($msg, 0, 500);
        $id = $wpdb->get_var($wpdb->prepare("SELECT id FROM $t WHERE question=%s", $q));
        if ($id) $wpdb->query($wpdb->prepare("UPDATE $t SET times=times+1, last_at=%s WHERE id=%d", current_time('mysql'), $id));
        else $wpdb->insert($t, ['question' => $q, 'times' => 1, 'last_at' => current_time('mysql'), 'done' => 0]);
    }
    public static function del_history($req) {
        if (!self::same_origin()) return self::forbidden();
        global $wpdb;
        $t = $wpdb->prefix;
        $sid = sanitize_text_field((string) $req->get_param('session_id'));
        $tok = sanitize_text_field((string) $req->get_param('token'));
        if (!$sid || !tjcb_check_token($tok, $sid)) {
            return new WP_Error('bad_session', __('Sesi tidak valid.', 'tj-chatbot'), ['status' => 403]);
        }
        $cid = $wpdb->get_var($wpdb->prepare("SELECT id FROM {$t}tjcb_conversations WHERE session_id=%s", $sid));
        if ($cid) {
            $wpdb->delete("{$t}tjcb_messages", ['conversation_id' => $cid]);
            $wpdb->delete("{$t}tjcb_conversations", ['id' => $cid]);
        }
        return ['ok' => true];
    }
}
