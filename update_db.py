"""
Update Supabase LSP — match scraped BNSP data to DB records.

Robust version:
- Menggunakan anon key (publik, ada di repo) sebagai key utama — TIDAK butuh secret.
- Jika env SUPABASE_SERVICE_KEY diset, dipakai dulu (prioritas), tapi anon key jadi fallback.
- Auto-detect key valid: kalau request pertama 401, coba key lain.
"""
import json, os, sys
import requests as req
from concurrent.futures import ThreadPoolExecutor, as_completed

SUPABASE_URL = "https://ziybqtcdphuzhfoahopr.supabase.co"

# Anon key publik — diambil runtime dari index.html (single source of truth,
# jadi tidak ada duplikasi key di repo). Sudah cukup untuk SELECT + PATCH (RLS terbuka).
def load_anon_key():
    import re
    try:
        with open("index.html", encoding="utf-8") as f:
            txt = f.read()
        m = re.search(r"SB_KEY\s*=\s*'([^']+)'", txt)
        if m and len(m.group(1)) > 100:
            return m.group(1)
    except Exception as e:
        print(f"WARN: gagal baca anon key dari index.html: {e}", file=sys.stderr)
    return ""

ANON_KEY = load_anon_key()

def get_key():
    """Pilih key: env secret (jika valid) > anon key. Auto-test keduanya."""
    candidates = []
    env_key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    if env_key and len(env_key) > 100:
        candidates.append(("env", env_key))
    if len(ANON_KEY) > 100:
        candidates.append(("anon", ANON_KEY))

    for name, key in candidates:
        try:
            resp = req.get(
                f"{SUPABASE_URL}/rest/v1/lsp?select=id&limit=1",
                headers={"apikey": key, "Authorization": f"Bearer {key}"},
                timeout=10,
            )
            if resp.status_code == 200:
                print(f"Using key: {name}", file=sys.stderr)
                return key
            print(f"Key {name} rejected (HTTP {resp.status_code}), trying next...", file=sys.stderr)
        except Exception as e:
            print(f"Key {name} error: {e}", file=sys.stderr)
    print("FATAL: no valid key", file=sys.stderr)
    sys.exit(1)

def main():
    KEY = get_key()

    # Load scraped data
    with open("bnsp_status_all.json", encoding="utf-8") as f:
        scraped = json.load(f)
    print(f"BNSP data: {len(scraped)} LSP")

    # Fetch DB LSP names (semua, pakai pagination)
    db_lsp = []
    offset = 0
    while True:
        resp = req.get(
            f"{SUPABASE_URL}/rest/v1/lsp?select=id,nama&order=nama.asc&limit=1000&offset={offset}",
            headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Accept": "application/json"},
            timeout=15,
        )
        if resp.status_code != 200:
            print(f"DB fetch failed HTTP {resp.status_code}: {resp.text[:200]}", file=sys.stderr)
            sys.exit(1)
        rows = resp.json()
        db_lsp.extend(rows)
        if len(rows) < 1000:
            break
        offset += 1000
    print(f"DB LSP: {len(db_lsp)} records")

    # Build name -> id maps
    db_by_name = {}
    for l in db_lsp:
        db_by_name[l['nama'].lower().strip()] = l['id']

    # Match
    matched = []
    unmatched_names = []
    for s in scraped:
        key = s['nama'].lower().strip()
        if key in db_by_name:
            matched.append((db_by_name[key], s))
        else:
            unmatched_names.append(s['nama'])

    print(f"Matched: {len(matched)}")
    print(f"Unmatched: {len(unmatched_names)}")
    print(f"Unmatched examples: {unmatched_names[:10]}")

    # Update matched records
    session = req.Session()
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    def update_record(args):
        id, item = args
        payload = {
            "status": item['status'],
            "no_sk": item.get('no_sk', ''),
            "no_lisensi": item.get('no_lisensi', ''),
            "last_checked": "now()",
        }
        try:
            url = f"{SUPABASE_URL}/rest/v1/lsp?id=eq.{id}"
            resp = session.patch(url, json=payload, headers=headers, timeout=10)
            if resp.status_code not in (200, 204):
                return (id, False, f"HTTP {resp.status_code}: {resp.text[:80]}")
            return (id, True, item['status'])
        except Exception as e:
            return (id, False, str(e)[:80])

    oks = 0
    fails = 0
    aktif = 0
    habis = 0
    with ThreadPoolExecutor(max_workers=5) as ex:
        futures = [ex.submit(update_record, m) for m in matched]
        for f in as_completed(futures):
            id, ok, info = f.result()
            if ok:
                oks += 1
                if info == 'Lisensi Aktif':
                    aktif += 1
                else:
                    habis += 1
            else:
                fails += 1
                print(f"  FAIL {id}: {info}", file=sys.stderr)

    print(f"\nDone: {oks} updated (Aktif: {aktif}, Habis: {habis}), {fails} failed")

    # Insert LSP baru yang belum ada di DB (sebelumnya hanya update, tidak pernah insert)
    new_items = [s for s in scraped if s['nama'].lower().strip() not in db_by_name]
    if new_items:
        print(f"\nInserting {len(new_items)} new LSP...")
        ins_ok = 0
        for i in range(0, len(new_items), 100):
            chunk = [
                {
                    "nama": s['nama'],
                    "status": s.get('status', ''),
                    "no_sk": s.get('no_sk', ''),
                    "no_lisensi": s.get('no_lisensi', ''),
                    "last_checked": "now()",
                }
                for s in new_items[i:i+100]
            ]
            try:
                resp = session.post(
                    f"{SUPABASE_URL}/rest/v1/lsp",
                    json=chunk,
                    headers=headers,
                    timeout=30,
                )
                if resp.status_code in (200, 201, 204):
                    ins_ok += len(chunk)
                else:
                    print(f"  INSERT FAIL HTTP {resp.status_code}: {resp.text[:200]}", file=sys.stderr)
            except Exception as e:
                print(f"  INSERT ERR: {str(e)[:200]}", file=sys.stderr)
        print(f"Inserted: {ins_ok} new LSP")
    else:
        print("\nNo new LSP to insert (DB already in sync)")

if __name__ == "__main__":
    main()
