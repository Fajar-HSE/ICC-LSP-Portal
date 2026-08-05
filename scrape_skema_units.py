"""
Scrape skema + unit kompetensi untuk SEMUA LSP P3 dari BNSP, lalu sync ke Supabase.

Alur:
1. Baca bnsp_status_p3.json (654 LSP + slug)
2. Fetch detail page tiap LSP -> parse tabel skema (nama, id_skema, jml_unit)
3. Fetch unit per skema via /lsp/unit-skema/{id} -> {kode, nama}
4. Checkpoint: skema_list.json + skema_units.json (resume-friendly)
5. Sync DB: INSERT skema baru + unit_kompetensi, UPDATE jml_unit bila beda
"""
import json, os, re, sys, time
import requests as req
from urllib.request import urlopen, Request
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape

HERE = os.path.dirname(os.path.abspath(__file__))
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
SUPABASE_URL = "https://ziybqtcdphuzhfoahopr.supabase.co"

def load_anon_key():
    with open(os.path.join(HERE, "index.html"), encoding="utf-8") as f:
        txt = f.read()
    m = re.search(r"SB_KEY\s*=\s*'([^']+)'", txt)
    return m.group(1) if m and len(m.group(1)) > 100 else ""

def fetch(url, timeout=30):
    r = Request(url, headers=HEADERS)
    with urlopen(r, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")

def parse_skema(html):
    """Ekstrak tabel skema dari detail page -> [(nama, id_skema, jml_unit)]"""
    out = []
    for m in re.finditer(
        r"onclick=\"fetchDataUnitSkema\('([^']+)',\s*'(\d+)'\)\"[^>]*>\s*(\d+)\s*</span>",
        html,
    ):
        out.append((unescape(m.group(1)), m.group(2), int(m.group(3))))
    return out

def parse_units(js):
    try:
        data = json.loads(js)
    except Exception:
        return []
    return [{"kode": u.get("kodeunit", ""), "nama": u.get("keterangan", "")}
            for u in data.get("units", [])]

def main():
    KEY = load_anon_key()
    if not KEY:
        print("FATAL: anon key tidak ditemukan", file=sys.stderr); sys.exit(1)

    with open(os.path.join(HERE, "bnsp_status_p3.json"), encoding="utf-8") as f:
        lsp_list = json.load(f)
    print(f"LSP P3: {len(lsp_list)}")

    # ---- Phase 1: skema list per LSP ----
    skema_file = os.path.join(HERE, "skema_list.json")
    lsp_skema = {}
    if os.path.exists(skema_file):
        lsp_skema = json.load(open(skema_file, encoding="utf-8"))
        print(f"Resume skema_list.json: {len(lsp_skema)} LSP sudah")

    # ---- Phase 0: scrape detail page tiap LSP belum ter-scrape ----
    # (resume dari skema_list.json; TPI sudah ada manual via sync)
    skipped = []
    todo = [l for l in lsp_list if l["nama"] not in lsp_skema]
    print(f"Perlu fetch detail page: {len(todo)} LSP", file=sys.stderr)

    def work(l):
        slug = l.get("slug", "").strip()
        if not slug:
            skipped.append(l)
            return l["nama"], None
        try:
            sk = parse_skema(fetch(slug, timeout=15))
            return l["nama"], sk
        except Exception as e:
            print(f"  skip {l['nama'][:40]}: {type(e).__name__}", file=sys.stderr)
            skipped.append(l)
            return l["nama"], None

    if todo:
        with ThreadPoolExecutor(max_workers=12) as ex:
            futs = {ex.submit(work, l): l for l in todo}
            for f in as_completed(futs):
                nama, skemas = f.result()
                if skemas is not None:
                    lsp_skema[nama] = skemas
        json.dump(lsp_skema, open(skema_file, "w", encoding="utf-8"), ensure_ascii=False)
        print(f"  skip {len(skipped)} LSP (slug 404/timeout)", file=sys.stderr)

    total_skema = sum(len(v) for v in lsp_skema.values())
    print(f"Total skema ter-scrape: {total_skema} dari {len(lsp_skema)} LSP")

    # ---- Phase 2: units per skema ----
    units_file = os.path.join(HERE, "skema_units.json")
    skema_units = {}
    if os.path.exists(units_file):
        skema_units = json.load(open(units_file, encoding="utf-8"))
        print(f"Resume skema_units.json: {len(skema_units)} skema sudah")

    todo_ids = [(l["nama"], nama, sid) for l in lsp_list if l["nama"] in lsp_skema
                for nama, sid, n in lsp_skema[l["nama"]]
                if sid not in skema_units]
    print(f"Perlu fetch units: {len(todo_ids)} skema")
    if todo_ids:
        def work2(t):
            lnama, sname, sid = t
            try:
                return sid, parse_units(fetch(f"https://bnsp.go.id/lsp/unit-skema/{sid}"))
            except Exception as e:
                print(f"  ERR unit skema {sid}: {type(e).__name__}", file=sys.stderr)
                return sid, None
        with ThreadPoolExecutor(max_workers=12) as ex:
            for f in as_completed({ex.submit(work2, t): t for t in todo_ids}):
                sid, units = f.result()
                if units is not None:
                    skema_units[sid] = units
        json.dump(skema_units, open(units_file, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"Total skema dgn units: {len(skema_units)}")

    # ---- Phase 3: sync DB ----
    hdrs = {"apikey": KEY, "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json", "Accept": "application/json"}
    prefs = {"Prefer": "count=exact"}

    # ambil semua lsp id+nama
    db_lsp, off = [], 0
    while True:
        r = req.get(f"{SUPABASE_URL}/rest/v1/lsp?select=id,nama&limit=1000&offset={off}", headers=hdrs, params=prefs, timeout=30)
        rows = r.json()
        db_lsp.extend(rows)
        if len(rows) < 1000: break
        off += 1000
    id_by_nama = {l["nama"]: l["id"] for l in db_lsp}
    print(f"DB LSP: {len(db_lsp)}")

    # ambil skema existing (lsp_id, nama)
    db_skema, off2 = {}, 0
    while True:
        r = req.get(f"{SUPABASE_URL}/rest/v1/skema?select=lsp_id,nama,id,jml_unit&limit=1000&offset={off2}", headers=hdrs, params=prefs, timeout=30)
        rows = r.json()
        for s in rows:
            db_skema.setdefault(s["lsp_id"], {})[s["nama"]] = {"id": s["id"], "jml_unit": s["jml_unit"]}
        if len(rows) < 1000: break
        off2 += 1000
    print(f"DB skema existing: {sum(len(v) for v in db_skema.values())}")

    ins_skema = ins_unit = upd = skip = 0
    for l in lsp_list:
        lid = id_by_nama.get(l["nama"])
        if not lid: continue
        for sname, sid, jml in lsp_skema.get(l["nama"], []):
            existing = db_skema.get(lid, {}).get(sname)
            units = skema_units.get(sid, [])
            if existing:
                if existing["jml_unit"] != jml:
                    req.patch(f"{SUPABASE_URL}/rest/v1/skema?id=eq.{existing['id']}",
                              headers=hdrs, json={"jml_unit": jml}, timeout=30)
                    upd += 1
                skip += 1
                continue
            r = req.post(f"{SUPABASE_URL}/rest/v1/skema", headers={**hdrs, "Prefer": "return=representation"},
                         json={"nama": sname, "id_skema": sid, "lsp_id": lid, "jml_unit": len(units)}, timeout=30)
            if r.status_code >= 300:
                print(f"  INS FAIL skema {sname[:40]} ({r.status_code})", file=sys.stderr)
                continue
            ins_skema += 1
            skema_id = r.json()[0]["id"]
            if units:
                for i in range(0, len(units), 300):
                    chunk = [{**u, "skema_id": skema_id} for u in units[i:i+300]]
                    rr = req.post(f"{SUPABASE_URL}/rest/v1/unit_kompetensi", headers={**hdrs, "Prefer": "return=minimal"},
                                  json=chunk, timeout=60)
                    if rr.status_code < 300:
                        ins_unit += len(chunk)
    print(f"\nSYNC: {ins_skema} skema baru, {ins_unit} unit baru, {upd} jml_unit diupdate, {skip} sudah ada")

if __name__ == "__main__":
    main()
