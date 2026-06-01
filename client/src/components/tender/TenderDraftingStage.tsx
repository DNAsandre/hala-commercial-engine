/**
 * TenderDraftingStage — Stage 6 Router + Header
 *
 * Routes activeTab to 6 sub-components.
 * Shows: Previous Stage Intelligence (collapsible), Save Status Strip, Stage Documents.
 * No AI. No mock data. No PDF Studio mutation.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, BarChart3, FileText, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { normalizeTenderPricingData } from "@/lib/tender-pricing-types";
import ProposalArchitectureTOCTab from "./ProposalArchitectureTOCTab";
import ProposalBlockWorkbenchTab from "./ProposalBlockWorkbenchTab";
import TechnicalVolumeTab from "./TechnicalVolumeTab";
import CommercialVolumeTab from "./CommercialVolumeTab";
import ComplianceCoverageTab from "./ComplianceCoverageTab";
import AppendicesEvidenceTab from "./AppendicesEvidenceTab";
import PdfStudioHandoffTab from "./PdfStudioHandoffTab";
import TenderDraftingDocumentsCard from "./TenderDraftingDocumentsCard";

// ─── Helpers ────────────────────────────────────────────────
function isFilled(v: any): boolean {
  if (!v) return false;
  if (typeof v === "string") return v.trim() !== "" && v !== "Not Assessed" && v !== "Not Selected";
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v).some(isFilled);
  return true;
}

function statusDot(saved: boolean) {
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full ${saved ? "bg-emerald-500" : "bg-slate-300"}`} />
  );
}

function psiRow(label: string, value: string) {
  return (
    <div className="flex justify-between text-[11px] py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={value === "Not captured" || value === "0" ? "text-muted-foreground" : "font-medium"}>{value}</span>
    </div>
  );
}

// ─── Previous Stage Intelligence ───────────────────────────
function PreviousStageIntelligence({ ws }: { ws: TenderWorkspace }) {
  const [open, setOpen] = useState(false);
  const t = ws.tender;
  const pricing = useMemo(() => normalizeTenderPricingData(t.pricingData), [t.pricingData]);
  const sd = (t.solutionDesignData ?? {}) as any;
  const bnb = (t.bidNoBidData ?? {}) as any;
  const risk = (t.riskSnapshotData ?? {}) as any;
  const sowQ = (t.sowQualificationData ?? {}) as any;
  const techQ = (t.technicalQualificationData ?? {}) as any;
  const custFit = (t.customerFitData ?? {}) as any;
  const docs = ws.documents ?? [];
  const nc = "Not captured";

  const riskRows = Array.isArray(risk.risk_rows) ? risk.risk_rows : [];
  const openRisks = riskRows.filter((r: any) => r.status !== "Mitigated" && r.status !== "Closed").length;
  const blockers = riskRows.filter((r: any) => r.risk_level === "Critical" || r.risk_level === "Very High").length;

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="py-2 px-4 cursor-pointer bg-muted/20 border-b border-border" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-xs font-semibold">Previous Stage Intelligence</span>
          <Badge variant="outline" className="text-[8px] ml-auto">read-only</Badge>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="space-y-0.5 rounded-md border border-border p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Qualification</p>
              {psiRow("SOW Qualification", isFilled(sowQ) ? "Captured" : nc)}
              {psiRow("Technical Qualification", isFilled(techQ) ? "Captured" : nc)}
              {psiRow("Customer Fit", isFilled(custFit) ? "Captured" : nc)}
              {psiRow("Risk Snapshot", riskRows.length > 0 ? `${riskRows.length} risks` : nc)}
              {psiRow("Open Risks", String(openRisks))}
              {psiRow("Bid Blockers", String(blockers))}
              {psiRow("Clarifications", String(riskRows.filter((r: any) => r.status === "Open" && r.risk_category === "Clarification").length || (sowQ.clarifications_needed ?? 0)))}
            </div>
            <div className="space-y-0.5 rounded-md border border-border p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Bid / No-Bid</p>
              {psiRow("Bid Decision", bnb.bid_decision?.decision || nc)}
              {psiRow("Win Strategy", isFilled(bnb.win_strategy) ? "Captured" : nc)}
              {psiRow("Resource Commitment", isFilled(bnb.resource_commitment) ? "Captured" : nc)}
              {psiRow("Decision Record", isFilled(bnb.decision_record) ? "Captured" : nc)}
            </div>
            <div className="space-y-0.5 rounded-md border border-border p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Solution Design</p>
              {psiRow("Configuration", sd.configuration?.selected_modules || nc)}
              {psiRow("HOP", isFilled(sd.hop) ? "Captured" : nc)}
              {psiRow("HAM", isFilled(sd.ham) ? "Captured" : nc)}
              {psiRow("HIP", isFilled(sd.hip) ? "Captured" : nc)}
              {psiRow("Scope Matrix", isFilled(sd.scope_matrix) ? "Captured" : nc)}
              {psiRow("SLA/KPI", isFilled(sd.sla_kpi) ? "Captured" : nc)}
              {psiRow("Assumptions", isFilled(sd.assumptions_dependencies) ? "Captured" : nc)}
            </div>
            <div className="space-y-0.5 rounded-md border border-border p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">P&L / Pricing</p>
              {psiRow("P&L Snapshot", pricing.pnl_snapshot?.snapshot_status !== "No Snapshot" ? pricing.pnl_snapshot?.snapshot_status : nc)}
              {psiRow("Pricing Scenarios", pricing.scenarios?.rows?.length > 0 ? `${pricing.scenarios.rows.length} rows` : nc)}
              {psiRow("Commercial Terms", isFilled(pricing.commercial_terms) ? "Captured" : nc)}
              {psiRow("Pricing Approval", pricing.approval?.summary?.approval_status !== "Not Submitted" ? pricing.approval.summary.approval_status : nc)}
            </div>
            <div className="space-y-0.5 rounded-md border border-border p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Documents</p>
              {psiRow("Total Documents", String(docs.length))}
              {psiRow("Source Documents", String(docs.filter((d: any) => d.document_category === "Source" || d.document_type === "rfp").length))}
              {psiRow("Supporting", String(docs.filter((d: any) => d.document_category === "Supporting").length))}
              {psiRow("Missing/Expired", String(docs.filter((d: any) => d.status === "Missing" || d.status === "Expired" || d.status === "Needs Update").length))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Stage Header ──────────────────────────────────────────
interface HeaderProps { ws: TenderWorkspace; onOpenDocuments?: () => void }
export function TenderDraftingStageHeader({ ws, onOpenDocuments }: HeaderProps) {
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
  const blocks = Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [];
  const statuses = [
    { label: "TOC", saved: isFilled(drafting.proposal_architecture) },
    { label: "Workbench", saved: blocks.length > 0 },
    { label: "Technical", saved: blocks.some((b: any) => b.volume === "Technical" || b.volume === "Shared") },
    { label: "Commercial", saved: blocks.some((b: any) => b.volume === "Commercial" || b.volume === "Shared") },
    { label: "Compliance", saved: isFilled(drafting.compliance_coverage) },
    { label: "Appendices", saved: isFilled(drafting.appendices_evidence) },
    { label: "Handoff", saved: isFilled(drafting.pdf_studio_handoff) },
  ];
  return (
    <div className="space-y-3">
      <PreviousStageIntelligence ws={ws} />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
        <div className="flex items-center gap-3">
          <span className="font-semibold uppercase tracking-wider">Save Status</span>
          {statuses.map(s => (
            <span key={s.label} className="flex items-center gap-1">{statusDot(s.saved)} {s.label}</span>
          ))}
        </div>
        <span className="italic">{blocks.length > 0 ? `${blocks.filter((b: any) => b.approval_status === "Approved").length}/${blocks.length} blocks approved` : "No blocks yet."}</span>
      </div>
      {onOpenDocuments && <TenderDraftingDocumentsCard ws={ws} onOpenDocuments={onOpenDocuments} />}
    </div>
  );
}

// ─── Main Router ───────────────────────────────────────────
interface StageProps {
  ws: TenderWorkspace;
  activeTab: string;
  reload: () => void;
  onOpenDocuments?: () => void;
}

export default function TenderDraftingStage({ ws, activeTab, reload, onOpenDocuments }: StageProps) {
  if (activeTab === "proposal_architecture_toc") return <ProposalArchitectureTOCTab ws={ws} reload={reload} />;
  if (activeTab === "proposal_block_workbench") return <ProposalBlockWorkbenchTab ws={ws} reload={reload} />;
  if (activeTab === "technical_volume") return <TechnicalVolumeTab ws={ws} reload={reload} />;
  if (activeTab === "commercial_volume") return <CommercialVolumeTab ws={ws} reload={reload} />;
  if (activeTab === "compliance_coverage") return <ComplianceCoverageTab ws={ws} reload={reload} />;
  if (activeTab === "appendices_evidence") return <AppendicesEvidenceTab ws={ws} reload={reload} onOpenDocuments={onOpenDocuments} />;
  if (activeTab === "pdf_studio_handoff") return <PdfStudioHandoffTab ws={ws} reload={reload} />;
  return <p className="text-sm text-muted-foreground text-center py-8">No Tender Drafting view configured for this tab.</p>;
}
