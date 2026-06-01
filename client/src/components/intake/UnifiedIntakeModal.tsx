/**
 * UnifiedIntakeModal — 4-Stage Commercial Ticket Intake
 *
 * Stage 1: Ticket Type + Basic Identity
 * Stage 2: Commercial Details + Timeline
 * Stage 3: Source / Lineage Metadata
 * Stage 4: Review + Submit
 *
 * Doctrine:
 *   - All fields nullable at DB level (except ticket_type)
 *   - Empty fields show "Not captured yet" — never fake defaults
 *   - Blank strings coerced to null in intake-save.ts
 *   - SLA requires customer_id + (parent_ticket_id OR standalone_reason)
 *   - lineage_status starts as "unverified" — always
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

import { createTicket } from "@/lib/intake-save";
import { fetchUsers } from "@/lib/supabase-data";
import {
  TICKET_TYPE_CONFIG,
  SOURCE_TYPE_CONFIG,
  displayValue,
  displayPercent,
  displayText,
} from "@/lib/unified-ticket-types";
import type {
  UnifiedTicketType,
  SourceType,
} from "@/lib/unified-ticket-types";

// ── Props ──────────────────────────────────────────────────────

interface UnifiedIntakeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill ticket type from entry point context */
  defaultType?: UnifiedTicketType;
  /** Pre-fill customer from entry point context */
  defaultCustomerId?: string;
  defaultCustomerName?: string;
  /** Callback after successful creation */
  onCreated?: (ticketId: string) => void;
}

// ── Form State ─────────────────────────────────────────────────

interface IntakeFormState {
  // Stage 1: Type + Identity
  ticket_type: UnifiedTicketType;
  ticket_title: string;
  customer_name: string;
  customer_id: string;
  contact_name: string;
  contact_email: string;
  company: string;
  owner: string;
  region: string;
  facility: string;

  // Stage 2: Commercial Details
  estimated_value: string;
  target_gp_percent: string;
  probability_percent: string;
  target_date: string;
  notes: string;

  // Stage 2b: SLA-specific
  sla_parent_ticket_id: string;
  sla_standalone_reason: string;
  sla_is_standalone: boolean;

  // Stage 3: Lineage
  source_type: SourceType | "";
  source_reference: string;
  source_file: string;
  source_sheet: string;
}

const INITIAL_STATE: IntakeFormState = {
  ticket_type: "proposal",
  ticket_title: "",
  customer_name: "",
  customer_id: "",
  contact_name: "",
  contact_email: "",
  company: "",
  owner: "",
  region: "",
  facility: "",
  estimated_value: "",
  target_gp_percent: "",
  probability_percent: "",
  target_date: "",
  notes: "",
  sla_parent_ticket_id: "",
  sla_standalone_reason: "",
  sla_is_standalone: false,
  source_type: "",
  source_reference: "",
  source_file: "",
  source_sheet: "",
};

const STAGES = [
  { label: "Type & Identity", step: 1 },
  { label: "Commercial Details", step: 2 },
  { label: "Source / Lineage", step: 3 },
  { label: "Review & Submit", step: 4 },
];

// ── Component ──────────────────────────────────────────────────

