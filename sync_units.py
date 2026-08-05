"""
Phase 2+3: fetch units per skema (resume skema_list.json) + sync DB.
Dipisah karena scraping phase 1 (9.978 skema) sudah selesai; phase 2 (unit fetch)
perlu waktu lama sehingga perlu jalan terpisah & checkpoint.
"""
import json, os, sys, re
from urllib.request import urlopen, Request
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests as req

HERE = os.path.dirname(os.path.abspath(__file__))
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
SUPABASE_URL = "https://ziybqtcdphuzhfoahopr.supabase.co"

def load_anon_key():
    m = re.search(r"SB_KEY\s*=\s*'([^']+)'", open(os.path.join(HERE, "index.html"), encoding="utf-8").read())
    return m.group(1) if m and len(m.group(1)) > 100 else ""

def fetch(url, timeout=20):
    try:
        r = Request(url, headers=HEADERS)
        with urlopen(r, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception:
        return None

def parse_units(sid):
    body = fetch(f"https://bnsp.go.id/lsp/unit-skema/{sid}", timeout=20)
    if not body:
        return None
    try:
        data = json.loads(body)
    except Exception:
        return []
    return [{"kode": u.get("kodeunit", ""), "nama": u.get("keterangan", "")} for u in data.get("units", [])]

def main():
    KEY = load_anon_key()
    if not KEY:
        print("FATAL: anon key", file=sys.stderr); sys.exit(1)
    hdrs_api = {"apikey": KEY, "Authorization": f"Bearer {KEY}",
                "Content-Type": "application/json", "Accept": "application/json"}

    lsp_list = json.load(open(os.path.join(HERE, "bnsp_status_p3.json"), encoding="utf-8"))
    print("LSP P3:", len(lsp_list))

    lsp_skema = json.load(open(os.path.join(HERE, "skema_list.json"), encoding="utf-8"))
    total = sum(len(v) for v in lsp_skema.values())
    print(f"skema_list: {len(lsp_skema)} LSP | {total} total skema baris")

    units_file = os.path.join(HERE, "skema_units.json")
    skema_units = json.load(open(units_file, encoding="utf-8")) if os.path.exists(units_file) else {}
    print(f"resume skema_units.json: {len(skema_units)} skema sudah")

    # ---- Phase 2: fetch units per skema (resume-friendly) ----
    todo = []
    for l in lsp_list:
        nm = l["nama"]
        if nm not in lsp_skema:
            continue
        for sname, sid, _ in lsp_skema[nm]:
            if sid not in skema_units:
                todo.append((sid, sname))
    print(f"Perlu fetch units: {len(todo)} skema")

    if todo:
        cnt = 0
        with ThreadPoolExecutor(max_workers=15) as ex:
            fut_to_sid = {ex.submit(parse_units, sid): sid for sid, sname in todo}
            for fut in as_completed(fut_to_sid):
                sid = fut_to_sid[fut]
                units = fut.result()
                if units is not None:
                    skema_units[sid] = units
                    cnt += 1
                if (cnt + len(skema_units)) % 200 == 0:
                    print(f"  progress: {len(skema_units)}/{len(skema_units)+len(todo)-cnt} fetched", file=sys.stderr)
        json.dump(skema_units, open(units_file, "w", encoding="utf-8"), ensure_ascii=False)
        print(f"units fetched baru: {cnt} | total: {len(skema_units)}")
    else:
        print("semua units sudah ter-fetch")

    # ---- Phase 3: sync DB ----
    print("\nSync DB...")
    db_lsp, off = [], 0
    while True:
        r = req.get(f"{SUPABASE_URL}/rest/v1/lsp?select=id,nama&limit=1000&offset={off}",
                    headers={**hdrs_api, "Prefer": "count=exact"}, timeout=30)
        rows = r.json()
        db_lsp.extend(rows)
        if len(rows) < 1000: break
        off += 1000
    id_by_nama = {l["nama"]: l["id"] for l in db_lsp}

    db_skema, off2 = {}, 0
    while True:
        r = req.get(f"{SUPABASE_URL}/rest/v1/skema?select=lsp_id,nama,id,jml_unit&limit=1000&offset={off2}",
                    headers={**hdrs_api, "Prefer": "count=exact"}, timeout=30)
        rows = r.json()
        for s in rows:
            db_skema.setdefault(s["lsp_id"], {})[s["nama"]] = {"id": s["id"], "jml_unit": s["jml_unit"]}
        if len(rows) < 1000: break
        off2 += 1000
    print(f"DB skema existing: {sum(len(v) for v in db_skema.values())}")

    ins_skema=ins_unit=upd=skip=0
    for l in lsp_list:
        lid = id_by_nama.get(l["nama"])
        if not lid:
            continue
        for sname, sid, _ in lsp_skema.get(l["nama"], []):
            existing = db_skema.get(lid, {}).get(sname)
            units = skema_units.get(sid, [])
            actual = len(units)
            if existing:
                if existing["jml_unit"] != actual:
                    req.patch(f"{SUPABASE_URL}/rest/v1/skema?id=eq.{existing['id']}",
                              headers=hdrs_api, json={"jml_unit": actual}, timeout=30)
                    upd += 1
                skip += 1
                continue
            r = req.post(f"{SUPABASE_URL}/rest/v1/skema",
                         headers={**hdrs_api, "Prefer": "return=representation"},
                         json={"nama": sname, "id_skema": sid, "lsp_id": lid, "jml_unit": actual}, timeout=30)
            if r.status_code >= 300:
                print(f"  FAIL skema {sname[:35]} ({r.status_code})", file=sys.stderr)
                continue
            ins_skema += 1
            skema_id = r.json()[0]["id"]
            if units:
                for i in range(0, len(units), 300):
                    chunk = [{**u, "skema_id": skema_id} for u in units[i:i+300]]
                    ur = req.post(f"{SUPABASE_URL}/rest/v1/unit_kompetensi",
                                  headers={**hdrs_api, "Prefer": "return=minimal"},
                                  json=chunk, timeout=60)
                    if ur.status_code < 300:
                        ins_unit += len(chunk)
    print(f"\nSYNC: {ins_skema} skema baru, {ins_unit} unit baru, {upd} jml_unit updated, {skip} sudah ada")

if __name__ == "__main__":
    main()
