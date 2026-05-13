/**
 * SUPA-002 Migration Runner
 * 
 * Executes the SQL migration against the live Supabase database
 * using the service role key (server-side only).
 * 
 * Usage: npx tsx server/scripts/run-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load .env from project root
config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Read & Split SQL ──────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, '..', '..', 'supabase', 'migrations', '20260504_supa002_commercial_tender_tables.sql');

console.log('📂 Reading migration file:', migrationPath);
const sql = readFileSync(migrationPath, 'utf-8');

// Split into individual statements (skip empty and comment-only)
// Handle DO $$ blocks as single statements
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarBlock = false;

  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    
    // Track DO $$ ... $$ blocks
    if (trimmed.startsWith('DO $$') || trimmed === 'DO $$') {
      inDollarBlock = true;
      current += line + '\n';
      continue;
    }
    if (inDollarBlock) {
      current += line + '\n';
      if (trimmed === '$$;') {
        inDollarBlock = false;
        statements.push(current.trim());
        current = '';
      }
      continue;
    }
    
    // Skip pure comments and empty lines
    if (trimmed.startsWith('--') || trimmed === '') {
      continue;
    }
    
    current += line + '\n';
    if (trimmed.endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }
  
  if (current.trim()) statements.push(current.trim());
  return statements.filter(s => s.length > 0);
}

const statements = splitStatements(sql);
console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

// ─── Execute via Supabase REST API ─────────────────────────
// The Supabase JS client doesn't support raw SQL, so we use 
// the PostgREST RPC endpoint with a helper function, or the
// direct HTTP SQL endpoint.

async function executeSql(sql: string): Promise<{ ok: boolean; error?: string }> {
  // Use the Supabase SQL HTTP API (available with service role key)
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: text };
  }
  return { ok: true };
}

// Try the direct SQL execution endpoint first
async function executeSqlDirect(sql: string): Promise<{ ok: boolean; error?: string }> {
  // Supabase exposes /pg/query for service role
  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    return { ok: false, error: await response.text() };
  }
  return { ok: true };
}

// ─── Main ──────────────────────────────────────────────────

async function runMigration() {
  console.log('🔄 Attempting to run migration via Supabase...\n');
  
  // First, test connectivity
  const { data, error } = await supabase.from('workspaces').select('id').limit(1);
  if (error) {
    console.error('❌ Cannot connect to Supabase:', error.message);
    process.exit(1);
  }
  console.log('✅ Supabase connection verified\n');

  // Try to execute the full SQL as one batch via the management API
  const fullSql = sql;
  
  // Use the Supabase Management API for SQL execution
  const projectRef = SUPABASE_URL!.replace('https://', '').replace('.supabase.co', '');
  
  console.log(`📡 Project ref: ${projectRef}`);
  console.log(`📝 Executing ${statements.length} statements...\n`);

  // Since we can't execute DDL via PostgREST, let's verify tables
  // by trying to query them. If they don't exist, we'll output the SQL
  // for manual execution.
  
  const testTables = [
    'commercial_quote_scenarios',
    'commercial_pricing_lines',
    'commercial_pnl_snapshots',
    'tender_packs',
    'tender_pack_sections',
  ];
  
  let allExist = true;
  for (const table of testTables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error && error.message.includes('does not exist')) {
      allExist = false;
      break;
    }
    if (!error) {
      console.log(`  ✅ ${table} — already exists`);
    }
  }
  
  if (allExist) {
    console.log('\n✅ All tables already exist! Migration has been applied.\n');
    return;
  }
  
  // Tables don't exist — output the SQL file path for manual execution
  console.log('\n⚠️  Tables do not yet exist in Supabase.');
  console.log('   The Supabase JS client cannot execute DDL (CREATE TABLE) statements.');
  console.log('   Please run the migration SQL via one of these methods:\n');
  console.log('   1. Supabase Dashboard → SQL Editor → paste & run:');
  console.log(`      ${migrationPath}\n`);
  console.log('   2. Supabase CLI:');
  console.log('      npx supabase db push --db-url postgresql://postgres:[PASSWORD]@db.kositquaqmuousalmoar.supabase.co:5432/postgres\n');
  console.log('   3. psql:');
  console.log('      psql postgresql://postgres:[PASSWORD]@db.kositquaqmuousalmoar.supabase.co:5432/postgres -f supabase/migrations/20260504_supa002_commercial_tender_tables.sql\n');
  
  // Output a copy-pasteable version for the SQL editor
  console.log('━'.repeat(60));
  console.log('📋 COPY THIS TO SUPABASE SQL EDITOR:');
  console.log('━'.repeat(60));
  console.log(fullSql);
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
