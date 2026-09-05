<?php
/**
 * Plugin Name:       TJ AI Chatbot
 * Plugin URI:        https://training-jogja.com/
 * Description:       Chatbot AI untuk WordPress — menjawab dari konten situs + Knowledge Base sendiri, tidak mengarang jawaban. Provider: OpenAI / OpenRouter / OpenAI-compatible. Bahasa Indonesia default.
 * Version:           1.3.1
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:            Training Jogja
 * License:           GPL v2 or later
 * Text Domain:       tj-chatbot
 * Domain Path:       /languages
 */

if (!defined('ABSPATH')) exit;

define('TJCB_VERSION', '1.3.1');
define('TJCB_DIR', plugin_dir_path(__FILE__));
define('TJCB_URL', plugin_dir_url(__FILE__));
define('TJCB_OPT', 'tjcb_settings');

require_once TJCB_DIR . 'includes/helpers.php';
require_once TJCB_DIR . 'includes/class-activator.php';
require_once TJCB_DIR . 'includes/class-usage.php';
require_once TJCB_DIR . 'includes/class-provider.php';
require_once TJCB_DIR . 'includes/class-crawler.php';
require_once TJCB_DIR . 'includes/class-rest.php';
require_once TJCB_DIR . 'includes/class-widget.php';
require_once TJCB_DIR . 'includes/class-admin.php';

/* Polyfill mbstring minimal (jaga-jaga hosting tanpa ekstensi mbstring) */
if (!function_exists('mb_strlen')) { function mb_strlen($s, $e = null) { return strlen($s); } }
if (!function_exists('mb_substr')) { function mb_substr($s, $st, $l = null, $e = null) { return $l === null ? substr($s, $st) : substr($s, $st, $l); } }
if (!function_exists('mb_strtolower')) { function mb_strtolower($s, $e = null) { return strtolower($s); } }

register_activation_hook(__FILE__, ['TJCB_Activator', 'activate']);

add_action('init', function () {
    load_plugin_textdomain('tj-chatbot', false, dirname(plugin_basename(__FILE__)) . '/languages');
});
add_action('plugins_loaded', function () {
    TJCB_Admin::init();
    TJCB_REST::init();
    TJCB_Widget::init();
});
add_action('admin_init', ['TJCB_Activator', 'migrate']);
add_action('tjcb_cleanup', ['TJCB_Activator', 'cleanup']);
