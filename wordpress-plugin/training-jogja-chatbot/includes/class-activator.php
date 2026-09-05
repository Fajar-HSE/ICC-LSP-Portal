<?php
if (!defined('ABSPATH')) exit;

class TJCB_Activator {
    public static function activate() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $c = $wpdb->get_charset_collate();
        $t = $wpdb->prefix;
        dbDelta("CREATE TABLE {$t}tjcb_index (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            post_id BIGINT UNSIGNED NOT NULL, post_type VARCHAR(40) NOT NULL,
            title VARCHAR(255) NOT NULL, url VARCHAR(255) NOT NULL,
            chunk_no INT NOT NULL DEFAULT 0, content MEDIUMTEXT NOT NULL,
            content_hash CHAR(32) NOT NULL, updated_at DATETIME NOT NULL,
            PRIMARY KEY (id), KEY post (post_id, chunk_no), FULLTEXT KEY ft (title, content)
        ) $c;");
        dbDelta("CREATE TABLE {$t}tjcb_knowledge (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            question VARCHAR(255) NOT NULL, answer MEDIUMTEXT NOT NULL,
            priority TINYINT NOT NULL DEFAULT 0, is_active TINYINT NOT NULL DEFAULT 1,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id), FULLTEXT KEY ft (question, answer)
        ) $c;");
        dbDelta("CREATE TABLE {$t}tjcb_conversations (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            session_id CHAR(36) NOT NULL, visitor_hash CHAR(64) NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id), KEY sess (session_id), KEY vis (visitor_hash)
        ) $c;");
        dbDelta("CREATE TABLE {$t}tjcb_messages (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            conversation_id BIGINT UNSIGNED NOT NULL, role VARCHAR(10) NOT NULL,
            content MEDIUMTEXT NOT NULL, tokens_in INT NOT NULL DEFAULT 0,
            tokens_out INT NOT NULL DEFAULT 0, model VARCHAR(120) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id), KEY conv (conversation_id)
        ) $c;");
        dbDelta("CREATE TABLE {$t}tjcb_unanswered (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            question VARCHAR(500) NOT NULL, times INT NOT NULL DEFAULT 1,
            last_at DATETIME NOT NULL, done TINYINT NOT NULL DEFAULT 0,
            PRIMARY KEY (id), KEY q (question(191))
        ) $c;");
        dbDelta("CREATE TABLE {$t}tjcb_vectors (
            post_id BIGINT UNSIGNED NOT NULL,
            chunk_no INT NOT NULL DEFAULT 0,
            embedding MEDIUMTEXT NOT NULL,
            PRIMARY KEY (post_id, chunk_no)
        ) $c;");
        update_option('tjcb_dbv', 2);
        // Seed knowledge awal Training Jogja
        if ((int) $wpdb->get_var("SELECT COUNT(*) FROM {$t}tjcb_knowledge") === 0) {
            $now = current_time('mysql');
            $seed = [
                ['Bagaimana cara mendaftar pelatihan?', "Isi formulir di https://amcicccrm.my.id/registrasi, lalu CS verifikasi via WA. Lengkapi KTP, ijazah, CV, dan pas foto, lakukan pembayaran, terima undangan kelas.", 1],
                ['Berapa kontak Training Jogja?', "Alamat: Jl. Patangpuluhan No.26A Wirobrajan, Yogyakarta. WA: 0853 2888 3511, Email: info@hseskillup.com, Jam Kerja: Senin–Jumat 08.00–17.00.", 1],
                ['Apa saja layanan Training Jogja?', "Sertifikasi BNSP, Sertifikasi Kemnaker/K3, Sertifikasi ISO (9001, 14001, 45001), In House Training, K3 & HSE, dan Management & Leadership.", 0],
                ['Apakah tersedia In House Training?', "Ya. Kurikulum custom sesuai kebutuhan perusahaan, instruktur onsite, diskon grup. Konsultasi: WA 0853 2888 3511.", 0],
            ];
            foreach ($seed as $s) {
                $wpdb->insert("{$t}tjcb_knowledge", [
                    'question' => $s[0], 'answer' => $s[1], 'priority' => $s[2],
                    'is_active' => 1, 'updated_at' => $now,
                ]);
            }
        }
        if (!wp_next_scheduled('tjcb_cleanup')) wp_schedule_event(time(), 'daily', 'tjcb_cleanup');
    }
    /** Migrasi DB untuk install lama (v1.0.x → tambah tabel vektor). Dijalankan tiap admin_init. */
    public static function migrate() {
        if ((int) get_option('tjcb_dbv', 1) >= 2) return;
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $c = $wpdb->get_charset_collate();
        $t = $wpdb->prefix;
        dbDelta("CREATE TABLE {$t}tjcb_vectors (
            post_id BIGINT UNSIGNED NOT NULL,
            chunk_no INT NOT NULL DEFAULT 0,
            embedding MEDIUMTEXT NOT NULL,
            PRIMARY KEY (post_id, chunk_no)
        ) $c;");
        update_option('tjcb_dbv', 2);
    }
    public static function cleanup() {
        global $wpdb;
        $t = $wpdb->prefix;
        $s = tjcb_get_settings();
        $days = max(7, (int) $s['retention']);
        $wpdb->query($wpdb->prepare(
            "DELETE m FROM {$t}tjcb_messages m JOIN {$t}tjcb_conversations c ON c.id=m.conversation_id WHERE c.created_at < %s",
            date('Y-m-d H:i:s', time() - $days * 86400)));
        $wpdb->query($wpdb->prepare("DELETE FROM {$t}tjcb_conversations WHERE created_at < %s",
            date('Y-m-d H:i:s', time() - $days * 86400)));
    }
}
