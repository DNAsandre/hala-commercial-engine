/*
 * Admin Governance Console — Shell Rules Doctrine Implementation
 * Design: Swiss Precision — deep navy, IBM Plex Sans
 * Implements all 9 compliance points with full configuration UI
 */
import { useState, useEffect } from "react";
import { Shield, Lock, Bot, GitBranch, Settings, Activity, AlertTriangle, CheckCircle, XCircle, Eye, EyeOff, ChevronDown, ChevronRight, History, Zap, Server, Users, RefreshCw, DollarSign, ExternalLink, ArrowLeft, FileText } from "lucide-react";
import CommercialGovernanceConfig from "@/components/commercial/CommercialGovernanceConfig";
import { Link } from "wouter";
import { cleanHref } from "@clean/lib/clean-routing";
// CLEAN APP: inlined. The original imported this from @/components/DashboardLayout,
// which would drag the legacy shell (ComposerDirtyContext, BotAssistPanel,
// GlobalCRMSyncIndicator) and its allNavItems array containing five denylisted
// routes into the clean bundle. The flag is a constant `true` upstream.
const navigationV1 = true;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
// SC-01 Wave 02 closure (SX-006/SX-011): lib/governance and
// TenderGovernanceConfig are excluded. Panels below either show REAL records
// (policy gates, governance audit log) or an honest deferred state. Nothing
// here enforces workflow behavior - governance is advisory before Sprint X.
import {
  fetchPolicyGatesResult,
  fetchGovernanceAuditLogResult,
  type GovernanceRead,
  type SupabasePolicyGate,
  type SupabaseGovernanceAuditEntry,
} from "@/lib/supabase-governance-data";
/* SC-01 Wave 04 (defect B): `new Date(x).toLocaleDateString()` does not throw
 * on a malformed or absent timestamp — it returns the literal string
 * "Invalid Date", which was rendered as though it were a recorded value.
 * These helpers test `Number.isNaN(d.getTime())` and render an honest
 * placeholder instead. */
import { formatRecordedDate, formatRecordedDateTime } from "@/lib/ops-runtime";

/* ── Shared read-failure panel ──────────────────────────────────────────────
 * SC-01 Wave 04. Every governance read below previously collapsed a failure to
 * `[]`, so a broken read rendered as "0 gates configured" / "No overrides
 * recorded yet" — a confident statement about data the page never saw. */
function GovernanceReadError({ subject, error, onRetry }: { subject: string; error: string; onRetry: () => void }) {
  return (
    <Card className="border border-red-200 bg-red-50/40 shadow-none">
      <CardContent className="p-6 space-y-2">
        <p className="text-sm font-semibold text-red-700">{subject} could not be read</p>
        <p className="text-xs text-muted-foreground max-w-2xl">
          Nothing is listed and no totals are shown. The number of records is unknown — it is not zero.
        </p>
        <p className="text-[11px] font-mono text-muted-foreground break-all">{error}</p>
        <Button variant="outline" size="sm" className="mt-1" onClick={onRetry}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
        </Button>
      </CardContent>
    </Card>
  );
}

/* ── Shared honest deferred panel ── */
function DeferredGovernancePanel({ title, note }: { title: string; note?: string }) {
  return (
    <Card className="border border-dashed border-border">
      <CardContent className="py-10 text-center space-y-2">
        <Shield className="w-8 h-8 mx-auto text-muted-foreground opacity-40" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          {note ?? "This capability is not configured in this build. It is deferred to Sprint X and does not restrict any manual workflow."}
        </p>
      </CardContent>
    </Card>
  );
}

/* ── Compliance Dashboard ── */
function ComplianceDashboard() {
  // SX-006/SX-011: the old self-asserted 9-point compliance status came from
  // the excluded governance module; honest deferred state instead.
  return <DeferredGovernancePanel title="Compliance verification is not configured in this build" />;
}

