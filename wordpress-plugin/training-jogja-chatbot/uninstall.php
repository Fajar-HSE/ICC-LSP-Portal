<?php
// Dijalankan WordPress saat plugin dihapus via Plugins → Delete.
// File ini jalan TANPA file utama plugin, jadi JANGAN pakai konstanta/fungsi plugin di sini.
if (!defined('WP_UNINSTALL_PLUGIN')) exit;

global $wpdb;

// Hapus tabel (satu per satu, abaikan yang gagal agar tidak fatal)
$tables = ['tjcb_index', 'tjcb_knowledge', 'tjcb_conversations', 'tjcb_messages', 'tjcb_unanswered', 'tjcb_vectors'];
if (isset($wpdb) && method_exists($wpdb, 'get_var')) {
    $prefix = $wpdb->prefix;
    foreach ($tables as $sfx) {
        $tbl = $prefix . $sfx;
        $found = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $tbl));
        if ($found === $tbl) {
            $wpdb->query('DROP TABLE `' . str_replace('`', '', $tbl) . '`');
        }
    }
}

delete_option('tjcb_settings');
delete_option('tjcb_usage_day');
delete_option('tjcb_dbv');
delete_option('tjcb_embed_model');

if (function_exists('wp_clear_scheduled_hook')) {
    wp_clear_scheduled_hook('tjcb_cleanup');
}
