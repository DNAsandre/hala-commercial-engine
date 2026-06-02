import { documentsForTenderStage, isTenderDocumentExpired, type TenderWorkspace } from "./tender-workspace-data";
import { normalizeTenderPricingData } from "./tender-pricing-types";

export interface Signal {
  title: string;
  reason: string;
  recommendation: string;
  severity: "info" | "warning" | "high" | "critical";
}

export type Indicator =
  | { type: "progress"; value: number; label: string; color: string }
  | { type: "gauge"; value: number; label: string; unit?: string; color: string }
  | { type: "status"; label: string; state: string; color: string }
  | { type: "numeric"; label: string; value: number; suffix?: string; color: string }
  | { type: "unknown"; label: string };

export interface StageConfig {
  indicators: Indicator[];
  signals: Signal[];
  nextAction: string;
  tabs: string[];
}

export function buildSignals(ws: TenderWorkspace, stageValue: string): Signal[] {
  const signals: Signal[] = [];

  const daysLeft = ws.tender && ws.tender.submissionDeadline
    ? Math.ceil((new Date(ws.tender.submissionDeadline).getTime() - Date.now()) / 86400000)
    : 999;
  if (daysLeft <= 7 && stageValue !== "submitted" && stageValue !== "awarded" && stageValue !== "lost_withdrawn") {
    signals.push({
      title: "Deadline Pressure",
      reason: `Only ${daysLeft > 0 ? daysLeft + " days" : "deadline passed"} remaining`,
      recommendation: "Prioritise submission preparation immediately",
      severity: daysLeft <= 0 ? "critical" : "high",
    });
  }

  // Derive signals from real compliance and document data (not from gates)
  const complianceGaps = ws.complianceItems.filter(c =>
    c.status === "non_compliant" || c.status === "clarification_required"
  ).length;
  const missingDocs = ws.packs.reduce((s, p) => s + (p.documentsTotal - p.documentsReady), 0);

  if (complianceGaps > 0) {
    signals.push({
      title: `${complianceGaps} Compliance Gap${complianceGaps > 1 ? "s" : ""}`,
      reason: "Non-compliant or clarification-required items in compliance matrix",
      recommendation: "Resolve compliance gaps before submission",
      severity: complianceGaps > 3 ? "high" : "warning",
    });
  } else if (missingDocs > 0) {
    signals.push({
      title: `${missingDocs} Document${missingDocs > 1 ? "s" : ""} Incomplete`,
      reason: "Required documents not yet ready",
      recommendation: "Complete outstanding required documents",
      severity: "warning",
    });
  }

  if (ws.tender && ws.tender.targetGpPercent < 20) {
    signals.push({
      title: "Margin Below Threshold",
      reason: `Target GP at ${ws.tender.targetGpPercent}% — below 20% threshold`,
      recommendation: "Review pricing before submission",
      severity: "warning",
    });
  }

  const missingPlaceholders = ws.packs.reduce((s, p) => s + (p.placeholdersTotal - p.placeholdersPopulated), 0);
  if (missingPlaceholders > 0) {
    signals.push({
      title: `${missingPlaceholders} Missing Placeholder${missingPlaceholders > 1 ? "s" : ""}`,
      reason: "Required tender data still missing",
      recommendation: "Populate placeholders before submission",
      severity: "warning",
    });
  }

  return signals.slice(0, 3);
}

