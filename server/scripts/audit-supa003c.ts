/**
 * SUPA-003C: Data Consistency Audit
 * Checks counts, duplicates, and link integrity for workspace w4.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function query(table: string, filter?: { col: string; val: string }) {
  let q = sb.from(table).select('*');
  if (filter) q = q.eq(filter.col, filter.val);
  const { data, error } = await q;
  if (error) { console.error(`  ❌ ${table}: ${error.message}`); return []; }
  return data ?? [];
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('SUPA-003C: Data Consistency Audit — w4');
  console.log('═══════════════════════════════════════════\n');

  // ── 1. Quote Scenarios ──
  const scenarios = await query('commercial_quote_scenarios', { col: 'workspace_id', val: 'w4' });
  console.log(`1. QUOTE SCENARIOS: ${scenarios.length} rows`);
  scenarios.forEach((s: any) => console.log(`   ${s.id} | ${s.name} | ${s.version} | GP ${s.gp_percent}%`));
  const scenarioIds = scenarios.map((s: any) => s.id);

  // ── 2. Pricing Lines ──
  const { data: pLines } = await sb.from('commercial_pricing_lines').select('*').in('scenario_id', scenarioIds);
  console.log(`\n2. PRICING LINES: ${pLines?.length ?? 0} rows`);
  const plByScenario: Record<string, number> = {};
  (pLines ?? []).forEach((p: any) => { plByScenario[p.scenario_id] = (plByScenario[p.scenario_id] ?? 0) + 1; });
  Object.entries(plByScenario).forEach(([k, v]) => console.log(`   ${k}: ${v} lines`));

  // ── 3. P&L Snapshots ──
  const { data: pnls } = await sb.from('commercial_pnl_snapshots').select('*').in('scenario_id', scenarioIds);
  console.log(`\n3. P&L SNAPSHOTS: ${pnls?.length ?? 0} rows`);
  (pnls ?? []).forEach((p: any) => console.log(`   ${p.scenario_id} | Rev ${p.revenue} | GP ${p.gp_percent}%`));

  // ── 4. Customer Scores ──
  const cScores = await query('commercial_customer_scores', { col: 'workspace_id', val: 'w4' });
  console.log(`\n4. CUSTOMER SCORES: ${cScores.length} rows`);

  // ── 5. Capacity Fits ──
  const { data: cFits } = await sb.from('commercial_capacity_fits').select('*').in('scenario_id', scenarioIds);
  console.log(`\n5. CAPACITY FITS: ${cFits?.length ?? 0} rows`);

  // ── 6. Revenue Realization ──
  const { data: revReal } = await sb.from('commercial_revenue_realization').select('*').in('scenario_id', scenarioIds);
  console.log(`\n6. REVENUE REALIZATION: ${revReal?.length ?? 0} rows`);

  // ── 7. Mock Escalations ──
  const { data: escs } = await sb.from('commercial_mock_escalations').select('*').in('scenario_id', scenarioIds);
  console.log(`\n7. MOCK ESCALATIONS: ${escs?.length ?? 0} rows`);

  // ── 8. Proposal Versions ──
  const proposals = await query('commercial_proposal_versions', { col: 'workspace_id', val: 'w4' });
  console.log(`\n8. PROPOSAL VERSIONS: ${proposals.length} rows`);
  proposals.forEach((p: any) => console.log(`   ${p.id} | ${p.proposal_name || p.notes?.substring(0,40)} | ${p.version} | scenario: ${p.scenario_id} | status: ${p.status}`));
  // Check duplicates by ID
  const propIds = proposals.map((p: any) => p.id);
  const propDupes = propIds.filter((id: string, i: number) => propIds.indexOf(id) !== i);
  if (propDupes.length) console.log(`   ⚠️ DUPLICATE IDs: ${propDupes.join(', ')}`);
  else console.log(`   ✅ No duplicate IDs`);

  // ── 9. Negotiation Rounds ──
  const negotiations = await query('commercial_negotiation_rounds', { col: 'workspace_id', val: 'w4' });
  console.log(`\n9. NEGOTIATION ROUNDS: ${negotiations.length} rows`);
  negotiations.forEach((n: any) => console.log(`   ${n.id} | Round ${n.round_number} | proposal: ${n.proposal_version_id} | status: ${n.status}`));
  // Check foreign key: each negotiation.proposal_version_id must exist in proposals
  const brokenNegLinks = negotiations.filter((n: any) => !propIds.includes(n.proposal_version_id));
  if (brokenNegLinks.length) console.log(`   ⚠️ BROKEN LINKS: ${brokenNegLinks.map((n: any) => `${n.id} → ${n.proposal_version_id}`).join(', ')}`);
  else console.log(`   ✅ All negotiation→proposal links valid`);

  // ── 10. SLA Drafts ──
  const slaDrafts = await query('commercial_sla_drafts', { col: 'workspace_id', val: 'w4' });
  console.log(`\n10. SLA DRAFTS: ${slaDrafts.length} rows`);
  slaDrafts.forEach((s: any) => console.log(`   ${s.id} | ${s.sla_name || '(no name)'} | ${s.version} | linked_proposal: ${s.linked_proposal_id || s.linked_scenario} | gaps: ${s.promise_gap_count}`));
  const slaDupes = slaDrafts.map((s: any) => s.id).filter((id: string, i: number, arr: string[]) => arr.indexOf(id) !== i);
  if (slaDupes.length) console.log(`   ⚠️ DUPLICATE IDs: ${slaDupes.join(', ')}`);
  else console.log(`   ✅ No duplicate IDs`);
  // Check SLA→proposal links
  const brokenSlaLinks = slaDrafts.filter((s: any) => s.linked_proposal_id && !propIds.includes(s.linked_proposal_id));
  if (brokenSlaLinks.length) console.log(`   ⚠️ BROKEN SLA→PROPOSAL: ${brokenSlaLinks.map((s: any) => `${s.id} → ${s.linked_proposal_id}`).join(', ')}`);
  else console.log(`   ✅ All SLA→proposal links valid`);

  // ── 11. Activity Events ──
  const activities = await query('commercial_activity_events', { col: 'workspace_id', val: 'w4' });
  console.log(`\n11. ACTIVITY EVENTS: ${activities.length} rows`);
  const actDupes = activities.map((a: any) => a.id).filter((id: string, i: number, arr: string[]) => arr.indexOf(id) !== i);
  if (actDupes.length) console.log(`   ⚠️ DUPLICATE IDs: ${actDupes.join(', ')}`);
  else console.log(`   ✅ No duplicate IDs`);

  // ── 12. Audit Events ──
  const audits = await query('commercial_audit_events', { col: 'workspace_id', val: 'w4' });
  console.log(`\n12. AUDIT EVENTS: ${audits.length} rows`);
  const audDupes = audits.map((a: any) => a.id).filter((id: string, i: number, arr: string[]) => arr.indexOf(id) !== i);
  if (audDupes.length) console.log(`   ⚠️ DUPLICATE IDs: ${audDupes.join(', ')}`);
  else console.log(`   ✅ No duplicate IDs`);

  // ── 13. SUMMARY ──
  console.log('\n═══════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`Scenarios:     ${scenarios.length} (expected 3)`);
  console.log(`Pricing Lines: ${pLines?.length ?? 0}`);
  console.log(`P&L Snapshots: ${pnls?.length ?? 0}`);
  console.log(`Customer Score:${cScores.length}`);
  console.log(`Capacity Fits: ${cFits?.length ?? 0}`);
  console.log(`Rev Realiz:    ${revReal?.length ?? 0}`);
  console.log(`Escalations:   ${escs?.length ?? 0}`);
  console.log(`Proposals:     ${proposals.length} (expected 3)`);
  console.log(`Negotiations:  ${negotiations.length} (expected 3)`);
  console.log(`SLA Drafts:    ${slaDrafts.length} (expected 3)`);
  console.log(`Activities:    ${activities.length} (expected 12 seeded)`);
  console.log(`Audit Events:  ${audits.length} (expected 10 seeded)`);
}

main().catch(console.error);