/* ── Policy Gates ── */
function PolicyGatesPanel() {
  const [expandedGate, setExpandedGate] = useState<string | null>(null);
  const [read, setRead] = useState<GovernanceRead<SupabasePolicyGate> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRead(null);
    fetchPolicyGatesResult().then(r => { if (!cancelled) setRead(r); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (read === null) return <p className="text-sm text-muted-foreground py-8 text-center">Loading policy gates from Supabase…</p>;
  if (read.status === "error") {
    return <GovernanceReadError subject="Policy gates" error={read.error} onRetry={() => setReloadKey(k => k + 1)} />;
  }

  const gates = read.rows;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-serif font-bold">Policy Gates</h3>
          <p className="text-xs text-muted-foreground">
            {gates.length} recorded gate {gates.length === 1 ? "row" : "rows"} — advisory display only; no gate in this build
            blocks, locks or restricts any workflow
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700">{gates.filter(g => g.mode === "enforce").length} recorded "enforce"</Badge>
          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">{gates.filter(g => g.mode === "warn").length} recorded "warn"</Badge>
          <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-500">{gates.filter(g => g.mode === "off").length} recorded "off"</Badge>
        </div>
      </div>

      <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 flex items-start gap-2">
        <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800">
          Advisory display only. The <span className="font-mono">mode</span> value beside each gate is the value stored in the
          database; it is <strong>not</strong> applied to any workflow by this build — a gate recorded as "enforce" enforces
          nothing here. Gate configuration cannot be changed on this page: <span className="font-mono">updatePolicyGateConfig</span>
          {" "}refuses every write and performs no update, so no change made here could persist.
        </p>
      </div>

      {gates.length === 0 && (
        <Card className="border border-border shadow-none">
          <CardContent className="py-8 text-center space-y-1">
            <Shield className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium">No policy gate records are visible to this account</p>
            <p className="text-xs text-muted-foreground max-w-xl mx-auto">
              The read of <span className="font-mono">governance_policy_gates</span> succeeded and returned zero rows.
              Rows hidden by row-level security would not appear here.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {gates.map(gate => {
          const isExpanded = expandedGate === gate.id;
          const scope = gate.scope || { regions: "all", businessUnits: "all" };
          const history = gate.rule_version_history || [];
          return (
            <Card key={gate.id} className={`border shadow-none transition-all ${gate.mode === "enforce" ? "border-l-4 border-l-red-400" : gate.mode === "warn" ? "border-l-4 border-l-amber-400" : "border-l-4 border-l-gray-300"}`}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setExpandedGate(isExpanded ? null : gate.id)}>
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <Shield className={`w-4 h-4 ${gate.mode === "enforce" ? "text-red-600" : gate.mode === "warn" ? "text-amber-600" : "text-gray-400"}`} />
                    <div>
                      <span className="text-sm font-medium">{gate.gate_name}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">v{gate.rule_version}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                    {/* SC-01 Wave 02 boundary correction (SX-011): gate configuration
                        cannot be changed in this build - recorded value shown
                        read-only, no control, no persistence claim. */}
                    <Badge variant="outline" className={`text-[10px] font-medium ${gate.mode === "enforce" ? "border-red-300 text-red-700" : gate.mode === "warn" ? "border-amber-300 text-amber-700" : "border-gray-300 text-gray-500"}`}>{gate.mode}</Badge>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">Override</span>
                      <span className="text-[10px] text-muted-foreground">{gate.overridable ? "Yes" : "No"} (read-only)</span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border p-3 bg-muted/20 space-y-3">
                    <p className="text-xs text-muted-foreground">{gate.description}</p>
                    {gate.tooltip_text && <p className="text-xs text-blue-700 italic">{gate.tooltip_text}</p>}
                    {gate.future_enforcement_note && <p className="text-xs text-amber-700 italic">Future: {gate.future_enforcement_note}</p>}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-muted-foreground">Scope — Regions:</span> <span className="font-medium">{scope.regions === "all" ? "All Regions" : Array.isArray(scope.regions) ? scope.regions.join(", ") : String(scope.regions)}</span></div>
                      <div><span className="text-muted-foreground">Scope — BU:</span> <span className="font-medium">{scope.businessUnits === "all" ? "All Business Units" : Array.isArray(scope.businessUnits) ? scope.businessUnits.join(", ") : String(scope.businessUnits)}</span></div>
                      <div><span className="text-muted-foreground">Last Updated:</span> <span className="font-mono">{formatRecordedDate(gate.updated_at)}</span></div>
                      <div><span className="text-muted-foreground">Updated By:</span> <span className="font-medium">{gate.updated_by}</span></div>
                    </div>

                    {history.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <History className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] font-medium text-muted-foreground">VERSION HISTORY</span>
                        </div>
                        <div className="space-y-1">
                          {history.slice().reverse().map(v => (
                            <div key={v.version} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-background">
                              <span className="font-mono text-muted-foreground">v{v.version}</span>
                              <Badge variant="outline" className={`text-[9px] ${v.mode === "enforce" ? "text-red-600" : v.mode === "warn" ? "text-amber-600" : "text-gray-500"}`}>{v.mode}</Badge>
                              <span className="text-muted-foreground">{v.changedBy}</span>
                              <span className="text-muted-foreground ml-auto font-mono">{formatRecordedDate(v.changedAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ── AI Restrictions ── */
function AIRestrictionsPanel() {
  // SX-001/SX-006/SX-011: AI kill switch, module toggles and restriction
  // config are AI-infrastructure controls - deferred, honest state only.
  return <DeferredGovernancePanel title="AI restriction controls are not available in this build" />;
}

/* ── Override Log ── */
function OverrideLogPanel() {
  const [read, setRead] = useState<GovernanceRead<SupabaseGovernanceAuditEntry> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRead(null);
    fetchGovernanceAuditLogResult().then(r => { if (!cancelled) setRead(r); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (read === null) return <p className="text-sm text-muted-foreground py-8 text-center">Loading override log from Supabase…</p>;
  if (read.status === "error") {
    return <GovernanceReadError subject="The governance audit log" error={read.error} onRetry={() => setReloadKey(k => k + 1)} />;
  }

  const entries = read.rows.filter(e => e.category === "override" || e.category === "override_attempt");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-serif font-bold">Override Log</h3>
          <p className="text-xs text-muted-foreground">Recorded override entries in <span className="font-mono">governance_audit_log</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{entries.length} recorded override {entries.length === 1 ? "entry" : "entries"}</Badge>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card className="border border-border shadow-none">
          <CardContent className="py-8 text-center">
            <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">No override records are visible to this account</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl mx-auto">
              The read succeeded and returned {read.rows.length} governance audit {read.rows.length === 1 ? "row" : "rows"},
              none of them in the override categories. Rows hidden by row-level security would not appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <Card key={e.id} className="border border-amber-200 shadow-none border-l-4 border-l-amber-400">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`w-4 h-4 ${e.action.includes("denied") ? "text-red-500" : "text-amber-500"}`} />
                      <span className="text-sm font-medium">{e.action.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">By: {e.user_name}</p>
                    <p className="text-xs mt-1 ml-6">{e.details}</p>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{formatRecordedDateTime(e.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Governance Audit Stream ── */
function GovernanceAuditPanel() {
  const [catFilter, setCatFilter] = useState<string>("all");
  const [read, setRead] = useState<GovernanceRead<SupabaseGovernanceAuditEntry> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRead(null);
    fetchGovernanceAuditLogResult().then(r => { if (!cancelled) setRead(r); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const auditLog = read?.rows ?? [];
  const categories = Array.from(new Set(auditLog.map(e => e.category)));
  const filtered = catFilter === "all" ? auditLog : auditLog.filter(e => e.category === catFilter);

  const catColors: Record<string, string> = {
    gate_evaluation: "bg-blue-100 text-blue-800",
    override: "bg-amber-100 text-amber-800",
    override_attempt: "bg-red-100 text-red-800",
    versioning: "bg-[#075eea]/15 text-[#064fc4]",
    stage_control: "bg-[#075eea]/15 text-[#064fc4]",
    ai_restriction: "bg-red-100 text-red-800",
    automation_protection: "bg-orange-100 text-orange-800",
    environment_protection: "bg-teal-100 text-teal-800",
    admin_change: "bg-[#075eea]/15 text-[#064fc4]",
    write_action: "bg-emerald-100 text-emerald-800",
    approval_decision: "bg-green-100 text-green-800",
    policy_change: "bg-cyan-100 text-cyan-800",
    user_action: "bg-gray-100 text-gray-800",
  };

  if (read === null) return <p className="text-sm text-muted-foreground py-8 text-center">Loading governance audit log from Supabase…</p>;
  if (read.status === "error") {
    return <GovernanceReadError subject="The governance audit log" error={read.error} onRetry={() => setReloadKey(k => k + 1)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-serif font-bold">Governance Audit Stream</h3>
          {/* The old subtitle claimed the log captured "every write, approval,
              gate evaluation, override and admin change". This build has no
              gate evaluation and no approval enforcement, so it describes the
              source instead of promising coverage. */}
          <p className="text-xs text-muted-foreground">Entries recorded in <span className="font-mono">governance_audit_log</span> (most recent first, 200 max)</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{auditLog.length} recorded {auditLog.length === 1 ? "entry" : "entries"}</Badge>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCatFilter(catFilter === cat ? "all" : cat)} className={`p-2 rounded border text-center transition-all ${catFilter === cat ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
              <div className="text-lg font-bold font-mono">{auditLog.filter(e => e.category === cat).length}</div>
              <div className="text-[9px] text-muted-foreground">{cat.replace(/_/g, " ")}</div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} entries shown</span>
      </div>

      <Card className="border border-border shadow-none">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-8 text-center">
              <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">
                {auditLog.length === 0
                  ? "No governance audit records are visible to this account"
                  : "No records match the selected category"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl mx-auto">
                {auditLog.length === 0
                  ? "The read succeeded and returned zero rows. Rows hidden by row-level security would not appear here."
                  : `${auditLog.length} records were read.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 p-3 hover:bg-muted/20 transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${entry.action.includes("blocked") || entry.action.includes("denied") || entry.action.includes("rejected") ? "bg-red-500" : entry.action.includes("override") || entry.action.includes("warn") ? "bg-amber-500" : "bg-emerald-500"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[9px] ${catColors[entry.category] || ""}`}>{entry.category.replace(/_/g, " ")}</Badge>
                      <span className="text-xs font-medium">{entry.user_name}</span>
                      <span className="text-[10px] text-muted-foreground">— {entry.action.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground shrink-0">{formatRecordedDateTime(entry.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Environment & Automation ── */
function EnvironmentPanel() {
  // SX-006/SX-011: environment/automation guard values were self-asserted
  // constants from the excluded governance module - honest deferred state.
  return <DeferredGovernancePanel title="Environment guard status is not configured in this build" />;
}

/* ── Versioning & Immutability ── */
function VersioningPanel() {
  const [read, setRead] = useState<GovernanceRead<SupabaseGovernanceAuditEntry> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchGovernanceAuditLogResult().then(r => { if (!cancelled) setRead(r); });
    return () => { cancelled = true; };
  }, []);

  const versionEvents = (read?.rows ?? []).filter((e) => e.category === "versioning");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-serif font-bold">Versioning & Immutability</h3>
        {/* SC-01 Wave 04 (requirement C): the old subtitle and the green
            checkmark list asserted that approved versions ARE locked and that
            edit attempts ARE blocked. This build enforces nothing — it holds
            no lock, no gate and no block — so the list is presented as the
            written doctrine it is, not as active system behaviour. */}
        <p className="text-xs text-muted-foreground">Written doctrine for document version control — recorded here for reference, not enforced by this build</p>
      </div>

      <Card className="border border-amber-200 bg-amber-50/40 shadow-none">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            The rules below are the organisation's written doctrine. This build does <strong>not</strong> implement them:
            it applies no version lock, blocks no edit and writes no audit entry when a version is changed. Treat them as
            policy text, not as a description of what the software currently does.
          </p>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-none">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium"><Lock className="w-4 h-4 text-muted-foreground" /> Immutability rules (doctrine text — not enforced here)</div>
          {[
            "Quote versions are immutable once approved — no edits possible",
            "Proposal versions are immutable once approved — locked with pricing snapshot",
            "SLA versions are immutable once approved — scope and terms frozen",
            "Pricing snapshot is stored with every approved version",
            "Historical versions cannot be edited — only new versions can be created",
            "Edit attempts on immutable versions are blocked and logged to audit trail",
          ].map((rule, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/40 border border-border">
              <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs">{rule}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-serif">Version Lock Events</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1.5">
            {read === null ? (
              <p className="text-xs text-muted-foreground text-center py-4">Loading version events…</p>
            ) : read.status === "error" ? (
              <p className="text-xs text-red-700 text-center py-4">
                The governance audit log could not be read, so it is unknown whether any version events exist.
                <span className="block font-mono text-[10px] text-muted-foreground mt-1 break-all">{read.error}</span>
              </p>
            ) : versionEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                The read succeeded and no version-lock records are visible to this account.
              </p>
            ) : (
              versionEvents.map((e: any) => (
                <div key={e.id} className="flex items-center gap-2 p-2 rounded border border-border text-xs">
                  <Lock className="w-3.5 h-3.5 text-[#0b73ff]" />
                  <span className="flex-1">{e.details}</span>
                  <span className="font-mono text-muted-foreground">{formatRecordedDateTime(e.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Approval Matrix ── */
function ApprovalMatrixPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-serif font-bold">Approval Matrix</h3>
        <p className="text-xs text-muted-foreground">Written approval authority — GP% bands x pallet volume. Reference documentation, not enforced by this build.</p>
      </div>

      {/* SC-01 Wave 04 (requirement C): these tables are hard-coded policy
          text, not configuration this build reads or applies. Nothing in the
          application checks a GP% band or a pallet count before allowing an
          action. */}
      <Card className="border border-amber-200 bg-amber-50/40 shadow-none">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Reference documentation of the organisation's approval policy. The values are fixed page content, not stored
            configuration, and this build does not evaluate them: no workflow is gated, blocked or routed for approval
            on the basis of this matrix.
          </p>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3"><CardTitle className="text-base font-serif">Pallet Volume Approval</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Volume</th>
              <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Salesman</th>
              <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Regional Sales Head</th>
              <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Directors</th>
            </tr></thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 font-medium">&lt; 300 pallets</td>
                <td className="p-3 text-center text-xs text-muted-foreground">Price List</td>
                <td className="p-3 text-center"><CheckCircle className="w-5 h-5 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center text-muted-foreground/30">—</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">&gt; 300 pallets</td>
                <td className="p-3 text-center text-xs text-muted-foreground">Price List</td>
                <td className="p-3 text-center"><CheckCircle className="w-5 h-5 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><CheckCircle className="w-5 h-5 text-emerald-600 mx-auto" /></td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3"><CardTitle className="text-base font-serif">GP% Approval Matrix</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">GP%</th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Salesman</th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Regional Sales Head</th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Regional Ops Head</th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Directors: Opp & Com</th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">CEO / CFO</th>
              </tr></thead>
              <tbody>
                {[
                  { gp: "> 30%", approvers: [true, true, "feasibility", false, false] },
                  { gp: "> 25%", approvers: [true, true, "feasibility", false, false] },
                  { gp: "> 22%", approvers: [true, true, true, false, false] },
                  { gp: "10 – 22%", approvers: [true, true, true, true, false] },
                  { gp: "< 10%", approvers: [true, true, true, true, true] },
                ].map((row, i) => (
                  <tr key={i} className={`border-b border-border ${i >= 3 ? "bg-red-50/30" : ""}`}>
                    <td className="p-3 font-medium font-mono">{row.gp}</td>
                    {row.approvers.map((a, j) => (
                      <td key={j} className="p-3 text-center">
                        {a === true ? <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto" /> :
                         a === "feasibility" ? <div className="text-center"><CheckCircle className="w-4 h-4 text-blue-500 mx-auto" /><span className="text-[9px] text-blue-600 block mt-0.5">Space & Ability</span></div> :
                         <span className="text-muted-foreground/30">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs text-amber-800"><strong>Note:</strong> Director approval must be obtained <strong>in writing</strong>. Recording approvals in the audit trail is a policy requirement carried out by people — this build does not write an audit entry when an approval is given.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Roles & Access ── */
function RolesPanel() {
  const roles = [
    { name: "CEO / CFO", level: 1, permissions: ["All system access", "Override all gates", "Approve <10% GP", "System configuration"], users: ["Mohammed Al-Harbi"] },
    { name: "Commercial Director", level: 2, permissions: ["Approve 10-22% GP", "Tender final approval", "Override warn gates", "Customer classification"], users: ["Ra'ed"] },
    { name: "Operations Director", level: 2, permissions: ["Tender sign-off", "Handover approval", "Capacity management", "SLA approval"], users: ["Yazan"] },
    { name: "Regional Sales Head", level: 3, permissions: ["Approve >22% GP", "Create workspaces", "Manage proposals", "CRM sync"], users: ["Albert", "Hano"] },
    { name: "Regional Operations Head", level: 3, permissions: ["Confirm space & ability", "Operational feasibility", "Handover tasks"], users: ["Ops East", "Ops Central", "Ops West"] },
    { name: "Salesman", level: 4, permissions: ["Create quotes", "Draft proposals", "View own workspaces", "CRM read"], users: ["Sales Team"] },
    { name: "Finance", level: 3, permissions: ["P&L review", "Insurance review", "Bank guarantees", "Billing setup"], users: ["Finance Team"] },
    { name: "Legal", level: 3, permissions: ["MSA review", "Contract review", "Document handover"], users: ["Legal Team"] },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-serif font-bold">Roles & Access Control</h3>
        <p className="text-xs text-muted-foreground">Written RBAC hierarchy — Level 1 (highest) to Level 4. Reference documentation, not live account data.</p>
      </div>

      {/* SC-01 Wave 04: the role rows below — including the names listed
          against each role — are fixed page content, not a read of the `users`
          table. Presenting them without this label implied the console was
          showing who currently holds each role. Live accounts and their roles
          are in Admin -> Users, which reads `users` directly. */}
      <Card className="border border-amber-200 bg-amber-50/40 shadow-none">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Reference documentation. The roles, permissions and names below are fixed page content — they are not read
            from the user directory and do not reflect who currently holds an account or what any account can do.
            For real accounts and their assigned roles, use <strong>Admin → Users</strong>. Permissions are not enforced
            from this page.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {roles.map(role => (
          <Card key={role.name} className="border border-border shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-hala-navy)] text-white flex items-center justify-center text-sm font-bold shrink-0">L{role.level}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{role.name}</span>
                    <Badge variant="outline" className="text-[10px]">Level {role.level}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {role.permissions.map(p => <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{role.users.join(", ")}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function AdminGovernance() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <Link href={cleanHref("/system/admin")}>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
          </Button>
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold">Governance Console</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Shell Rules Doctrine — Governance &gt; Speed | Auditability &gt; Convenience | Human Judgment &gt; Automation
        </p>
      </div>

      <Card className="border-2 border-[var(--color-hala-navy)]/20 shadow-none mb-6 bg-[var(--color-hala-navy)]/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <Shield className="w-8 h-8 text-[var(--color-hala-navy)] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold mb-1">Override Doctrine — Truthpack Principle</h3>
              {/* SC-01 Wave 04 (requirement C): the previous text described
                  Enforce as "blocks action", Warn as "logs override", and
                  claimed gate modes are changeable by named roles and that all
                  overrides are permanently logged. None of that is true of
                  this build: it evaluates no gate, blocks no action, logs no
                  override, and supabase-governance-data.updatePolicyGateConfig
                  refuses every gate-mode write. */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                This console is <strong>advisory</strong>. It displays recorded governance configuration and recorded
                governance audit entries; it does not evaluate, gate, lock, block or restrict any workflow, and it does
                not change anyone's permissions. A gate stored with mode <strong>Enforce</strong>, <strong>Warn</strong>
                {" "}or <strong>Off</strong> has that value stored against it — no mode is applied to anything here.
                Gate modes cannot be changed on this page: the write path refuses every change and persists nothing.
                No AI or bot can approve, sign, override or delete in this build, because it contains no bot execution
                path at all. Human judgment has final authority.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CLEAN APP: "Related:" quick-link row removed. It pointed at
          /renewal-gates and /revenue-exposure (both redirect to the renewals
          isolation shell) and /ai-cost-ledger (not in the approved clean
          surface, brief §2). */}

      <Tabs defaultValue="compliance" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="compliance" className="text-xs gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Compliance</TabsTrigger>
          <TabsTrigger value="gates" className="text-xs gap-1.5"><Shield className="w-3.5 h-3.5" /> Policy Gates</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs gap-1.5"><Bot className="w-3.5 h-3.5" /> AI Restrictions</TabsTrigger>
          <TabsTrigger value="overrides" className="text-xs gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Overrides</TabsTrigger>
          <TabsTrigger value="versioning" className="text-xs gap-1.5"><GitBranch className="w-3.5 h-3.5" /> Versioning</TabsTrigger>
          <TabsTrigger value="matrix" className="text-xs gap-1.5"><Settings className="w-3.5 h-3.5" /> Approval Matrix</TabsTrigger>
          <TabsTrigger value="roles" className="text-xs gap-1.5"><Users className="w-3.5 h-3.5" /> Roles</TabsTrigger>
          <TabsTrigger value="environment" className="text-xs gap-1.5"><Server className="w-3.5 h-3.5" /> Environment</TabsTrigger>
          <TabsTrigger value="audit" className="text-xs gap-1.5"><Activity className="w-3.5 h-3.5" /> Audit Stream</TabsTrigger>
          <TabsTrigger value="tender_config" className="text-xs gap-1.5"><FileText className="w-3.5 h-3.5" /> Tender Config</TabsTrigger>
          <TabsTrigger value="commercial_config" className="text-xs gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Commercial Config</TabsTrigger>
        </TabsList>

        <TabsContent value="compliance"><ComplianceDashboard /></TabsContent>
        <TabsContent value="gates"><PolicyGatesPanel /></TabsContent>
        <TabsContent value="ai"><AIRestrictionsPanel /></TabsContent>
        <TabsContent value="overrides"><OverrideLogPanel /></TabsContent>
        <TabsContent value="versioning"><VersioningPanel /></TabsContent>
        <TabsContent value="matrix"><ApprovalMatrixPanel /></TabsContent>
        <TabsContent value="roles"><RolesPanel /></TabsContent>
        <TabsContent value="environment"><EnvironmentPanel /></TabsContent>
        <TabsContent value="audit"><GovernanceAuditPanel /></TabsContent>
        <TabsContent value="tender_config"><DeferredGovernancePanel title="Tender governance configuration is not available in this build" /></TabsContent>
        <TabsContent value="commercial_config"><CommercialGovernanceConfig /></TabsContent>
      </Tabs>
    </div>
  );
}