export function buildStageConfig(ws: TenderWorkspace, stageValue: string): StageConfig {
  const daysLeft = ws.tender && ws.tender.submissionDeadline
    ? Math.ceil((new Date(ws.tender.submissionDeadline).getTime() - Date.now()) / 86400000)
    : 999;
  const targetGp = ws.tender?.targetGpPercent ?? 0;
  const readiness = ws.readinessScore;
  const missingPlaceholders = ws.packs.reduce((s, p) => s + (p.placeholdersTotal - p.placeholdersPopulated), 0);
  const docsReady = ws.packs.reduce((s, p) => s + p.documentsReady, 0);
  const docsTotal = ws.packs.reduce((s, p) => s + p.documentsTotal, 0);
  const complianceCompliant = ws.packs.reduce((s, p) => s + p.complianceCompliant, 0);
  const complianceTotal = ws.packs.reduce((s, p) => s + p.complianceTotal, 0);
  const compliancePct = complianceTotal > 0 ? Math.round((complianceCompliant / complianceTotal) * 100) : 0;
  const docsPct = docsTotal > 0 ? Math.round((docsReady / docsTotal) * 100) : 0;
  const placeholderPct = ws.packs.reduce((s, p) => {
    const t = p.placeholdersTotal; const r = p.placeholdersPopulated;
    return s + (t > 0 ? Math.round((r / t) * 100) : 0);
  }, 0) / (ws.packs.length || 1);
  // Real compliance/doc signals — no gate data used
  const criticalGates = ws.complianceItems.filter(c => c.status === "non_compliant").length;
  const warnGates = ws.complianceItems.filter(c => c.status === "partial" || c.status === "clarification_required").length;
  const docsPctColor = docsPct >= 80 ? "text-emerald-700" : docsPct >= 50 ? "text-amber-700" : "text-red-700";
  const compPctColor = compliancePct >= 80 ? "text-emerald-700" : compliancePct >= 50 ? "text-amber-700" : "text-red-700";
  const gpColor = targetGp >= 25 ? "text-emerald-700" : targetGp >= 18 ? "text-amber-700" : "text-red-700";
  const readinessColor = readiness >= 80 ? "text-emerald-700" : readiness >= 50 ? "text-amber-700" : "text-red-700";
  const deadlineColor = daysLeft > 14 ? "text-emerald-700" : daysLeft > 0 ? "text-amber-700" : "text-red-700";
  const placeholderPctColor = placeholderPct >= 70 ? "text-emerald-700" : placeholderPct >= 40 ? "text-amber-700" : "text-red-700";

  switch (stageValue) {
    case "identified": {
      return {
        indicators: [
          { type: "progress", value: readiness, label: "Tender Capture", color: readinessColor },
          { type: "gauge", value: daysLeft, label: "Deadline", unit: "d", color: deadlineColor },
          { type: "gauge", value: ws.tender?.estimatedValue ? Math.min(Math.round(ws.tender.estimatedValue / 1000000), 100) : 0, label: "Est. Value", unit: "M SAR", color: "text-foreground" },
          { type: "status", label: "Source Quality", state: ws.tender?.source ?? "Unknown", color: "text-slate-600 bg-slate-50 border-slate-200" },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Complete tender identification.",
        tabs: ["Tender Summary", "Customer Snapshot", "Activity"],
      };
    }

    case "qualification": {
      return {
        indicators: [
          { type: "progress", value: readiness, label: "Qualification", color: readinessColor },
          { type: "gauge", value: compliancePct, label: "Technical Fit", color: compPctColor },
          { type: "gauge", value: docsPct, label: "Customer Fit", color: docsPctColor },
          { type: "progress", value: docsPct, label: "Requirement Cover", color: docsPctColor },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Confirm bid suitability.",
        tabs: ["SOW Qualification", "Technical Qualification", "Customer Fit", "Risk Snapshot"],
      };
    }

    case "bid_no_bid": {
      return {
        indicators: [
          { type: "progress", value: readiness, label: "Bid Decision", color: readinessColor },
          { type: "gauge", value: compliancePct, label: "Strategic Fit", color: compPctColor },
          { type: "numeric", label: "Resource Burden", value: criticalGates + warnGates, suffix: "", color: criticalGates > 0 ? "text-red-700" : warnGates > 0 ? "text-amber-700" : "text-emerald-700" },
          { type: "gauge", value: ws.tender?.probabilityPercent ?? 0, label: "Win Probability", unit: "%", color: (ws.tender?.probabilityPercent ?? 0) >= 50 ? "text-emerald-700" : "text-amber-700" },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Record bid / no-bid decision.",
        tabs: ["Bid Decision", "Win Strategy", "Resource Commitment", "Decision Record"],
      };
    }

    case "solution_design": {
      return {
        indicators: [
          { type: "progress", value: readiness, label: "Solution", color: readinessColor },
          { type: "gauge", value: compliancePct, label: "Feasibility", color: compPctColor },
          { type: "progress", value: docsPct, label: "Scope Clarity", color: docsPctColor },
          { type: "numeric", label: "Complexity Risk", value: criticalGates, suffix: "", color: criticalGates > 0 ? "text-red-700" : "text-emerald-700" },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Complete solution design.",
        tabs: ["Solution Configuration", "HOP Operations Model", "HAM Manpower Model", "HIP Systems & IP Model", "Scope Matrix", "SLA / KPI Model", "Assumptions & Dependencies"],
      };
    }

    case "pnl_pricing": {
      const pricing = normalizeTenderPricingData(ws.tender?.pricingData);
      const pricingDocs = documentsForTenderStage(ws.documents ?? [], "pnl_pricing");
      const pricingDocIssues = pricingDocs.filter(doc => doc.status === "Missing" || doc.status === "Expired" || doc.status === "Needs Update" || isTenderDocumentExpired(doc)).length;
      const scenarioCount = pricing.scenarios.rows.length;
      const approvalStatus = pricing.approval.summary.approval_status || "Not Captured";
      const snapshotStatus = pricing.pnl_snapshot.snapshot_status || "No Snapshot";
      return {
        indicators: [
          { type: "status", label: "P&L Snapshot", state: snapshotStatus, color: snapshotStatus === "No Snapshot" ? "text-slate-500 bg-slate-50 border-slate-200" : "text-indigo-700 bg-indigo-50 border-indigo-200" },
          { type: "numeric", label: "Pricing Scenarios", value: scenarioCount, suffix: "", color: scenarioCount > 0 ? "text-emerald-700" : "text-slate-500" },
          { type: "status", label: "Approval Status", state: approvalStatus, color: approvalStatus === "Not Submitted" || approvalStatus === "Not Captured" ? "text-slate-500 bg-slate-50 border-slate-200" : approvalStatus.includes("Approved") ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200" },
          { type: "numeric", label: "Pricing Doc Issues", value: pricingDocIssues, suffix: "", color: pricingDocIssues > 0 ? "text-amber-700" : "text-emerald-700" },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Select working pricing scenario.",
        tabs: ["P&L Calculator", "Pricing Scenarios", "Commercial Terms", "Pricing Approval"],
      };
    }

    case "tender_drafting": {
      const drafting = (ws.tender as any).tenderDraftingData ?? {};
      const blocks = Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [];
      const approvedBlocks = blocks.filter((b: any) => b.approval_status === "Approved").length;
      const blockPct = blocks.length > 0 ? Math.round((approvedBlocks / blocks.length) * 100) : 0;
      const blockColor = blockPct >= 80 ? "text-emerald-700" : blockPct >= 50 ? "text-amber-700" : "text-red-700";
      const tocStatus = drafting.proposal_architecture?.status || "Not Started";
      return {
        indicators: [
          { type: "status", label: "TOC", state: tocStatus, color: tocStatus !== "Not Started" ? "text-blue-600 bg-blue-50 border-blue-200" : "text-slate-500 bg-slate-50 border-slate-200" },
          { type: "progress", value: blockPct, label: "Blocks Approved", color: blockColor },
          { type: "status", label: "Blocks", state: blocks.length > 0 ? `${approvedBlocks}/${blocks.length}` : "None", color: blocks.length > 0 ? "text-blue-600 bg-blue-50 border-blue-200" : "text-slate-500 bg-slate-50 border-slate-200" },
          { type: "status", label: "Handoff", state: drafting.pdf_studio_handoff?.proposal_instance_status || "Not Created", color: "text-slate-500 bg-slate-50 border-slate-200" },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Define proposal architecture in TOC, then create blocks.",
        tabs: ["Proposal Architecture / TOC", "Proposal Block Workbench", "Technical Volume", "Commercial Volume", "Compliance Coverage", "Appendices & Evidence", "PDF Studio Handoff"],
      };
    }

    case "internal_review": {
      const sectionCount = ws.packs.reduce((s, p) => s + p.sectionsTotal, 0);
      const draftedSections = ws.packs.reduce((s, p) => s + p.sectionsDrafted, 0);
      const reviewPct = sectionCount > 0 ? Math.round((draftedSections / sectionCount) * 100) : 0;
      const reviewColor = reviewPct >= 80 ? "text-emerald-700" : reviewPct >= 50 ? "text-amber-700" : "text-red-700";
      return {
        indicators: [
          { type: "progress", value: reviewPct, label: "Review Completion", color: reviewColor },
          { type: "status", label: "Ops Review", state: reviewPct > 0 ? "In Review" : "Not Started", color: reviewPct > 0 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-slate-500 bg-slate-50 border-slate-200" },
          { type: "status", label: "Finance Review", state: reviewPct >= 80 ? "Complete" : "Pending", color: reviewPct >= 80 ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-slate-50 border-slate-200" },
          { type: "status", label: "Legal Review", state: "Not Started", color: "text-slate-500 bg-slate-50 border-slate-200" },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Resolve review signals.",
        tabs: ["Review Dashboard", "Operations Review", "Finance Review", "Legal Review", "Exceptions"],
      };
    }

    case "approval_matrix": {
      const approvalsComplete = ws.packs.reduce((s, p) => s + p.approvalsComplete, 0);
      const approvalsTotal = ws.packs.reduce((s, p) => s + p.approvalsTotal, 1);
      const approvalPct = approvalsTotal > 0 ? Math.round((approvalsComplete / approvalsTotal) * 100) : 0;
      const approvalColor = approvalPct >= 80 ? "text-emerald-700" : approvalPct >= 50 ? "text-amber-700" : "text-red-700";
      return {
        indicators: [
          { type: "progress", value: approvalPct, label: "Approval Readiness", color: approvalColor },
          { type: "gauge", value: targetGp, label: "GP Threshold Signal", unit: "%", color: gpColor },
          { type: "unknown", label: "Pallet Volume Signal" },
          { type: "progress", value: approvalPct, label: "Advisory Signoff", color: approvalColor },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Review approval signals.",
        tabs: ["Approval Matrix", "Signoff Tracker", "Exception Notes", "Governance Log"],
      };
    }

    case "final_approved": {
      return {
        indicators: [
          { type: "status", label: "Final Approval", state: "Approved", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
          { type: "progress", value: readiness, label: "Submission Ready", color: readinessColor },
          { type: "numeric", label: "Open Signals", value: criticalGates + warnGates, suffix: "", color: criticalGates > 0 ? "text-red-700" : warnGates > 0 ? "text-amber-700" : "text-emerald-700" },
          { type: "status", label: "Version Integrity", state: "Verified", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Prepare submission.",
        tabs: ["Submission Readiness", "Final Pack", "Submission Checklist", "Approval Record"],
      };
    }

    case "submitted": {
      return {
        indicators: [
          { type: "status", label: "Submission Status", state: "Submitted", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
          { type: "status", label: "Receipt", state: "Confirmed", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
          { type: "status", label: "CRM Sync", state: ws.tender?.crmSynced ? "Synced" : "Pending", color: ws.tender?.crmSynced ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-amber-600 bg-amber-50 border-amber-200" },
          { type: "gauge", value: daysLeft, label: "Response Timer", unit: "d", color: deadlineColor },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Monitor tender response.",
        tabs: ["Submission Log", "Submitted Version", "CRM Sync", "Audit Trail"],
      };
    }

    case "clarification": {
      const clarifications = ws.activityEvents.filter(e => e.eventType === "clarification").length;
      return {
        indicators: [
          { type: "progress", value: docsPct, label: "Response Complete", color: docsPctColor },
          { type: "numeric", label: "Open Clarif.", value: clarifications, suffix: "", color: clarifications > 0 ? "text-amber-700" : "text-emerald-700" },
          { type: "gauge", value: daysLeft, label: "Deadline", unit: "d", color: deadlineColor },
          { type: "numeric", label: "Change Impact", value: criticalGates, suffix: "", color: criticalGates > 0 ? "text-red-700" : "text-emerald-700" },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Submit clarification responses.",
        tabs: ["Clarification Log", "Response Drafts", "Impact Analysis"],
      };
    }

    case "technical_review": {
      const missingEvidence = ws.packs.reduce((s, p) => s + (p.complianceTotal - p.complianceCompliant), 0);
      return {
        indicators: [
          { type: "gauge", value: compliancePct, label: "Tech Strength", color: compPctColor },
          { type: "progress", value: compliancePct, label: "Compliance Align", color: compPctColor },
          { type: "numeric", label: "Technical Risk", value: criticalGates, suffix: "", color: criticalGates > 0 ? "text-red-700" : "text-emerald-700" },
          { type: "numeric", label: "Missing Evidence", value: missingEvidence, suffix: "", color: "text-amber-700" },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Strengthen technical response.",
        tabs: ["Technical Review", "Technical Evidence", "Compliance Alignment", "Response History"],
      };
    }

    case "commercial_review": {
      return {
        indicators: [
          { type: "gauge", value: targetGp, label: "Commercial Strength", unit: "%", color: gpColor },
          { type: "gauge", value: targetGp, label: "Margin Protection", unit: "%", color: gpColor },
          { type: "unknown", label: "BAFO Readiness" },
          { type: "numeric", label: "Pricing Risk", value: criticalGates + warnGates, suffix: "", color: criticalGates > 0 ? "text-red-700" : warnGates > 0 ? "text-amber-700" : "text-emerald-700" },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Prepare commercial response.",
        tabs: ["Commercial Review", "BAFO", "Pricing Revisions", "Margin Impact"],
      };
    }

    case "negotiation": {
      return {
        indicators: [
          { type: "gauge", value: targetGp, label: "Negotiation Risk", unit: "%", color: gpColor },
          { type: "gauge", value: targetGp, label: "Margin Drift", unit: "%", color: gpColor },
          { type: "gauge", value: compliancePct, label: "Scope Drift", unit: "%", color: compPctColor },
          { type: "progress", value: docsPct, label: "Revisions", color: docsPctColor },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Resolve negotiation changes.",
        tabs: ["Negotiation Log", "Requested Changes", "Margin Impact", "Revised Versions"],
      };
    }

    case "awarded": {
      const awardPct = docsPct; // Use doc completion as contract readiness proxy
      const handoverPct = compliancePct;
      return {
        indicators: [
          { type: "status", label: "Award Status", state: "Awarded", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
          { type: "progress", value: awardPct, label: "Contract Ready", color: awardPct >= 70 ? "text-emerald-700" : awardPct >= 40 ? "text-amber-700" : "text-red-700" },
          { type: "progress", value: awardPct, label: "SLA Ready", color: awardPct >= 70 ? "text-emerald-700" : awardPct >= 40 ? "text-amber-700" : "text-red-700" },
          { type: "gauge", value: handoverPct, label: "Handover Ready", color: handoverPct >= 70 ? "text-emerald-700" : "text-amber-700" },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Prepare contract and handover.",
        tabs: ["Award Notice", "Contract Prep", "SLA Prep", "Handover Prep"],
      };
    }

    case "lost_withdrawn": {
      const hasLossReason = ws.activityEvents.some(e => e.eventType === "stage_change" && (e.description ?? "").toLowerCase().includes("lost"));
      return {
        indicators: [
          { type: "status", label: "Loss Reason", state: hasLossReason ? "Captured" : "Missing", color: hasLossReason ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-amber-600 bg-amber-50 border-amber-200" },
          { type: "progress", value: docsPct, label: "Learning", color: docsPctColor },
          { type: "status", label: "Competitor", state: "Not Available", color: "text-slate-500 bg-slate-50 border-slate-200" },
          { type: "gauge", value: ws.tender?.probabilityPercent ?? 0, label: "Rebid Potential", unit: "%", color: (ws.tender?.probabilityPercent ?? 0) >= 40 ? "text-emerald-700" : "text-amber-700" },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Capture tender intelligence.",
        tabs: ["Loss Reason", "Lessons Learned", "Competitor Intelligence", "Rebid Potential"],
      };
    }

    default: {
      return {
        indicators: [
          { type: "progress", value: readiness, label: "Readiness", color: readinessColor },
          { type: "gauge", value: daysLeft, label: "Deadline", unit: "d", color: deadlineColor },
          { type: "gauge", value: targetGp, label: "GP%", unit: "%", color: gpColor },
          { type: "numeric", label: "Signals", value: criticalGates + warnGates, suffix: "", color: "text-foreground" },
        ],
        signals: buildSignals(ws, stageValue),
        nextAction: "Advance tender workflow.",
        tabs: ["Overview", "Activity"],
      };
    }
  }
}
