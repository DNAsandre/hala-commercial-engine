/**
 * SUPA-003C: Seed the missing activity/audit events to reach parity with the in-memory mock.
 * Original mock: 24 activity, 20 audit. Current Supabase: 12 activity, 10 audit.
 * This adds act-13..act-24 and aud-11..aud-20.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const missingActivity = [
  { id:"act-13",workspace_id:"w4",category:"Pricing Posture",actor:"Amin Al-Rashid",severity:"Info",timestamp:"2026-04-29T09:00:00Z",event_type:"pricing_posture_reviewed",title:"Pricing posture reviewed",description:"Posture: Hold Ground. Strategic value insufficient for aggressive entry.",role:"Commercial Director",related_artifact:"Option A",related_module:"Pricing Posture",related_scenario_id:"qs-a",mock:true },
  { id:"act-14",workspace_id:"w4",category:"Revenue Timing",actor:"Amin Al-Rashid",severity:"Warning",timestamp:"2026-04-29T09:30:00Z",event_type:"revenue_timing_reviewed",title:"Revenue timing reviewed",description:"Revenue realization: This Quarter. DSO 68 days — payment risk.",role:"Commercial Director",related_artifact:"Option A",related_module:"Revenue Realization",related_scenario_id:"qs-a",mock:true },
  { id:"act-15",workspace_id:"w4",category:"Escalation",actor:"System",severity:"High",timestamp:"2026-04-29T10:00:00Z",event_type:"escalation_created",title:"Mock escalation created",description:"Red: Margin below threshold for Option A. Escalation to CEO/CFO.",role:"Mock Engine",related_artifact:"Option A",related_module:"Mock Escalation",related_scenario_id:"qs-a",mock:true },
  { id:"act-16",workspace_id:"w4",category:"Escalation",actor:"Amin Al-Rashid",severity:"Info",timestamp:"2026-04-29T10:15:00Z",event_type:"testing_bypass",title:"Testing bypass used",description:"Mock escalation reviewed. Continue for testing — no enforcement applied.",role:"Commercial Director",related_artifact:"Option A",related_module:"Mock Escalation",related_scenario_id:"qs-a",mock:true },
  { id:"act-17",workspace_id:"w4",category:"Proposal",actor:"Amin Al-Rashid",severity:"Info",timestamp:"2026-04-30T08:00:00Z",event_type:"proposal_created",title:"Proposal v0.1 created",description:"Internal draft proposal created linked to Option A — Standard Tariff.",role:"Commercial Director",related_artifact:"Proposal v0.1",related_module:"Proposal Control",related_scenario_id:"qs-a",mock:true },
  { id:"act-18",workspace_id:"w4",category:"Quote",actor:"Amin Al-Rashid",severity:"Info",timestamp:"2026-04-30T09:00:00Z",event_type:"option_c_reviewed",title:"Option C — Premium reviewed",description:"Premium fast implementation scenario reviewed. GP 21.7%.",role:"Commercial Director",related_artifact:"Option C",related_module:"Quote Control",related_scenario_id:"qs-c",mock:true },
  { id:"act-19",workspace_id:"w4",category:"Negotiation",actor:"Amin Al-Rashid",severity:"Critical",timestamp:"2026-05-01T08:00:00Z",event_type:"proposal_negotiation",title:"Negotiation round 2 logged",description:"Client asked for discount on storage rate. GP drops to 5.6%.",role:"Commercial Director",related_artifact:"Proposal v0.3",related_module:"Proposal Control",related_scenario_id:"qs-b",mock:true },
  { id:"act-20",workspace_id:"w4",category:"SLA",actor:"System",severity:"High",timestamp:"2026-05-02T08:00:00Z",event_type:"sla_pricing_lock",title:"SLA pricing lock warning",description:"SLA v0.1 pricing not locked. Future gate: must lock before client-facing SLA.",role:"Mock Engine",related_artifact:"SLA v0.1",related_module:"SLA Control",related_scenario_id:"qs-a",mock:true },
  { id:"act-21",workspace_id:"w4",category:"SLA",actor:"Amin Al-Rashid",severity:"Critical",timestamp:"2026-05-02T09:00:00Z",event_type:"sla_critical_reviewed",title:"SLA v0.3 critical risk reviewed",description:"Critical SLA risk for aggressive pricing. Executive review would be required.",role:"Commercial Director",related_artifact:"SLA v0.3",related_module:"SLA Control",related_scenario_id:"qs-b",mock:true },
  { id:"act-22",workspace_id:"w4",category:"SLA",actor:"System",severity:"High",timestamp:"2026-05-02T09:15:00Z",event_type:"sla_promise_gap",title:"SLA promise gap flagged",description:"Inbound receiving SLA < 4h vs operational reality 6-8h for special handling.",role:"Mock Engine",related_artifact:"SLA v0.1",related_module:"SLA Control",related_scenario_id:"qs-a",mock:true },
  { id:"act-23",workspace_id:"w4",category:"CRM Mock",actor:"Amin Al-Rashid",severity:"Info",timestamp:"2026-05-02T10:00:00Z",event_type:"crm_status_viewed",title:"CRM status viewed",description:"CRM Sync: Mock / Not Connected. No real CRM integration active.",role:"Commercial Director",related_artifact:"",related_module:"CRM",related_scenario_id:"",mock:true },
  { id:"act-24",workspace_id:"w4",category:"Proposal",actor:"Amin Al-Rashid",severity:"Critical",timestamp:"2026-05-02T11:00:00Z",event_type:"proposal_v03_reviewed",title:"Proposal v0.3 negotiation response reviewed",description:"Negotiation response for aggressive pricing reviewed. Executive review needed.",role:"Commercial Director",related_artifact:"Proposal v0.3",related_module:"Proposal Control",related_scenario_id:"qs-b",mock:true },
];

const missingAudit = [
  { id:"aud-11",workspace_id:"w4",event_code:"PRICING_POSTURE_REVIEWED",category:"PRICING_POSTURE",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-29T09:00:00Z",entity_type:"Pricing Posture",event_name:"Pricing Posture Reviewed",description:"Posture: Hold Ground for Option A.",entity_name:"Option A",before_state:"—",after_state:"Hold Ground",mock:true,severity:"Info",trace_id:"tr-011" },
  { id:"aud-12",workspace_id:"w4",event_code:"REVENUE_TIMING_REVIEWED",category:"REVENUE_TIMING",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-29T09:30:00Z",entity_type:"Revenue Timing",event_name:"Revenue Timing Reviewed",description:"Revenue realization: This Quarter. DSO 68 days.",entity_name:"Option A",before_state:"—",after_state:"This Quarter",mock:true,severity:"Warning",trace_id:"tr-012" },
  { id:"aud-13",workspace_id:"w4",event_code:"MOCK_ESCALATION_CREATED",category:"ESCALATION",actor:"System",role:"Mock Engine",timestamp:"2026-04-29T10:00:00Z",entity_type:"Mock Escalation",event_name:"Mock Escalation Created",description:"Red: Margin below threshold. Escalation to CEO/CFO.",entity_name:"Option A Margin",before_state:"No Escalation",after_state:"Red — CEO/CFO",mock:true,severity:"High",trace_id:"tr-013" },
  { id:"aud-14",workspace_id:"w4",event_code:"TESTING_BYPASS_USED",category:"ESCALATION",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-29T10:15:00Z",entity_type:"Mock Escalation",event_name:"Testing Bypass Used",description:"Mock escalation reviewed. Continue for testing.",entity_name:"Option A Bypass",before_state:"Red",after_state:"Bypass — Testing",mock:true,severity:"Info",trace_id:"tr-014" },
  { id:"aud-15",workspace_id:"w4",event_code:"PROPOSAL_VERSION_SELECTED",category:"PROPOSAL",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-30T08:00:00Z",entity_type:"Proposal",event_name:"Proposal Version Created",description:"Proposal v0.1 internal draft created. Linked to Option A.",entity_name:"Proposal v0.1",before_state:"None",after_state:"Drafting",mock:true,severity:"Info",trace_id:"tr-015" },
  { id:"aud-16",workspace_id:"w4",event_code:"NEGOTIATION_ROUND_LOGGED",category:"NEGOTIATION",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-05-01T08:00:00Z",entity_type:"Negotiation",event_name:"Negotiation Round Logged",description:"Round 2: Client discount request. GP 8.5% → 5.6%.",entity_name:"Round 2",before_state:"8.5% GP",after_state:"5.6% GP",mock:true,severity:"Critical",trace_id:"tr-016" },
  { id:"aud-17",workspace_id:"w4",event_code:"SLA_DRAFT_SELECTED",category:"SLA",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-05-02T08:00:00Z",entity_type:"SLA",event_name:"SLA Draft Selected",description:"SLA v0.1 selected for review.",entity_name:"SLA v0.1",before_state:"—",after_state:"Selected",mock:true,severity:"Info",trace_id:"tr-017" },
  { id:"aud-18",workspace_id:"w4",event_code:"SLA_PRICING_LOCK_WARNING_SHOWN",category:"SLA",actor:"System",role:"Mock Engine",timestamp:"2026-05-02T08:05:00Z",entity_type:"SLA",event_name:"SLA Pricing Lock Warning",description:"SLA v0.1 pricing not locked. Future gate shown.",entity_name:"SLA v0.1",before_state:"Not Locked",after_state:"Warning Shown",mock:true,severity:"High",trace_id:"tr-018" },
  { id:"aud-19",workspace_id:"w4",event_code:"SLA_PROMISE_GAP_FLAGGED",category:"SLA",actor:"System",role:"Mock Engine",timestamp:"2026-05-02T09:15:00Z",entity_type:"Promise Gap",event_name:"SLA Promise Gap Flagged",description:"Inbound receiving SLA < 4h vs reality 6-8h.",entity_name:"Inbound Receiving",before_state:"< 4h target",after_state:"6-8h actual",mock:true,severity:"High",trace_id:"tr-019" },
  { id:"aud-20",workspace_id:"w4",event_code:"CRM_SYNC_NOT_CONNECTED",category:"CRM_SYNC",actor:"System",role:"System",timestamp:"2026-05-02T10:00:00Z",entity_type:"CRM",event_name:"CRM Sync Status",description:"CRM Sync: Mock / Not Connected.",entity_name:"CRM Integration",before_state:"—",after_state:"Not Connected",mock:true,severity:"Info",trace_id:"tr-020" },
];

async function main() {
  console.log('SUPA-003C: Adding missing activity/audit events...\n');

  const { error: e1 } = await sb.from('commercial_activity_events').upsert(missingActivity, { onConflict: 'id' });
  console.log(e1 ? `❌ activity: ${e1.message}` : `✅ Upserted ${missingActivity.length} activity events (act-13..act-24)`);

  const { error: e2 } = await sb.from('commercial_audit_events').upsert(missingAudit, { onConflict: 'id' });
  console.log(e2 ? `❌ audit: ${e2.message}` : `✅ Upserted ${missingAudit.length} audit events (aud-11..aud-20)`);

  // Verify
  const { count: actCount } = await sb.from('commercial_activity_events').select('*', { count: 'exact', head: true }).eq('workspace_id', 'w4');
  const { count: audCount } = await sb.from('commercial_audit_events').select('*', { count: 'exact', head: true }).eq('workspace_id', 'w4');
  console.log(`\nFinal counts:`);
  console.log(`  Activity: ${actCount} (expected 24)`);
  console.log(`  Audit:    ${audCount} (expected 20)`);
}

main().catch(console.error);