export default function UnifiedIntakeModal({
  open,
  onOpenChange,
  defaultType,
  defaultCustomerId,
  defaultCustomerName,
  onCreated,
}: UnifiedIntakeModalProps) {
  const [stage, setStage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<IntakeFormState>(() => ({
    ...INITIAL_STATE,
    ticket_type: defaultType ?? "proposal",
    customer_id: defaultCustomerId ?? "",
    customer_name: defaultCustomerName ?? "",
  }));

  // Live data for dropdowns
  const [owners, setOwners] = useState<string[]>([]);
  const [customers, setCustomers] = useState<{id:string;name:string}[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [existingTickets, setExistingTickets] = useState<{id:string;title:string;type:string}[]>([]);

  const [facilities, setFacilities] = useState<{id:string;name:string}[]>([]);

  // Load owners from real system users, plus any owner already present on canonical tickets.
  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetchUsers(),
      supabase.from("commercial_tickets").select("owner").eq("active", true),
    ]).then(([userRows, ticketRes]) => {
      const all = [
        ...userRows.map(u => u.name),
        ...((ticketRes.data ?? []).map(r => r.owner)),
      ].filter(Boolean);
      setOwners([...new Set(all)].sort());
    });
    // Load customers
    supabase.from("customers").select("id,name").order("name").then(r => {
      if (r.data) setCustomers(r.data.map(c => ({ id: c.id, name: c.name })));
    });
    // Load existing tickets for SLA parent linking
    supabase.from("commercial_tickets").select("id,ticket_title,ticket_type")
      .eq("active", true).order("created_at", { ascending: false }).then(r => {
      if (r.data) setExistingTickets(r.data.map(t => ({
        id: t.id, title: t.ticket_title || `Untitled ${t.ticket_type}`, type: t.ticket_type,
      })));
    });
    // Load facilities from Supabase (real warehouse names)
    supabase.from("facilities").select("id,name").eq("active", true).order("sort_order").then(r => {
      if (r.data) setFacilities(r.data.map(f => ({ id: f.id, name: f.name })));
    });
  }, [open]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 10);
    const s = customerSearch.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(s)).slice(0, 10);
  }, [customers, customerSearch]);

  const set = useCallback(
    <K extends keyof IntakeFormState>(field: K, value: IntakeFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // ── Validation ───────────────────────────────────────────────

  function getStageErrors(s: number): string[] {
    const errors: string[] = [];
    if (s === 1) {
      // ticket_type always has a value
    }
    if (s === 2 && form.ticket_type === "sla") {
      if (!form.customer_id.trim() && !form.customer_name.trim()) {
        errors.push("SLA requires a customer");
      }
      if (!form.sla_is_standalone && !form.sla_parent_ticket_id.trim()) {
        errors.push("Link a parent ticket or mark as standalone");
      }
      if (form.sla_is_standalone && !form.sla_standalone_reason.trim()) {
        errors.push("Standalone SLA requires a reason");
      }
    }
    return errors;
  }

  function canProceed(s: number): boolean {
    return getStageErrors(s).length === 0;
  }

  // ── Parse Helpers ────────────────────────────────────────────

  function parseNumber(val: string): number | null {
    if (val.trim() === "") return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  }

  // ── Submit ───────────────────────────────────────────────────

  async function handleSubmit() {
    setSaving(true);
    try {
      const typeDetails: Record<string, unknown> = {};
      if (form.ticket_type === "sla") {
        if (form.sla_parent_ticket_id.trim()) {
          typeDetails.parent_ticket_id = form.sla_parent_ticket_id.trim();
        }
        if (form.sla_standalone_reason.trim()) {
          typeDetails.standalone_reason = form.sla_standalone_reason.trim();
        }
      }

      const result = await createTicket(
        {
          ticket_type: form.ticket_type,
          ticket_title: form.ticket_title || null,
          customer_name: form.customer_name || null,
          customer_id: form.customer_id || null,
          contact_name: form.contact_name || null,
          contact_email: form.contact_email || null,
          company: form.company || null,
          owner: form.owner || null,
          region: form.region || null,
          estimated_value: parseNumber(form.estimated_value),
          target_gp_percent: parseNumber(form.target_gp_percent),
          probability_percent: parseNumber(form.probability_percent),
          target_date: form.target_date || null,
          notes: form.notes || null,
          type_details: Object.keys(typeDetails).length > 0 ? typeDetails : undefined,
          source_type: (form.source_type as SourceType) || null,
          source_reference: form.source_reference || null,
          source_file: form.source_file || null,
          source_sheet: form.source_sheet || null,
        },
        "Unknown user"
      );

      if (result.error) {
        toast.error("Failed to create ticket", { description: result.error });
      } else {
        toast.success("Ticket created", {
          description: `${TICKET_TYPE_CONFIG[form.ticket_type].label} ticket saved — lineage: unverified`,
        });
        onCreated?.(result.data!.id);
        onOpenChange(false);
        setForm({ ...INITIAL_STATE, ticket_type: defaultType ?? "proposal" });
        setStage(1);
      }
    } catch (err: unknown) {
      toast.error("Unexpected error", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Reset on close ───────────────────────────────────────────

  function handleOpenChange(v: boolean) {
    if (!v) {
      setForm({ ...INITIAL_STATE, ticket_type: defaultType ?? "proposal" });
      setStage(1);
    }
    onOpenChange(v);
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">New Commercial Ticket</span>
            <Badge variant="outline" className="text-xs font-mono">
              {TICKET_TYPE_CONFIG[form.ticket_type]?.icon}{" "}
              {TICKET_TYPE_CONFIG[form.ticket_type]?.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            All new tickets enter as <strong>unverified</strong>. Lineage must be confirmed
            before they appear in operational views.
          </DialogDescription>
        </DialogHeader>

        {/* ── Clickable Progress Strip ───────────────────────── */}
        <div className="flex items-center gap-1 mb-4">
          {STAGES.map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => canProceed(stage) || s.step < stage ? setStage(s.step) : null}
              className={`flex-1 h-2 rounded-full transition-colors cursor-pointer hover:opacity-80 ${
                s.step <= stage ? "bg-[#1B2A4A]" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mb-4">
          {STAGES.map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => canProceed(stage) || s.step < stage ? setStage(s.step) : null}
              className={`cursor-pointer hover:text-foreground transition-colors ${
                s.step === stage ? "text-foreground font-medium" : ""
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Stage 1: Type + Identity ────────────────────────── */}
        {stage === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Ticket Type *</Label>
              <Select
                value={form.ticket_type}
                onValueChange={(v) => set("ticket_type", v as UnifiedTicketType)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TICKET_TYPE_CONFIG) as UnifiedTicketType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TICKET_TYPE_CONFIG[t].icon} {TICKET_TYPE_CONFIG[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ticket Title</Label>
              <Input
                placeholder="e.g. SABIC Jubail Warehousing"
                value={form.ticket_title}
                onChange={(e) => set("ticket_title", e.target.value)}
              />
            </div>

            {/* Customer search with typeahead */}
            <div>
              <Label>Customer</Label>
              <div className="relative">
                <Input
                  placeholder="Type to search existing customers..."
                  value={customerSearch || form.customer_name}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    set("customer_name", e.target.value);
                    set("customer_id", "");
                  }}
                />
                {customerSearch.trim() && filteredCustomers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b last:border-0"
                        onClick={() => {
                          set("customer_name", c.name);
                          set("customer_id", c.id);
                          setCustomerSearch("");
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {form.customer_id && (
                <p className="text-[10px] text-emerald-600 mt-1">✓ Linked: {form.customer_id}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contact Name</Label>
                <Input
                  placeholder="Leave blank if unknown"
                  value={form.contact_name}
                  onChange={(e) => set("contact_name", e.target.value)}
                />
              </div>
              <div>
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  placeholder="Leave blank if unknown"
                  value={form.contact_email}
                  onChange={(e) => set("contact_email", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Owner</Label>
                {owners.length > 0 ? (
                  <Select value={form.owner} onValueChange={(v) => set("owner", v)}>
                    <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                    <SelectContent>
                      {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Assigned person"
                    value={form.owner}
                    onChange={(e) => set("owner", e.target.value)}
                  />
                )}
              </div>
              <div>
                <Label>Region</Label>
                <Select value={form.region} onValueChange={(v) => set("region", v)}>
                  <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="East">East</SelectItem>
                    <SelectItem value="Central">Central</SelectItem>
                    <SelectItem value="West">West</SelectItem>
                    <SelectItem value="Global">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Facility</Label>
                <Select value={form.facility} onValueChange={(v) => set("facility", v)}>
                  <SelectTrigger><SelectValue placeholder="Select facility" /></SelectTrigger>
                  <SelectContent>
                    {facilities.map(f => <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>)}
                    {facilities.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No facilities loaded — run intake002 migration</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* ── Stage 2: Commercial Details ─────────────────────── */}
        {stage === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Estimated Value (SAR)</Label>
                <Input
                  type="number"
                  placeholder="Leave blank if unknown"
                  value={form.estimated_value}
                  onChange={(e) => set("estimated_value", e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Blank = unknown · 0 = confirmed zero
                </p>
              </div>
              <div>
                <Label>Target GP %</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Blank = unknown"
                  value={form.target_gp_percent}
                  onChange={(e) => set("target_gp_percent", e.target.value)}
                />
              </div>
              <div>
                <Label>Probability %</Label>
                <Input
                  type="number"
                  step="1"
                  placeholder="Blank = unknown"
                  value={form.probability_percent}
                  onChange={(e) => set("probability_percent", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Target Date</Label>
              <Input
                type="date"
                value={form.target_date}
                onChange={(e) => set("target_date", e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Deadline, go-live, or expiry — depending on ticket type
              </p>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Any relevant context, instructions, or constraints"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
              />
            </div>

            {/* SLA-specific fields */}
            {form.ticket_type === "sla" && (
              <div className="border border-teal-200 bg-teal-50/50 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-teal-800">SLA Guardrails</p>

                {/* Toggle: linked vs standalone */}
                <div className="flex gap-2">
                  <Button
                    type="button" size="sm" variant={!form.sla_is_standalone ? "default" : "outline"}
                    onClick={() => set("sla_is_standalone", false)}
                  >
                    Link to Parent Ticket
                  </Button>
                  <Button
                    type="button" size="sm" variant={form.sla_is_standalone ? "default" : "outline"}
                    onClick={() => { set("sla_is_standalone", true); set("sla_parent_ticket_id", ""); }}
                  >
                    Standalone SLA
                  </Button>
                </div>

                {!form.sla_is_standalone ? (
                  <div>
                    <Label>Parent Ticket</Label>
                    <Select value={form.sla_parent_ticket_id} onValueChange={(v) => set("sla_parent_ticket_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Select parent ticket" /></SelectTrigger>
                      <SelectContent>
                        {existingTickets.filter(t => t.type !== "sla").map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {TICKET_TYPE_CONFIG[t.type as UnifiedTicketType]?.icon} {t.title}
                          </SelectItem>
                        ))}
                        {existingTickets.filter(t => t.type !== "sla").length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">No tickets found — create one first</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label>Standalone Reason *</Label>
                    <Textarea
                      placeholder="Why is this SLA not linked to a proposal/tender/renewal?"
                      value={form.sla_standalone_reason}
                      onChange={(e) => set("sla_standalone_reason", e.target.value)}
                      rows={2}
                    />
                  </div>
                )}

                {getStageErrors(2).length > 0 && (
                  <div className="flex items-start gap-2 text-xs text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div>{getStageErrors(2).join(". ")}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Stage 3: Source / Lineage ───────────────────────── */}
        {stage === 3 && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                <strong>Lineage is mandatory.</strong> Tickets without verified source
                information are quarantined from operational views until reviewed.
              </p>
            </div>

            <div>
              <Label>Source Type</Label>
              <Select
                value={form.source_type}
                onValueChange={(v) => set("source_type", v as SourceType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="How did this ticket originate?" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_TYPE_CONFIG) as SourceType[]).map((st) => (
                    <SelectItem key={st} value={st}>
                      {SOURCE_TYPE_CONFIG[st].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Source Reference</Label>
              <Input
                placeholder="e.g. CRM deal ID, email thread ref, document number"
                value={form.source_reference}
                onChange={(e) => set("source_reference", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Source File</Label>
                <Input
                  placeholder="Filename if from import"
                  value={form.source_file}
                  onChange={(e) => set("source_file", e.target.value)}
                />
              </div>
              <div>
                <Label>Source Sheet / Link</Label>
                <Input
                  type="url"
                  placeholder="Paste Google Sheets / Excel Online URL"
                  value={form.source_sheet}
                  onChange={(e) => set("source_sheet", e.target.value)}
                />
                {form.source_sheet && form.source_sheet.startsWith("http") && (
                  <a
                    href={form.source_sheet}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline mt-1"
                  >
                    <ExternalLink className="h-3 w-3" /> Open sheet
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Stage 4: Review ─────────────────────────────────── */}
        {stage === 4 && (
          <div className="space-y-3">
            <div className="bg-slate-50 border rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="outline">
                  {TICKET_TYPE_CONFIG[form.ticket_type].icon}{" "}
                  {TICKET_TYPE_CONFIG[form.ticket_type].label}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Title</span>
                <span>{displayText(form.ticket_title || null)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span>{displayText(form.customer_name || null)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Owner</span>
                <span>{displayText(form.owner || null)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Region</span>
                <span>{displayText(form.region || null)}</span>
              </div>
              <hr />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Value</span>
                <span>{displayValue(parseNumber(form.estimated_value))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target GP%</span>
                <span>{displayPercent(parseNumber(form.target_gp_percent))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Probability</span>
                <span>{displayPercent(parseNumber(form.probability_percent))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Date</span>
                <span>{displayText(form.target_date || null)}</span>
              </div>
              <hr />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source Type</span>
                <span>
                  {form.source_type
                    ? SOURCE_TYPE_CONFIG[form.source_type as SourceType]?.label
                    : "Not captured yet"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference</span>
                <span>{displayText(form.source_reference || null)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs bg-gray-100 rounded-lg p-3">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>
                This ticket will be saved with lineage status{" "}
                <strong className="text-amber-700">UNVERIFIED</strong>. It will not
                appear in operational views until lineage is confirmed.
              </span>
            </div>
          </div>
        )}

        {/* ── Navigation ──────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStage(Math.max(1, stage - 1))}
            disabled={stage === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <div className="text-xs text-muted-foreground">
            Step {stage} of {STAGES.length}
          </div>

          {stage < 4 ? (
            <Button
              size="sm"
              onClick={() => setStage(Math.min(4, stage + 1))}
              disabled={!canProceed(stage)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={saving}
              className="bg-[#1B2A4A] hover:bg-[#1B2A4A]/90"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Create Ticket
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
