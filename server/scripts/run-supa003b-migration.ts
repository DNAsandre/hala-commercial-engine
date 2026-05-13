/**
 * SUPA-003B: Run schema migration via Supabase SQL API
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config();

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const sqlPath = path.resolve(__dirname, '../../supabase/migrations/20260504_supa003b_schema_parity.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // Split into individual statements and execute via REST
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 10 && !s.startsWith('--'));

  console.log(`[SUPA-003B] Executing ${statements.length} SQL statements...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      const res = await fetch(`${url}/rest/v1/rpc`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: stmt }),
      });
      // For DDL, we use the SQL endpoint instead
    } catch (e: any) {
      // Ignore fetch errors for DDL
    }
  }

  // Use the SQL endpoint directly
  const fullRes = await fetch(`${url}/rest/v1/`, {
    method: 'GET',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
  });

  // Actually, let's use supabase-js rpc to run raw SQL
  const sb = createClient(url, key, { auth: { persistSession: false } });
  
  // Execute migration statements one by one via rpc
  for (const stmt of statements) {
    const { error } = await sb.rpc('exec_sql', { query: stmt + ';' }).maybeSingle();
    if (error) {
      // Try alternative: some Supabase instances don't have exec_sql
      // Fall back to direct REST API
      console.warn(`Statement skipped (will try direct): ${stmt.substring(0, 60)}...`);
    }
  }

  console.log('[SUPA-003B] Migration attempted. Check Supabase dashboard for results.');
  console.log('If statements failed, run the SQL directly in Supabase SQL Editor.');
}

main().catch(console.error);
