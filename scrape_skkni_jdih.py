#!/usr/bin/env python3
"""
Scrape SKKNI Berlaku dari JDIH Kemnaker
- Listing: https://jdih.kemnaker.go.id/peraturan?tag%5B0%5D=skkni&status=berlaku&per_page=15&page=N
- Detail: https://jdih.kemnaker.go.id/peraturan/detail/<id>/
- Download: https://jdih.kemnaker.go.id/download.php?id=<id> (PDF langsung, bukan homepage)
Hanya ambil yang judul mengandung "Standar Kompetensi Kerja Nasional Indonesia" / "SKKNI" dan status Berlaku
"""
import requests, re, time, json, sys
from bs4 import BeautifulSoup
from pathlib import Path

BASE_URL = "https://jdih.kemnaker.go.id"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"}

OUT_SCRAPED = Path(r"C:\Users\ASUSA5~1\AppData\Local\Temp\icc-portal\skkni_berlaku_scraped.json")
OUT_REGISTRY = Path(r"C:\Users\ASUSA5~1\AppData\Local\Temp\icc-portal\skkni_registry.json")
OUT_PREFIX = Path(r"C:\Users\ASUSA5~1\AppData\Local\Temp\icc-portal\skkni_prefix_map.json")

session = requests.Session()
session.headers.update(HEADERS)

def get_listing_page(hal):
    if hal==1:
        url = f"{BASE_URL}/peraturan?tag%5B0%5D=skkni&status=berlaku&per_page=15&sort=terbaru"
    else:
        url = f"{BASE_URL}/peraturan?tag%5B0%5D=skkni&status=berlaku&per_page=15&page=2&hal={hal}&sort=terbaru"
    for attempt in range(3):
        try:
            r = session.get(url, timeout=20)
            if r.status_code==200:
                return r.text
            print(f"  Listing hal {hal} status {r.status_code} retry")
            time.sleep(1)
        except Exception as e:
            print(f"  Listing hal {hal} error {e} retry")
            time.sleep(1)
    return None

def parse_listing(html):
    soup = BeautifulSoup(html, 'html.parser')
    cards = soup.find_all('a', href=re.compile(r'/peraturan/detail/'))
    ids = []
    for a in cards:
        href = a.get('href')
        m = re.search(r'/peraturan/detail/(\d+)/', href)
        if m:
            ids.append(m.group(1))
    # Deduplicate preserve order
    seen=set()
    uniq=[]
    for i in ids:
        if i not in seen:
            uniq.append(i)
            seen.add(i)
    # Find total count
    total_m = re.search(r'Ditemukan\s*<span[^>]*>([\d,\.]+)</span>', html)
    total = None
    if total_m:
        total = int(total_m.group(1).replace('.','').replace(',',''))
    return uniq, total

