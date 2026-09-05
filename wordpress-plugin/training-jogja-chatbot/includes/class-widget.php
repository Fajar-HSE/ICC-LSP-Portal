<?php
if (!defined('ABSPATH')) exit;

class TJCB_Widget {
    private static $done = false;
    public static function init() {
        add_shortcode('tj_chatbot', [__CLASS__, 'shortcode']);
        add_action('wp_enqueue_scripts', [__CLASS__, 'assets']);
        add_action('wp_footer', [__CLASS__, 'sitewide']);
    }
    public static function assets() {
        wp_register_style('tjcb', TJCB_URL . 'assets/css/chat.css', [], TJCB_VERSION);
        wp_register_script('tjcb', TJCB_URL . 'assets/js/chat.js', [], TJCB_VERSION, true);
    }
    public static function config() {
        $s = tjcb_get_settings();
        return [
            'api'      => esc_url_raw(rest_url('tjcb/v1')),
            'nonce'    => wp_create_nonce('wp_rest'),
            'welcome'  => $s['welcome'],
            'presets'  => array_values(array_filter(array_map('trim', explode('|', $s['presets'])))),
            'wa'       => esc_url($s['wa_link']),
            'daftar'   => esc_url($s['daftar_link']),
            'bot_name' => $s['bot_name'],
            'avatar'   => $s['bot_avatar_img'] !== '' ? $s['bot_avatar_img'] : $s['bot_avatar'],
            'avatar_img' => $s['bot_avatar_img'] !== '' ? 1 : 0,
        ];
    }
    public static function shortcode() {
        if (self::$done) return '';
        self::$done = true;
        wp_enqueue_style('tjcb'); wp_enqueue_script('tjcb');
        wp_add_inline_script('tjcb', 'window.TJCB=' . wp_json_encode(self::config()) . ';', 'before');
        return '<div id="tjcb-inline"></div><div id="tj-chat"></div>';
    }
    public static function sitewide() {
        $s = tjcb_get_settings();
        if (empty($s['sitewide']) || is_admin() || self::$done) return;
        self::$done = true;
        // Jangan dobel kalau shortcode sudah render
        wp_enqueue_style('tjcb'); wp_enqueue_script('tjcb');
        wp_add_inline_script('tjcb', 'window.TJCB=' . wp_json_encode(self::config()) . ';', 'before');
        echo '<div id="tj-chat"></div>';
    }
}
