// ─── Renewal Policy Gates Admin Page ───
// Design: Swiss Precision — white cards, left-border accents, enterprise SaaS aesthetic
// Governance Hardened: override role configs, rule set mutation protection, lock indicators
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  renewalGateConfigs,
  type RenewalGateConfig,
  type RenewalGateMode,
} from "@/lib/renewal-engine";
import {
  overrideRoleConfigs,
  ruleSetReferences,
  canMutateRuleSet,
  aiIsolationRules,
  aiAllowedActions,
} from "@/lib/commercial-integrity";
import { Shield, Settings, AlertTriangle, CheckCircle, XCircle, Ban, Edit, Save, Info, Users, Lock, GitBranch, ShieldAlert, Bot } from "lucide-react";
import { toast } from "sonner";

const MODE_COLORS: Record<RenewalGateMode, string> = {
  enforce: "text-red-700 bg-red-50 border-red-200",
  warn: "text-amber-700 bg-amber-50 border-amber-200",
  off: "text-gray-500 bg-gray-50 border-gray-200",
};

const MODE_ICONS: Record<RenewalGateMode, React.ReactNode> = {
  enforce: <XCircle className="w-3.5 h-3.5" />,
  warn: <AlertTriangle className="w-3.5 h-3.5" />,
  off: <Ban className="w-3.5 h-3.5" />,
};

const MODE_BORDER: Record<RenewalGateMode, string> = {
  enforce: "border-l-red-500",
  warn: "border-l-amber-500",
  off: "border-l-gray-300",
};

