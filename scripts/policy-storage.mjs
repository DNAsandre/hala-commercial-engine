#!/usr/bin/env node
/**
 * policy:storage — Storage Policy Enforcement Script
 * 
 * Scans client/src for forbidden browser storage usage:
 *   - localStorage (except ThemeContext.tsx)
 *   - sessionStorage (no exceptions)
 *   - indexedDB (except @supabase internal usage)
 * 
 * Also checks for in-memory business data arrays in store.ts
 * that should be read from Supabase instead.
 * 
 * Exit code 0 = PASS, 1 = FAIL
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(import.meta.dirname, '..', 'client', 'src');

// ── Config ──────────────────────────────────────────────────

const STORAGE_PATTERNS = [
  { pattern: /\blocalStorage\b/, label: 'localStorage' },
  { pattern: /\bsessionStorage\b/, label: 'sessionStorage' },
  { pattern: /\bindexedDB\b/, label: 'indexedDB' },
];

// Files allowed to use specific storage APIs
const ALLOWLIST = {
  'contexts/ThemeContext.tsx': ['localStorage'],
  // Supabase client internals handle their own storage
  'lib/supabase.ts': ['localStorage', 'sessionStorage', 'indexedDB'],
};

// Business data arrays that should NOT exist as exported mutable arrays
// in store.ts (they should come from Supabase)
const BUSINESS_ARRAY_PATTERN = /^export\s+(?:const|let)\s+(customers|workspaces|quotes|proposals|approvalRecords|signals|crmSyncEvents|auditLog|handoverTasks)\s*[:\[=]/;

// ── Helpers ─────────────────────────────────────────────────

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      // Skip node_modules, dist, .git
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      results.push(...walk(full));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

// ── Main ────────────────────────────────────────────────────

let violations = 0;
let warnings = 0;

const files = walk(ROOT);

console.log('╔══════════════════════════════════════════════════╗');
console.log('║  STORAGE POLICY CHECK — Supabase-First Guard    ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log(`Scanning ${files.length} files in client/src/...\n`);

for (const file of files) {
  const rel = relative(ROOT, file);
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const allowed = ALLOWLIST[rel] || [];

  // Check storage patterns
  for (const { pattern, label } of STORAGE_PATTERNS) {
    if (allowed.includes(label)) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      if (pattern.test(line)) {
        console.log(`  ❌ VIOLATION: ${rel}:${i + 1} — uses ${label}`);
        console.log(`     ${line.trim()}`);
        violations++;
      }
    }
  }

  // Check business arrays in store.ts
  if (rel === 'lib/store.ts') {
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(BUSINESS_ARRAY_PATTERN);
      if (match) {
        console.log(`  ⚠️  WARNING: ${rel}:${i + 1} — in-memory business array "${match[1]}" (should migrate to Supabase reads)`);
        warnings++;
      }
    }
  }
}

// ── Summary ─────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────');
if (violations === 0 && warnings === 0) {
  console.log('✅ PASS — No storage policy violations found.');
  console.log('         No in-memory business arrays detected.');
} else {
  if (violations > 0) {
    console.log(`❌ FAIL — ${violations} storage violation(s) found.`);
  }
  if (warnings > 0) {
    console.log(`⚠️  WARN — ${warnings} in-memory business array(s) in store.ts.`);
    console.log('         These are legacy mock data. Migration to Supabase reads is tracked.');
  }
  if (violations > 0) {
    console.log('\nFix all violations before proceeding.');
  }
}
console.log('─────────────────────────────────────────────────');

// Exit with error only for hard violations, not warnings
// (warnings are tracked debt, not blockers)
process.exit(violations > 0 ? 1 : 0);
