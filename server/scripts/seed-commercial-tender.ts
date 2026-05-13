/**
 * SUPA-002 Seed Script — Populate new tables with existing mock data
 *
 * Reads from commercial-workspace-data.ts and tender-workspace-data.ts
 * and inserts into the new Supabase tables via service role key.
 *
 * Usage: npx tsx server/scripts/seed-commercial-tender.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Helper ─────────────────────────────────────────────────
async function upsertBatch(table: string, rows: Record<string, any>[]) {
  if (!rows.length) { console.log('  SKIP ' + table + ' (0 rows)'); return; }
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) console.log('  FAIL ' + table + ': ' + error.message);
  else console.log('  OK   ' + table + ': ' + rows.length + ' rows');
}

// ─── Commercial Seed Data ───────────────────────────────────
async function seedCommercial() {
  console.log('\n=== COMMERCIAL WORKSPACE SEED ===\n');
  const W4 = 'w4'; // Al-Rajhi workspace

  // 1. Quote Scenarios
  await upsertBatch('commercial_quote_scenarios', [
    { id: 'qs-a', workspace_id: W4, name: 'Option A — Standard Tariff', version: 'v0.1', status: 'draft_scenario', revenue: 1200000, cost: 1098000, gp_percent: 8.5, pricing_posture: 'Reprice', customer_score: 'C', capacity_fit: 'Constrained', revenue_timing: 'Next Quarter', mock_escalation: 'Red margin signal — CEO/CFO future approval required', owner: 'Amin Al-Rashid', notes: 'Standard tariff applied to emergency storage scope. GP below threshold.' },
    { id: 'qs-b', workspace_id: W4, name: 'Option B — Aggressive Entry Price', version: 'v0.1', status: 'margin_risk_flagged', revenue: 1080000, cost: 1020000, gp_percent: 5.6, pricing_posture: 'Walk Away / Reprice', customer_score: 'C', capacity_fit: 'Constrained', revenue_timing: 'Next Quarter', mock_escalation: 'CEO/CFO future approval required — GP critically below threshold', owner: 'Amin Al-Rashid', notes: 'Aggressive entry price to secure initial volume. Margin risk flagged.' },
    { id: 'qs-c', workspace_id: W4, name: 'Option C — Premium Fast Implementation', version: 'v0.1', status: 'ready_for_review_mock', revenue: 1380000, cost: 1080000, gp_percent: 21.7, pricing_posture: 'Balanced', customer_score: 'C', capacity_fit: 'Acceptable', revenue_timing: 'This Quarter', mock_escalation: 'Future commercial review required — near authority threshold', owner: 'Amin Al-Rashid', notes: 'Premium pricing with expedited implementation. GP near threshold.' },
  ]);

  // 2. Pricing Lines (Option A)
  await upsertBatch('commercial_pricing_lines', [
    { id: 'pl-a1', scenario_id: 'qs-a', service_category: 'Storage', service_name: 'Ambient Pallet Storage', unit: 'plt/mo', volume: 4800, selling_rate: 180, revenue: 864000, cost_rate: 169.50, cost: 813600, gross_profit: 50400, gp_percent: 5.8, cost_owner: 'Warehouse', selling_owner: 'Commercial', risk_level: 'High', risk_reason: 'Storage margin is thin', review_status: 'Needs Ops Input' },
    { id: 'pl-a2', scenario_id: 'qs-a', service_category: 'Inbound Handling', service_name: 'Inbound Handling', unit: 'mvt', volume: 7200, selling_rate: 12, revenue: 86400, cost_rate: 10, cost: 72000, gross_profit: 14400, gp_percent: 16.7, cost_owner: 'Operations', selling_owner: 'Commercial', risk_level: 'Low' },
    { id: 'pl-a3', scenario_id: 'qs-a', service_category: 'Outbound Handling', service_name: 'Outbound Handling', unit: 'mvt', volume: 6600, selling_rate: 14, revenue: 92400, cost_rate: 11.50, cost: 75900, gross_profit: 16500, gp_percent: 17.9, cost_owner: 'Operations', selling_owner: 'Commercial', risk_level: 'Low' },
    { id: 'pl-a4', scenario_id: 'qs-a', service_category: 'Value Added Services', service_name: 'Value Added Services', unit: 'unit', volume: 2400, selling_rate: 25, revenue: 60000, cost_rate: 20, cost: 48000, gross_profit: 12000, gp_percent: 20.0, cost_owner: 'Operations', selling_owner: 'Commercial', risk_level: 'Low', review_status: 'Reviewed Mock' },
    { id: 'pl-a5', scenario_id: 'qs-a', service_category: 'Admin / Reporting', service_name: 'Admin & Reporting', unit: 'month', volume: 12, selling_rate: 6000, revenue: 72000, cost_rate: 5500, cost: 66000, gross_profit: 6000, gp_percent: 8.3, cost_owner: 'Finance', selling_owner: 'Commercial', risk_level: 'Medium', review_status: 'Needs Finance Input' },
    { id: 'pl-a6', scenario_id: 'qs-a', service_category: 'Special Handling', service_name: 'Special Handling Buffer', unit: 'event', volume: 600, selling_rate: 42, revenue: 25200, cost_rate: 37.50, cost: 22500, gross_profit: 2700, gp_percent: 10.7, cost_owner: 'Operations', selling_owner: 'Commercial', risk_level: 'Medium', review_status: 'Needs Ops Input' },
    // Option B
    { id: 'pl-b1', scenario_id: 'qs-b', service_category: 'Storage', service_name: 'Ambient Pallet Storage', unit: 'plt/mo', volume: 4800, selling_rate: 165, revenue: 792000, cost_rate: 160, cost: 768000, gross_profit: 24000, gp_percent: 3.0, cost_owner: 'Warehouse', selling_owner: 'Commercial', risk_level: 'High', review_status: 'Risk Flagged' },
    { id: 'pl-b2', scenario_id: 'qs-b', service_category: 'Inbound Handling', service_name: 'Inbound Handling', unit: 'mvt', volume: 7200, selling_rate: 10.50, revenue: 75600, cost_rate: 9.50, cost: 68400, gross_profit: 7200, gp_percent: 9.5, cost_owner: 'Operations', selling_owner: 'Commercial', risk_level: 'Medium' },
    { id: 'pl-b3', scenario_id: 'qs-b', service_category: 'Outbound Handling', service_name: 'Outbound Handling', unit: 'mvt', volume: 6600, selling_rate: 11.50, revenue: 75900, cost_rate: 10.50, cost: 69300, gross_profit: 6600, gp_percent: 8.7, cost_owner: 'Operations', selling_owner: 'Commercial', risk_level: 'Medium' },
    { id: 'pl-b4', scenario_id: 'qs-b', service_category: 'Value Added Services', service_name: 'Value Added Services', unit: 'unit', volume: 2400, selling_rate: 18, revenue: 43200, cost_rate: 14, cost: 33600, gross_profit: 9600, gp_percent: 22.2, cost_owner: 'Operations', selling_owner: 'Commercial', risk_level: 'Low', review_status: 'Reviewed Mock' },
    { id: 'pl-b5', scenario_id: 'qs-b', service_category: 'Admin / Reporting', service_name: 'Admin & Reporting', unit: 'month', volume: 12, selling_rate: 3800, revenue: 45600, cost_rate: 4200, cost: 50400, gross_profit: -4800, gp_percent: -10.5, cost_owner: 'Finance', selling_owner: 'Commercial', risk_level: 'Critical', review_status: 'Risk Flagged' },
    { id: 'pl-b6', scenario_id: 'qs-b', service_category: 'Transport Add-On', service_name: 'Transport Add-On', unit: 'trip', volume: 1200, selling_rate: 39.75, revenue: 47700, cost_rate: 24.85, cost: 29820, gross_profit: 17880, gp_percent: 37.5, cost_owner: 'Transport', selling_owner: 'Commercial', risk_level: 'Low' },
    // Option C
    { id: 'pl-c1', scenario_id: 'qs-c', service_category: 'Storage', service_name: 'Premium Pallet Storage', unit: 'plt/mo', volume: 4800, selling_rate: 210, revenue: 1008000, cost_rate: 165, cost: 792000, gross_profit: 216000, gp_percent: 21.4, cost_owner: 'Warehouse', selling_owner: 'Commercial', risk_level: 'Low', review_status: 'Reviewed Mock' },
    { id: 'pl-c2', scenario_id: 'qs-c', service_category: 'Inbound Handling', service_name: 'Inbound Handling', unit: 'mvt', volume: 7200, selling_rate: 15, revenue: 108000, cost_rate: 10, cost: 72000, gross_profit: 36000, gp_percent: 33.3, cost_owner: 'Operations', selling_owner: 'Commercial', risk_level: 'Low', review_status: 'Reviewed Mock' },
    { id: 'pl-c3', scenario_id: 'qs-c', service_category: 'Outbound Handling', service_name: 'Outbound Handling', unit: 'mvt', volume: 6600, selling_rate: 16, revenue: 105600, cost_rate: 11, cost: 72600, gross_profit: 33000, gp_percent: 31.3, cost_owner: 'Operations', selling_owner: 'Commercial', risk_level: 'Low' },
    { id: 'pl-c4', scenario_id: 'qs-c', service_category: 'Value Added Services', service_name: 'Enhanced VAS Package', unit: 'unit', volume: 2400, selling_rate: 22, revenue: 52800, cost_rate: 18, cost: 43200, gross_profit: 9600, gp_percent: 18.2, cost_owner: 'Operations', selling_owner: 'Commercial', risk_level: 'Medium', review_status: 'Needs Ops Input' },
    { id: 'pl-c5', scenario_id: 'qs-c', service_category: 'Dedicated Manpower', service_name: 'Dedicated Team', unit: 'man-mo', volume: 24, selling_rate: 2500, revenue: 60000, cost_rate: 2400, cost: 57600, gross_profit: 2400, gp_percent: 4.0, cost_owner: 'Operations', selling_owner: 'Commercial', risk_level: 'High', review_status: 'Needs Ops Input' },
    { id: 'pl-c6', scenario_id: 'qs-c', service_category: 'Special Handling', service_name: 'Fast Implementation Premium', unit: 'month', volume: 12, selling_rate: 3800, revenue: 45600, cost_rate: 3595, cost: 43140, gross_profit: 2460, gp_percent: 5.4, cost_owner: 'Projects', selling_owner: 'Commercial', risk_level: 'Medium', review_status: 'Needs Finance Input' },
  ]);

  // 3. P&L Snapshots
  await upsertBatch('commercial_pnl_snapshots', [
    { id: 'pnl-a', scenario_id: 'qs-a', revenue: 1200000, warehouse_cost: 813600, transport_cost: 0, labor_cost: 147900, special_handling_cost: 22500, admin_reporting_cost: 66000, risk_reserve: 48000, total_cost: 1098000, gross_profit: 102000, gp_percent: 8.5, pnl_confidence: 'Needs Finance + Ops Input', missing_inputs: JSON.stringify(['Warehouse cost confirmation', 'Handling labor rate validation', 'Risk reserve methodology']), input_owners: JSON.stringify([{owner:'Finance',item:'Confirm cost allocation'},{owner:'Operations',item:'Confirm capacity'}]), assumptions: JSON.stringify(['400 pallets constant occupancy', 'Risk reserve at 4%']), notes: 'P&L basis credible but needs sign-off.' },
    { id: 'pnl-b', scenario_id: 'qs-b', revenue: 1080000, warehouse_cost: 768000, transport_cost: 29820, labor_cost: 137700, special_handling_cost: 0, admin_reporting_cost: 50400, risk_reserve: 33600, total_cost: 1019520, gross_profit: 60480, gp_percent: 5.6, pnl_confidence: 'Needs Finance + Ops Input', missing_inputs: JSON.stringify(['Aggressive pricing justification', 'Admin subsidy approval']), input_owners: JSON.stringify([{owner:'Finance',item:'Validate GP tolerance'}]), assumptions: JSON.stringify(['Entry pricing to secure footprint']), notes: 'Aggressive scenario — multiple lines near cost.' },
    { id: 'pnl-c', scenario_id: 'qs-c', revenue: 1380000, warehouse_cost: 792000, transport_cost: 0, labor_cost: 144600, special_handling_cost: 43140, admin_reporting_cost: 0, risk_reserve: 100800, total_cost: 1080540, gross_profit: 299460, gp_percent: 21.7, pnl_confidence: 'Ready for Review Mock', missing_inputs: JSON.stringify(['Implementation scope finalization']), input_owners: JSON.stringify([{owner:'Operations',item:'Confirm manpower cost'}]), assumptions: JSON.stringify(['Premium rate justified', 'Risk reserve at 7.3%']), notes: 'Near 22% threshold.', last_reviewed: '2026-02-10', reviewed_by: "Ra'ed Al-Harbi" },
  ]);

  // 4. Customer Score
  await upsertBatch('commercial_customer_scores', [
    { id: 'cs-w4', workspace_id: W4, customer_id: 'c9', overall_grade: 'C', overall_score: 42, financial_strength: JSON.stringify({rating:'Weak',score:25,factors:['DSO 68 days','Bad payment status','Declining revenue']}), operational_behavior: JSON.stringify({rating:'Moderate',score:50,factors:['Small volume 400 pallets']}), strategic_fit: JSON.stringify({rating:'Low',score:35,factors:['Non-strategic segment']}), commercial_fit: JSON.stringify({rating:'Marginal',score:40,factors:['GP 8.5% below threshold']}), notes: 'High-risk customer. Short-term emergency scope.' },
  ]);

  // 5. Capacity Fits
  await upsertBatch('commercial_capacity_fits', [
    { id: 'cf-a', scenario_id: 'qs-a', facility: 'Jubail 1', capacity_before: 2200, required_positions: 400, capacity_after: 1800, utilization_before: 73.3, utilization_after: 86.7, fit_status: 'Constrained', constraints: JSON.stringify(['Near capacity ceiling', 'No seasonal buffer']), ops_owner: 'Yazan Khalil', notes: 'Tight fit — monitor weekly.' },
    { id: 'cf-b', scenario_id: 'qs-b', facility: 'Jubail 1', capacity_before: 2200, required_positions: 400, capacity_after: 1800, utilization_before: 73.3, utilization_after: 86.7, fit_status: 'Constrained', constraints: JSON.stringify(['Same capacity concern as Option A']), ops_owner: 'Yazan Khalil' },
    { id: 'cf-c', scenario_id: 'qs-c', facility: 'Jubail 1', capacity_before: 2200, required_positions: 400, capacity_after: 1800, utilization_before: 73.3, utilization_after: 86.7, fit_status: 'Acceptable', constraints: JSON.stringify(['Premium rate justifies priority allocation']), ops_owner: 'Yazan Khalil' },
  ]);

  // 6. Revenue Realization
  await upsertBatch('commercial_revenue_realization', [
    { id: 'rr-a', scenario_id: 'qs-a', timing: 'Next Quarter', ramp_weeks: 6, month1_percent: 40, full_run_month: 3, risk_factors: JSON.stringify(['Client onboarding delays', 'IT integration']) },
    { id: 'rr-b', scenario_id: 'qs-b', timing: 'Next Quarter', ramp_weeks: 8, month1_percent: 30, full_run_month: 4, risk_factors: JSON.stringify(['Aggressive pricing may not sustain volume']) },
    { id: 'rr-c', scenario_id: 'qs-c', timing: 'This Quarter', ramp_weeks: 3, month1_percent: 70, full_run_month: 2, risk_factors: JSON.stringify(['Fast implementation scope creep']) },
  ]);

  // 7. Mock Escalations
  await upsertBatch('commercial_mock_escalations', [
    { id: 'esc-a1', scenario_id: 'qs-a', type: 'Margin', severity: 'Critical', signal: 'GP 8.5% below 10% floor', required_authority: 'CEO/CFO', current_status: 'Open' },
    { id: 'esc-a2', scenario_id: 'qs-a', type: 'Customer Risk', severity: 'High', signal: 'ECR Grade C — DSO 68d', required_authority: 'Director', current_status: 'Open' },
    { id: 'esc-a3', scenario_id: 'qs-a', type: 'Capacity', severity: 'Medium', signal: 'Utilization to 86.7%', required_authority: 'Ops Head', current_status: 'Open' },
    { id: 'esc-b1', scenario_id: 'qs-b', type: 'Margin', severity: 'Critical', signal: 'GP 5.6% — critically below threshold', required_authority: 'CEO/CFO', current_status: 'Open' },
    { id: 'esc-b2', scenario_id: 'qs-b', type: 'Negative Margin Line', severity: 'Critical', signal: 'Admin line at -10.5% GP', required_authority: 'CFO', current_status: 'Open' },
    { id: 'esc-b3', scenario_id: 'qs-b', type: 'Customer Risk', severity: 'High', signal: 'ECR Grade C — Bad payer', required_authority: 'Director', current_status: 'Open' },
    { id: 'esc-c1', scenario_id: 'qs-c', type: 'Margin', severity: 'Medium', signal: 'GP 21.7% near 22% authority threshold', required_authority: 'Director', current_status: 'Open' },
    { id: 'esc-c2', scenario_id: 'qs-c', type: 'Implementation Risk', severity: 'Medium', signal: 'Fast implementation scope may expand', required_authority: 'Ops Head', current_status: 'Open' },
    { id: 'esc-c3', scenario_id: 'qs-c', type: 'Manpower Cost', severity: 'Low', signal: 'Dedicated FTE margin at 4%', required_authority: 'Ops Head', current_status: 'Open' },
  ]);

  // 8. Proposal Versions
  await upsertBatch('commercial_proposal_versions', [
    { id: 'pv-1', workspace_id: W4, scenario_id: 'qs-a', version: 'v0.1', status: 'draft_mock', margin_delta: '-13.5% vs target', client_facing: false, future_gate: 'Commercial Review', notes: 'Initial draft based on Option A.' },
    { id: 'pv-2', workspace_id: W4, scenario_id: 'qs-c', version: 'v0.2', status: 'review_pending_mock', margin_delta: '-0.3% vs target', client_facing: false, future_gate: 'Director Approval', notes: 'Revised to Option C premium.' },
    { id: 'pv-3', workspace_id: W4, scenario_id: 'qs-c', version: 'v1.0', status: 'ready_for_client_mock', margin_delta: 'At target', client_facing: true, future_gate: 'CRM Send', notes: 'Client-facing version.' },
  ]);

  // 9. SLA Drafts
  await upsertBatch('commercial_sla_drafts', [
    { id: 'sla-1', workspace_id: W4, version: 'v0.1', linked_scenario: 'qs-a', status: 'Draft', ops_review: 'Not Reviewed', legal_review: 'Not Reviewed', promise_gap_score: '3 gaps', sections: JSON.stringify([{id:'s1',title:'Service Scope',status:'draft'},{id:'s2',title:'KPIs & Penalties',status:'draft'},{id:'s3',title:'Governance',status:'not_started'}]), kpis: JSON.stringify([{id:'k1',name:'On-Time Delivery',target:'98%',penalty:'0.5% per 1% miss'},{id:'k2',name:'Inventory Accuracy',target:'99.5%',penalty:'SAR 500/incident'}]), promise_gaps: JSON.stringify([{id:'g1',description:'No cold chain SLA',severity:'High'},{id:'g2',description:'Penalty caps not defined',severity:'Medium'},{id:'g3',description:'Force majeure scope unclear',severity:'Low'}]) },
    { id: 'sla-2', workspace_id: W4, version: 'v0.2', linked_scenario: 'qs-c', status: 'Ops Review', ops_review: 'In Progress', legal_review: 'Not Reviewed', promise_gap_score: '1 gap', sections: JSON.stringify([{id:'s1',title:'Service Scope',status:'reviewed'},{id:'s2',title:'KPIs & Penalties',status:'draft'},{id:'s3',title:'Governance',status:'draft'}]), kpis: JSON.stringify([{id:'k1',name:'On-Time Delivery',target:'98%',penalty:'0.5% per 1% miss'},{id:'k2',name:'Inventory Accuracy',target:'99.5%',penalty:'SAR 500/incident'},{id:'k3',name:'Ramp Completion',target:'3 weeks',penalty:'SAR 2000/week delay'}]), promise_gaps: JSON.stringify([{id:'g1',description:'Penalty caps not defined',severity:'Medium'}]) },
  ]);

  console.log('\n  Commercial seed complete.\n');
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  // Verify connectivity
  const { error } = await supabase.from('workspaces').select('id').limit(1);
  if (error) { console.error('Cannot connect:', error.message); process.exit(1); }
  console.log('Connected to Supabase.\n');

  await seedCommercial();

  // Re-verify counts
  console.log('=== VERIFICATION ===\n');
  const tables = ['commercial_quote_scenarios','commercial_pricing_lines','commercial_pnl_snapshots','commercial_customer_scores','commercial_capacity_fits','commercial_revenue_realization','commercial_mock_escalations','commercial_proposal_versions','commercial_sla_drafts'];
  for (const t of tables) {
    const { data } = await supabase.from(t).select('id');
    console.log('  ' + t + ': ' + (data?.length ?? 0) + ' rows');
  }
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
