/**
 * TND-006: Tender Submission Gates Tab
 * Extracted component — mock gate engine with summary, filters, table, review modal, and mock evaluation.
 */
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Eye, CheckCircle2, XCircle, AlertTriangle, Clock, Play, Info, Zap, Database } from "lucide-react";
import { toast } from "sonner";
import { logMockBypass, updateGateStatus } from "@/lib/supabase-tender-actions";
import {
  type TenderMockGate,
  type TenderWorkspace,
  type MockGateStatus,
  getGateStatusLabel,
  getGateStatusColor,
  getGateSeverityColor,
  getGateCategoryLabel,
  getGateEnforcementLabel,
  getGateRuntimeLabel,
  getRiskLabel,
  GATE_CATEGORIES,
  GATE_SEVERITIES,
} from "@/lib/tender-workspace-data";

// ─── GATE REVIEW MODAL ──────────────────────────────────────

function GateReviewModal({ gate, onClose, onBypass }: { gate: TenderMockGate; onClose: () => void; onBypass: (id: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background rounded-xl border shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-serif font-bold">Gate Review (Mock)</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Development mock — no enforcement applied.</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><XCircle className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Gate Name</label>
            <p className="text-xs font-medium mt-1">{gate.gateName}</p>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
            <p className="text-xs mt-1 text-muted-foreground">{gate.gateDescription}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pack</label><p className="text-xs mt-1">{gate.tenderPackId ? gate.tenderPackId.replace("tp-linde-", "").toUpperCase() : "Workspace"}</p></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</label><p className="text-xs mt-1">{getGateCategoryLabel(gate.category)}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</label><div className="mt-1"><Badge variant="outline" className={`text-[9px] ${getGateStatusColor(gate.status)}`}>{getGateStatusLabel(gate.status)}</Badge></div></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Severity</label><div className="mt-1"><Badge variant="outline" className={`text-[9px] ${getGateSeverityColor(gate.severity)}`}>{getRiskLabel(gate.severity)}</Badge></div></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Enforcement</label><p className="text-xs mt-1">{getGateEnforcementLabel(gate.enforcementMode)}</p></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Runtime</label><p className="text-xs mt-1">{getGateRuntimeLabel(gate.runtimeMode)}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Doctrine Required</label><p className="text-xs mt-1">{gate.doctrineRequired ? "Yes" : "No"}</p></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Owner</label><p className="text-xs mt-1">{gate.ownerName || "—"}</p></div>
          </div>
          {gate.wouldBlockReason && (
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Would Block Reason</label><p className="text-xs mt-1 text-red-700">{gate.wouldBlockReason}</p></div>
          )}
          {gate.linkedSignal && (
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Linked Signal</label><p className="text-xs mt-1">{gate.linkedSignal}</p></div>
          )}
          {gate.notes && (
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</label><p className="text-xs mt-1 text-muted-foreground">{gate.notes}</p></div>
          )}
          {gate.wouldBlock && gate.status !== "pass" && gate.status !== "mock_bypassed" && (
            <div className="p-2.5 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30">
              <p className="text-xs text-red-800 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 shrink-0" />Would block production submission. Testing bypass available.</p>
            </div>
          )}
          <div className="p-2.5 rounded-md border border-blue-200 bg-blue-50/50">
            <p className="text-[10px] text-blue-700 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 shrink-0" />Mock gate only. Allow test bypass = {gate.allowTestBypass ? "Yes" : "No"}.</p>
          </div>
        </div>
        <div className="p-5 border-t flex items-center gap-2 justify-end flex-wrap">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { toast.info(`Mock evaluation: "${gate.gateName}" — no enforcement applied.`); onClose(); }}>
            <Play className="w-3.5 h-3.5 mr-1" /> Run Mock Evaluation
          </Button>
          {gate.wouldBlock && gate.status !== "pass" && gate.status !== "mock_bypassed" && (
            <Button variant="outline" size="sm" className="text-xs h-8 text-blue-700 border-blue-200" onClick={() => { onBypass(gate.id); onClose(); }}>
              <Zap className="w-3.5 h-3.5 mr-1" /> Continue for Testing
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

// ─── SUMMARY CARD ────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────

export default function TenderSubmissionGatesTab({ ws, tenderId, reload }: { ws: TenderWorkspace; tenderId: string; reload: () => void }) {
  const [packFilter, setPackFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [reviewGate, setReviewGate] = useState<TenderMockGate | null>(null);
  const [bypassed, setBypassed] = useState<Set<string>>(new Set());

  const gates = ws.mockGates;

  const effectiveStatus = (g: TenderMockGate): MockGateStatus => bypassed.has(g.id) ? "mock_bypassed" : g.status;

  // Counts
  const passCount = gates.filter(g => effectiveStatus(g) === "pass").length;
  const warningCount = gates.filter(g => effectiveStatus(g) === "warning").length;
  const wouldBlockCount = gates.filter(g => effectiveStatus(g) === "would_block").length;
  const bypassedCount = gates.filter(g => effectiveStatus(g) === "mock_bypassed").length;
  const criticalCount = gates.filter(g => g.severity === "critical").length;
  const bypassAvailable = gates.filter(g => g.allowTestBypass && effectiveStatus(g) !== "pass" && effectiveStatus(g) !== "mock_bypassed").length;

  const filtered = useMemo(() => {
    return gates.filter(g => {
      if (packFilter === "workspace" && g.tenderPackId !== null) return false;
      if (packFilter !== "all" && packFilter !== "workspace" && g.tenderPackId !== packFilter) return false;
      const es = effectiveStatus(g);
      if (statusFilter !== "all" && es !== statusFilter) return false;
      if (severityFilter !== "all" && g.severity !== severityFilter) return false;
      if (categoryFilter !== "all" && g.category !== categoryFilter) return false;
      return true;
    });
  }, [gates, packFilter, statusFilter, severityFilter, categoryFilter, bypassed]);

  const packOptions = useMemo(() => {
    const packs = ws.packs.map(p => ({ value: p.id, label: p.packName }));
    return [{ value: "all", label: "All Packs" }, { value: "workspace", label: "Workspace-level" }, ...packs];
  }, [ws.packs]);

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "pass", label: "Pass" },
    { value: "warning", label: "Warning" },
    { value: "would_block", label: "Would Block" },
    { value: "not_started", label: "Not Started" },
    { value: "mock_bypassed", label: "Mock Bypassed" },
    { value: "fail", label: "Fail" },
    { value: "not_applicable", label: "N/A" },
  ];

  async function handleBypass(id: string) {
    const gate = gates.find(g => g.id === id);
    const result = await logMockBypass(tenderId, id, gate?.gateName ?? id, 'Testing bypass activated');
    setBypassed(prev => new Set(prev).add(id));
    if (result.success) {
      toast.info("Mock bypass logged and persisted.", { description: "Continue for Testing activated." });
      reload();
    } else {
      toast.warning("Mock bypass logged locally. Supabase write failed.", { description: result.error });
    }
  }

  async function handleRunAll() {
    let successCount = 0;
    for (const gate of gates) {
      const newStatus = gate.wouldBlock ? 'would_block' : 'pass';
      if (gate.status !== newStatus) {
        const r = await updateGateStatus(tenderId, gate.id, gate.gateName, gate.status, newStatus, 'Bulk mock evaluation');
        if (r.success) successCount++;
      } else {
        successCount++;
      }
    }
    toast.info(`Mock evaluation complete. ${wouldBlockCount} gate(s) would block production.`, { description: `${successCount}/${gates.length} gates evaluated and persisted.` });
    reload();
  }

  if (gates.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No submission gates configured yet.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Dev banner */}
      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">Development mode: submission gates are mock controls only. They show what would block production submission, but they do not block testing.</p>
        </div>
        <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50 flex items-center gap-1 shrink-0"><Database className="w-2.5 h-2.5" />Supabase-Backed</Badge>
      </div>

      {/* Summary + Run button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="grid grid-cols-4 md:grid-cols-7 gap-2 flex-1">
          <SummaryCard label="Total Gates" value={gates.length} color="text-foreground" />
          <SummaryCard label="Pass" value={passCount} color="text-emerald-600" />
          <SummaryCard label="Warnings" value={warningCount} color="text-amber-600" />
          <SummaryCard label="Would Block" value={wouldBlockCount} color="text-red-600" />
          <SummaryCard label="Bypassed" value={bypassedCount} color="text-blue-600" />
          <SummaryCard label="Critical" value={criticalCount} color="text-red-600" />
          <SummaryCard label="Bypass Avail." value={bypassAvailable} color="text-blue-600" />
        </div>
      </div>

      <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={handleRunAll}>
        <Play className="w-3.5 h-3.5" /> Run Mock Gate Evaluation
      </Button>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={packFilter} onValueChange={setPackFilter}>
          <SelectTrigger size="sm" className="w-[180px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{packOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-[170px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{statusOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger size="sm" className="w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{GATE_SEVERITIES.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger size="sm" className="w-[180px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{GATE_CATEGORIES.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground ml-1">{filtered.length} of {gates.length} shown</span>
      </div>

      {/* Gate table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Gate</th>
              <th className="px-3 py-2 text-left font-semibold">Pack</th>
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-center font-semibold">Severity</th>
              <th className="px-3 py-2 text-center font-semibold">Block?</th>
              <th className="px-3 py-2 text-left font-semibold">Runtime</th>
              <th className="px-3 py-2 text-left font-semibold">Owner</th>
              <th className="px-3 py-2 text-left font-semibold">Evaluated</th>
              <th className="px-3 py-2 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(gate => {
              const es = effectiveStatus(gate);
              const isBlock = es === "would_block" || es === "fail";
              const isCritical = gate.severity === "critical";
              return (
                <tr key={gate.id} className={`border-t border-border hover:bg-muted/30 ${isBlock ? "bg-red-50/40 border-l-2 border-l-red-400" : es === "warning" ? "bg-amber-50/30 border-l-2 border-l-amber-300" : es === "mock_bypassed" ? "bg-blue-50/20 border-l-2 border-l-blue-300" : ""}`}>
                  <td className="px-3 py-2 max-w-[220px]">
                    <p className="font-medium leading-snug">{gate.gateName}</p>
                    {isCritical && <Badge variant="outline" className="text-[8px] mt-0.5 border-red-300 text-red-700 bg-red-50">Critical Gate</Badge>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{gate.tenderPackId ? gate.tenderPackId.replace("tp-linde-", "").toUpperCase() : "Workspace"}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[9px]">{getGateCategoryLabel(gate.category)}</Badge></td>
                  <td className="px-3 py-2"><Badge variant="outline" className={`text-[9px] ${getGateStatusColor(es)}`}>{getGateStatusLabel(es)}</Badge></td>
                  <td className="px-3 py-2 text-center"><Badge variant="outline" className={`text-[9px] ${getGateSeverityColor(gate.severity)}`}>{getRiskLabel(gate.severity)}</Badge></td>
                  <td className="px-3 py-2 text-center">
                    {gate.wouldBlock && es !== "pass" && es !== "mock_bypassed" ? (
                      <Badge variant="outline" className="text-[9px] text-amber-700 bg-amber-50 border-amber-200">Would Block</Badge>
                    ) : es === "pass" || es === "mock_bypassed" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-[10px]">{getGateRuntimeLabel(gate.runtimeMode)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{gate.ownerName || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground text-[10px]">{gate.evaluatedAt ? new Date(gate.evaluatedAt).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => setReviewGate(gate)}><Eye className="w-3 h-3" /> Review</Button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">No gates match current filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Future enforcement explanation */}
      <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <p className="text-[10px] text-blue-700">Future production behavior: these gates can later be configured as Enforce / Warn / Off in Governance. Current runtime mode is development mock only.</p>
      </div>

      {reviewGate && <GateReviewModal gate={reviewGate} onClose={() => setReviewGate(null)} onBypass={handleBypass} />}
    </div>
  );
}
