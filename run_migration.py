import os, requests, sys, json

SUPABASE_URL = "https://ziybqtcdphuzhfoahopr.supabase.co"
KEY = os.environ.get("SUPABASE_MANAGEMENT_KEY", "")  # WAJIB via env
if not KEY:
    sys.exit("ERROR: set SUPABASE_MANAGEMENT_KEY env var")

SQL = """
ALTER TABLE lsp ADD COLUMN IF NOT EXISTS status TEXT DEFAULT '';
ALTER TABLE lsp ADD COLUMN IF NOT EXISTS no_sk TEXT DEFAULT '';
ALTER TABLE lsp ADD COLUMN IF NOT EXISTS no_lisensi TEXT DEFAULT '';
ALTER TABLE lsp ADD COLUMN IF NOT EXISTS expiry_date TEXT DEFAULT '';
ALTER TABLE lsp ADD COLUMN IF NOT EXISTS last_checked TIMESTAMPTZ DEFAULT NOW();
"""

# Via Supabase management API 
resp = requests.post(
    f"https://api.supabase.com/v1/projects/ziybqtcdphuzhfoahopr/database/query",
    json={"query": SQL},
    headers={
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json"
    }
)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text[:1000]}")
