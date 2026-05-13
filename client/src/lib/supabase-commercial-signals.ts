import { supabase } from '@/lib/supabase';
import type { 
  CommercialExecutionSignal, 
  CommercialWorkspaceSignalSummary,
  CommercialRiskLevel
} from '@/lib/commercial-workspace-data';

export async function fetchCommercialSignalSummariesFromSupabase(): Promise<{
  summaries: Record<string, CommercialWorkspaceSignalSummary>;
  signals: CommercialExecutionSignal[];
}> {
  // Fetch required data from Supabase across all workspaces
  const [
    { data: workspaces },
    { data: scenarios },
    { data: customerScores },
    { data: capacityFits },
    { data: proposals },
    { data: slaDrafts },
    { data: escalations },
    { data: revenueRealizations }
  ] = await Promise.all([
    supabase.from('workspaces').select('id, name, customer_name, type, status').eq('type', 'Commercial'),
    supabase.from('commercial_quote_scenarios').select('*').order('created_at'),
    supabase.from('commercial_customer_scores').select('*'),
    supabase.from('commercial_capacity_fits').select('*'),
    supabase.from('commercial_proposal_versions').select('*'),
    supabase.from('commercial_sla_drafts').select('*'),
    supabase.from('commercial_mock_escalations').select('*'),
    supabase.from('commercial_revenue_realization').select('*')
  ]);

  if (!workspaces || workspaces.length === 0) return { summaries: {}, signals: [] };

  const summaries: Record<string, CommercialWorkspaceSignalSummary> = {};
  const signals: CommercialExecutionSignal[] = [];

  for (const ws of workspaces) {
    const wsScenarios = (scenarios || []).filter(s => s.workspace_id === ws.id);
    if (wsScenarios.length === 0) continue; // Skip workspaces without commercial scenarios

    // Default to the first scenario (or Option A) as primary
    const primaryScenario = wsScenarios[0];
    const gpPercent = primaryScenario.gp_percent ?? 0;
    const value = primaryScenario.revenue ?? 0;
    
    const wsEscalations = (escalations || []).filter(e => e.workspace_id === ws.id);
    const totalEscalations = wsEscalations.length;
    const criticalEscalations = wsEscalations.filter(e => e.severity === 'Critical').length;
    
    let marginRisk: CommercialRiskLevel = 'Low';
    if (gpPercent < 10) marginRisk = 'Critical';
    else if (gpPercent < 15) marginRisk = 'High';
    else if (gpPercent < 22) marginRisk = 'Medium';
    
    let riskLevel: CommercialRiskLevel = 'Low';
    if (marginRisk === 'Critical' || criticalEscalations > 0) riskLevel = 'Critical';
    else if (marginRisk === 'High' || totalEscalations > 3) riskLevel = 'High';
    else if (marginRisk === 'Medium') riskLevel = 'Medium';
    
    const wsCustomerScore = (customerScores || []).find(c => c.workspace_id === ws.id);
    const customerRisk = wsCustomerScore?.overall_grade ?? 'N/A';
    
    const wsCapacityFit = (capacityFits || []).find(c => c.scenario_id === primaryScenario.id);
    const capacityRisk = wsCapacityFit?.capacity_fit_status ?? 'Unknown';

    const wsRevenue = (revenueRealizations || []).find(r => r.scenario_id === primaryScenario.id);
    const revenueTiming = wsRevenue?.budget_impact_timing ?? 'Unknown';
    
    const wsProposals = (proposals || []).filter(p => p.workspace_id === ws.id);
    const proposalReviewNeeded = wsProposals.some(
      p => p.review_status === "Needs Commercial Review" || 
           p.review_status === "Needs Finance Review" || 
           p.review_status === "Needs Ops Review" || 
           p.review_status === "Future Approval Required"
    );
    const clientFacingProposalsCount = wsProposals.filter(p => p.client_facing_mock).length;
    const proposalStatus = `${wsProposals.length} versions — ${clientFacingProposalsCount} client-facing`;
    
    const wsSlas = (slaDrafts || []).filter(s => s.workspace_id === ws.id);
    const slaReviewNeeded = wsSlas.some(
      s => (s.ops_review !== "Mock Reviewed" && s.ops_review !== "Not Reviewed") || 
           (s.legal_review !== "Mock Reviewed" && s.legal_review !== "Not Reviewed")
    );
    // Approximate high-risk SLA check (since we might not have full kpi/sections parsing here)
    const highRiskSlasCount = wsSlas.filter(s => (s.kpis || []).length > 5 || (s.promise_gaps || []).length > 0).length;
    const slaStatus = `${wsSlas.length} drafts — ${highRiskSlasCount} high-risk`;
    
    let nextAction = "Review mock escalation and reprice quote";
    if (marginRisk === "Critical") nextAction = "Review mock escalation and reprice quote";
    else if (proposalReviewNeeded) nextAction = "Review proposal before client-facing";
    else if (slaReviewNeeded) nextAction = "Complete Ops/Legal SLA review";
    else nextAction = "Proceed to client presentation";

    summaries[ws.id] = {
      workspaceId: ws.id,
      workspaceName: ws.name,
      customerName: ws.customer_name || 'Unknown Customer',
      stage: ws.status === 'draft' ? 'quoting' : ws.status,
      value,
      gpPercent,
      riskLevel,
      quoteStatus: `${wsScenarios.length} scenarios active`,
      proposalStatus,
      slaStatus,
      marginRisk,
      customerRisk,
      capacityRisk,
      mockEscalationCount: totalEscalations,
      criticalEscalationCount: criticalEscalations,
      proposalReviewNeeded,
      slaReviewNeeded,
      revenueTiming,
      nextAction,
      crmStatus: "Mock / Not Connected",
      developmentMode: true,
    };

    // ─── Generate individual signals ───
    const base = {
      workspaceId: ws.id,
      workspaceName: ws.name,
      customerName: ws.customer_name || 'Unknown Customer',
      stage: ws.status === 'draft' ? 'quoting' : ws.status,
      developmentMode: true as const,
    };

    if (marginRisk === "Critical") {
      signals.push({ ...base, riskColor: "red", riskReason: `GP ${gpPercent}% — critical margin risk`, nextAction: "Reprice quote to improve GP above 10%", signalType: "margin" });
    } else if (marginRisk === "High" || marginRisk === "Medium") {
      signals.push({ ...base, riskColor: "amber", riskReason: `GP ${gpPercent}% — near margin threshold`, nextAction: "Protect price; do not reduce further", signalType: "margin" });
    }

    if (customerRisk === "C" || customerRisk === "C-" || customerRisk === "D") {
      signals.push({ ...base, riskColor: customerRisk === "D" ? "red" : "amber", riskReason: `Customer ECR grade ${customerRisk} — discount not recommended`, nextAction: "Monitor payment behavior; no additional discount", signalType: "customer" });
    }

    if (capacityRisk === "Constrained" || capacityRisk === "High Risk" || capacityRisk === "Critical") {
      signals.push({ ...base, riskColor: capacityRisk === "Constrained" ? "amber" : "red", riskReason: `Capacity ${capacityRisk.toLowerCase()} — promise gaps flagged`, nextAction: "Confirm Ops capacity before proposal", signalType: "capacity" });
    }

    if (totalEscalations > 0) {
      signals.push({ ...base, riskColor: criticalEscalations > 0 ? "red" : "amber", riskReason: `${totalEscalations} mock escalations (${criticalEscalations} critical)`, nextAction: "Review and resolve open escalations", signalType: "escalation" });
    }

    if (proposalReviewNeeded) {
      signals.push({ ...base, riskColor: "amber", riskReason: "Internal proposal review required", nextAction: "Complete proposal review", signalType: "proposal" });
    }

    if (slaReviewNeeded) {
      signals.push({ ...base, riskColor: "amber", riskReason: "Ops/Legal SLA review required", nextAction: "Chase Ops/Legal for SLA review", signalType: "sla" });
    }
  }

  return { summaries, signals };
}
