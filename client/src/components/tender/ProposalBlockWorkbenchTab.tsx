/**
 * ProposalBlockWorkbenchTab — Tab 2 of Tender Drafting
 *
 * Master proposal block register + clean block editor.
 * Blocks are the proposal body. TOC is the spine.
 * Technical/Commercial Volumes are filtered views of this register.
 *
 * No AI. No mock data. No PDF Studio mutation.
 */
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import {
  Plus, Save, Loader2, Trash2, Edit3, Eye, ArrowUp, ArrowDown,
  FileText, CheckCircle2, XCircle, Clock, Sparkles, Layers,
} from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderDraftingData } from "@/lib/supabase-tender-actions";
import TenderProposalEditorBlock, {
  buildInitialEditorContent,
  normalizeEditorStage,
  TENDER_EDITOR_STAGE_CONFIG,
  type TenderProposalEditorStage,
  type AIDraftAction,
} from "./TenderProposalEditorBlock";
import { generateBlockContent, getBlockBots } from "@/lib/ai-runs";
import { normalizeTenderPricingData } from "@/lib/tender-pricing-types";

// ─── Types & Constants ────────────────────────────────────
interface ProposalBlock {
  id: string;
  toc_section_id: string;
  section_number: string;
  title: string;
  block_key: string;
  block_type: string;
  volume: string;
  intended_section: string;
  source_stages: string;
  required_source_data: string;
  required_evidence: string;
  pdf_studio_target: string;
  owner: string;
  notes: string;
  draft_content: string;
  editor_stage: TenderProposalEditorStage;
  editor_content: string;
  is_canon_locked: boolean;
  ai_suggestions?: Record<string, unknown>;
  section_name: string;
  internal_notes: string;
  source_references: string;
  draft_status: string;
  approval_status: string;
  reviewer: string;
  review_notes: string;
  approved_at: string;
  approved_by: string;
  last_updated: string;
  created_at: string;
}

const BLOCK_TYPES = [
  "Executive Summary",
  "Customer Operating Context",
  "Understanding of Requirement",
  "Hala Solution Package",
  "HIP/HOP/HAM Modules",
  "Scope of Work",
  "Operating Model",
  "Data and Reporting Model",
  "Manpower Model",
  "Implementation Plan",
  "Governance Rhythm",
  "Commercial Model",
  "KPIs",
  "Expansion Path",
  "Decision Required",
  "Risk Mitigation",
  "Assumptions & Dependencies",
  "Appendices / Evidence",
  "Custom",
];

const VOLUMES = ["Technical", "Commercial", "Shared", "Appendix"];
const DRAFT_STATUSES = ["Not Ready", "Ready to Draft", "Manual Draft", "Human Edited", "Approved", "Sent to PDF Studio", "Locked"];
const APPROVAL_STATUSES = ["Draft", "Needs Review", "Approved", "Rejected", "Locked"];

