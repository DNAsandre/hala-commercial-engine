/*
 * Admin Governance Console — Shell Rules Doctrine Implementation
 * Design: Swiss Precision — deep navy, IBM Plex Sans
 * Implements all 9 compliance points with full configuration UI
 */
import { useState } from "react";
import { Shield, Lock, Bot, GitBranch, Settings, Activity, AlertTriangle, CheckCircle, XCircle, Eye, EyeOff, ChevronDown, ChevronRight, History, Zap, Server, Users, RefreshCw, DollarSign, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { navigationV1 } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  policyGateConfigs,
  updateGateConfig,
  AI_RESTRICTIONS,
  aiBotConfig,
  governanceAuditLog,
  overrideRecords,
  automationGuard,
  environmentConfig,
  getComplianceStatus,
  logAdminChange,
  type PolicyGateConfig,
} from "@/lib/governance";
import { type GateMode } from "@/lib/store";
import { useCurrentUser } from "@/hooks/useSupabase";

/* ── Compliance Dashboard ── */
function ComplianceDashboard() {
  const status = getComplianceStatus();
  const entries = Object.entries(status);
  const implemented = entries.filter(([, v]) => v.status === "implemented").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-serif font-bold">Compliance Status</h3>
          <p className="text-xs text-muted-foreground">Shell Rules Doctrine — 9-Point Verification</p>
        </div>
        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
          {implemented}/9 Implemented
        </Badge>
      </div>
      <div className="space-y-2">
        {entries.map(([key, val]) => {
          const label = key.replace(/^\d+_/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          const num = key.match(/^\d+/)?.[0] || "";
          return (
            <Card key={key} className="border border-border shadow-none">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${val.status === "implemented" ? "bg-emerald-100 text-emerald-700" : val.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                    {val.status === "implemented" ? <CheckCircle className="w-4 h-4" /> : val.status === "partial" ? <AlertTriangle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{num}.</span>
                      <span className="text-sm font-medium">{label}</span>
                      <Badge variant="outline" className={`text-[10px] ml-auto ${val.status === "implemented" ? "bg-emerald-50 text-emerald-700" : val.status === "partial" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                        {val.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{val.details}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ── Policy Gates ── */
function PolicyGatesPanel() {
  const { data: currentUser } = useCurrentUser();
  const [expandedGate, setExpandedGate] = useState<string | null>(null);

  const handleModeChange = (gate: PolicyGateConfig, newMode: GateMode) => {
    updateGateConfig(gate.id, { mode: newMode }, currentUser.name, `Mode changed to ${newMode} via Admin Console`);
    toast.success(`Gate "${gate.name}" mode changed to ${newMode.toUpperCase()}`);
  };

  const handleOverridableToggle = (gate: PolicyGateConfig) => {
    const newVal = !gate.overridable;
    updateGateConfig(gate.id, { overridable: newVal }, currentUser.name, `Override ${newVal ? "enabled" : "disabled"} via Admin Console`);
    toast.success(`Gate "${gate.name}" override ${newVal ? "enabled" : "disabled"}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-serif font-bold">Policy Gates</h3>
          <p className="text-xs text-muted-foreground">{policyGateConfigs.length} gates configured — Enforce / Warn / Off</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700">{policyGateConfigs.filter(g => g.mode === "enforce").length} Enforce</Badge>
          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">{policyGateConfigs.filter(g => g.mode === "warn").length} Warn</Badge>
          <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-500">{policyGateConfigs.filter(g => g.mode === "off").length} Off</Badge>
        </div>
      </div>

      <div className="space-y-2">
        {policyGateConfigs.map(gate => {
          const isExpanded = expandedGate === gate.id;
          return (
            <Card key={gate.id} className={`border shadow-none transition-all ${gate.mode === "enforce" ? "border-l-4 border-l-red-400" : gate.mode === "warn" ? "border-l-4 border-l-amber-400" : "border-l-4 border-l-gray-300"}`}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setExpandedGate(isExpanded ? null : gate.id)}>
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <Shield className={`w-4 h-4 ${gate.mode === "enforce" ? "text-red-600" : gate.mode === "warn" ? "text-amber-600" : "text-gray-400"}`} />
                    <div>
                      <span className="text-sm font-medium">{gate.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">v{gate.ruleVersion}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                    <Select value={gate.mode} onValueChange={(v: string) => handleModeChange(gate, v as GateMode)}>
                      <SelectTrigger className={`w-24 h-7 text-[10px] font-medium ${gate.mode === "enforce" ? "border-red-300 text-red-700" : gate.mode === "warn" ? "border-amber-300 text-amber-700" : "border-gray-300 text-gray-500"}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enforce">Enforce</SelectItem>
                        <SelectItem value="warn">Warn</SelectItem>
                        <SelectItem value="off">Off</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">Override</span>
                      <Switch checked={gate.overridable} onCheckedChange={() => handleOverridableToggle(gate)} className="scale-75" />
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border p-3 bg-muted/20 space-y-3">
                    <p className="text-xs text-muted-foreground">{gate.description}</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-muted-foreground">Scope — Regions:</span> <span className="font-medium">{gate.scope.regions === "all" ? "All Regions" : (gate.scope.regions as string[]).join(", ")}</span></div>
                      <div><span className="text-muted-foreground">Scope — BU:</span> <span className="font-medium">{gate.scope.businessUnits === "all" ? "All Business Units" : (gate.scope.businessUnits as string[]).join(", ")}</span></div>
                      <div><span className="text-muted-foreground">Last Updated:</span> <span className="font-mono">{new Date(gate.updatedAt).toLocaleDateString()}</span></div>
                      <div><span className="text-muted-foreground">Updated By:</span> <span className="font-medium">{gate.updatedBy}</span></div>
                    </div>

                    {gate.ruleVersionHistory.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <History className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] font-medium text-muted-foreground">VERSION HISTORY</span>
                        </div>
                        <div className="space-y-1">
                          {gate.ruleVersionHistory.slice().reverse().map(v => (
                            <div key={v.version} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-background">
                              <span className="font-mono text-muted-foreground">v{v.version}</span>
                              <Badge variant="outline" className={`text-[9px] ${v.mode === "enforce" ? "text-red-600" : v.mode === "warn" ? "text-amber-600" : "text-gray-500"}`}>{v.mode}</Badge>
                              <span className="text-muted-foreground">{v.changedBy}</span>
                              <span className="text-muted-foreground ml-auto font-mono">{new Date(v.changedAt).toLocaleDateString()}</span>
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
  const { data: currentUser } = useCurrentUser();
  const [killSwitch, setKillSwitch] = useState(aiBotConfig.globalKillSwitch);
  const [moduleAccess, setModuleAccess] = useState({ ...aiBotConfig.moduleAccess });

  const toggleKillSwitch = () => {
    const newVal = !killSwitch;
    setKillSwitch(newVal);
    aiBotConfig.globalKillSwitch = newVal;
    logAdminChange("ai_config", "global_kill_switch", newVal ? "kill_switch_activated" : "kill_switch_deactivated", currentUser.id, currentUser.name, `AI Global Kill Switch ${newVal ? "ACTIVATED" : "DEACTIVATED"}`, { newState: newVal });
    toast[newVal ? "warning" : "success"](newVal ? "AI Kill Switch ACTIVATED — All AI disabled" : "AI Kill Switch deactivated — AI active within restrictions");
  };

  const toggleModule = (key: string) => {
    const newVal = !(moduleAccess as Record<string, boolean>)[key];
    setModuleAccess(prev => ({ ...prev, [key]: newVal }));
    (aiBotConfig.moduleAccess as Record<string, boolean>)[key] = newVal;
    logAdminChange("ai_config", key, newVal ? "module_enabled" : "module_disabled", currentUser.id, currentUser.name, `AI module "${key}" ${newVal ? "enabled" : "disabled"}`, { module: key, newState: newVal });
    toast.success(`AI module "${key}" ${newVal ? "enabled" : "disabled"}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-serif font-bold">AI Authority Restrictions</h3>
          <p className="text-xs text-muted-foreground">Hard-coded constraints — AI/Bots permission boundary</p>
        </div>
      </div>

      <Card className={`border shadow-none ${killSwitch ? "border-red-300 bg-red-50/50" : "border-emerald-200 bg-emerald-50/30"}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${killSwitch ? "bg-red-100" : "bg-emerald-100"}`}>
              <Zap className={`w-5 h-5 ${killSwitch ? "text-red-600" : "text-emerald-600"}`} />
            </div>
            <div>
              <div className="text-sm font-bold">Global AI Kill Switch</div>
              <div className="text-xs text-muted-foreground">{killSwitch ? "ALL AI functionality is DISABLED" : "AI active within defined restrictions"}</div>
            </div>
          </div>
          <Switch checked={killSwitch} onCheckedChange={toggleKillSwitch} />
        </CardContent>
      </Card>

      <Card className="border border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-serif flex items-center gap-2"><Lock className="w-4 h-4 text-red-600" /> Hard-Coded Restrictions (Immutable)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1.5">
            {AI_RESTRICTIONS.map(r => (
              <div key={r.id} className="flex items-center justify-between p-2 rounded bg-red-50/50 border border-red-100">
                <div className="flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-xs">{r.description}</span>
                </div>
                <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600 border-red-200">
                  <Lock className="w-2.5 h-2.5 mr-0.5" /> HARD-CODED
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-serif flex items-center gap-2"><Bot className="w-4 h-4" /> Per-Module AI Access Control</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1.5">
            {Object.entries(moduleAccess).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between p-2 rounded border border-border">
                <div className="flex items-center gap-2">
                  {enabled ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
                  <span className="text-xs font-medium">{key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
                </div>
                <Switch checked={enabled as boolean} onCheckedChange={() => toggleModule(key)} className="scale-75" disabled={killSwitch} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Override Log ── */
function OverrideLogPanel() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-serif font-bold">Override Log</h3>
          <p className="text-xs text-muted-foreground">"Break Glass" doctrine — all overrides are auditable</p>
        </div>
        <Badge variant="outline" className="text-xs">{overrideRecords.length} overrides recorded</Badge>
      </div>

      {overrideRecords.length === 0 ? (
        <Card className="border border-border shadow-none">
          <CardContent className="py-8 text-center">
            <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No overrides recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1">Overrides will appear here when gates are overridden via the "Break Glass" doctrine</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {overrideRecords.map(o => (
            <Card key={o.id} className="border border-amber-200 shadow-none border-l-4 border-l-amber-400">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium">{o.gateName}</span>
                      <Badge variant="outline" className="text-[10px]">v{o.ruleVersionAtOverride}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">By: {o.overriddenBy} ({o.overriddenByRole})</p>
                    <p className="text-xs mt-1 ml-6"><span className="font-medium">Reason:</span> {o.reason}</p>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{new Date(o.overriddenAt).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">Override Audit Trail</h4>
        <div className="space-y-1">
          {governanceAuditLog.filter(e => e.category === "override" || e.category === "override_attempt").length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No override audit entries yet</p>
          ) : (
            governanceAuditLog.filter(e => e.category === "override" || e.category === "override_attempt").map(e => (
              <div key={e.id} className="flex items-center gap-2 p-2 rounded border border-border text-xs">
                <AlertTriangle className={`w-3.5 h-3.5 ${e.action.includes("denied") ? "text-red-500" : "text-amber-500"}`} />
                <span className="flex-1">{e.details}</span>
                <span className="font-mono text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Governance Audit Stream ── */
function GovernanceAuditPanel() {
  const [catFilter, setCatFilter] = useState<string>("all");
  const categories = Array.from(new Set(governanceAuditLog.map(e => e.category)));
  const filtered = catFilter === "all" ? governanceAuditLog : governanceAuditLog.filter(e => e.category === catFilter);

  const catColors: Record<string, string> = {
    gate_evaluation: "bg-blue-100 text-blue-800",
    override: "bg-amber-100 text-amber-800",
    override_attempt: "bg-red-100 text-red-800",
    versioning: "bg-violet-100 text-violet-800",
    stage_control: "bg-indigo-100 text-indigo-800",
    ai_restriction: "bg-red-100 text-red-800",
    automation_protection: "bg-orange-100 text-orange-800",
    environment_protection: "bg-teal-100 text-teal-800",
    admin_change: "bg-purple-100 text-purple-800",
    write_action: "bg-emerald-100 text-emerald-800",
    approval_decision: "bg-green-100 text-green-800",
    policy_change: "bg-cyan-100 text-cyan-800",
    user_action: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-serif font-bold">Governance Audit Stream</h3>
          <p className="text-xs text-muted-foreground">Unified log — every write, approval, gate evaluation, override, and admin change</p>
        </div>
        <Badge variant="outline" className="text-xs">{governanceAuditLog.length} entries</Badge>
      </div>

      {categories.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCatFilter(catFilter === cat ? "all" : cat)} className={`p-2 rounded border text-center transition-all ${catFilter === cat ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
              <div className="text-lg font-bold font-mono">{governanceAuditLog.filter(e => e.category === cat).length}</div>
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
              <p className="text-sm text-muted-foreground">No audit entries yet</p>
              <p className="text-xs text-muted-foreground mt-1">Governance events will appear here as the system is used</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.slice().reverse().map(entry => (
                <div key={entry.id} className="flex items-start gap-3 p-3 hover:bg-muted/20 transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${entry.action.includes("blocked") || entry.action.includes("denied") || entry.action.includes("rejected") ? "bg-red-500" : entry.action.includes("override") || entry.action.includes("warn") ? "bg-amber-500" : "bg-emerald-500"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[9px] ${catColors[entry.category] || ""}`}>{entry.category.replace(/_/g, " ")}</Badge>
                      <span className="text-xs font-medium">{entry.userName}</span>
                      <span className="text-[10px] text-muted-foreground">— {entry.action.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground shrink-0">{new Date(entry.timestamp).toLocaleString()}</span>
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
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-serif font-bold">Environment & Automation Protection</h3>
        <p className="text-xs text-muted-foreground">Environment guards, rate limiting, recursion protection</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-serif flex items-center gap-2"><Server className="w-4 h-4" /> Environment Protection</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {[
              { label: "Environment", value: environmentConfig.environment, ok: true },
              { label: "Production Guard", value: environmentConfig.productionGuard ? "Active" : "Inactive", ok: environmentConfig.productionGuard },
              { label: "Direct Schema Edits", value: environmentConfig.directSchemaEdits ? "Allowed" : "Blocked", ok: !environmentConfig.directSchemaEdits },
              { label: "Migration Versioning", value: environmentConfig.migrationVersioning ? "Enforced" : "Disabled", ok: environmentConfig.migrationVersioning },
              { label: "Destructive Cmd Protection", value: environmentConfig.destructiveCommandProtection ? "Active" : "Inactive", ok: environmentConfig.destructiveCommandProtection },
              { label: "Migration Version", value: `v${environmentConfig.currentMigrationVersion}`, ok: true },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-2 rounded border border-border">
                <span className="text-xs">{item.label}</span>
                <Badge variant="outline" className={`text-[10px] ${item.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{item.value}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-serif flex items-center gap-2"><Zap className="w-4 h-4" /> Automation Guards</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {[
              { label: "Max Recursion Depth", value: String(automationGuard.maxRecursionDepth) },
              { label: "API Rate Limit", value: `${automationGuard.apiRateLimit}/min` },
              { label: "Idempotency Keys Active", value: String(automationGuard.webhookIdempotencyKeys.size) },
              { label: "Max Concurrent Jobs", value: String(automationGuard.backgroundJobBounds.maxConcurrent) },
              { label: "Max Job Duration", value: `${automationGuard.backgroundJobBounds.maxDuration / 1000}s` },
              { label: "Auto-Trigger Protection", value: automationGuard.autoTriggerProtection ? "Active" : "Inactive" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-2 rounded border border-border">
                <span className="text-xs">{item.label}</span>
                <span className="text-xs font-mono font-medium">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── Versioning & Immutability ── */
function VersioningPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-serif font-bold">Versioning & Immutability</h3>
        <p className="text-xs text-muted-foreground">Document version control — approved versions are locked and immutable</p>
      </div>

      <Card className="border border-border shadow-none">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium"><Lock className="w-4 h-4 text-emerald-600" /> Immutability Rules</div>
          {[
            "Quote versions are immutable once approved — no edits possible",
            "Proposal versions are immutable once approved — locked with pricing snapshot",
            "SLA versions are immutable once approved — scope and terms frozen",
            "Pricing snapshot is stored with every approved version",
            "Historical versions cannot be edited — only new versions can be created",
            "Edit attempts on immutable versions are blocked and logged to audit trail",
          ].map((rule, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded bg-emerald-50/50 border border-emerald-100">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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
            {governanceAuditLog.filter(e => e.category === "versioning").length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No version lock events yet — events will appear when documents are approved</p>
            ) : (
              governanceAuditLog.filter(e => e.category === "versioning").map(e => (
                <div key={e.id} className="flex items-center gap-2 p-2 rounded border border-border text-xs">
                  <Lock className="w-3.5 h-3.5 text-violet-500" />
                  <span className="flex-1">{e.details}</span>
                  <span className="font-mono text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</span>
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
        <p className="text-xs text-muted-foreground">Multi-dimensional approval authority — GP% bands x pallet volume</p>
      </div>

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
              <span className="text-xs text-amber-800"><strong>Note:</strong> Director approval must be obtained <strong>in writing</strong>. All approvals are logged in the audit trail.</span>
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
        <p className="text-xs text-muted-foreground">RBAC hierarchy — Level 1 (highest) to Level 4</p>
      </div>
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
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every policy gate operates in one of three modes: <strong>Enforce</strong> (blocks action, requires approval),
                <strong> Warn</strong> (allows action but logs override with reason), or <strong>Off</strong> (no check).
                Only the Commercial Director or CEO can change gate modes. All overrides are permanently logged.
                AI cannot approve, sign, override, or delete. Human judgment always has final authority.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Renewal & Revenue Quick Links (navigationV1) */}
      {navigationV1 && (
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <span className="text-xs text-muted-foreground font-medium">Related:</span>
          <Link href="/renewals"><Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted transition-colors gap-1"><RefreshCw className="w-3 h-3" /> Renewals</Badge></Link>
          <Link href="/renewal-gates"><Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted transition-colors gap-1"><Shield className="w-3 h-3" /> Renewal Policy Gates</Badge></Link>
          <Link href="/revenue-exposure"><Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted transition-colors gap-1"><DollarSign className="w-3 h-3" /> Revenue Exposure</Badge></Link>
        </div>
      )}

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
      </Tabs>
    </div>
  );
}
