/**
 * seed-users.mjs — Create the 7 named test users for Hala Commercial Engine
 *
 * HOW TO USE:
 *   1. Copy .env to .env.local (never commit passwords)
 *   2. Add SEED_PASSWORD=<your-test-password> to .env.local
 *   3. Run: node scripts/seed-users.mjs
 *
 * This script:
 *   - Creates auth users in Supabase Auth (admin API)
 *   - Inserts matching rows in public.users with role + region
 *   - Is idempotent: safe to re-run (skips existing users)
 *
 * NEVER commit passwords. NEVER run in production.
 * Keep .env.local in .gitignore (it is).
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });
config({ path: resolve(__dirname, '..', '.env.local'), override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SEED_PASSWORD = process.env.SEED_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env');
  process.exit(1);
}
if (!SEED_PASSWORD) {
  console.error('❌ SEED_PASSWORD is required in .env.local (never commit this file)');
  console.error('   Add: SEED_PASSWORD=<your-test-password> to .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── User definitions ───────────────────────────────────────────────────────
// Roles: admin | manager | sales | ops | finance | viewer
// Regions must match the region values used elsewhere in the app.
const USERS = [
  { id: 'u1', name: 'Amin',      email: 'amin@hala.sa',       role: 'admin',   region: 'HQ'    },
  { id: 'u2', name: "Ra'ed",     email: 'raed@hala.sa',       role: 'manager', region: 'North' },
  { id: 'u3', name: 'Albert',    email: 'albert@hala.sa',     role: 'sales',   region: 'West'  },
  { id: 'u4', name: 'Hano',      email: 'hano@hala.sa',       role: 'sales',   region: 'East'  },
  { id: 'u5', name: 'Yazan',     email: 'yazan@hala.sa',      role: 'ops',     region: 'South' },
  { id: 'u6', name: 'Mohammed',  email: 'mohammed@hala.sa',   role: 'finance', region: 'HQ'    },
  { id: 'u7', name: 'Tariq',     email: 'tariq@hala.sa',      role: 'manager', region: 'Central' },
];

async function seedUsers() {
  console.log(`\n  Seeding ${USERS.length} users against ${SUPABASE_URL}\n`);
  let created = 0, skipped = 0, failed = 0;

  for (const user of USERS) {
    process.stdout.write(`  ${user.name.padEnd(12)} (${user.email}) ... `);

    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { name: user.name },
    });

    if (authError) {
      if (authError.message?.includes('already been registered') || authError.code === 'email_exists') {
        // Look up existing auth user to get their ID
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existing = listData?.users?.find(u => u.email === user.email);
        if (existing) {
          // Ensure public.users row exists
          await upsertProfile(user, existing.id);
          process.stdout.write('⏭  skipped (already exists)\n');
          skipped++;
          continue;
        }
      }
      process.stdout.write(`❌ auth error: ${authError.message}\n`);
      failed++;
      continue;
    }

    const authId = authData.user.id;

    // 2. Insert into public.users
    const profileError = await upsertProfile(user, authId);
    if (profileError) {
      process.stdout.write(`⚠️  auth OK but profile error: ${profileError}\n`);
      failed++;
      continue;
    }

    process.stdout.write(`✅ created (auth_id: ${authId.slice(0, 8)}...)\n`);
    created++;
  }

  console.log(`\n  Done. Created: ${created}  Skipped: ${skipped}  Failed: ${failed}\n`);
  if (failed > 0) process.exit(1);
}

async function upsertProfile(user, authId) {
  const { error } = await supabase
    .from('users')
    .upsert({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      region: user.region,
      auth_id: authId,
      active: true,
    }, { onConflict: 'email' });
  return error?.message || null;
}

seedUsers().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
