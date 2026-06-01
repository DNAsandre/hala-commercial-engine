import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  ChevronRight,
  FileText,
  Filter,
  Info,
  Plus,
  Search,
  Shield,
  Target,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-state";

// ============================================================
// TYPES
// ============================================================

interface V2Ticket {
  id: string;
  ticket_type: "proposal" | "tender";
  routing_decision: string | null;
  converted_at: string | null;
  customer_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  company: string;
  region: string;
  industry: string;
  revenue_potential: number;
  lead_owner: string;
  opportunity_type: string;
  estimated_gp_percent: number;
  source: string;
  notes: string;
  qualification_score: number;
  qualification_notes: string;
  missing_fields: string[];
  stage: string;
  stage_changed_at: string;
  customer_master_id: string | null;
  legacy_workspace_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface V2Proposal {
  id: string;
  v2_ticket_id: string;
  customer_name: string;
  stage: string;
  outcome: string | null;
  created_at: string;
}

interface V2Tender {
  id: string;
  v2_ticket_id: string;
  customer_name: string;
  tender_ref: string;
  stage: string;
  outcome: string | null;
  created_at: string;
}

// ============================================================
// STAGES
// ============================================================

const TICKET_STAGES = [
  { key: "lead_generation", label: "Lead Generation", color: "slate" },
  { key: "prospecting", label: "Prospecting", color: "blue" },
  { key: "research", label: "Research", color: "indigo" },
  { key: "qualification", label: "Qualification", color: "amber" },
  { key: "qualified", label: "Qualified", color: "emerald" },
  { key: "route_decision", label: "Route Decision", color: "violet" },
];

const STAGE_COLORS: Record<string, string> = {
  lead_generation: "bg-slate-100 text-slate-700 border-slate-200",
  prospecting: "bg-blue-50 text-blue-700 border-blue-200",
  research: "bg-indigo-50 text-indigo-700 border-indigo-200",
  qualification: "bg-amber-50 text-amber-700 border-amber-200",
  qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  route_decision: "bg-violet-100 text-violet-700 border-violet-200",
  proposal: "bg-violet-50 text-violet-700 border-violet-200",
  tender: "bg-orange-50 text-orange-700 border-orange-200",
  lost: "bg-red-50 text-red-700 border-red-200",
};

const INDUSTRIES = ["Chemical", "Mining", "Agriculture", "Food & Beverage", "Automotive", "Construction", "Retail", "Healthcare", "Other"];
const REGIONS = ["East", "West", "Central", "North", "South"];

// ============================================================
// HELPERS
// ============================================================

function fmt(v: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v || 0);
}

function stageLabel(stage: string) {
  return TICKET_STAGES.find(s => s.key === stage)?.label || stage;
}

function qualScoreColor(score: number) {
  if (score >= 70) return "text-emerald-700 bg-emerald-50";
  if (score >= 40) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}

// ============================================================
// RPC WRAPPERS
// ============================================================

async function rpcCreateTicket(params: Record<string, unknown>) {
  const { data, error } = await supabase.rpc("commercial_v2_create_ticket", { params: JSON.stringify(params) });
  if (error) throw error;
  return data;
}

async function rpcUpdateStage(ticketId: string, newStage: string, userName: string, skip = false, notes = "") {
  const { data, error } = await supabase.rpc("commercial_v2_update_ticket_stage", {
    p_ticket_id: ticketId,
    p_new_stage: newStage,
    p_user_name: userName,
    p_skip: skip,
    p_notes: notes,
  });
  if (error) throw error;
  return data;
}

async function rpcConvertToProposal(ticketId: string, leadOwner: string) {
  const { data, error } = await supabase.rpc("commercial_v2_convert_to_proposal", {
    p_ticket_id: ticketId,
    p_lead_owner: leadOwner,
  });
  if (error) throw error;
  return data;
}

async function rpcConvertToTender(ticketId: string, tenderRef: string, leadOwner: string) {
  const { data, error } = await supabase.rpc("commercial_v2_convert_to_tender", {
    p_ticket_id: ticketId,
    p_tender_ref: tenderRef,
    p_tender_ws_id: null,
    p_lead_owner: leadOwner,
  });
  if (error) throw error;
  return data;
}

