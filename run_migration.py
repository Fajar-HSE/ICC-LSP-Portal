import requests, json

SUPABASE_URL = "https://ziybqtcdphuzhfoahopr.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppeWJxdGNkcGh1emhmb2Fob3ByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc4NDQ1NSwiZXhwIjoyMTAwMzYwNDU1fQ.pGsEuaMoCxFsZetRFqacKpX_OiEFJU1V1IENKSqz6UQ"

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
