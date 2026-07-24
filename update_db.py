"""
Update Supabase LSP — match scraped BNSP data to DB records
"""
import json, sys, time
import requests as req
from concurrent.futures import ThreadPoolExecutor, as_completed

SUPABASE_URL = "https://ziybqtcdphuzhfoahopr.supabase.co"
import os
KEY = os.environ.get("SUPABASE_SERVICE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppeWJxdGNkcGh1emhmb2Fob3ByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc4NDQ1NSwiZXhwIjoyMTAwMzYwNDU1fQ.pGsEuaMoCxFsZetRFqacKpX_OiEFJU1V1IENKSqz6UQ"

# Load scraped data
with open("bnsp_status_all.json") as f:
    scraped = json.load(f)
print(f"BNSP data: {len(scraped)} LSP")

# Fetch DB LSP names
resp = req.get(f"{SUPABASE_URL}/rest/v1/lsp?select=id,nama&order=nama.asc&limit=500",
    headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Accept": "application/json"})
db_lsp = resp.json()
print(f"DB LSP: {len(db_lsp)} records")

# Build name -> id maps
db_by_name = {}
for l in db_lsp:
    db_by_name[l['nama'].lower().strip()] = l['id']

# Build scraped by name (normalized)
scraped_by_name = {}
for s in scraped:
    scraped_by_name[s['nama'].lower().strip()] = s

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
    "Prefer": "return=minimal"
}

def update_record(args):
    id, item = args
    payload = {
        "status": item['status'],
        "no_sk": item['no_sk'],
        "no_lisensi": item['no_lisensi'],
        "last_checked": "now()"
    }
    try:
        url = f"{SUPABASE_URL}/rest/v1/lsp?id=eq.{id}"
        resp = session.patch(url, json=payload, headers=headers, timeout=10)
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
