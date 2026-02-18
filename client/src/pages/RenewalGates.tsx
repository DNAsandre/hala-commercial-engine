// ─── Renewal Policy Gate Config ───
// Design: Swiss Precision — white cards, left-border accents, enterprise SaaS aesthetic
// Aligned with AdminGovernance, ECR Dashboard, Proposals
// Admin screen for configuring renewal-specific gates with enforce/warn/off modes
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
import { Shield, Settings, AlertTriangle, CheckCircle, XCircle, Ban, Edit, Save, RotateCcw, Info } from "lucide-react";

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
    // Also update the source array for runtime use
    const idx = renewalGateConfigs.findIndex(g => g.key === editGate.key);
    if (idx >= 0) {
      renewalGateConfigs[idx] = updated.find(g => g.key === editGate.key)!;
    }
    setEditGate(null);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#1B2A4A]">Renewal Policy Gates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure validation gates for renewal transitions — enforce, warn, or disable</p>
        </div>
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          {gates.length} gates configured
        </Badge>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border border-gray-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-700">{enforceCount}</div>
              <div className="text-xs text-gray-500">Enforced (Hard Block)</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-700">{warnCount}</div>
              <div className="text-xs text-gray-500">Warning (Soft Gate)</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 bg-gray-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
              <Ban className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">{offCount}</div>
              <div className="text-xs text-gray-500">Disabled</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-slate-700">
          <span className="font-medium">Gate Modes:</span> <span className="text-red-700">Enforce</span> blocks the transition entirely. <span className="text-amber-700">Warn</span> allows override with a reason. <span className="text-gray-500">Off</span> disables the gate check. Gates marked as <span className="font-medium">overridable</span> can be bypassed with justification.
        </div>
      </div>

      {/* Gate Cards */}
      <div className="space-y-3">
        {gates.map(gate => (
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
                  </div>
                  <p className="text-sm text-gray-500">{gate.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Key: <code className="text-slate-700 bg-gray-100 px-1 rounded">{gate.key}</code></span>
                    {Object.keys(gate.thresholds).length > 0 && (
                      <span>Thresholds: {Object.entries(gate.thresholds).map(([k,v]) => <span key={k} className="text-slate-700 font-mono ml-1">{k}: {v}</span>)}</span>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => openEdit(gate)}>
                  <Edit className="w-3.5 h-3.5 mr-1" /> Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
