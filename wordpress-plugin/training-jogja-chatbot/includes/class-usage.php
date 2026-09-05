<?php
if (!defined('ABSPATH')) exit;

/**
 * Batas pemakaian: rate limit + cap harian + cap harian sitewide + cost guard bulanan.
 * Kuota dihitung terhadap DUA identitas sekaligus (jaringan + cookie perangkat) supaya
 * ganti IP atau ganti User-Agent saja tidak mereset kuota.
 * Counter disimpan di transient per-kunci, bukan satu option berisi seluruh visitor.
 */
class TJCB_Usage {
    const GLOBAL_KEY = 'tjcb_day_all';

    private static function keys() {
        return array_unique([tjcb_visitor_hash(), 'cid:' . tjcb_client_id()]);
    }
    /** Sisa detik sampai tengah malam waktu situs (minimal 1 jam) */
    private static function day_ttl() {
        $now = tjcb_site_time();
        return max(HOUR_IN_SECONDS, strtotime('tomorrow', $now) - $now);
    }
    public static function check($s) {
        $per_min = max(1, (int) $s['rate_per_min']);
        $cap     = max(1, (int) $s['daily_cap']);
        foreach (self::keys() as $k) {
            $rk = 'tjcb_rl_' . md5($k);
            $n = (int) get_transient($rk);
            if ($n >= $per_min) return __('Terlalu banyak pesan. Tunggu sebentar ya.', 'tj-chatbot');
            set_transient($rk, $n + 1, MINUTE_IN_SECONDS);
            if ((int) get_transient('tjcb_dc_' . md5($k)) >= $cap) {
                return __('Batas chat harian tercapai. Silakan lanjut via WhatsApp 0853 2888 3511.', 'tj-chatbot');
            }
        }
        $global = (int) $s['global_cap'];
        if ($global > 0 && (int) get_transient(self::GLOBAL_KEY) >= $global) {
            return __('Layanan chat sedang penuh hari ini. Silakan hubungi CS via WhatsApp 0853 2888 3511.', 'tj-chatbot');
        }
        return true;
    }
    public static function hit() {
        $ttl = self::day_ttl();
        foreach (self::keys() as $k) {
            $dk = 'tjcb_dc_' . md5($k);
            set_transient($dk, ((int) get_transient($dk)) + 1, $ttl);
        }
        set_transient(self::GLOBAL_KEY, ((int) get_transient(self::GLOBAL_KEY)) + 1, $ttl);
    }
    /** Biaya bulan berjalan dijumlahkan untuk SEMUA model yang dipakai, di-cache 5 menit. */
    public static function cost_mtd() {
        $cached = get_transient('tjcb_cost_mtd');
        if ($cached !== false) return (float) $cached;
        global $wpdb;
        $t = $wpdb->prefix;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT model, COALESCE(SUM(tokens_in),0) ti, COALESCE(SUM(tokens_out),0) tou
             FROM {$t}tjcb_messages WHERE created_at >= %s GROUP BY model", tjcb_month_start()));
        $sum = 0.0;
        foreach ((array) $rows as $r) {
            $sum += (($r->ti + $r->tou) / 1000) * tjcb_price_per_1k($r->model);
        }
        set_transient('tjcb_cost_mtd', $sum, 5 * MINUTE_IN_SECONDS);
        return $sum;
    }
    public static function stats_month() {
        global $wpdb;
        $t = $wpdb->prefix;
        $start = tjcb_month_start();
        return [
            'conv' => (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$t}tjcb_conversations WHERE created_at >= %s", $start)),
            'msg'  => (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$t}tjcb_messages WHERE role='user' AND created_at >= %s", $start)),
            'cost' => self::cost_mtd(),
        ];
    }
}