def parse_detail(id_str):
    url = f"{BASE_URL}/peraturan/detail/{id_str}/detail"
    for attempt in range(3):
        try:
            r = session.get(url, timeout=20)
            if r.status_code!=200:
                time.sleep(0.5)
                continue
            soup = BeautifulSoup(r.text, 'html.parser')
            # Extract table
            data = {}
            rows = soup.find_all('tr')
            for tr in rows:
                tds = tr.find_all('td')
                if len(tds)>=2:
                    k = tds[0].text.strip()
                    v = tds[1].text.strip()
                    # Clean
                    v = re.sub(r'\s+', ' ', v)
                    data[k]=v
            # Check judul
            judul = data.get('Judul Peraturan','')
            # Only SKKNI if contains those keywords
            is_skkni = ('Standar Kompetensi Kerja Nasional Indonesia' in judul) or ('SKKNI' in judul) or ('SKKNI' in data.get('Subjek',''))
            # Extract fields
            nomor = data.get('Nomor Peraturan','')
            tahun = data.get('Tahun Peraturan','')
            jenis = data.get('Jenis/Bentuk Peraturan','')
            status_raw = data.get('Status','')
            # Status may be in badge text
            if not status_raw:
                # Try find badge
                badge = soup.find(string=re.compile(r'Berlaku'))
                if badge:
                    status_raw = 'Berlaku'
            subjek = data.get('Subjek','')
            bidang = data.get('Bidang Hukum','')
            tgl_penetapan = data.get('Tanggal Penetapan','')
            # Build urls
            # Find actual slug from canonical? Use detail href
            # We'll construct slug from judul simplified
            slug = re.sub(r'[^a-z0-9]+','-', judul.lower())[:60]
            url_detail = f"{BASE_URL}/peraturan/detail/{id_str}/{slug}"
            # Try to find actual detail link from listing? But we have id
            # Download is always download.php?id=
            url_download = f"{BASE_URL}/download.php?id={id_str}"
            # Verify download is PDF via HEAD (optional but we do)
            # We'll assume true if id exists
            # Filter: only Berlaku and is_skkni and jenis contains Keputusan Menteri (SKKNI Kepmen)
            # Actually keep all is_skkni regardless of jenis, but prioritize Kepmen
            if 'Tidak Berlaku' in status_raw:
                return None  # skip tidak berlaku
            if not is_skkni:
                # Still include if tag skkni but judul not containing? Skip
                return None
            # Build record
            record = {
                "jdih_id": int(id_str),
                "nomor": nomor,
                "tahun": int(tahun) if tahun.isdigit() else tahun,
                "judul": judul,
                "jenis": jenis,
                "status_raw": status_raw,
                "subjek": subjek,
                "bidang": bidang,
                "tanggal_penetapan": tgl_penetapan,
                "url_detail": url_detail,
                "url_download": url_download,
                "is_skkni": is_skkni
            }
            return record
        except Exception as e:
            print(f"  Detail {id_str} error {e} retry {attempt}")
            time.sleep(0.7)
    return None

