<?php
if (!defined('ABSPATH')) exit;

/** Klien chat OpenAI-compatible (OpenAI / OpenRouter / custom base URL) */
class TJCB_Provider {
    public static function chat($messages, $s) {
        $key = tjcb_decrypt($s['api_key_enc']);
        if ($key === '') return ['error' => __('API key belum diisi. Buka TJ Chatbot → Pengaturan.', 'tj-chatbot')];
        $base = tjcb_provider_base($s);
        if ($base === '') return ['error' => __('Base URL provider belum diisi.', 'tj-chatbot')];
        $body = [
            'model' => tjcb_chat_model($s),
            'messages' => $messages,
            'max_tokens' => (int) $s['max_tokens'],
            'temperature' => (float) $s['temperature'],
        ];
        $r = wp_remote_post($base . '/chat/completions', [
            'timeout' => 45,
            'headers' => [
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $key,
                'HTTP-Referer' => home_url('/'),
                'X-Title' => get_bloginfo('name'),
            ],
            'body' => wp_json_encode($body),
        ]);
        if (is_wp_error($r)) return ['error' => __('Gagal menghubungi AI: ', 'tj-chatbot') . $r->get_error_message()];
        $code = wp_remote_retrieve_response_code($r);
        $j = json_decode(wp_remote_retrieve_body($r), true);
        if ($code === 429) return ['error' => 'QUOTA', 'detail' => __('Batas pemakaian AI tercapai, coba lagi nanti.', 'tj-chatbot')];
        if ($code < 200 || $code >= 300) {
            $msg = $j['error']['message'] ?? sprintf(__('HTTP %d', 'tj-chatbot'), (int) $code);
            if ($code === 401 || $code === 403) $msg = __('API key tidak valid. Periksa Pengaturan.', 'tj-chatbot');
            if ($code === 404 || $code === 400) {
                $msg .= ' ' . sprintf(
                    /* translators: %s: nama model yang dikirim ke provider */
                    __('(model yang dikirim: %s — pastikan formatnya sesuai provider)', 'tj-chatbot'),
                    tjcb_chat_model($s));
            }
            return ['error' => $msg];
        }
        $text = $j['choices'][0]['message']['content'] ?? '';
        if ($text === '') return ['error' => __('Respons AI kosong, coba lagi.', 'tj-chatbot')];
        return [
            'text' => $text,
            'in'   => (int) ($j['usage']['prompt_tokens'] ?? 0),
            'out'  => (int) ($j['usage']['completion_tokens'] ?? 0),
        ];
    }
    public static function test($s) {
        $res = self::chat([['role' => 'user', 'content' => 'Balas persis: OK']], $s);
        if (isset($res['error'])) return $res;
        $model = tjcb_chat_model($s);
        $note = ($model !== trim($s['model'])) ? sprintf(__(' (model dinormalkan jadi %s)', 'tj-chatbot'), $model) : '';
        return ['ok' => ((stripos($res['text'], 'OK') !== false)
            ? __('Koneksi berhasil.', 'tj-chatbot')
            : __('Terhubung, respons: ', 'tj-chatbot') . mb_substr($res['text'], 0, 80)) . $note];
    }
}
