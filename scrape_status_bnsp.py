"""
Scrape ALL LSP status dari BNSP — pakai ?hal=N (127 halaman)
curl langsung, lebih cepat & tanpa Playwright
"""
import json, os, re, sys, time
from urllib.request import urlopen, Request

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bnsp_status_all.json")

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
        results.append(entry)
    return results

def main():
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
            with open(OUT, 'w', encoding='utf-8') as f:
                json.dump(all_lsp, f, indent=2, ensure_ascii=False)
            print(f"  [saved {len(all_lsp)} LSP]", file=sys.stderr)
        
        time.sleep(0.3)

    # Final save
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(all_lsp, f, indent=2, ensure_ascii=False)
    
    aktif = sum(1 for l in all_lsp if l['status'] == 'Lisensi Aktif')
    habis = sum(1 for l in all_lsp if l['status'] == 'Masa Berlaku Habis')
    print(f"\nDone: {len(all_lsp)} LSP (Aktif: {aktif}, Masa Berlaku Habis: {habis})", file=sys.stderr)

if __name__ == "__main__":
    main()