def main():
    print("=== Scraping SKKNI Berlaku JDIH ===")
    # Step 1: Collect all ids from listing - uses hal pagination
    all_ids = []
    total = None
    hal = 1
    max_pages = 80
    while hal <= max_pages:
        print(f"Fetching listing hal {hal} ...")
        html = get_listing_page(hal)
        if not html:
            print(f"  Failed hal {hal}, break")
            break
        ids, tot = parse_listing(html)
        if tot and not total:
            total = tot
            print(f"  Total ditemukan: {total} (berlaku, tag skkni)")
        print(f"  Hal {hal}: {len(ids)} ids: {ids[:3]}...")
        if not ids:
            print("  No ids, break")
            break
        # Add new ids
        new = [i for i in ids if i not in all_ids]
        if not new and len(ids)>=15:
            print("  No new ids but page full, continue to next hal (maybe duplicate due to site)")
            # Still continue, but avoid infinite loop
        all_ids.extend(new)
        # If we have reached total, break
        if total and len(all_ids) >= total:
            print(f"  Reached total {len(all_ids)}/{total}")
            break
        # If page has less than 15, last page
        if len(ids) < 15:
            print("  Last hal (less than 15)")
            break
        hal += 1
        time.sleep(0.5)
        if hal > 70:
            break

    print(f"\nCollected {len(all_ids)} unique ids from listing (expected ~921)")
    # Save ids
    Path(r"C:\Users\ASUSA5~1\AppData\Local\Temp\icc-portal\skkni_ids.json").write_text(json.dumps(all_ids, indent=2), encoding='utf-8')
    
    # Step 2: Scrape details
    scraped = []
    # Load existing progress if exists
    if OUT_SCRAPED.exists():
        try:
            scraped = json.loads(OUT_SCRAPED.read_text(encoding='utf-8'))
            print(f"Resuming: already {len(scraped)} scraped")
            scraped_ids = {str(r['jdih_id']) for r in scraped}
            # Filter out already done
            all_ids = [i for i in all_ids if i not in scraped_ids]
            print(f"Remaining to scrape: {len(all_ids)}")
        except:
            scraped=[]
    
    for idx, id_str in enumerate(all_ids, 1):
        print(f"[{idx}/{len(all_ids)}] Detail {id_str} ...", end=" ")
        rec = parse_detail(id_str)
        if rec:
            scraped.append(rec)
            print(f"OK: {rec['nomor']}/{rec['tahun']} - {rec['judul'][:50]}... Status:{rec['status_raw']}")
        else:
            print("SKIP (not SKKNI or tidak berlaku)")
        # Save incrementally every 10
        if idx % 10 == 0:
            OUT_SCRAPED.write_text(json.dumps(scraped, ensure_ascii=False, indent=2), encoding='utf-8')
            print(f"  Saved {len(scraped)} so far")
        time.sleep(0.5)
        # Early break for testing? No, full
        # if idx>=20: break

    OUT_SCRAPED.write_text(json.dumps(scraped, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"\nDone scraping. Total SKKNI Berlaku scraped: {len(scraped)}")
    print(f"Saved to {OUT_SCRAPED}")

    # Step 3: Merge into registry
    print("\n=== Merging into skkni_registry.json ===")
    try:
        registry = json.loads(OUT_REGISTRY.read_text(encoding='utf-8'))
    except:
        registry=[]
    # Build map by nomor+tahun
    reg_map = {(r.get('nomor'), str(r.get('tahun'))): r for r in registry}
    added=0
    updated=0
    for rec in scraped:
        key = (rec['nomor'], str(rec['tahun']))
        # Find existing
        existing = None
        for r in registry:
            if str(r.get('nomor')).strip()==rec['nomor'] and str(r.get('tahun'))==str(rec['tahun']):
                existing=r
                break
            # Also match by jdih_id
            if r.get('jdih_id')==rec['jdih_id']:
                existing=r
                break
        if existing:
            # Update fields if missing or status
            existing['jdih_id']=rec['jdih_id']
            existing['url_detail']=rec['url_detail']
            existing['url_download']=rec['url_download']
            existing['status']='berlaku'  # since scraped berlaku
            existing['judul']=rec['judul']  # update judul from JDIH (more accurate)
            existing['tanggal_penetapan']=rec['tanggal_penetapan']
            existing['subjek']=rec['subjek']
            updated+=1
        else:
            # Create new entry
            # Infer sektor from subjek or judul
            sektor = rec['subjek'] if rec['subjek'] else rec['bidang']
            # Simplify sektor
            if 'SKKNI' in sektor:
                sektor = sektor.replace('SKKNI - ','').strip()
            # Build id
            new_id = f"skkni-{rec['nomor']}-{rec['tahun']}"
            # Ensure unique
            suffix=1
            orig_id=new_id
            while any(r['id']==new_id for r in registry):
                new_id=f"{orig_id}-{suffix}"
                suffix+=1
            new_entry={
                "id": new_id,
                "nomor": f"Kepmenaker No. {rec['nomor']} Tahun {rec['tahun']}" if 'Keputusan' in rec['jenis'] else f"{rec['jenis']} No. {rec['nomor']} Tahun {rec['tahun']}",
                "tahun": rec['tahun'] if isinstance(rec['tahun'], int) else int(rec['tahun']) if str(rec['tahun']).isdigit() else rec['tahun'],
                "judul": rec['judul'],
                "sektor": sektor[:80] if sektor else "SKKNI",
                "status": "berlaku",
                "keterangan": f"Scraped JDIH {rec['tanggal_penetapan']} - {rec['subjek'][:80]}",
                "digantikan_oleh": None,
                "jdih_id": rec['jdih_id'],
                "url_detail": rec['url_detail'],
                "url_download": rec['url_download'],
                "keywords": [],  # will be inferred later
                "unit_prefixes": [],
                "updated_at": "2026-08-25",
                "scraped": True
            }
            registry.append(new_entry)
            added+=1

    # Sort by tahun desc, nomor desc
    registry.sort(key=lambda x: (int(x['tahun']) if isinstance(x['tahun'], int) else 0, int(re.search(r'\d+', str(x['nomor'])).group()) if re.search(r'\d+', str(x['nomor'])) else 0), reverse=True)
    OUT_REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Merged: {added} added, {updated} updated, total registry now {len(registry)}")
    print(f"Saved to {OUT_REGISTRY}")

if __name__=="__main__":
    main()