async function rpcUpdateQualification(ticketId: string, score: number, notes: string, missing: string[]) {
  const { data, error } = await supabase.rpc("commercial_v2_update_ticket_qualification", {
    p_ticket_id: ticketId,
    p_score: score,
    p_notes: notes,
    p_missing_fields: missing,
  });
  if (error) throw error;
  return data;
}

// ============================================================
// CREATE LEAD FORM
// ============================================================

interface CreateLeadFormData {
  customer_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  company: string;
  region: string;
  industry: string;
  revenue_potential: string;
  lead_owner: string;
  ticket_type: "proposal" | "tender";
  opportunity_type: string;
  estimated_gp_percent: string;
  source: string;
  notes: string;
}

function CreateLeadDialog({ onCreated }: { onCreated: () => void }) {
  const user = getCurrentUser();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateLeadFormData>({
    customer_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    company: "",
    region: "",
    industry: "",
    revenue_potential: "",
    lead_owner: user?.name || "",
    ticket_type: "proposal",
    opportunity_type: "",
    estimated_gp_percent: "",
    source: "",
    notes: "",
  });

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!form.customer_name.trim()) m.push("customer_name");
    if (!form.contact_email.trim()) m.push("contact_email");
    if (!form.region.trim()) m.push("region");
    if (!form.industry.trim()) m.push("industry");
    if (!form.revenue_potential.trim()) m.push("revenue_potential");
    return m;
  }, [form]);

  const score = useMemo(() => {
    const total = 6; // customer + email + region + industry + revenue + owner
    const present = total - missing.length;
    return Math.round((present / total) * 100);
  }, [missing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const params = {
        ...form,
        revenue_potential: parseFloat(form.revenue_potential) || 0,
        estimated_gp_percent: parseFloat(form.estimated_gp_percent) || 0,
        missing_fields: missing,
        qualification_score: score,
        qualification_notes: missing.length > 0 ? `Missing: ${missing.join(", ")}` : "Complete",
      };
      await rpcCreateTicket(params);
      setOpen(false);
      setForm({
        customer_name: "", contact_name: "", contact_email: "", contact_phone: "",
        company: "", region: "", industry: "", revenue_potential: "",
        lead_owner: user?.name || "", ticket_type: "proposal",
        opportunity_type: "", estimated_gp_percent: "", source: "", notes: "",
      });
      onCreated();
    } catch (err) {
      console.error("[PipelineV2] Failed to create lead:", err);
    } finally {
      setSubmitting(false);
    }
  }

  function updateField(key: keyof CreateLeadFormData, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Lead</DialogTitle>
          <DialogDescription>Enter lead details. Missing fields are non-blocking — you can proceed anyway.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Name */}
          <div className="space-y-1.5">
            <Label htmlFor="customer_name">Customer Name *</Label>
            <Input
              id="customer_name"
              value={form.customer_name}
              onChange={e => updateField("customer_name", e.target.value)}
              placeholder="e.g. SABIC, Ma'aden, Almarai"
              required
            />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input id="contact_name" value={form.contact_name} onChange={e => updateField("contact_name", e.target.value)} placeholder="Primary contact" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact_email">Contact Email *</Label>
              <Input id="contact_email" type="email" value={form.contact_email} onChange={e => updateField("contact_email", e.target.value)} placeholder="name@company.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact_phone">Phone</Label>
              <Input id="contact_phone" value={form.contact_phone} onChange={e => updateField("contact_phone", e.target.value)} placeholder="+966 ..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input id="company" value={form.company} onChange={e => updateField("company", e.target.value)} placeholder="Legal entity" />
            </div>
          </div>

          {/* Region + Industry */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="region">Region *</Label>
              <Select value={form.region} onValueChange={v => updateField("region", v)}>
                <SelectTrigger id="region"><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent>
                  {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry *</Label>
              <Select value={form.industry} onValueChange={v => updateField("industry", v)}>
                <SelectTrigger id="industry"><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Revenue + Owner */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="revenue_potential">Revenue Potential (SAR) *</Label>
              <Input id="revenue_potential" type="number" value={form.revenue_potential} onChange={e => updateField("revenue_potential", e.target.value)} placeholder="5000000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead_owner">Lead Owner *</Label>
              <Input id="lead_owner" value={form.lead_owner} onChange={e => updateField("lead_owner", e.target.value)} placeholder="Your name" />
            </div>
          </div>

          {/* Ticket Type */}
          <div className="space-y-1.5">
            <Label>Path *</Label>
            <Select value={form.ticket_type} onValueChange={v => updateField("ticket_type", v as "proposal" | "tender")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proposal">Proposal Path</SelectItem>
                <SelectItem value="tender">Tender Path</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Opportunity Type + Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Opportunity Type</Label>
              <Select value={form.opportunity_type} onValueChange={v => updateField("opportunity_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_business">New Business</SelectItem>
                  <SelectItem value="renewal">Renewal</SelectItem>
                  <SelectItem value="expansion">Expansion</SelectItem>
                  <SelectItem value="cross_sell">Cross-sell</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => updateField("source", v)}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="cold_call">Cold Call</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="tender_portal">Tender Portal</SelectItem>
                  <SelectItem value="existing_account">Existing Account</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Estimated GP% */}
          <div className="space-y-1.5">
            <Label>Estimated GP %</Label>
            <Input type="number" value={form.estimated_gp_percent} onChange={e => updateField("estimated_gp_percent", e.target.value)} placeholder="e.g. 25" />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => updateField("notes", e.target.value)} rows={2} placeholder="Any additional context..." />
          </div>

          {/* Qualification Score */}
          <div className={`rounded border px-3 py-2 text-xs flex items-center gap-2 ${qualScoreColor(score)}`}>
            <Target className="h-3.5 w-3.5" />
            <span>Qualification score: <strong>{score}%</strong></span>
            {missing.length > 0 && (
              <span>— Missing: {missing.join(", ")}</span>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || !form.customer_name || !form.lead_owner}>
              {submitting ? "Creating..." : "Create Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// CONVERT DIALOG
// ============================================================

function ConvertDialog({ ticket, onConverted }: { ticket: V2Ticket; onConverted: () => void }) {
  const user = getCurrentUser();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tenderRef, setTenderRef] = useState("");

  async function handleConvert(path: "proposal" | "tender") {
    setSubmitting(true);
    try {
      if (path === "proposal") {
        await rpcConvertToProposal(ticket.id, user?.name || "system");
      } else {
        await rpcConvertToTender(ticket.id, tenderRef, user?.name || "system");
      }
      setOpen(false);
      onConverted();
    } catch (err) {
      console.error("[PipelineV2] Conversion failed:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <ArrowRightLeft className="h-3.5 w-3.5" /> Convert
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Route Lead</DialogTitle>
          <DialogDescription>
            Route <strong>{ticket.customer_name}</strong> to Proposal V.2 or Tender V.2.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Button
            className="w-full justify-start gap-2"
            variant="outline"
            onClick={() => handleConvert("proposal")}
            disabled={submitting}
          >
            <ArrowRight className="h-4 w-4 text-violet-600" />
            Route to Proposal V.2
          </Button>
          <div className="flex gap-2">
            <Input
              placeholder="Tender reference (e.g. tn-linde-001)"
              value={tenderRef}
              onChange={e => setTenderRef(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={() => handleConvert("tender")}
              disabled={submitting || !tenderRef.trim()}
            >
              Route to Tender V.2
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// STAGE MOVE DIALOG
// ============================================================

function StageMoveDialog({ ticket, onMoved }: { ticket: V2Ticket; onMoved: () => void }) {
  const user = getCurrentUser();
  const [open, setOpen] = useState(false);
  const [newStage, setNewStage] = useState("");
  const [notes, setNotes] = useState("");
  const [skip, setSkip] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentIdx = TICKET_STAGES.findIndex(s => s.key === ticket.stage);

  async function handleMove() {
    if (!newStage) return;
    setSubmitting(true);
    try {
      await rpcUpdateStage(ticket.id, newStage, user?.name || "system", skip, notes);
      setOpen(false);
      setNewStage("");
      setNotes("");
      setSkip(false);
      onMoved();
    } catch (err) {
      console.error("[PipelineV2] Stage move failed:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" /> Move
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Stage</DialogTitle>
          <DialogDescription>
            Moving <strong>{ticket.customer_name}</strong> from <strong>{stageLabel(ticket.stage)}</strong>.
            Skip is allowed — it logs the skip in the activity timeline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-1">
            {TICKET_STAGES.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setNewStage(s.key)}
                className={`rounded border px-2 py-1.5 text-[10px] font-medium transition-colors ${newStage === s.key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : i <= currentIdx
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                  }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="skip-flag" checked={skip} onChange={e => setSkip(e.target.checked)} className="accent-indigo-600" />
            <Label htmlFor="skip-flag" className="text-xs">Skip stage (log as skipped)</Label>
          </div>
          <Textarea
            placeholder="Optional notes..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleMove} disabled={!newStage || submitting}>
              {submitting ? "Moving..." : "Move Stage"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// QUALIFICATION EDITOR
// ============================================================

function QualificationDialog({ ticket, onSaved }: { ticket: V2Ticket; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(ticket.qualification_score);
  const [notes, setNotes] = useState(ticket.qualification_notes);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitting(true);
    try {
      const missing: string[] = [];
      if (!ticket.customer_name.trim()) missing.push("customer_name");
      if (!ticket.contact_email.trim()) missing.push("contact_email");
      if (!ticket.region.trim()) missing.push("region");
      if (!ticket.industry.trim()) missing.push("industry");
      if (score < 70) missing.push("qualification_score_low");

      await rpcUpdateQualification(ticket.id, score, notes, missing);
      setOpen(false);
      onSaved();
    } catch (err) {
      console.error("[PipelineV2] Qualification update failed:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5">
          <Target className="h-3.5 w-3.5" /> Edit Score
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Qualification — {ticket.customer_name}</DialogTitle>
          <DialogDescription>Update qualification score and notes. Low scores trigger warnings but do not block progression.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Score: {score}/100</Label>
            <input
              type="range"
              min="0"
              max="100"
              value={score}
              onChange={e => setScore(parseInt(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0 — Not ready</span>
              <span>50 — Partial</span>
              <span>100 — Fully qualified</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Qualification Notes</Label>
            <Textarea
              placeholder="Notes on lead quality, gaps, next steps..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          {score < 40 && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
              Low qualification score — consider whether this lead should continue.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// TICKET ROW
// ============================================================

function TicketRow({ ticket, onRefresh }: { ticket: V2Ticket; onRefresh: () => void }) {
  const [, navigate] = useLocation();
  const isConverted = ticket.routing_decision !== null;
  const colorCls = STAGE_COLORS[ticket.stage] || STAGE_COLORS.lead_generation;

  return (
    <tr className={`border-b last:border-0 ${isConverted ? "opacity-60" : ""}`}>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] ${colorCls}`}>
            {stageLabel(ticket.stage)}
          </Badge>
          {isConverted && (
            <Badge variant="outline" className="text-[10px] border-violet-200 bg-violet-50 text-violet-600">
              {ticket.routing_decision === "proposal" ? "→ Proposal" : ticket.routing_decision === "tender" ? "→ Tender" : "Lost"}
            </Badge>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div>
          <span className="font-medium text-sm">{ticket.customer_name || "--"}</span>
          {ticket.company && ticket.company !== ticket.customer_name && (
            <p className="text-[10px] text-muted-foreground">{ticket.company}</p>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{ticket.contact_name || "--"}</td>
      <td className="px-3 py-2.5 text-xs">{ticket.region || "--"}</td>
      <td className="px-3 py-2.5 text-xs">{ticket.industry || "--"}</td>
      <td className="px-3 py-2.5 font-mono text-xs">{fmt(ticket.revenue_potential)} SAR</td>
      <td className="px-3 py-2.5">
        <div className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${qualScoreColor(ticket.qualification_score)}`}>
          <Target className="h-3 w-3" />{ticket.qualification_score}%
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{ticket.lead_owner || "--"}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          {!isConverted && (
            <>
              <StageMoveDialog ticket={ticket} onMoved={onRefresh} />
              <QualificationDialog ticket={ticket} onSaved={onRefresh} />
              <ConvertDialog ticket={ticket} onConverted={onRefresh} />
            </>
          )}
          {ticket.routing_decision === "proposal" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[10px] text-violet-700"
              onClick={() => navigate("/commercial-v2/proposals")}
            >
              View Proposal →
            </Button>
          )}
          {ticket.routing_decision === "tender" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[10px] text-orange-700"
              onClick={() => navigate("/commercial-v2/tenders")}
            >
              View Tender →
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ============================================================
// PIPELINE V.2 PAGE
// ===========================================================

export default function PipelineV2() {
  const [tickets, setTickets] = useState<V2Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase
        .from("commercial_v2_tickets")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (err) throw err;
      setTickets(data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [refreshKey]);

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      const matchSearch = !search ||
        t.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        t.contact_name.toLowerCase().includes(search.toLowerCase()) ||
        t.lead_owner.toLowerCase().includes(search.toLowerCase()) ||
        t.region.toLowerCase().includes(search.toLowerCase());
      const matchStage = stageFilter === "all" || t.stage === stageFilter;
      const matchType = typeFilter === "all" || t.ticket_type === typeFilter;
      return matchSearch && matchStage && matchType;
    });
  }, [tickets, search, stageFilter, typeFilter]);

  const stats = useMemo(() => ({
    total: tickets.length,
    leadGen: tickets.filter(t => t.stage === "lead_generation").length,
    prospecting: tickets.filter(t => t.stage === "prospecting").length,
    research: tickets.filter(t => t.stage === "research").length,
    qualification: tickets.filter(t => t.stage === "qualification").length,
    qualified: tickets.filter(t => t.stage === "qualified").length,
    converted: tickets.filter(t => t.routing_decision !== null).length,
    lowScore: tickets.filter(t => t.qualification_score < 40).length,
  }), [tickets]);

  function handleRefresh() { setRefreshKey(k => k + 1); }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-screen-xl px-6 py-6">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-semibold">Pipeline V.2</h1>
                <p className="text-xs text-muted-foreground">Master intake — route to Proposal or Tender</p>
              </div>
              <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px]">BETA</Badge>
            </div>
            <CreateLeadDialog onCreated={handleRefresh} />
          </div>

          {/* Doctrine Banner */}
          <div className="mb-4 rounded border border-amber-100 bg-amber-50/50 px-4 py-2.5 flex flex-wrap gap-4 items-center">
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-amber-800">
              <Shield className="h-3 w-3" /> Read-only pipeline foundation
            </span>
            <span className="text-[10px] text-amber-700">• Soft workflow — no hard gates</span>
            <span className="text-[10px] text-amber-700">• Missing fields are warnings, not blockers</span>
            <span className="text-[10px] text-amber-700">• Override always available</span>
            <span className="ml-auto text-[10px] text-amber-600">Commercial V.2 — {stats.total} leads</span>
          </div>

          {/* Stats */}
          <div className="mb-4 grid grid-cols-7 gap-2">
            {[
              { label: "Total Leads", value: stats.total },
              { label: "Lead Gen", value: stats.leadGen },
              { label: "Prospecting", value: stats.prospecting },
              { label: "Research", value: stats.research },
              { label: "Qualification", value: stats.qualification },
              { label: "Qualified", value: stats.qualified },
              { label: "Converted", value: stats.converted },
            ].map(s => (
              <div key={s.label} className="rounded border bg-card px-3 py-2 text-center">
                <div className="text-base font-semibold">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Low score alert */}
          {stats.lowScore > 0 && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 flex items-center gap-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {stats.lowScore} lead{stats.lowScore > 1 ? "s" : ""} with qualification score below 40% — review before conversion
            </div>
          )}

          {/* Filters */}
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Search leads..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="rounded border bg-background px-2 py-1 text-xs"
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
            >
              <option value="all">All Stages</option>
              {TICKET_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select
              className="rounded border bg-background px-2 py-1 text-xs"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="all">All Paths</option>
              <option value="proposal">Proposal Path</option>
              <option value="tender">Tender Path</option>
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="py-12 text-center text-xs text-red-600">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mb-2 text-xs text-muted-foreground">No leads found</div>
              <CreateLeadDialog onCreated={handleRefresh} />
            </div>
          ) : (
            <div className="rounded border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2 font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">Stage</th>
                    <th className="px-3 py-2 font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">Customer</th>
                    <th className="px-3 py-2 font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">Contact</th>
                    <th className="px-3 py-2 font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">Region</th>
                    <th className="px-3 py-2 font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">Industry</th>
                    <th className="px-3 py-2 font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">Revenue</th>
                    <th className="px-3 py-2 font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">Score</th>
                    <th className="px-3 py-2 font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">Owner</th>
                    <th className="px-3 py-2 font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <TicketRow key={t.id} ticket={t} onRefresh={handleRefresh} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-4 text-[10px] text-muted-foreground flex flex-wrap gap-4">
            <span>• {stats.converted} leads routed to Proposal/Tender</span>
            <span>• {stats.total - stats.converted} in active pipeline</span>
            <span>• Stage progression: Lead Gen → Prospecting → Research → Qualification → Qualified → Route</span>
          </div>
        </div>
      </div>

      {/* Activity sidebar */}
      <ActivitySidebar />
    </div>
  );
}

// ============================================================
// ACTIVITY SIDEBAR
// ============================================================

interface ActivityEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  stage_from: string | null;
  stage_to: string | null;
  skipped: boolean;
  notes: string;
  user_name: string;
  created_at: string;
}

function ActivitySidebar() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    supabase
      .from("commercial_v2_activity")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setEntries(data || []));
  }, []);

  function actionLabel(a: string) {
    const map: Record<string, string> = {
      ticket_created: "Lead created",
      stage_moved: "Stage moved",
      stage_skipped: "Stage skipped",
      converted_to_proposal: "→ Proposal",
      converted_to_tender: "→ Tender",
      qualification_updated: "Score updated",
      outcome_set: "Outcome set",
      approval_overridden: "Approval overridden",
      document_uploaded: "Doc uploaded",
      note_added: "Note added",
    };
    return map[a] || a;
  }

  function entityLink(e: ActivityEntry) {
    if (e.entity_type === "ticket") {
      return `Ticket ${e.entity_id.slice(0, 8)}...`;
    }
    return `${e.entity_type} ${e.entity_id.slice(0, 8)}...`;
  }

  return (
    <div className="w-64 border-l overflow-y-auto bg-slate-50/30 hidden lg:block">
      <div className="px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recent Activity</p>
        <div className="space-y-2">
          {entries.length === 0 && (
            <p className="text-[10px] text-muted-foreground py-4 text-center">No activity yet</p>
          )}
          {entries.slice(0, 20).map(e => (
            <div key={e.id} className="rounded border bg-white px-2.5 py-2 text-[10px]">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="font-medium text-foreground">{actionLabel(e.action)}</span>
                <span className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="text-muted-foreground">{entityLink(e)} · {e.user_name || "system"}</div>
              {e.stage_from && e.stage_to && (
                <div className={`mt-0.5 ${e.skipped ? "text-amber-700" : "text-emerald-700"}`}>
                  {stageLabel(e.stage_from)} → {stageLabel(e.stage_to)}{e.skipped ? " (skipped)" : ""}
                </div>
              )}
              {e.notes && <div className="mt-0.5 text-muted-foreground line-clamp-2">{e.notes}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}