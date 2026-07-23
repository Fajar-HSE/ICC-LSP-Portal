import json, subprocess, sys, time

KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppeWJxdGNkcGh1emhmb2Fob3ByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc4NDQ1NSwiZXhwIjoyMTAwMzYwNDU1fQ.pGsEuaMoCxFsZetRFqacKpX_OiEFJU1V1IENKSqz6UQ"
URL = "https://ziybqtcdphuzhfoahopr.supabase.co"

with open(r'C:\Users\DELL\LSP-Dashboard\data.json', encoding='utf-8') as f:
    data = json.load(f)

def curl(method, path, body=None):
    args = ['curl', '-s', '-X', method, f'{URL}/rest/v1/{path}',
            '-H', f'apikey: {KEY}',
            '-H', f'Authorization: Bearer {KEY}']
    if body is not None:
        args += ['-H', 'Content-Type: application/json',
                 '-H', 'Prefer: return=minimal',
                 '-d', json.dumps(body, ensure_ascii=False)]
    else:
        args += ['-H', 'Accept: application/json']
    
    try:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=120)
        return proc.stdout
    except subprocess.TimeoutExpired:
        print(f"  TIMEOUT: {method} {path}")
        return ""

# 0. Clear
print("Clearing...")
curl('DELETE', 'unit_kompetensi')
curl('DELETE', 'skema')
curl('DELETE', 'lsp')
time.sleep(1)

# 1. Insert LSP
print(f"Seeding {len(data['lsp'])} LSP...")
for i in range(0, len(data['lsp']), 100):
    batch = [{"nama": l["nama"], "jml_skema": l["jml_skema"]} for l in data['lsp'][i:i+100]]
    curl('POST', 'lsp', batch)
    print(f"  LSP batch {i//100+1}/{(len(data['lsp'])-1)//100+1}")
    time.sleep(0.2)

# 2. Get all LSP (paginated)
print("Fetching LSP IDs...")
all_lsp = []
offset = 0
while True:
    out = curl('GET', f'lsp?select=id,nama&limit=1000&offset={offset}')
    if not out: break
    rows = json.loads(out)
    if not rows: break
    all_lsp.extend(rows)
    offset += 1000
print(f"  Got {len(all_lsp)} LSP")

lsp_map = {r["nama"]: r["id"] for r in all_lsp}

# 3. Insert Skema
skema_rows = []
for sk in data['skema']:
    for opt in sk['lsps']:
        lsp_id = lsp_map.get(opt['lsp'])
        if lsp_id:
            skema_rows.append({
                "nama": sk["nama"],
                "id_skema": opt.get("id_skema", ""),
                "lsp_id": lsp_id,
                "jml_unit": opt["jml_unit"]
            })

print(f"Seeding {len(skema_rows)} Skema...")
for i in range(0, len(skema_rows), 100):
    batch = skema_rows[i:i+100]
    curl('POST', 'skema', batch)
    if (i // 100) % 10 == 0:
        print(f"  Skema batch {i//100+1}/{(len(skema_rows)-1)//100+1}")
    time.sleep(0.1)

# 4. Get all Skema (paginated)
print("Fetching all Skema IDs...")
all_skema = []
offset = 0
while True:
    out = curl('GET', f'skema?select=id,lsp_id,nama&limit=1000&offset={offset}')
    if not out: break
    rows = json.loads(out)
    if not rows: break
    all_skema.extend(rows)
    offset += 1000
print(f"  Got {len(all_skema)} Skema")

skema_map = {}
for s in all_skema:
    skema_map[(s["lsp_id"], s["nama"])] = s["id"]

# 5. Insert Unit Kompetensi
unit_rows = []
for sk in data['skema']:
    for opt in sk['lsps']:
        lsp_id = lsp_map.get(opt['lsp'])
        if not lsp_id: continue
        skema_id = skema_map.get((lsp_id, sk['nama']))
        if not skema_id: continue
        for u in opt['units']:
            unit_rows.append({"kode": u["kode"], "nama": u["nama"], "skema_id": skema_id})

print(f"Seeding {len(unit_rows)} Unit Kompetensi...")
for i in range(0, len(unit_rows), 200):
    batch = unit_rows[i:i+200]
    curl('POST', 'unit_kompetensi', batch)
    if (i // 200) % 25 == 0:
        perc = int(i / len(unit_rows) * 100)
        print(f"  Unit {perc}%")
    time.sleep(0.05)

print(f"\nDONE! {len(data['lsp'])} LSP, {len(skema_rows)} Skema, {len(unit_rows)} Unit")