function emptyBlock(owner: string): ProposalBlock {
  return {
    id: nanoid(10),
    toc_section_id: "",
    section_number: "",
    title: "",
    block_key: "",
    block_type: "",
    volume: "Technical",
    intended_section: "",
    source_stages: "",
    required_source_data: "",
    required_evidence: "",
    pdf_studio_target: "",
    owner,
    notes: "",
    draft_content: "",
    editor_stage: "structure",
    editor_content: "",
    is_canon_locked: false,
    ai_suggestions: {},
    section_name: "",
    internal_notes: "",
    source_references: "",
    draft_status: "Not Ready",
    approval_status: "Draft",
    reviewer: "",
    review_notes: "",
    approved_at: "",
    approved_by: "",
    last_updated: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

function normalizeProposalBlock(raw: any): ProposalBlock {
  const title = String(raw?.title || "");
  const blockKey = String(raw?.block_key || "");
  const legacyContent = String(raw?.draft_content || "");
  const editorContent = String(raw?.editor_content || legacyContent || (title || blockKey ? buildInitialEditorContent(title, blockKey) : ""));
  const stage = normalizeEditorStage(raw?.editor_stage);

  return {
    ...emptyBlock(String(raw?.owner || "")),
    ...(raw || {}),
    id: String(raw?.id || nanoid(10)),
    toc_section_id: String(raw?.toc_section_id || ""),
    section_number: String(raw?.section_number || ""),
    title,
    block_key: blockKey,
    block_type: String(raw?.block_type || raw?.block_key || ""),
    volume: String(raw?.volume || "Technical"),
    intended_section: String(raw?.intended_section || ""),
    source_stages: String(raw?.source_stages || ""),
    required_source_data: String(raw?.required_source_data || ""),
    required_evidence: String(raw?.required_evidence || ""),
    pdf_studio_target: String(raw?.pdf_studio_target || ""),
    owner: String(raw?.owner || ""),
    notes: String(raw?.notes || ""),
    draft_content: legacyContent || editorContent,
    editor_stage: stage,
    editor_content: editorContent,
    is_canon_locked: raw?.is_canon_locked === true || stage === "canon",
    ai_suggestions: (raw?.ai_suggestions && typeof raw.ai_suggestions === "object") ? raw.ai_suggestions : {},
    section_name: String(raw?.section_name || ""),
    internal_notes: String(raw?.internal_notes || ""),
    source_references: String(raw?.source_references || ""),
    draft_status: String(raw?.draft_status || (editorContent ? "Manual Draft" : "Not Ready")),
    approval_status: String(raw?.approval_status || "Draft"),
    reviewer: String(raw?.reviewer || ""),
    review_notes: String(raw?.review_notes || ""),
    approved_at: String(raw?.approved_at || ""),
    approved_by: String(raw?.approved_by || ""),
    last_updated: String(raw?.last_updated || new Date().toISOString()),
    created_at: String(raw?.created_at || new Date().toISOString()),
  };
}

const statusColor = (s: string) => {
  if (s === "Approved" || s === "Locked") return "border-emerald-300 text-emerald-700 bg-emerald-50";
  if (s === "Human Edited" || s === "Manual Draft") return "border-blue-300 text-blue-700 bg-blue-50";
  if (s === "Needs Review") return "border-amber-300 text-amber-700 bg-amber-50";
  if (s === "Rejected") return "border-red-300 text-red-700 bg-red-50";
  return "border-slate-200 text-slate-600 bg-slate-50";
};

// ─── Source Data Preview ──────────────────────────────────
function SourcePreview({ ws, block }: { ws: TenderWorkspace; block: ProposalBlock }) {
  const t = ws.tender;
  const sd = (t.solutionDesignData ?? {}) as any;
  const bnb = (t.bidNoBidData ?? {}) as any;

  const key = (block.block_key || block.title || "").toLowerCase();
  const items: [string, string][] = [];

  if (key.includes("executive")) {
    items.push(["Customer", t.customerName || "Not captured"]);
    items.push(["Tender", t.title || "Not captured"]);
    items.push(["Win Themes", bnb.win_strategy?.key_themes || "Not captured"]);
    items.push(["Solution Config", sd.configuration?.selected_modules || "Not captured"]);
  } else if (key.includes("scope") || key.includes("hop") || key.includes("ham") || key.includes("hip") || key.includes("module")) {
    items.push(["HOP", sd.hop ? "Captured" : "Not captured"]);
    items.push(["HAM", sd.ham ? "Captured" : "Not captured"]);
    items.push(["HIP", sd.hip ? "Captured" : "Not captured"]);
    items.push(["Scope Matrix", sd.scope_matrix ? "Captured" : "Not captured"]);
  } else if (key.includes("commercial") || key.includes("pricing") || key.includes("terms")) {
    const pricing = t.pricingData as any;
    items.push(["P&L Snapshot", pricing?.pnl_snapshot?.snapshot_status || "Not captured"]);
    items.push(["Pricing Approval", pricing?.approval?.summary?.approval_status || "Not captured"]);
    items.push(["Commercial Terms", pricing?.commercial_terms ? "Captured" : "Not captured"]);
  } else if (key.includes("sla") || key.includes("kpi")) {
    items.push(["SLA/KPI", sd.sla_kpi ? "Captured" : "Not captured"]);
  } else if (key.includes("assumption") || key.includes("dependenc")) {
    items.push(["Assumptions", sd.assumptions_dependencies ? "Captured" : "Not captured"]);
  } else if (key.includes("risk")) {
    const risk = (t.riskSnapshotData ?? {}) as any;
    const rows = Array.isArray(risk.risk_rows) ? risk.risk_rows : [];
    items.push(["Risk Rows", rows.length > 0 ? `${rows.length} risks` : "Not captured"]);
  }

  if (items.length === 0) {
    return (
      <div className="bg-muted/30 rounded-md p-2">
        <p className="text-[10px] text-muted-foreground">No specific source data mapped for this block yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-muted/30 rounded-md p-2 space-y-0.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Source Data Preview (read-only)</p>
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">{k}</span>
          <span className={v === "Not captured" ? "text-muted-foreground" : "font-medium"}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────
interface Props { ws: TenderWorkspace; reload: () => void }

export default function ProposalBlockWorkbenchTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;

  const [blocks, setBlocks] = useState<ProposalBlock[]>(() =>
    Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks.map(normalizeProposalBlock) : []
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newBlock, setNewBlock] = useState<ProposalBlock>(() => emptyBlock(""));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [aiGeneratingBlockId, setAiGeneratingBlockId] = useState<string | null>(null);
  const [aiDrafts, setAiDrafts] = useState<Record<string, string>>({});

  const selectedBlock = useMemo(() => blocks.find(b => b.id === selectedId), [blocks, selectedId]);

  const updateBlock = useCallback((id: string, patch: Partial<ProposalBlock>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch, last_updated: new Date().toISOString() } : b));
    setDirty(true);
  }, []);

  const addBlock = useCallback(() => {
    if (!newBlock.title.trim()) { toast.error("Block title is required."); return; }
    const id = nanoid(10);
    const editorContent = newBlock.editor_content || buildInitialEditorContent(newBlock.title, newBlock.block_key);
    const blockToInsert = normalizeProposalBlock({
      ...newBlock,
      id,
      section_number: String(blocks.length + 1),
      editor_stage: "structure",
      editor_content: editorContent,
      draft_content: editorContent,
      draft_status: "Ready to Draft",
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    });
    setBlocks(prev => [...prev, blockToInsert]);
    setSelectedId(id);
    setNewBlock(emptyBlock(""));
    setShowAdd(false);
    setDirty(true);
    toast.success("Block added.");
  }, [newBlock, blocks.length]);

  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
    setDirty(true);
  }, [selectedId]);

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr.map((b, i) => ({ ...b, section_number: String(i + 1) }));
    });
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await updateTenderDraftingData(tenderId, "proposal_blocks", blocks, "Proposal blocks updated");
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Proposal blocks saved.");
      setDirty(false);
      reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [blocks, tenderId, reload]);

  // Sort blocks by section_number
  const sortedBlocks = useMemo(() =>
    [...blocks].sort((a, b) => {
      const na = parseInt(a.section_number) || 9999;
      const nb = parseInt(b.section_number) || 9999;
      return na - nb;
    }),
  [blocks]);

  // ── AI Context Builders (concise summaries, never raw dumps) ───

  const buildQualificationContext = useCallback(() => {
    const t = ws.tender;
    const sowQ = (t.sowQualificationData ?? {}) as any;
    const techQ = (t.technicalQualificationData ?? {}) as any;
    const custFit = (t.customerFitData ?? {}) as any;
    const lines = [
      "## Qualification",
      `SOW Qualification: ${sowQ.outcome?.recommendation || sowQ.overall_result || sowQ.qualification_status || "Not assessed"}`,
      `Technical Qualification: ${techQ.recommendation?.outcome || techQ.overall_result || techQ.qualification_status || "Not assessed"}`,
      `Customer Fit: ${custFit.recommendation?.outcome || custFit.fit_rating || custFit.overall_fit || "Not assessed"}`,
    ];
    // SOW coverage matrix — summarize clear vs partial
    if (Array.isArray(sowQ.coverage_matrix) && sowQ.coverage_matrix.length > 0) {
      const clear = sowQ.coverage_matrix.filter((r: any) => r.status === "Clear").length;
      const partial = sowQ.coverage_matrix.filter((r: any) => r.status === "Partial").length;
      lines.push(`SOW Coverage: ${clear} Clear, ${partial} Partial out of ${sowQ.coverage_matrix.length} areas`);
    }
    // Technical capability assessment — summarize fit levels
    if (Array.isArray(techQ.capability_assessment) && techQ.capability_assessment.length > 0) {
      const strong = techQ.capability_assessment.filter((r: any) => r.fit === "Strong").length;
      const moderate = techQ.capability_assessment.filter((r: any) => r.fit === "Moderate").length;
      lines.push(`Technical Capability: ${strong} Strong, ${moderate} Moderate out of ${techQ.capability_assessment.length} areas`);
      // Include specific capability details
      techQ.capability_assessment.forEach((r: any) => {
        if (r.evidence) lines.push(`  - ${r.area}: ${r.fit} — ${String(r.evidence).substring(0, 200)}`);
      });
    }
    // Technical gaps
    if (Array.isArray(techQ.gaps) && techQ.gaps.length > 0) {
      lines.push(`Technical Gaps: ${techQ.gaps.length}`);
      techQ.gaps.forEach((g: any) => lines.push(`  - ${g.gap} (${g.severity || "Unrated"})`));
    }
    // SOW clarifications
    if (Array.isArray(sowQ.clarifications) && sowQ.clarifications.length > 0) {
      lines.push(`Clarifications: ${sowQ.clarifications.length}`);
      sowQ.clarifications.forEach((c: any) => lines.push(`  - ${c.question} — ${c.status || "Open"}`));
    }
    // Customer fit dimensions
    if (Array.isArray(custFit.dimensions) && custFit.dimensions.length > 0) {
      custFit.dimensions.forEach((d: any) => lines.push(`  - ${d.dimension}: ${d.fit || d.status || "Not assessed"} — ${String(d.evidence || "").substring(0, 150)}`));
    }
    return lines.join("\n");
  }, [ws.tender]);

  const buildBidNoBidContext = useCallback(() => {
    const bnb = (ws.tender.bidNoBidData ?? {}) as any;
    // bnb.decision is an OBJECT: { decision, decision_owner, decision_date, decision_reason }
    const decisionObj = bnb.decision && typeof bnb.decision === "object" ? bnb.decision : {};
    const decisionStr = decisionObj.decision || bnb.bid_decision?.decision || bnb.final_decision || "Pending";
    const lines = [
      "## Bid/No-Bid",
      `Decision: ${decisionStr}`,
      `Decision Owner: ${decisionObj.decision_owner || "Not captured"}`,
      `Decision Date: ${decisionObj.decision_date || "Not captured"}`,
    ];
    if (decisionObj.decision_reason) lines.push(`Rationale: ${String(decisionObj.decision_reason).substring(0, 300)}`);
    if (bnb.scoring) {
      lines.push(`Scoring: Strategic ${bnb.scoring.strategic_alignment || "-"}%, Operational ${bnb.scoring.operational_readiness || "-"}%, Commercial ${bnb.scoring.commercial_viability || "-"}%, Overall ${bnb.scoring.overall_score || "-"}%`);
    }
    // Win strategy — structured themes
    if (bnb.win_strategy) {
      const ws = bnb.win_strategy;
      if (ws.rationale?.why_bid) lines.push(`Why Bid: ${String(ws.rationale.why_bid).substring(0, 300)}`);
      if (ws.rationale?.why_win) lines.push(`Why Win: ${String(ws.rationale.why_win).substring(0, 300)}`);
      if (ws.rationale?.client_values) lines.push(`Client Values: ${String(ws.rationale.client_values).substring(0, 300)}`);
      if (Array.isArray(ws.win_themes) && ws.win_themes.length > 0) {
        lines.push(`Win Themes (${ws.win_themes.length}):`);
        ws.win_themes.forEach((wt: any) => {
          lines.push(`  - ${wt.theme || wt}: ${wt.hala_proof || wt.buyer_need || ""}`);
        });
      }
      if (Array.isArray(ws.differentiators) && ws.differentiators.length > 0) {
        lines.push(`Differentiators (${ws.differentiators.length}):`);
        ws.differentiators.forEach((d: any) => lines.push(`  - ${d.differentiator}: ${d.evidence || ""}`));
      }
    }
    // Resource commitment
    if (bnb.resource_commitment) {
      const rc = bnb.resource_commitment;
      lines.push(`Bid Manager: ${rc.bid_manager || "Not assigned"}`);
      lines.push(`Commercial Lead: ${rc.commercial_lead || "Not assigned"}`);
      lines.push(`Operations Lead: ${rc.operations_lead || "Not assigned"}`);
    }
    return lines.join("\n");
  }, [ws.tender]);

  const buildSolutionDesignContext = useCallback(() => {
    const sd = (ws.tender.solutionDesignData ?? {}) as any;
    const cfg = sd.configuration ?? {};
    const lines = [
      "## Solution Design",
      `Selected Modules: ${cfg.selected_modules || "Not captured"}`,
      `Customer Operating Road: ${cfg.customer_operating_road || "Not captured"}`,
      `Market Entry Mode: ${cfg.market_entry_mode || "Not captured"}`,
      `Solution Package: ${cfg.solution_package || "Not captured"}`,
      `Deployment Type: ${cfg.deployment_type || "Not captured"}`,
    ];
    if (cfg.customer_problem?.statement) lines.push(`Customer Problem: ${String(cfg.customer_problem.statement).substring(0, 300)}`);
    if (Array.isArray(cfg.customer_pain_categories) && cfg.customer_pain_categories.length > 0) {
      lines.push(`Pain Categories: ${cfg.customer_pain_categories.join(", ")}`);
    }
    if (sd.hop) {
      lines.push(`\nHOP (Operations):  ${typeof sd.hop === "object" ? "Captured" : "Not captured"}`);
      if (sd.hop.operating_model) lines.push(`  Operating Model: ${sd.hop.operating_model}`);
      if (sd.hop.service_description) lines.push(`  Service: ${String(sd.hop.service_description).substring(0, 300)}`);
      if (sd.hop.geographic_coverage) lines.push(`  Coverage: ${sd.hop.geographic_coverage}`);
      if (sd.hop.kpi_approach) lines.push(`  KPIs: ${String(sd.hop.kpi_approach).substring(0, 200)}`);
    }
    if (sd.ham) {
      lines.push(`HAM (Manpower): Captured`);
      if (sd.ham.manpower_model) lines.push(`  Model: ${sd.ham.manpower_model}`);
      if (sd.ham.total_headcount) lines.push(`  Headcount: ${sd.ham.total_headcount}`);
      if (sd.ham.training_requirements) lines.push(`  Training: ${String(sd.ham.training_requirements).substring(0, 200)}`);
    }
    if (sd.hip) {
      lines.push(`HIP (Systems): Captured`);
      if (sd.hip.systems_overview) lines.push(`  Systems: ${String(sd.hip.systems_overview).substring(0, 200)}`);
      if (sd.hip.reporting_model) lines.push(`  Reporting: ${String(sd.hip.reporting_model).substring(0, 200)}`);
    }
    if (sd.scope_matrix?.rows && Array.isArray(sd.scope_matrix.rows)) {
      lines.push(`Scope Matrix: ${sd.scope_matrix.rows.length} service areas`);
      sd.scope_matrix.rows.forEach((r: any) => lines.push(`  - ${r.service_area}: ${r.in_scope ? "In Scope" : "Out of Scope"} (${r.responsibility || "-"})`));
    }
    if (sd.sla_kpi?.rows && Array.isArray(sd.sla_kpi.rows)) {
      lines.push(`SLA/KPIs: ${sd.sla_kpi.rows.length} KPIs`);
      sd.sla_kpi.rows.forEach((r: any) => lines.push(`  - ${r.kpi}: Target: ${r.target} | ${r.measurement}`));
    }
    if (sd.assumptions_dependencies) lines.push(`Assumptions: ${String(sd.assumptions_dependencies).substring(0, 300)}`);
    return lines.join("\n");
  }, [ws.tender]);

  const buildPricingContext = useCallback(() => {
    const pricing = normalizeTenderPricingData(ws.tender.pricingData);
    const lines = [
      "## Pricing Status",
      `Selected Scenario: ${pricing.scenarios.selected_scenario.selected_scenario_name || "Not selected"}`,
      `Margin Target: ${ws.tender.targetGpPercent ? `${ws.tender.targetGpPercent}%` : "Not captured"}`,
      `P&L Snapshot: ${pricing.pnl_snapshot.snapshot_status || "Not captured"}`,
      `Pricing Approval: ${pricing.approval.summary.approval_status || "Not captured"}`,
      `Number of Scenarios: ${pricing.scenarios.rows.length || 0}`,
    ];
    if (pricing.commercial_terms.payment_tax_validity.payment_terms !== "Not Captured") {
      lines.push(`Payment Terms: ${pricing.commercial_terms.payment_tax_validity.payment_terms}`);
      lines.push(`Commercial Terms: Captured`);
    } else {
      lines.push(`Commercial Terms: Not captured`);
    }
    // Never include actual SAR figures
    return lines.join("\n");
  }, [ws.tender]);

  const buildRiskContext = useCallback(() => {
    const risk = (ws.tender.riskSnapshotData ?? {}) as any;
    const rows = Array.isArray(risk.risk_rows) ? risk.risk_rows : [];
    const openRisks = rows.filter((r: any) => r.status !== "Mitigated" && r.status !== "Closed");
    const critical = rows.filter((r: any) => r.risk_level === "Critical" || r.risk_level === "Very High");
    const lines = [
      "## Risk Snapshot",
      `Total Risks: ${rows.length || "No risks captured"}`,
      `Open Risks: ${openRisks.length}`,
      `Critical/Very High: ${critical.length}`,
    ];
    if (openRisks.length > 0) {
      lines.push(`Key Risks:`);
      openRisks.slice(0, 5).forEach((r: any) => lines.push(`  - ${r.risk_title || r.description || "Unnamed risk"} (${r.risk_level || "Unrated"}): ${String(r.mitigation || r.risk_mitigation || "").substring(0, 150)}`));
    }
    if (risk.assumptions) lines.push(`Assumptions: ${String(risk.assumptions).substring(0, 300)}`);
    if (risk.exclusions) lines.push(`Exclusions: ${String(risk.exclusions).substring(0, 300)}`);
    return lines.join("\n");
  }, [ws.tender]);

  const buildComplianceContext = useCallback(() => {
    const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
    const comp = drafting.compliance_coverage;
    if (!comp || (typeof comp === "object" && Object.keys(comp).length === 0)) {
      return "## Compliance Coverage\nNot assessed";
    }
    const reqs = Array.isArray(comp.requirements) ? comp.requirements : [];
    const met = reqs.filter((r: any) => r.status === "Compliant" || r.status === "Met").length;
    const lines = [
      "## Compliance Coverage",
      `Requirements: ${reqs.length > 0 ? `${met}/${reqs.length} met` : "Not assessed"}`,
    ];
    const gaps = reqs.filter((r: any) => r.status !== "Compliant" && r.status !== "Met");
    if (gaps.length > 0) {
      lines.push(`Gaps:`);
      gaps.slice(0, 5).forEach((r: any) => lines.push(`  - ${r.requirement || r.title || "Unnamed"}: ${r.status || "Not assessed"}`));
    }
    return lines.join("\n");
  }, [ws.tender]);

  const buildLinkedDocumentsContext = useCallback(() => {
    const docs = ws.documents ?? [];
    if (docs.length === 0) return "## Linked Documents\nNo documents linked";
    const lines = ["## Linked Documents"];
    docs.slice(0, 10).forEach((d: any) => {
      lines.push(`- ${d.title || d.name || "Untitled"} (${d.type || d.doc_type || "unknown"})`);
    });
    return lines.join("\n");
  }, [ws.documents]);

  const buildTOCSectionContext = useCallback((block: ProposalBlock) => {
    const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
    const toc = drafting.proposal_architecture;
    const lines = [
      "## Active TOC Section",
      `Section: ${block.section_number ? `§${block.section_number}` : "Not numbered"} — ${block.section_name || block.title || "Untitled"}`,
      `Intended Section: ${block.intended_section || "Not specified"}`,
    ];
    if (block.toc_section_id && toc) {
      // Find sibling blocks in same section
      const siblings = blocks.filter(b => b.toc_section_id === block.toc_section_id && b.id !== block.id);
      if (siblings.length > 0) {
        lines.push(`Sibling Blocks: ${siblings.map(s => s.title || "Untitled").join(", ")}`);
      }
    }
    return lines.join("\n");
  }, [ws.tender, blocks]);

  // ── AI Generation Handler ─────────────────────────────────

  const handleAIGenerate = useCallback(async (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    setAiGeneratingBlockId(blockId);
    try {
      // 1. Find available tender bot from Bot Builder (governed system)
      const bots = await getBlockBots("tenders");
      if (bots.length === 0) {
        toast.error("No tender AI bot configured. Go to Admin → Bot Builder to create one with 'tenders' domain.");
        return;
      }
      const bot = bots[0];

      // 2. Build rich structured context from full workspace
      const t = ws.tender;
      const contextSections = [
        `## Block Metadata`,
        `Title: ${block.title || "Untitled"}`,
        `Block Type: ${block.block_type || "Not specified"}`,
        `Volume: ${block.volume || "Not specified"}`,
        `Section: ${block.section_name || block.intended_section || "Not specified"}`,
        `Source Stages: ${block.source_stages || "Not specified"}`,
        `Required Source Data: ${block.required_source_data || "Not specified"}`,
        `Required Evidence: ${block.required_evidence || "Not specified"}`,
        ``,
        `## Tender Context`,
        `Tender: ${t.title || "Untitled"}`,
        `Customer: ${t.customerName || "Unknown"}`,
        `Submission Deadline: ${t.submissionDeadline || "Not captured"}`,
        ``,
        buildQualificationContext(),
        ``,
        buildBidNoBidContext(),
        ``,
        buildSolutionDesignContext(),
        ``,
        buildPricingContext(),
        ``,
        buildRiskContext(),
        ``,
        buildComplianceContext(),
        ``,
        buildLinkedDocumentsContext(),
        ``,
        buildTOCSectionContext(block),
      ].join("\n");

      // 3. Call existing AI pipeline — throws on failure
      const existingContent = block.editor_content || block.draft_content || "";
      const result = await generateBlockContent(
        bot.id,
        "commercial",
        contextSections,
        existingContent,
        null, // no transcript
        undefined, // docInstanceId
        ws.tender.id, // tenderId — links bot_run audit to this specific tender
      );

      // 4. Store AI output for preview — does NOT touch editor
      setAiDrafts(prev => ({ ...prev, [blockId]: result.content }));
      toast.success(`AI draft ready — review before applying`);
    } catch (err: any) {
      console.error("[ProposalBlockWorkbench] AI generation failed:", err);
      toast.error(err.message || "AI generation failed — check provider configuration");
    } finally {
      setAiGeneratingBlockId(null);
    }
  }, [blocks, ws, buildQualificationContext, buildBidNoBidContext, buildSolutionDesignContext, buildPricingContext, buildRiskContext, buildComplianceContext, buildLinkedDocumentsContext, buildTOCSectionContext]);

  const handleAIDraftAction = useCallback(async (blockId: string, mode: AIDraftAction) => {
    const draft = aiDrafts[blockId];
    if (mode === "cancel" || !draft) {
      setAiDrafts(prev => { const next = { ...prev }; delete next[blockId]; return next; });
      if (mode === "cancel") toast.info("AI draft discarded");
      return;
    }

    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const existing = block.editor_content || block.draft_content || "";
    let newContent = "";

    switch (mode) {
      case "replace":
        newContent = draft;
        break;
      case "append":
        newContent = existing + draft;
        break;
      case "insert_cursor":
        newContent = existing + draft;
        break;
    }

    // Update state
    updateBlock(blockId, {
      editor_content: newContent,
      draft_content: newContent,
      editor_stage: "sprint" as TenderProposalEditorStage,
      draft_status: "Manual Draft",
    });

    // Clear preview
    setAiDrafts(prev => { const next = { ...prev }; delete next[blockId]; return next; });

    // Auto-save to Supabase immediately
    try {
      const updatedBlocks = blocks.map(b =>
        b.id === blockId
          ? { ...b, editor_content: newContent, draft_content: newContent, editor_stage: "sprint" as TenderProposalEditorStage, draft_status: "Manual Draft", last_updated: new Date().toISOString() }
          : b
      );
      const res = await updateTenderDraftingData(ws.tender.id, "proposal_blocks", updatedBlocks, `AI draft ${mode} applied to block ${block.title || blockId}`);
      if (res.success) {
        toast.success(`AI draft ${mode === "replace" ? "applied" : mode === "append" ? "appended" : "inserted"} and saved`);
        setDirty(false);
      } else {
        toast.warning(`AI draft applied but save failed: ${res.error}. Click Save Draft to retry.`);
      }
    } catch (e: any) {
      toast.warning(`AI draft applied but save failed: ${e.message}. Click Save Draft to retry.`);
    }
  }, [aiDrafts, blocks, updateBlock, ws.tender.id]);

  return (
    <div className="space-y-4">
      {/* Block Register */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs font-semibold">Proposal Block Register</span>
              <Badge variant="outline" className="text-[8px]">{blocks.length} block{blocks.length !== 1 ? "s" : ""}</Badge>
              <Badge variant="outline" className="text-[8px] border-emerald-200 text-emerald-600">{blocks.filter(b => b.approval_status === "Approved").length} approved</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => setShowAdd(!showAdd)}>
                <Plus className="w-3 h-3" /> Add Block
              </Button>
              <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save Blocks
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sortedBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No proposal blocks created yet. Use Proposal Architecture / TOC to create blocks.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold w-8">#</th>
                    <th className="px-3 py-2 text-left font-semibold">Title</th>
                    <th className="px-3 py-2 text-left font-semibold">Volume</th>
                    <th className="px-3 py-2 text-left font-semibold">Stage</th>
                    <th className="px-3 py-2 text-left font-semibold">Draft</th>
                    <th className="px-3 py-2 text-left font-semibold">Approval</th>
                    <th className="px-3 py-2 text-left font-semibold">Owner</th>
                    <th className="px-3 py-2 text-left font-semibold">Updated</th>
                    <th className="px-3 py-2 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBlocks.map((b, i) => {
                    const stage = normalizeEditorStage(b.editor_stage);
                    return (
                      <tr key={b.id} className={`border-t border-border hover:bg-muted/30 cursor-pointer ${selectedId === b.id ? "bg-indigo-50 dark:bg-indigo-950/20" : ""}`} onClick={() => setSelectedId(b.id)}>
                        <td className="px-3 py-2 text-muted-foreground font-mono">{b.section_number || i + 1}</td>
                        <td className="px-3 py-2 font-medium">{b.title || "Untitled"}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[8px]">{b.volume}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[8px] ${TENDER_EDITOR_STAGE_CONFIG[stage].badge}`}>{TENDER_EDITOR_STAGE_CONFIG[stage].label}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[8px] ${statusColor(b.draft_status)}`}>{b.draft_status}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[8px] ${statusColor(b.approval_status)}`}>{b.approval_status}</Badge></td>
                        <td className="px-3 py-2 text-muted-foreground">{b.owner || "-"}</td>
                        <td className="px-3 py-2 text-muted-foreground font-mono">{b.last_updated ? new Date(b.last_updated).toLocaleDateString() : "-"}</td>
                        <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-0.5">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={i === 0} onClick={() => moveBlock(b.id, -1)}><ArrowUp className="w-3 h-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={i === sortedBlocks.length - 1} onClick={() => moveBlock(b.id, 1)}><ArrowDown className="w-3 h-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeBlock(b.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Block Form (manual — testing fallback) */}
      {showAdd && (
        <Card className="border-indigo-200 shadow-none">
          <CardHeader className="py-2 px-4 bg-indigo-50 dark:bg-indigo-950/20 border-b border-indigo-200">
            <span className="text-xs font-semibold text-indigo-700">Add Proposal Block (manual)</span>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">Block Title *</label>
                <Input className="h-8 text-xs mt-1" value={newBlock.title} onChange={e => setNewBlock(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Executive Summary" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">Block Type</label>
                <Select value={newBlock.block_type} onValueChange={v => setNewBlock(p => ({ ...p, block_type: v, block_key: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{BLOCK_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">Volume</label>
                <Select value={newBlock.volume} onValueChange={v => setNewBlock(p => ({ ...p, volume: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{VOLUMES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" className="h-7 text-[10px]" onClick={addBlock}>Add Block</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Block — Clean Editor */}
      {selectedBlock && (
        <Card className="border-border shadow-none">
          <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                {selectedBlock.section_number && <span className="text-[10px] text-muted-foreground font-mono">§{selectedBlock.section_number}</span>}
                <span className="text-xs font-semibold">{selectedBlock.title || "Untitled Block"}</span>
                <Badge variant="outline" className="text-[8px]">{selectedBlock.volume}</Badge>
                <Badge variant="outline" className={`text-[8px] ${statusColor(selectedBlock.draft_status)}`}>{selectedBlock.draft_status}</Badge>
                <Badge variant="outline" className={`text-[8px] ${statusColor(selectedBlock.approval_status)}`}>{selectedBlock.approval_status}</Badge>
                {selectedBlock.pdf_studio_target && <span className="text-[9px] text-muted-foreground">→ {selectedBlock.pdf_studio_target}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{selectedBlock.owner ? `Owner: ${selectedBlock.owner}` : ""}</span>
                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setSelectedId(null)}>Close</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Source Data Preview */}
            <SourcePreview ws={ws} block={selectedBlock} />

            {/* Rich Manual Block Editor */}
            <TenderProposalEditorBlock
              block={selectedBlock}
              saving={saving}
              onChange={(patch) => updateBlock(selectedBlock.id, patch)}
              onRequestSave={handleSave}
              onAIGenerate={handleAIGenerate}
              aiGenerating={aiGeneratingBlockId === selectedBlock.id}
              aiDraftContent={aiDrafts[selectedBlock.id] || null}
              onAIDraftAction={(mode) => handleAIDraftAction(selectedBlock.id, mode)}
            />

            {/* Compact Status Row */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground">Draft</label>
                <Select value={selectedBlock.draft_status} onValueChange={v => updateBlock(selectedBlock.id, { draft_status: v })}>
                  <SelectTrigger className="h-7 text-[10px] w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>{DRAFT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground">Approval</label>
                <Select value={selectedBlock.approval_status} onValueChange={v => updateBlock(selectedBlock.id, { approval_status: v, ...(v === "Approved" ? { approved_at: new Date().toISOString() } : {}) })}>
                  <SelectTrigger className="h-7 text-[10px] w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>{APPROVAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground">Reviewer</label>
                <Input className="h-7 text-[10px] w-28" value={selectedBlock.reviewer} onChange={e => updateBlock(selectedBlock.id, { reviewer: e.target.value })} placeholder="optional" />
              </div>
            </div>

            {/* AI Bot Status */}
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">AI Drafting</span>
              <span className="text-[9px] text-emerald-600">✓ Tender bot connected — use ✨ AI Draft in the editor toolbar</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