export default function RenewalGates() {
  const [gates, setGates] = useState<RenewalGateConfig[]>([...renewalGateConfigs]);
  const [editGate, setEditGate] = useState<RenewalGateConfig | null>(null);
  const [editMode, setEditMode] = useState<RenewalGateMode>("warn");
  const [editThreshold, setEditThreshold] = useState("");
  const [editOverridable, setEditOverridable] = useState(true);
  const [editDescription, setEditDescription] = useState("");

  const activeGates = gates.filter(g => g.mode !== "off");
  const enforceCount = gates.filter(g => g.mode === "enforce").length;
  const warnCount = gates.filter(g => g.mode === "warn").length;
  const offCount = gates.filter(g => g.mode === "off").length;
  const overridableCount = gates.filter(g => g.overridable && g.mode !== "off").length;
  const secondApprovalCount = overrideRoleConfigs.filter(c => c.requires_second_approval).length;

  const openEdit = (gate: RenewalGateConfig) => {
    setEditGate(gate);
    setEditMode(gate.mode);
    setEditThreshold(Object.values(gate.thresholds)[0]?.toString() || "");
    setEditOverridable(gate.overridable);
    setEditDescription(gate.description);
  };

  const saveEdit = () => {
    if (!editGate) return;
    const updated = gates.map(g => {
      if (g.key === editGate.key) {
        return {
          ...g,
          mode: editMode,
          thresholds: editThreshold ? { ...g.thresholds, [Object.keys(g.thresholds)[0]]: parseFloat(editThreshold) } : g.thresholds,
          overridable: editOverridable,
          description: editDescription,
        };
      }
      return g;
    });
    setGates(updated);
    const idx = renewalGateConfigs.findIndex(g => g.key === editGate.key);
    if (idx >= 0) {
      renewalGateConfigs[idx] = updated.find(g => g.key === editGate.key)!;
    }
    toast.success("Gate configuration updated", { description: `"${editGate.name}" saved.` });
    setEditGate(null);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
              <Shield className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-[#1B2A4A]">Renewal Policy Gates</h1>
              <p className="text-sm text-gray-500 mt-0.5">Configure validation gates for renewal transitions — enforce, warn, or disable</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          {gates.length} gates configured
        </Badge>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border border-gray-200 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="p-1.5 rounded-md bg-red-50 border border-red-200">
                <XCircle className="w-3.5 h-3.5 text-red-600" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900">{enforceCount}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Enforced (Hard Block)</div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="p-1.5 rounded-md bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900">{warnCount}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Warning (Soft Gate)</div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="p-1.5 rounded-md bg-gray-50 border border-gray-200">
                <Ban className="w-3.5 h-3.5 text-gray-500" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900">{offCount}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Disabled</div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="p-1.5 rounded-md bg-blue-50 border border-blue-200">
                <Users className="w-3.5 h-3.5 text-blue-600" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900">{overridableCount}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Overridable</div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="p-1.5 rounded-md bg-amber-50 border border-amber-200">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900">{secondApprovalCount}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">2nd Approval Required</div>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-slate-700">
          <span className="font-medium">Gate Modes:</span> <span className="text-red-700">Enforce</span> blocks the transition entirely. <span className="text-amber-700">Warn</span> allows override with a reason. <span className="text-gray-500">Off</span> disables the gate check. Gates marked as <span className="font-medium">overridable</span> can be bypassed with justification. Gates requiring <span className="font-medium text-blue-700">2nd approval</span> need a senior approver to confirm.
        </div>
      </div>

      {/* AI Isolation Banner */}
      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-start gap-2">
        <Bot className="w-4 h-4 text-gray-600 mt-0.5 shrink-0" />
        <div className="text-sm text-slate-700">
          <span className="font-medium">AI Isolation:</span> Bot/AI services are blocked from: {aiIsolationRules.slice(0, 4).map(r => r.endpoint).join(", ")}, and more. Bots may only: {aiAllowedActions.slice(0, 3).map(a => a.replace(/_/g, " ")).join(", ")}.
        </div>
      </div>

      {/* Gate Cards */}
      <div className="space-y-3">
        {gates.map(gate => {
          const overrideConfig = overrideRoleConfigs.find(c => c.gateKey === gate.key);
          return (
            <Card key={gate.key} className={`border border-gray-200 shadow-none border-l-4 ${MODE_BORDER[gate.mode]} ${gate.mode === "off" ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Shield className={`w-4 h-4 ${gate.mode === "enforce" ? "text-red-600" : gate.mode === "warn" ? "text-amber-600" : "text-gray-400"}`} />
                      <span className="font-semibold text-sm text-slate-900">{gate.name}</span>
                      <Badge variant="outline" className={`text-[10px] border ${MODE_COLORS[gate.mode]}`}>
                        {MODE_ICONS[gate.mode]}
                        <span className="ml-1">{gate.mode.toUpperCase()}</span>
                      </Badge>
                      {gate.overridable && gate.mode !== "off" && (
                        <Badge variant="outline" className="text-[10px] border-gray-200 text-gray-500">Overridable</Badge>
                      )}
                      {!gate.overridable && gate.mode !== "off" && (
                        <Badge variant="outline" className="text-[10px] border-red-200 text-red-700 bg-red-50">Non-overridable</Badge>
                      )}
                      {overrideConfig?.requires_second_approval && (
                        <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">
                          <Users className="w-3 h-3 mr-0.5" /> 2nd Approval
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{gate.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                      <span>Key: <code className="text-slate-700 bg-gray-100 px-1 rounded">{gate.key}</code></span>
                      {Object.keys(gate.thresholds).length > 0 && (
                        <span>Thresholds: {Object.entries(gate.thresholds).map(([k,v]) => <span key={k} className="text-slate-700 font-mono ml-1">{k}: {v}</span>)}</span>
                      )}
                    </div>
                    {/* Override role permissions */}
                    {overrideConfig && overrideConfig.allowed_override_roles.length > 0 && gate.mode !== "off" && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-gray-400">Override roles:</span>
                        {overrideConfig.allowed_override_roles.map(role => (
                          <Badge key={role} variant="outline" className="text-[10px] border-gray-200 text-gray-500">{role.replace(/_/g, " ")}</Badge>
                        ))}
                        {overrideConfig.requires_second_approval && (
                          <>
                            <span className="text-[10px] text-gray-400 ml-2">2nd approval:</span>
                            {overrideConfig.second_approval_roles.map(role => (
                              <Badge key={role} variant="outline" className="text-[10px] border-blue-200 text-blue-600">{role.replace(/_/g, " ")}</Badge>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                    {overrideConfig && overrideConfig.allowed_override_roles.length === 0 && gate.mode !== "off" && (
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-red-500" />
                        <span className="text-[10px] text-red-600 font-medium">No roles can override this gate</span>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => openEdit(gate)}>
                    <Edit className="w-3.5 h-3.5 mr-1" /> Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rule Set References */}
      <Card className="border border-gray-200 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
            <GitBranch className="w-4 h-4" /> Rule Set References ({ruleSetReferences.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ruleSetReferences.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No rule set references recorded</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="text-left py-2 pr-4">Rule Set</th>
                    <th className="text-left py-2 pr-4">Version</th>
                    <th className="text-left py-2 pr-4">Referenced By</th>
                    <th className="text-left py-2 pr-4">Entity</th>
                    <th className="text-left py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {ruleSetReferences.slice(0, 10).map(ref => (
                    <tr key={ref.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-mono text-slate-700">{ref.ruleSetId}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">v{ref.ruleSetVersion}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{ref.referencedBy.replace(/_/g, " ")}</td>
                      <td className="py-2 pr-4 font-mono text-gray-500">{ref.entityId}</td>
                      <td className="py-2 text-gray-400">{new Date(ref.referencedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={!!editGate} onOpenChange={() => setEditGate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4" /> Configure: {editGate?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Gate Mode</label>
              <Select value={editMode} onValueChange={v => setEditMode(v as RenewalGateMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enforce">Enforce (Hard Block)</SelectItem>
                  <SelectItem value="warn">Warn (Soft Gate)</SelectItem>
                  <SelectItem value="off">Off (Disabled)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editGate && Object.keys(editGate.thresholds).length > 0 && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Threshold Value</label>
                <Input type="number" value={editThreshold} onChange={e => setEditThreshold(e.target.value)} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-700">Allow Override</label>
              <Switch checked={editOverridable} onCheckedChange={setEditOverridable} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Description</label>
              <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} />
            </div>

            {/* Override role info */}
            {editGate && (() => {
              const config = overrideRoleConfigs.find(c => c.gateKey === editGate.key);
              return config ? (
                <div className="p-2 rounded bg-blue-50 border border-blue-200 text-xs space-y-1">
                  <div className="flex items-center gap-1 text-blue-700 font-medium">
                    <Users className="w-3 h-3" /> Override Role Configuration
                  </div>
                  <div className="text-blue-600">
                    Allowed: {config.allowed_override_roles.length > 0 ? config.allowed_override_roles.map(r => r.replace(/_/g, " ")).join(", ") : "None (non-overridable)"}
                  </div>
                  {config.requires_second_approval && (
                    <div className="text-amber-700">
                      2nd approval: {config.second_approval_roles.map(r => r.replace(/_/g, " ")).join(", ")}
                    </div>
                  )}
                </div>
              ) : null;
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditGate(null)}>Cancel</Button>
            <Button size="sm" onClick={saveEdit} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]"><Save className="w-3.5 h-3.5 mr-1" /> Save Configuration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
