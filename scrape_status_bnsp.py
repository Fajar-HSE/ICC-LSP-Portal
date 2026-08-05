"""
Scrape LSP P3 (Pihak Ketiga) dari BNSP — portal hanya menampilkan LSP P3.

Strategi 2-tahap (akurat, karena filter sub-kategori BNSP tidak lengkap):
1. Scan halaman ?hal=N untuk SEMUA LSP + no_lisensi.
2. Klasifikasi kategori tiap LSP via halaman detail (regex 'LSP Pihak X'),
   dengan fallback: no_lisensi yang muncul di filter sProp=31-36 => P3.
3. Output: bnsp_status_all.json (semua, + kolom kategori) dan
   bnsp_status_p3.json (hanya kategori Ketiga) untuk update_db.py.
"""
import json, os, re, sys, time
from urllib.request import urlopen, Request
from concurrent.futures import ThreadPoolExecutor, as_completed

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_ALL = os.path.join(HERE, "bnsp_status_all.json")
OUT_P3 = os.path.join(HERE, "bnsp_status_p3.json")

# no_lisensi yang dikonfirmasi P3 via filter sub-kategori BNSP (31-36)
P3_LICENSES = set()
def load_p3_licenses():
    """Ambil semua no_lisensi dari halaman sProp=31..36 (sub-kategori P3)."""
    for sp in range(31, 37):
        page = 1
        while True:
            try:
                html = fetch(f"https://bnsp.go.id/lsp?sProp={sp}&hal={page}")
            except Exception as e:
                print(f"  [sProp={sp}] err: {e}", file=sys.stderr)
                time.sleep(2)
                break
            items = parse_lsp(html)
            if not items:
                break
            for it in items:
                if it['no_lisensi']:
                    P3_LICENSES.add(it['no_lisensi'])
            page += 1
            if page > 60:
                break
            time.sleep(0.2)
    print(f"P3 license confirmed via filter: {len(P3_LICENSES)}", file=sys.stderr)

def fetch(url):
    req = Request(url, headers=HEADERS)
    with urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")

def parse_lsp(html):
    results = []
    card_marker = '<div class="bg-white rounded-lg border border-gray-200 flex flex-col h-full overflow-hidden'
    blocks = html.split(card_marker)[1:]
    for block in blocks:
        entry = {}
        m = re.search(r'Lisensi Aktif|Masa Berlaku Habis', block)
        entry['status'] = m.group(0) if m else 'Unknown'
        m = re.search(r'<h3[^>]*>\s*<a[^>]*>\s*(.*?)\s*</a>\s*</h3>', block, re.DOTALL)
        if not m:
            continue
        entry['nama'] = m.group(1).strip()
        m = re.search(r'(BNSP-LSP-\d+-I[Dl])', block)
        entry['no_lisensi'] = m.group(1) if m else ''
        m = re.search(r'SK:\s*([^)\n<]+)', block)
        entry['no_sk'] = m.group(1).strip() if m else ''
        m = re.search(r'href="(https://bnsp\.go\.id/lsp/[^"]+)"', block)
        entry['slug'] = m.group(1) if m else ''
        entry['kategori'] = 'Unknown'
        results.append(entry)
    return results

def classify_detail(item):
    """Kategori via halaman detail. Returns 'Kesatu'/'Kedua'/'Ketiga'/'Unknown'."""
    lic = item.get('no_lisensi', '')
    if lic in P3_LICENSES:
        return 'Ketiga'
    slug = item.get('slug', '')
    if not slug:
        return 'Unknown'
    try:
        html = fetch(slug)
        m = re.findall(r'LSP Pihak (Kesatu|Kedua|Ketiga)', html)
        return m[0] if m else 'Unknown'
    except Exception:
        return 'Unknown'

def main():
    load_p3_licenses()

    all_lsp = []
    seen_names = set()

    for page in range(1, 200):
        url = f"https://bnsp.go.id/lsp?hal={page}"
        print(f"Page {page}...", file=sys.stderr)
        try:
            html = fetch(url)
        except Exception as e:
            print(f"  Error: {e}", file=sys.stderr)
            time.sleep(2)
            continue

        items = parse_lsp(html)
        if not items:
            print(f"  Empty page, stopping", file=sys.stderr)
            break

        new = 0
        for item in items:
            key = item['nama'].lower().strip()
            if key and key not in seen_names:
                seen_names.add(key)
                all_lsp.append(item)
                new += 1

        print(f"  {len(items)} LSP ({new} baru, total {len(all_lsp)})", file=sys.stderr)

        if len(items) < 20:
            print(f"  Less than 20 items, likely last page", file=sys.stderr)

        # Save checkpoint every 20 pages
        if page % 20 == 0:
            with open(OUT_ALL, 'w', encoding='utf-8') as f:
                json.dump(all_lsp, f, indent=2, ensure_ascii=False)
            print(f"  [saved {len(all_lsp)} LSP]", file=sys.stderr)

        time.sleep(0.3)

    # Klasifikasi kategori (paralel)
    print(f"Classifying {len(all_lsp)} LSP (detail pages)...", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = {ex.submit(classify_detail, l): i for i, l in enumerate(all_lsp)}
        for f in as_completed(futs):
            all_lsp[futs[f]]['kategori'] = f.result()

    # Final save all
    with open(OUT_ALL, 'w', encoding='utf-8') as f:
        json.dump(all_lsp, f, indent=2, ensure_ascii=False)

    # Save P3 only
    p3 = [l for l in all_lsp if l['kategori'] == 'Ketiga']
    with open(OUT_P3, 'w', encoding='utf-8') as f:
        json.dump(p3, f, indent=2, ensure_ascii=False)

    aktif = sum(1 for l in all_lsp if l['status'] == 'Lisensi Aktif')
    habis = sum(1 for l in all_lsp if l['status'] == 'Masa Berlaku Habis')
    print(f"\nDone: {len(all_lsp)} LSP total (Aktif: {aktif}, Habis: {habis}) | P3: {len(p3)}", file=sys.stderr)

if __name__ == "__main__":
    main()
