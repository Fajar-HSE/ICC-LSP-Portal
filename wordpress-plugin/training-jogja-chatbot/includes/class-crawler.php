<?php
if (!defined('ABSPATH')) exit;

/** Index konten situs (posts, pages, CPT publik) + pencarian hybrid */
class TJCB_Crawler {
    const CHUNK = 900;
    /** Batas baris vektor yang di-scan per pencarian (lihat vector_search) */
    const SCAN_MAX = 4000;
    const SCAN_BATCH = 500;

    public static function post_types() {
        $pts = get_post_types(['public' => true], 'names');
        unset($pts['attachment']);
        return array_values($pts);
    }
    /** Index penuh (dipanggil via admin, batch per 30 post agar tidak timeout) */
    public static function crawl($offset = 0) {
        global $wpdb;
        $t = $wpdb->prefix . 'tjcb_index';
        $q = new WP_Query([
            'post_type' => self::post_types(), 'post_status' => 'publish',
            'posts_per_page' => 30, 'offset' => $offset,
            'orderby' => 'ID', 'order' => 'ASC', 'no_found_rows' => false,
        ]);
        $now = current_time('mysql');
        $n = 0;
        foreach ($q->posts as $p) {
            $text = self::extract($p);
            if (mb_strlen($text) < 50) continue;
            $hash = md5($text);
            $old = $wpdb->get_var($wpdb->prepare("SELECT content_hash FROM $t WHERE post_id=%d AND chunk_no=0", $p->ID));
            if ($old === $hash) continue; // tidak berubah
            $wpdb->delete($t, ['post_id' => $p->ID]);
            $wpdb->delete($wpdb->prefix . 'tjcb_vectors', ['post_id' => $p->ID]);
            foreach (self::chunks($text) as $i => $ch) {
                $wpdb->insert($t, [
                    'post_id' => $p->ID, 'post_type' => $p->post_type,
                    'title' => get_the_title($p), 'url' => get_permalink($p),
                    'chunk_no' => $i, 'content' => $ch,
                    'content_hash' => $i === 0 ? $hash : md5($ch), 'updated_at' => $now,
                ]);
                $n++;
            }
        }
        return ['chunks' => $n, 'total' => (int) $q->found_posts, 'done' => ($offset + 30) >= (int) $q->found_posts];
    }
    public static function extract($p) {
        $c = $p->post_content;
        $c = strip_shortcodes($c);
        $c = preg_replace('/<!--.*?-->/s', ' ', $c);
        $c = wp_strip_all_tags($c);
        $c = html_entity_decode($c, ENT_QUOTES, 'UTF-8');
        $c = preg_replace('/\s+/', ' ', $c);
        return trim(get_the_title($p) . '. ' . mb_substr($c, 0, 20000));
    }
    public static function chunks($text) {
        $words = preg_split('/\s+/', $text);
        $out = [];
        $size = 150; $ov = 25; $i = 0;
        while ($i < count($words)) {
            $out[] = implode(' ', array_slice($words, $i, $size));
            $i += $size - $ov;
        }
        return $out;
    }

    /** Cari konteks relevan: knowledge prioritas + knowledge cocok + vector + keyword */
    public static function search($query, $limit = 5) {
        $out = [];
        $seen = [];
        $push = function ($src, $text) use (&$out, &$seen) {
            $text = trim((string) $text);
            if ($text === '') return;
            $k = md5($src . '|' . mb_substr($text, 0, 120));
            if (isset($seen[$k])) return;
            $seen[$k] = 1;
            $out[] = ['src' => $src, 'text' => mb_substr($text, 0, 800)];
        };
        // 1a. Knowledge berprioritas selalu disuntik (sesuai janji opsi "Prioritas")
        foreach (self::kb_priority(2) as $k) $push('Knowledge: ' . $k->question, $k->answer);
        // 1b. Knowledge yang cocok dengan pertanyaan
        foreach (self::kb_match($query, 3) as $k) $push('Knowledge: ' . $k->question, $k->answer);
        // 2. Vector/semantik (kalau embedding aktif & sudah ada vektor)
        foreach (self::vector_search($query, 3) as $v) $push($v['src'], $v['text']);
        // 3. Keyword FULLTEXT (+ fallback LIKE)
        foreach (self::keyword_search($query, $limit) as $r) $push($r->title . ' (' . $r->url . ')', $r->content);
        return array_slice($out, 0, 3 + $limit);
    }

    private static function kb_priority($limit = 2) {
        global $wpdb;
        $t = $wpdb->prefix . 'tjcb_knowledge';
        return (array) $wpdb->get_results($wpdb->prepare(
            "SELECT question, answer FROM $t WHERE is_active=1 AND priority=1 ORDER BY id DESC LIMIT %d", $limit));
    }

