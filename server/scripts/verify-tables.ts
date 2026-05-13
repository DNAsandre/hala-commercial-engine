import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES = [
  'commercial_quote_scenarios','commercial_pricing_lines','commercial_pnl_snapshots',
  'commercial_customer_scores','commercial_capacity_fits','commercial_revenue_realization',
  'commercial_mock_escalations','commercial_proposal_versions','commercial_sla_drafts',
  'commercial_activity_events','commercial_audit_events','commercial_governance_config',
  'tender_packs','tender_pack_sections','tender_placeholders','tender_required_documents',
  'tender_compliance_items','tender_submission_gates','tender_activity_events',
  'tender_audit_events','tender_governance_config',
];

(async () => {
  let ok = 0, fail = 0;
  for (const t of TABLES) {
    const { data, error } = await s.from(t).select('id').limit(1);
    if (error) { console.log('X ' + t + ': ' + error.message); fail++; }
    else { console.log('OK ' + t + ': ' + (data?.length ?? 0) + ' rows'); ok++; }
  }
  console.log('\nResult: ' + ok + '/' + TABLES.length + ' tables OK, ' + fail + ' failed');
})();
