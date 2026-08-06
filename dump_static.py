"""
Dump data ke JSON statis tiap sync agar GitHub Pages bisa fetch lewat static file (no CORS).
Output: data.json (lsp + skema + unit_count summary).
Hanya untuk LSP P3 aktif (yang punya skema) agar ukuran wajar.
"""
import os, re, json, urllib.request, sys

URL = "https://ziybqtcdphuzhfoahopr.supabase.co"
KEY = re.search(r"SB_KEY\s*=\s*'([^']+)'", open("index.html", encoding="utf-8").read()).group(1)
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Accept": "application/json"}

def fetch_page(table, select, limit=1000):
    out = []
    off = 0
    while True:
        req = urllib.request.Request(f"{URL}/rest/v1/{table}?select={urllib.parse.quote(select)}&limit={limit}&offset={off}", headers=H)
        res = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
        out.extend(res); off += limit
        if len(res) < limit: break
    return out

def count(table):
    req = urllib.request.Request(f"{URL}/rest/v1/{table}?select=id", headers={**H, "Prefer": "count=exact"})
    r = urllib.request.urlopen(req, timeout=30)
    return int(r.headers.get("content-range").split("/")[-1])

import urllib.parse
lsp = fetch_page("lsp", "id,nama,jml_skema,status,no_sk,no_lisensi,last_checked")
skema = fetch_page("skema", "id,nama,jml_unit,lsp_id")
# join: attach lsp info per skema
id2lsp = {l["id"]: l for l in lsp}
for s in skema:
    l = id2lsp.get(s["lsp_id"])
    if l: s["lsp_nama"] = l["nama"]; s["lsp_status"] = l["status"]; s["lsp_no_sk"] = l["no_sk"]; s["lsp_no_lisensi"] = l["no_lisensi"]; s["lsp_last_checked"] = l["last_checked"]
unit_cnt = count("unit_kompetensi")
out = {"lsp": lsp, "skema": skema, "unit_total": unit_cnt, "source": "supabase anon public", "note": "static dump for static-site hosting (no CORS)"}
json.dump(out, open("data.json", "w", encoding="utf-8"), ensure_ascii=False)
print(f"Wrote data.json: {len(lsp)} LSP, {len(skema)} skema, {unit_cnt} unit")
