/**
 * CustomerFitQualification — Structured Manual Qualification Capture
 *
 * Replaces old mock/AI-driven "Customer Fit" tab in the Qualification stage.
 *
 * 7 Subsections:
 *   1. Customer Snapshot
 *   2. Fit Dimensions (8 structured rows)
 *   3. Qualification Scorecard (auto-calculated from user selections only)
 *   4. Evidence Register (repeatable rows)
 *   5. Fit Gaps / Clarifications (repeatable rows)
 *   6. Qualification Recommendation
 *   7. Save Button
 *
 * Data: ws.tender.customerFitData → emptyCustomerFitData() fallback
 * Save: updateTenderCustomerFitData() → type_details.customer_fit_data
 *
 * Rules:
 * - No fake data, no AI generation, no hardcoded tender/customer facts.
 * - Manual capture only.
 * - No stage movement. No CRM change. No PDF Studio touch.
 * - No localStorage.
 * - All fields empty or "Not Assessed" by default.
 * - Scorecard calculated only from user-selected assessment values.
 * - If all dimensions are "Not Assessed", fit status = "Not Assessed".
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderCustomerFitData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import {
  Loader2, Save, ChevronDown, ChevronRight, Plus, X,
  Building2, Target, MapPin, Truck, ShieldCheck, DollarSign,
  Handshake, Globe, FileText, AlertTriangle, ClipboardCheck,
  MessageSquare,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type Assessment = "Strong Fit" | "Moderate Fit" | "Weak Fit" | "Not Assessed";
type DimensionStatus = "Open" | "In Progress" | "Reviewed" | "Confirmed";
type EvidenceStatus = "Captured" | "Missing" | "Needs clarification" | "Confirmed";
type GapStatus = "Open" | "In progress" | "Submitted to customer" | "Resolved" | "Accepted as assumption";
type GapImpact = "Low" | "Medium" | "High" | "Bid blocker";
type RecommendationOutcome = "Proceed to Bid / No-Bid" | "Hold pending clarification" | "Escalate for management review" | "Do not proceed" | "Not decided";

interface CustomerSnapshot {
  customer_name: string;
  source: string;
  crm_reference: string;
  existing_customer_status: string;
  linked_opportunity: string;
  owner: string;
  estimated_value: string;
  region: string;
  win_probability: string;
  notes: string;
}

interface FitDimension {
  dimension: string;
  question: string;
  assessment: Assessment;
  selected_values: string[];
  evidence: string;
  gap_or_concern: string;
  owner: string;
  status: DimensionStatus;
}

interface EvidenceRow {
  evidence_type: string;
  description: string;
  source: string;
  attachment_ref: string;
  owner: string;
  status: EvidenceStatus;
}

interface GapRow {
  gap_question: string;
  impact: GapImpact;
  owner: string;
  required_by: string;
  status: GapStatus;
}

interface Recommendation {
  outcome: RecommendationOutcome;
  reason: string;
  reviewer: string;
}

interface CustomerFitData {
  customer_snapshot: CustomerSnapshot;
  dimensions: FitDimension[];
  evidence: EvidenceRow[];
  gaps: GapRow[];
  recommendation: Recommendation;
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS — Generic reusable options. NOT tender/customer facts.
// ═══════════════════════════════════════════════════════════

const ASSESSMENT_OPTIONS: Assessment[] = ["Strong Fit", "Moderate Fit", "Weak Fit", "Not Assessed"];

const SECTOR_OPTIONS = [
  "FMCG / F&B", "Healthcare", "Petrochemical", "Industrial",
  "Warehousing", "Transport / Distribution", "Freight Forwarding",
  "Customs Clearance", "Other",
];

const SERVICE_LINE_OPTIONS = [
  "Warehousing", "Transportation", "Distribution", "Inventory Management",
  "Order Fulfilment", "Freight Forwarding", "Customs Clearance",
  "Value Added Services", "Technology Integration",
  "Control Tower / Command Center", "HSE / Compliance", "Other",
];

const REGION_OPTIONS = [
  "Central", "East", "West", "North", "South", "Nationwide", "GCC / Cross-border",
];

const RELATIONSHIP_OPTIONS = [
  "Existing strategic customer", "Existing transactional customer",
  "Known prospect", "New prospect", "Not captured",
];

const COMPLEXITY_OPTIONS = ["Low", "Medium", "High", "Not Assessed"];

const EVIDENCE_TYPE_OPTIONS = [
  "Customer relationship", "Sector alignment", "Facility capability",
  "Fleet capability", "Systems capability", "Compliance capability",
  "Pricing/commercial evidence", "Payment/contract evidence",
  "Local content evidence", "Other",
];

const EVIDENCE_STATUS_OPTIONS: EvidenceStatus[] = ["Captured", "Missing", "Needs clarification", "Confirmed"];

const GAP_IMPACT_OPTIONS: GapImpact[] = ["Low", "Medium", "High", "Bid blocker"];
const GAP_STATUS_OPTIONS: GapStatus[] = ["Open", "In progress", "Submitted to customer", "Resolved", "Accepted as assumption"];

const RECOMMENDATION_OPTIONS: RecommendationOutcome[] = [
  "Proceed to Bid / No-Bid", "Hold pending clarification",
  "Escalate for management review", "Do not proceed", "Not decided",
];

const DIMENSION_STATUS_OPTIONS: DimensionStatus[] = ["Open", "In Progress", "Reviewed", "Confirmed"];

// ═══════════════════════════════════════════════════════════
// DEFAULT DATA — All empty / "Not Assessed" only.
// ═══════════════════════════════════════════════════════════

const DEFAULT_DIMENSIONS: FitDimension[] = [
  { dimension: "Strategic Sector Fit", question: "Does this tender fall inside Hala's target sectors?", assessment: "Not Assessed", selected_values: [], evidence: "", gap_or_concern: "", owner: "", status: "Open" },
  { dimension: "Service Line Fit", question: "Do the requested services match Hala's service capabilities?", assessment: "Not Assessed", selected_values: [], evidence: "", gap_or_concern: "", owner: "", status: "Open" },
  { dimension: "Regional Fit", question: "Can Hala serve the required region/site network?", assessment: "Not Assessed", selected_values: [], evidence: "", gap_or_concern: "", owner: "", status: "Open" },
  { dimension: "Operational Capability Fit", question: "Does Hala have the operational capability, assets, systems, and people to deliver?", assessment: "Not Assessed", selected_values: [], evidence: "", gap_or_concern: "", owner: "", status: "Open" },
  { dimension: "Commercial Attractiveness", question: "Is the opportunity commercially attractive?", assessment: "Not Assessed", selected_values: [], evidence: "", gap_or_concern: "", owner: "", status: "Open" },
  { dimension: "Relationship Strength", question: "What is the current relationship position with this customer?", assessment: "Not Assessed", selected_values: [], evidence: "", gap_or_concern: "", owner: "", status: "Open" },
  { dimension: "Payment / Contract Confidence", question: "Are payment terms, contract terms, and risk exposure acceptable?", assessment: "Not Assessed", selected_values: [], evidence: "", gap_or_concern: "", owner: "", status: "Open" },
  { dimension: "Vision 2030 / Local Content Fit", question: "Does this tender support local content, Saudization, or strategic positioning?", assessment: "Not Assessed", selected_values: [], evidence: "", gap_or_concern: "", owner: "", status: "Open" },
];

function emptyCustomerFitData(): CustomerFitData {
  return {
    customer_snapshot: {
      customer_name: "",
      source: "",
      crm_reference: "",
      existing_customer_status: "",
      linked_opportunity: "",
      owner: "",
      estimated_value: "",
      region: "",
      win_probability: "",
      notes: "",
    },
    dimensions: DEFAULT_DIMENSIONS.map(d => ({ ...d })),
    evidence: [],
    gaps: [],
    recommendation: { outcome: "Not decided", reason: "", reviewer: "" },
  };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function assessmentScore(a: Assessment): number {
  if (a === "Strong Fit") return 3;
  if (a === "Moderate Fit") return 2;
  if (a === "Weak Fit") return 1;
  return 0;
}

function assessmentColor(a: Assessment): string {
  if (a === "Strong Fit") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (a === "Moderate Fit") return "border-amber-300 bg-amber-50 text-amber-700";
  if (a === "Weak Fit") return "border-red-300 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function fitStatusLabel(total: number, allNotAssessed: boolean): string {
  if (allNotAssessed) return "Not Assessed";
  if (total >= 17) return "Strong Fit";
  if (total >= 9) return "Moderate Fit";
  return "Weak Fit";
}

function fitStatusColor(label: string): string {
  if (label === "Strong Fit") return "text-emerald-700 bg-emerald-50 border-emerald-300";
  if (label === "Moderate Fit") return "text-amber-700 bg-amber-50 border-amber-300";
  if (label === "Weak Fit") return "text-red-700 bg-red-50 border-red-300";
  return "text-slate-500 bg-slate-50 border-slate-200";
}

function dimensionIcon(dim: string) {
  if (dim.includes("Sector")) return <Target className="w-3.5 h-3.5" />;
  if (dim.includes("Service")) return <Truck className="w-3.5 h-3.5" />;
  if (dim.includes("Regional")) return <MapPin className="w-3.5 h-3.5" />;
  if (dim.includes("Operational")) return <ShieldCheck className="w-3.5 h-3.5" />;
  if (dim.includes("Commercial")) return <DollarSign className="w-3.5 h-3.5" />;
  if (dim.includes("Relationship")) return <Handshake className="w-3.5 h-3.5" />;
  if (dim.includes("Payment")) return <FileText className="w-3.5 h-3.5" />;
  if (dim.includes("Vision")) return <Globe className="w-3.5 h-3.5" />;
  return <Target className="w-3.5 h-3.5" />;
}

function dimensionOptions(dim: string): string[] {
  if (dim.includes("Sector")) return SECTOR_OPTIONS;
  if (dim.includes("Service")) return SERVICE_LINE_OPTIONS;
  if (dim.includes("Regional")) return REGION_OPTIONS;
  if (dim.includes("Relationship")) return RELATIONSHIP_OPTIONS;
  return [];
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

interface Props {
  ws: TenderWorkspace;
}

export default function CustomerFitQualification({ ws }: Props) {
  const t = ws.tender;
  const tenderId = t.id;

  // ── State ─────────────────────────────────────────────────
  const [data, setData] = useState<CustomerFitData>(() => {
    if (t.customerFitData && typeof t.customerFitData === "object") {
      const saved = t.customerFitData as any;
      return {
        customer_snapshot: { ...emptyCustomerFitData().customer_snapshot, ...(saved.customer_snapshot || {}) },
        dimensions: Array.isArray(saved.dimensions) && saved.dimensions.length === 8
          ? saved.dimensions
          : DEFAULT_DIMENSIONS.map(d => ({ ...d })),
        evidence: Array.isArray(saved.evidence) ? saved.evidence : [],
        gaps: Array.isArray(saved.gaps) ? saved.gaps : [],
        recommendation: { ...emptyCustomerFitData().recommendation, ...(saved.recommendation || {}) },
      };
    }
    return emptyCustomerFitData();
  });

  const [initial, setInitial] = useState(() => JSON.stringify(data));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(data) !== initial;

  // Reload if tender changes — but only if user hasn't made local edits
  useEffect(() => {
    if (t.customerFitData && typeof t.customerFitData === "object") {
      const saved = t.customerFitData as any;
      const loaded: CustomerFitData = {
        customer_snapshot: { ...emptyCustomerFitData().customer_snapshot, ...(saved.customer_snapshot || {}) },
        dimensions: Array.isArray(saved.dimensions) && saved.dimensions.length === 8
          ? saved.dimensions
          : DEFAULT_DIMENSIONS.map(d => ({ ...d })),
        evidence: Array.isArray(saved.evidence) ? saved.evidence : [],
        gaps: Array.isArray(saved.gaps) ? saved.gaps : [],
        recommendation: { ...emptyCustomerFitData().recommendation, ...(saved.recommendation || {}) },
      };
      const loadedStr = JSON.stringify(loaded);
      // Only overwrite local state if user has NOT made unsaved edits
      setData(prev => {
        const prevStr = JSON.stringify(prev);
        if (prevStr === initial) {
          // No local edits — safe to reload from server
          return loaded;
        }
        // User has unsaved edits — don't overwrite
        return prev;
      });
      setInitial(prev => {
        // Update the baseline regardless so dirty tracking stays correct after save
        return loadedStr;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.customerFitData]);

  // ── Collapsible sections ──────────────────────────────────
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    snapshot: true, dimensions: true, scorecard: true,
    evidence: false, gaps: false, recommendation: true,
  });
  const toggle = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Updaters ──────────────────────────────────────────────
  const updateSnapshot = useCallback((field: keyof CustomerSnapshot, value: string) => {
    setData(prev => ({ ...prev, customer_snapshot: { ...prev.customer_snapshot, [field]: value } }));
  }, []);

  const updateDimension = useCallback((idx: number, patch: Partial<FitDimension>) => {
    setData(prev => {
      const dims = [...prev.dimensions];
      dims[idx] = { ...dims[idx], ...patch };
      return { ...prev, dimensions: dims };
    });
  }, []);

  const toggleDimValue = useCallback((idx: number, val: string) => {
    setData(prev => {
      const dims = [...prev.dimensions];
      const curr = [...dims[idx].selected_values];
      const i = curr.indexOf(val);
      if (i >= 0) curr.splice(i, 1); else curr.push(val);
      dims[idx] = { ...dims[idx], selected_values: curr };
      return { ...prev, dimensions: dims };
    });
  }, []);

  const addEvidence = useCallback(() => {
    setData(prev => ({
      ...prev,
      evidence: [...prev.evidence, { evidence_type: "", description: "", source: "", attachment_ref: "", owner: "", status: "Missing" as EvidenceStatus }],
    }));
  }, []);

  const updateEvidence = useCallback((idx: number, patch: Partial<EvidenceRow>) => {
    setData(prev => {
      const rows = [...prev.evidence];
      rows[idx] = { ...rows[idx], ...patch };
      return { ...prev, evidence: rows };
    });
  }, []);

  const removeEvidence = useCallback((idx: number) => {
    setData(prev => ({ ...prev, evidence: prev.evidence.filter((_, i) => i !== idx) }));
  }, []);

  const addGap = useCallback(() => {
    setData(prev => ({
      ...prev,
      gaps: [...prev.gaps, { gap_question: "", impact: "Medium" as GapImpact, owner: "", required_by: "", status: "Open" as GapStatus }],
    }));
  }, []);

  const updateGap = useCallback((idx: number, patch: Partial<GapRow>) => {
    setData(prev => {
      const rows = [...prev.gaps];
      rows[idx] = { ...rows[idx], ...patch };
      return { ...prev, gaps: rows };
    });
  }, []);

  const removeGap = useCallback((idx: number) => {
    setData(prev => ({ ...prev, gaps: prev.gaps.filter((_, i) => i !== idx) }));
  }, []);

  const updateRecommendation = useCallback((patch: Partial<Recommendation>) => {
    setData(prev => ({ ...prev, recommendation: { ...prev.recommendation, ...patch } }));
  }, []);

  // ── Scorecard ─────────────────────────────────────────────
  const scorecard = useMemo(() => {
    const scores = data.dimensions.map(d => assessmentScore(d.assessment));
    const total = scores.reduce((a, b) => a + b, 0);
    const allNotAssessed = data.dimensions.every(d => d.assessment === "Not Assessed");
    const status = fitStatusLabel(total, allNotAssessed);
    return { scores, total, maxScore: 24, status };
  }, [data.dimensions]);

  // ── Save ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const result = await updateTenderCustomerFitData(tenderId, data);
      if (result.success) {
        toast.success("Customer Fit Qualification saved.");
        setInitial(JSON.stringify(data));
      } else {
        toast.error(result.error || "Save failed.");
      }
    } catch (e: any) {
      toast.error(e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [tenderId, data]);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="pb-2 border-b border-border bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-indigo-600" />
            Customer Fit Qualification
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[9px] ${fitStatusColor(scorecard.status)}`}>
              {scorecard.status === "Not Assessed" ? "Not Assessed" : `${scorecard.total}/24 — ${scorecard.status}`}
            </Badge>
            {dirty && <Badge variant="outline" className="text-[9px] border-amber-300 bg-amber-50 text-amber-700">Unsaved</Badge>}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Evidence-backed qualification capture used to assess whether this tender fits Hala's strategy, capability, region, customer relationship, and commercial priorities.
        </p>
      </CardHeader>
      <CardContent className="p-4 space-y-4">

        {/* ── 1. Customer Snapshot ──────────────────────────── */}
        <SectionHeader title="Customer Snapshot" icon={<Building2 className="w-3.5 h-3.5 text-indigo-600" />} open={openSections.snapshot} onToggle={() => toggle("snapshot")} />
        {openSections.snapshot && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {([
              { key: "customer_name" as const, label: "Customer Name", readonlyVal: t.customerName },
              { key: "source" as const, label: "Source", readonlyVal: t.source },
              { key: "region" as const, label: "Region", readonlyVal: t.region },
              { key: "owner" as const, label: "Owner", readonlyVal: t.assignedOwner },
              { key: "estimated_value" as const, label: "Estimated Value", readonlyVal: t.estimatedValue ? `SAR ${t.estimatedValue.toLocaleString()}` : "" },
              { key: "win_probability" as const, label: "Win Probability", readonlyVal: t.probabilityPercent ? `${t.probabilityPercent}%` : "" },
              { key: "crm_reference" as const, label: "CRM Reference" },
              { key: "existing_customer_status" as const, label: "Existing Customer Status" },
              { key: "linked_opportunity" as const, label: "Linked Opportunity" },
            ] as const).map(f => (
              <div key={f.key} className="space-y-0.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</label>
                {"readonlyVal" in f ? (
                  <p className="text-xs font-medium px-2 py-1.5 rounded bg-muted/30 border border-transparent">
                    {f.readonlyVal || "Not captured"}
                  </p>
                ) : (
                  <input
                    className="w-full text-xs border border-border rounded px-2 py-1.5 bg-card focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    value={data.customer_snapshot[f.key]}
                    onChange={e => updateSnapshot(f.key, e.target.value)}
                    placeholder="Not captured"
                  />
                )}
              </div>
            ))}
            <div className="col-span-full space-y-0.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</label>
              <textarea
                className="w-full text-xs border border-border rounded px-2 py-1.5 bg-card focus:outline-none focus:ring-1 focus:ring-indigo-300 min-h-[48px]"
                rows={2}
                value={data.customer_snapshot.notes}
                onChange={e => updateSnapshot("notes", e.target.value)}
                placeholder=""
              />
            </div>
          </div>
        )}

        {/* ── 2. Fit Dimensions ─────────────────────────────── */}
        <SectionHeader title="Fit Dimensions" icon={<Target className="w-3.5 h-3.5 text-indigo-600" />} open={openSections.dimensions} onToggle={() => toggle("dimensions")}
          badge={`${data.dimensions.filter(d => d.assessment !== "Not Assessed").length}/${data.dimensions.length} assessed`}
        />
        {openSections.dimensions && (
          <div className="space-y-3">
            {data.dimensions.map((dim, idx) => {
              const opts = dimensionOptions(dim.dimension);
              return (
                <div key={dim.dimension} className="border border-border rounded-lg p-3 bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-slate-400">{dimensionIcon(dim.dimension)}</span>
                    <span className="text-xs font-semibold flex-1">{dim.dimension}</span>
                    <select
                      className="text-[10px] border border-border rounded px-1.5 py-0.5 bg-card"
                      value={dim.assessment}
                      onChange={e => updateDimension(idx, { assessment: e.target.value as Assessment })}
                    >
                      {ASSESSMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <Badge variant="outline" className={`text-[8px] ${assessmentColor(dim.assessment)}`}>
                      {dim.assessment}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">{dim.question}</p>

                  {/* Multi-select chips for dimensions that have options */}
                  {opts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {opts.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                            dim.selected_values.includes(opt)
                              ? "bg-indigo-100 border-indigo-300 text-indigo-700 font-medium"
                              : "bg-card border-border text-muted-foreground hover:bg-muted/30"
                          }`}
                          onClick={() => toggleDimValue(idx, opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Commercial Attractiveness extra fields */}
                  {dim.dimension === "Commercial Attractiveness" && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                      <div>
                        <label className="text-[9px] text-muted-foreground">Est. Contract Value</label>
                        <input className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card" value={dim.selected_values[0] || ""} onChange={e => {
                          const vals = [...dim.selected_values];
                          vals[0] = e.target.value;
                          updateDimension(idx, { selected_values: vals });
                        }} placeholder="" />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted-foreground">Target GP %</label>
                        <input className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card" value={dim.selected_values[1] || ""} onChange={e => {
                          const vals = [...dim.selected_values];
                          vals[1] = e.target.value;
                          updateDimension(idx, { selected_values: vals });
                        }} placeholder="" />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted-foreground">Pricing Complexity</label>
                        <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card" value={dim.selected_values[2] || ""} onChange={e => {
                          const vals = [...dim.selected_values];
                          vals[2] = e.target.value;
                          updateDimension(idx, { selected_values: vals });
                        }}>
                          <option value="">Select...</option>
                          {COMPLEXITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-muted-foreground">Resource Effort</label>
                        <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card" value={dim.selected_values[3] || ""} onChange={e => {
                          const vals = [...dim.selected_values];
                          vals[3] = e.target.value;
                          updateDimension(idx, { selected_values: vals });
                        }}>
                          <option value="">Select...</option>
                          {COMPLEXITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Payment / Contract extra fields */}
                  {dim.dimension === "Payment / Contract Confidence" && (
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {["Payment Terms Captured", "Contract Term Captured", "Penalties / LDs Captured"].map((lbl, i) => (
                        <div key={lbl}>
                          <label className="text-[9px] text-muted-foreground">{lbl}</label>
                          <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card" value={dim.selected_values[i] || ""} onChange={e => {
                            const vals = [...dim.selected_values];
                            vals[i] = e.target.value;
                            updateDimension(idx, { selected_values: vals });
                          }}>
                            <option value="">Select...</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                      ))}
                      <div>
                        <label className="text-[9px] text-muted-foreground">Risk Level</label>
                        <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card" value={dim.selected_values[3] || ""} onChange={e => {
                          const vals = [...dim.selected_values];
                          vals[3] = e.target.value;
                          updateDimension(idx, { selected_values: vals });
                        }}>
                          <option value="">Select...</option>
                          {COMPLEXITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Operational Capability guidance sub-labels */}
                  {dim.dimension === "Operational Capability Fit" && (
                    <p className="text-[9px] text-muted-foreground/70 mb-2 italic">
                      Capture evidence for: facility capability · fleet capability · manpower capability · WMS/TMS/system capability · HSE/compliance capability
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-muted-foreground">Evidence / Source</label>
                      <textarea className="w-full text-[10px] border border-border rounded px-2 py-1 bg-card min-h-[32px]" rows={1} value={dim.evidence} onChange={e => updateDimension(idx, { evidence: e.target.value })} placeholder="" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground">Gap / Concern</label>
                      <textarea className="w-full text-[10px] border border-border rounded px-2 py-1 bg-card min-h-[32px]" rows={1} value={dim.gap_or_concern} onChange={e => updateDimension(idx, { gap_or_concern: e.target.value })} placeholder="" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <label className="text-[9px] text-muted-foreground">Owner</label>
                      <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card" value={dim.owner} onChange={e => updateDimension(idx, { owner: e.target.value })} placeholder="" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground">Status</label>
                      <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card" value={dim.status} onChange={e => updateDimension(idx, { status: e.target.value as DimensionStatus })}>
                        {DIMENSION_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 3. Qualification Scorecard ────────────────────── */}
        <SectionHeader title="Qualification Scorecard" icon={<ClipboardCheck className="w-3.5 h-3.5 text-indigo-600" />} open={openSections.scorecard} onToggle={() => toggle("scorecard")}
          badge={scorecard.status === "Not Assessed" ? "Not Assessed" : `${scorecard.total}/${scorecard.maxScore}`}
        />
        {openSections.scorecard && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/10 border-b border-border">
                  <th className="text-left p-2 font-semibold text-muted-foreground">Dimension</th>
                  <th className="text-center p-2 font-semibold text-muted-foreground w-20">Score</th>
                  <th className="text-center p-2 font-semibold text-muted-foreground w-20">Assessment</th>
                </tr>
              </thead>
              <tbody>
                {data.dimensions.map((dim, idx) => (
                  <tr key={dim.dimension} className="border-b border-border/50">
                    <td className="p-2 font-medium">{dim.dimension}</td>
                    <td className="p-2 text-center font-mono">{scorecard.scores[idx]}</td>
                    <td className="p-2 text-center">
                      <Badge variant="outline" className={`text-[8px] ${assessmentColor(dim.assessment)}`}>
                        {dim.assessment}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/20 border-t border-border">
                  <td className="p-2 font-bold">Total</td>
                  <td className="p-2 text-center font-mono font-bold">{scorecard.total} / {scorecard.maxScore}</td>
                  <td className="p-2 text-center">
                    <Badge variant="outline" className={`text-[9px] font-semibold ${fitStatusColor(scorecard.status)}`}>
                      {scorecard.status}
                    </Badge>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ── 4. Evidence Register ──────────────────────────── */}
        <SectionHeader title="Evidence Register" icon={<FileText className="w-3.5 h-3.5 text-indigo-600" />} open={openSections.evidence} onToggle={() => toggle("evidence")}
          badge={data.evidence.length > 0 ? `${data.evidence.length} items` : undefined}
        />
        {openSections.evidence && (
          <div className="space-y-2">
            {data.evidence.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60 py-2 text-center">No evidence captured yet.</p>
            )}
            {data.evidence.map((row, idx) => (
              <div key={idx} className="border border-border rounded-lg p-2.5 bg-card relative">
                <button type="button" className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-red-500" onClick={() => removeEvidence(idx)}>
                  <X className="w-3 h-3" />
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] text-muted-foreground">Evidence Type</label>
                    <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card" value={row.evidence_type} onChange={e => updateEvidence(idx, { evidence_type: e.target.value })}>
                      <option value="">Select...</option>
                      {EVIDENCE_TYPE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Source</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card" value={row.source} onChange={e => updateEvidence(idx, { source: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Status</label>
                    <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card" value={row.status} onChange={e => updateEvidence(idx, { status: e.target.value as EvidenceStatus })}>
                      {EVIDENCE_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <label className="text-[9px] text-muted-foreground">Description</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card" value={row.description} onChange={e => updateEvidence(idx, { description: e.target.value })} placeholder="" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-muted-foreground">Attachment Ref</label>
                      <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card" value={row.attachment_ref} onChange={e => updateEvidence(idx, { attachment_ref: e.target.value })} placeholder="" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground">Owner</label>
                      <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card" value={row.owner} onChange={e => updateEvidence(idx, { owner: e.target.value })} placeholder="" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1" onClick={addEvidence}>
              <Plus className="w-3 h-3" /> Add Evidence
            </Button>
          </div>
        )}

        {/* ── 5. Fit Gaps / Clarifications ──────────────────── */}
        <SectionHeader title="Fit Gaps / Clarifications" icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-600" />} open={openSections.gaps} onToggle={() => toggle("gaps")}
          badge={data.gaps.length > 0 ? `${data.gaps.length} gaps` : undefined}
        />
        {openSections.gaps && (
          <div className="space-y-2">
            {data.gaps.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60 py-2 text-center">No gaps or clarifications captured yet.</p>
            )}
            {data.gaps.map((row, idx) => (
              <div key={idx} className="border border-border rounded-lg p-2.5 bg-card relative">
                <button type="button" className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-red-500" onClick={() => removeGap(idx)}>
                  <X className="w-3 h-3" />
                </button>
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <label className="text-[9px] text-muted-foreground">Gap / Question</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card" value={row.gap_question} onChange={e => updateGap(idx, { gap_question: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Impact</label>
                    <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card" value={row.impact} onChange={e => updateGap(idx, { impact: e.target.value as GapImpact })}>
                      {GAP_IMPACT_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Status</label>
                    <select className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-card" value={row.status} onChange={e => updateGap(idx, { status: e.target.value as GapStatus })}>
                      {GAP_STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <label className="text-[9px] text-muted-foreground">Owner</label>
                    <input className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card" value={row.owner} onChange={e => updateGap(idx, { owner: e.target.value })} placeholder="" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Required By</label>
                    <input type="date" className="w-full text-[10px] border border-border rounded px-2 py-0.5 bg-card" value={row.required_by} onChange={e => updateGap(idx, { required_by: e.target.value })} />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1" onClick={addGap}>
              <Plus className="w-3 h-3" /> Add Gap / Clarification
            </Button>
          </div>
        )}

        {/* ── 6. Qualification Recommendation ───────────────── */}
        <SectionHeader title="Qualification Recommendation" icon={<MessageSquare className="w-3.5 h-3.5 text-indigo-600" />} open={openSections.recommendation} onToggle={() => toggle("recommendation")} />
        {openSections.recommendation && (
          <div className="border border-border rounded-lg p-3 bg-card space-y-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recommended Qualification Outcome</label>
              <select
                className="w-full text-xs border border-border rounded px-2 py-1.5 bg-card mt-0.5"
                value={data.recommendation.outcome}
                onChange={e => updateRecommendation({ outcome: e.target.value as RecommendationOutcome })}
              >
                {RECOMMENDATION_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
              <p className="text-[9px] text-muted-foreground mt-0.5">Advisory only — does not move tender stage.</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reason for Recommendation</label>
              <textarea
                className="w-full text-xs border border-border rounded px-2 py-1.5 bg-card mt-0.5 min-h-[48px]"
                rows={2}
                value={data.recommendation.reason}
                onChange={e => updateRecommendation({ reason: e.target.value })}
                placeholder=""
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reviewer / Owner</label>
              <input
                className="w-full text-xs border border-border rounded px-2 py-1.5 bg-card mt-0.5"
                value={data.recommendation.reviewer}
                onChange={e => updateRecommendation({ reviewer: e.target.value })}
                placeholder=""
              />
            </div>
          </div>
        )}

        {/* ── 7. Save Button ───────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <Button size="sm" className="gap-1.5 h-9 text-xs px-5" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Customer Fit Qualification
          </Button>
          {dirty && <span className="text-[10px] text-amber-600">You have unsaved changes.</span>}
          {!dirty && data.dimensions.some(d => d.assessment !== "Not Assessed") && <span className="text-[10px] text-emerald-600">✓ Saved</span>}
        </div>

      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

function SectionHeader({ title, icon, open, onToggle, badge }: {
  title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; badge?: string;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 w-full text-left py-1.5 group"
      onClick={onToggle}
    >
      {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-semibold group-hover:text-foreground transition-colors">{title}</span>
      {badge && <Badge variant="outline" className="text-[8px] ml-auto">{badge}</Badge>}
    </button>
  );
}
