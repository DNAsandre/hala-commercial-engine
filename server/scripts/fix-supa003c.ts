/**
 * SUPA-003C: Remove stale SUPA-002 seed rows superseded by SUPA-003B.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  console.log('SUPA-003C: Removing stale SUPA-002 seed rows...\n');

  // Remove stale proposals (pv-1, pv-2, pv-3) — superseded by prop-v01/02/03
  const { error: e1, count: c1 } = await sb
    .from('commercial_proposal_versions')
    .delete({ count: 'exact' })
    .in('id', ['pv-1', 'pv-2', 'pv-3']);
  console.log(e1 ? `❌ proposals: ${e1.message}` : `✅ Removed ${c1} stale proposal rows (pv-1, pv-2, pv-3)`);

  // Remove stale SLA drafts (sla-1, sla-2) — superseded by sla-v01/02/03
  const { error: e2, count: c2 } = await sb
    .from('commercial_sla_drafts')
    .delete({ count: 'exact' })
    .in('id', ['sla-1', 'sla-2']);
  console.log(e2 ? `❌ SLA drafts: ${e2.message}` : `✅ Removed ${c2} stale SLA draft rows (sla-1, sla-2)`);

  // Verify final counts
  const { count: propCount } = await sb.from('commercial_proposal_versions').select('*', { count: 'exact', head: true }).eq('workspace_id', 'w4');
  const { count: slaCount } = await sb.from('commercial_sla_drafts').select('*', { count: 'exact', head: true }).eq('workspace_id', 'w4');
  
  console.log(`\nFinal counts:`);
  console.log(`  Proposals: ${propCount} (expected 3)`);
  console.log(`  SLA Drafts: ${slaCount} (expected 3)`);
}

main().catch(console.error);