    /** Knowledge yang relevan: BOOLEAN MODE dulu, kalau kosong jatuh ke LIKE per token */
    private static function kb_match($query, $limit = 3) {
        global $wpdb;
        $t = $wpdb->prefix . 'tjcb_knowledge';
        $bq = tjcb_boolean_query($query);
        $rows = [];
        if ($bq !== '') {
            $rows = (array) $wpdb->get_results($wpdb->prepare(
                "SELECT question, answer FROM $t
                 WHERE is_active=1 AND MATCH(question,answer) AGAINST(%s IN BOOLEAN MODE)
                 ORDER BY priority DESC, MATCH(question,answer) AGAINST(%s IN BOOLEAN MODE) DESC LIMIT %d",
                $bq, $bq, $limit));
        }
        if (!empty($rows)) return $rows;
        $tok = tjcb_tokens($query);
        if (empty($tok)) return [];
        $where = []; $args = [];
        foreach (array_slice($tok, 0, 8) as $w) {
            $like = '%' . $wpdb->esc_like($w) . '%';
            $where[] = '(question LIKE %s OR answer LIKE %s)';
            $args[] = $like; $args[] = $like;
        }
        $args[] = $limit;
        return (array) $wpdb->get_results($wpdb->prepare(
            "SELECT question, answer FROM $t WHERE is_active=1 AND (" . implode(' OR ', $where) . ")
             ORDER BY priority DESC, id DESC LIMIT %d", $args));
    }

    /** Index konten: BOOLEAN MODE dulu, fallback LIKE per token */
    private static function keyword_search($query, $limit = 5) {
        global $wpdb;
        $t = $wpdb->prefix . 'tjcb_index';
        $bq = tjcb_boolean_query($query);
        $rows = [];
        if ($bq !== '') {
            $rows = (array) $wpdb->get_results($wpdb->prepare(
                "SELECT title, url, content FROM $t WHERE MATCH(title,content) AGAINST(%s IN BOOLEAN MODE)
                 ORDER BY MATCH(title,content) AGAINST(%s IN BOOLEAN MODE) DESC LIMIT %d",
                $bq, $bq, $limit));
        }
        if (!empty($rows)) return $rows;
        $tok = tjcb_tokens($query);
        if (empty($tok)) return [];
        $where = []; $args = [];
        foreach (array_slice($tok, 0, 8) as $w) {
            $like = '%' . $wpdb->esc_like($w) . '%';
            $where[] = '(title LIKE %s OR content LIKE %s)';
            $args[] = $like; $args[] = $like;
        }
        $args[] = $limit;
        return (array) $wpdb->get_results($wpdb->prepare(
            "SELECT title, url, content FROM $t WHERE " . implode(' OR ', $where) . " LIMIT %d", $args));
    }

    /**
     * Pencarian semantik. Untuk index besar, kandidat disaring dulu lewat keyword
     * agar tidak menghitung cosine untuk seluruh tabel, lalu di-scan bertahap
     * dengan batas SCAN_MAX baris supaya memori & waktu request tetap terjaga.
     */
    public static function vector_search($query, $limit = 3) {
        $s = tjcb_get_settings();
        if (empty($s['embed_enabled'])) return [];
        global $wpdb;
        $t = $wpdb->prefix;
        $nvec = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$t}tjcb_vectors");
        if ($nvec === 0) return [];
        $qv = tjcb_embed_query_cached($query, $s);
        if (!$qv) return [];

        $max = (int) apply_filters('tjcb_vector_scan_max', self::SCAN_MAX);
        $scored = [];
        $post_ids = ($nvec > $max) ? self::keyword_post_ids($query, 200) : [];

        if (!empty($post_ids)) {
            $in = implode(',', array_map('absint', $post_ids));
            $sql = "SELECT i.title, i.url, i.content, v.embedding
                    FROM {$t}tjcb_vectors v JOIN {$t}tjcb_index i
                      ON i.post_id=v.post_id AND i.chunk_no=v.chunk_no
                    WHERE v.post_id IN ($in) LIMIT %d";
            self::score_batch($wpdb->get_results($wpdb->prepare($sql, $max)), $qv, $scored);
        } else {
            for ($off = 0; $off < $max; $off += self::SCAN_BATCH) {
                $rows = $wpdb->get_results($wpdb->prepare(
                    "SELECT i.title, i.url, i.content, v.embedding
                     FROM {$t}tjcb_vectors v JOIN {$t}tjcb_index i
                       ON i.post_id=v.post_id AND i.chunk_no=v.chunk_no
                     ORDER BY v.post_id ASC, v.chunk_no ASC LIMIT %d OFFSET %d",
                    self::SCAN_BATCH, $off));
                if (empty($rows)) break;
                self::score_batch($rows, $qv, $scored);
                unset($rows);
            }
        }
        usort($scored, function ($a, $b) { return $b[0] <=> $a[0]; });
        $out = [];
        foreach (array_slice($scored, 0, $limit) as $r) {
            $out[] = ['src' => $r[1] . ' (' . $r[2] . ')', 'text' => $r[3]];
        }
        return $out;
    }

    /** Hitung skor satu batch lalu buang barisnya dari memori (embedding besar) */
    private static function score_batch($rows, $qv, &$scored) {
        $min = (float) apply_filters('tjcb_vector_min_score', 0.25);
        foreach ((array) $rows as $r) {
            $vec = tjcb_vec_decode($r->embedding);
            if (!$vec) continue;
            $sc = tjcb_cosine($qv, $vec);
            unset($vec);
            if ($sc > $min) $scored[] = [$sc, $r->title, $r->url, $r->content];
        }
    }

    /** post_id kandidat dari pencarian keyword, untuk mempersempit scan vektor */
    private static function keyword_post_ids($query, $limit = 200) {
        global $wpdb;
        $t = $wpdb->prefix . 'tjcb_index';
        $bq = tjcb_boolean_query($query);
        $ids = [];
        if ($bq !== '') {
            $ids = $wpdb->get_col($wpdb->prepare(
                "SELECT DISTINCT post_id FROM $t WHERE MATCH(title,content) AGAINST(%s IN BOOLEAN MODE) LIMIT %d",
                $bq, $limit));
        }
        if (!empty($ids)) return $ids;
        $tok = tjcb_tokens($query);
        if (empty($tok)) return [];
        $where = []; $args = [];
        foreach (array_slice($tok, 0, 6) as $w) {
            $like = '%' . $wpdb->esc_like($w) . '%';
            $where[] = '(title LIKE %s OR content LIKE %s)';
            $args[] = $like; $args[] = $like;
        }
        $args[] = $limit;
        return (array) $wpdb->get_col($wpdb->prepare(
            "SELECT DISTINCT post_id FROM $t WHERE " . implode(' OR ', $where) . " LIMIT %d", $args));
    }

    /** Generate embedding untuk chunks yang belum punya vektor. Dipanggil berulang via AJAX. */
    public static function embed_pending($batch = 40) {
        $s = tjcb_get_settings();
        global $wpdb;
        $t = $wpdb->prefix;
        // Ganti model embedding → vektor lama tidak valid, hapus & generate ulang
        $model = tjcb_embed_model($s);
        $used = get_option('tjcb_embed_model', '');
        $nvec = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$t}tjcb_vectors");
        if ($nvec > 0 && $used !== '' && $used !== $model) {
            $wpdb->query("DELETE FROM {$t}tjcb_vectors");
        }
        update_option('tjcb_embed_model', $model, false);
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT i.post_id, i.chunk_no, i.content FROM {$t}tjcb_index i
             LEFT JOIN {$t}tjcb_vectors v ON v.post_id=i.post_id AND v.chunk_no=i.chunk_no
             WHERE v.post_id IS NULL LIMIT %d", $batch));
        if (empty($rows)) {
            return ['embedded' => 0, 'remaining' => 0, 'done' => true];
        }
        $texts = [];
        foreach ($rows as $r) $texts[] = tjcb_embed_prepare($r->content, 'passage', $model);
        $e = tjcb_embed($texts, $s);
        if (isset($e['error'])) return ['error' => $e['error']];
        foreach ($rows as $i => $r) {
            $wpdb->replace("{$t}tjcb_vectors", [
                'post_id' => $r->post_id, 'chunk_no' => $r->chunk_no,
                'embedding' => tjcb_vec_encode($e['vectors'][$i]),
            ]);
        }
        $rem = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$t}tjcb_index i
            LEFT JOIN {$t}tjcb_vectors v ON v.post_id=i.post_id AND v.chunk_no=i.chunk_no WHERE v.post_id IS NULL");
        return ['embedded' => count($rows), 'remaining' => $rem, 'done' => $rem === 0];
    }
    public static function stats() {
        global $wpdb;
        $t = $wpdb->prefix . 'tjcb_index';
        $v = $wpdb->prefix . 'tjcb_vectors';
        $has_v = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $v)) === $v;
        return [
            'chunks' => (int) $wpdb->get_var("SELECT COUNT(*) FROM $t"),
            'docs'   => (int) $wpdb->get_var("SELECT COUNT(DISTINCT post_id) FROM $t"),
            'vecs'   => $has_v ? (int) $wpdb->get_var("SELECT COUNT(*) FROM $v") : 0,
            'vec_model' => get_option('tjcb_embed_model', '-'),
        ];
    }
}
