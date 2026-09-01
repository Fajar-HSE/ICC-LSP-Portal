// This script checks Supabase DB status and requires environment variables
// SUPABASE_DB_PASSWORD must be set as environment variable, not hardcoded

if (!process.env.SUPABASE_DB_PASSWORD) { console.error('ERROR: set SUPABASE_DB_PASSWORD env var'); process.exit(1); }
const { Client } = require('pg');
const client = new Client({
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.ziybqtcdphuzhfoahopr',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});
client.connect().then(() => {
  return client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'lsp';");
}).then(r => {
  console.log(JSON.stringify(r.rows, null, 2));
  return client.query("SELECT DISTINCT status FROM lsp ORDER BY status;");
}).then(r => {
  console.log("\n=== STATUS VALUES ===");
  console.log(JSON.stringify(r.rows.map(r => r.status), null, 2));
  return client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
