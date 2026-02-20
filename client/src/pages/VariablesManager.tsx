import { Link } from "wouter";
/*
 * Variables Manager — Admin page for managing semantic variables, sets, and overrides
 * CRUD for variable definitions with namespaces, types, and defaults
 * Variable set management with doc type bindings
 * Override tracking with precedence visualization
 * Design: Swiss Precision — white cards, subtle borders, muted accents
 */

import { useState, useMemo } from "react";
import { Braces, Plus, Search, Edit2, Copy, ChevronDown, ChevronRight, Tag, Layers, Users, ArrowRight, Shield, Lock , ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  variableDefinitions,
  variableSets,
  variableSetItems,
  docVariableOverrides,
  type VariableDefinition,
  type VariableDataType,
  type VariableScope,
  type VariableSource,
  DATA_TYPE_CONFIG,
  SCOPE_CONFIG,
  SOURCE_CONFIG,
  NAMESPACE_CONFIG,
  addVariableDefinition,
} from "@/lib/semantic-variables";
import { navigationV1 } from "@/components/DashboardLayout";

const namespaceIcons: Record<string, typeof Tag> = {
  customer: Users,
  quote: Tag,
  sla: Shield,
  legal: Lock,
  system: Layers,
};

export default function VariablesManager() {
  const [activeTab, setActiveTab] = useState<"definitions" | "sets" | "overrides">("definitions");
  const [searchTerm, setSearchTerm] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState<string>("all");
  const [expandedSet, setExpandedSet] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // New variable form state
  const [newVar, setNewVar] = useState({
    key: "",
    label: "",
    description: "",
    data_type: "text" as VariableDataType,
    scope: "global" as VariableScope,
    source: "static" as VariableSource,
    binding_path: "",
    default_value: "",
    allowed_in_doc_types: "" as string,
    created_by: "admin",
  });

  const namespaces = useMemo(() => {
    const ns = new Set(variableDefinitions.map(v => v.namespace));
    return Array.from(ns);
  }, []);

  const filteredDefinitions = useMemo(() => {
    return variableDefinitions.filter(v => {
      const matchesSearch = v.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.label.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesNs = namespaceFilter === "all" || v.namespace === namespaceFilter;
      return matchesSearch && matchesNs;
    });
  }, [searchTerm, namespaceFilter]);

  const filteredSets = useMemo(() => {
    return variableSets.filter(s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.doc_type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  // Stats
  const totalVars = variableDefinitions.length;
  const totalSets = variableSets.length;
  const totalOverrides = docVariableOverrides.length;
  const bindingCount = variableDefinitions.filter(v => v.source === "binding").length;

  const handleCreateVariable = () => {
    if (!newVar.key || !newVar.label) {
      toast.error("Key and label are required");
      return;
    }
    addVariableDefinition({
      key: newVar.key,
      label: newVar.label,
      description: newVar.description,
      data_type: newVar.data_type,
      scope: newVar.scope,
      source: newVar.source,
      binding_path: newVar.binding_path || null,
      default_value_json: newVar.default_value || null,
      allowed_in_doc_types: newVar.allowed_in_doc_types ? newVar.allowed_in_doc_types.split(",").map(s => s.trim()) : [],
      created_by: "admin",
    });
    toast.success(`Variable "${newVar.label}" created`, { description: `Key: {{${newVar.key}}}` });
    setShowCreateDialog(false);
    setNewVar({ key: "", label: "", description: "", data_type: "text", scope: "global", source: "static", binding_path: "", default_value: "", allowed_in_doc_types: "", created_by: "admin" });
  };

  const tabs = [
    { id: "definitions" as const, label: "Variable Definitions", count: totalVars },
    { id: "sets" as const, label: "Variable Sets", count: totalSets },
    { id: "overrides" as const, label: "Override Precedence", count: null },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Legacy Banner */}
      {navigationV1 && (
        <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-center gap-2">
          <span className="text-xs text-amber-800">This page is now accessible via <a href="/admin" className="underline font-semibold hover:text-amber-900">Admin</a>.</span>
        </div>
      )}
      {/* Header */}
      <div className="mb-4">
        <Link href="/admin-panel">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#1B2A4A]">Variables Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage semantic variables, token definitions, and resolution sets</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]">
          <Plus className="w-4 h-4 mr-1.5" /> New Variable
        </Button>
      </div>

      {/* Metric Strip */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="border border-gray-200 bg-blue-50">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total Variables</p>
            <p className="text-2xl font-bold mt-1 text-[#1B2A4A]">{totalVars}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 bg-emerald-50">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Data Bindings</p>
            <p className="text-2xl font-bold mt-1 text-emerald-700">{bindingCount}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 bg-purple-50">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Variable Sets</p>
            <p className="text-2xl font-bold mt-1 text-purple-700">{totalSets}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Active Overrides</p>
            <p className="text-2xl font-bold mt-1 text-amber-700">{totalOverrides}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-[#1B2A4A] text-[#1B2A4A]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className="ml-1.5 text-xs text-gray-400">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder={activeTab === "definitions" ? "Search variables by key or label..." : "Search variable sets..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        {activeTab === "definitions" && (
          <Select value={namespaceFilter} onValueChange={setNamespaceFilter}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="Namespace" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Namespaces</SelectItem>
              {namespaces.map(ns => (
                <SelectItem key={ns} value={ns}>{NAMESPACE_CONFIG[ns]?.label || ns}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tab Content: Definitions */}
      {activeTab === "definitions" && (
        <div className="space-y-2">
          {filteredDefinitions.map(v => {
            const dtCfg = DATA_TYPE_CONFIG[v.data_type];
            const scopeCfg = SCOPE_CONFIG[v.scope];
            const srcCfg = SOURCE_CONFIG[v.source];
            const NsIcon = namespaceIcons[v.namespace] || Tag;
            return (
              <Card key={v.id} className="border border-gray-200 shadow-none hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded bg-blue-50">
                        <NsIcon className="w-4 h-4 text-blue-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-medium text-[#1B2A4A] bg-gray-100 px-1.5 py-0.5 rounded">{`{{${v.key}}}`}</code>
                          <span className="text-sm text-gray-600">{v.label}</span>
                        </div>
                        {v.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{v.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${dtCfg.color}`}>{dtCfg.label}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${scopeCfg.color} ${scopeCfg.bg}`}>{scopeCfg.label}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${srcCfg.color} ${srcCfg.bg}`}>{srcCfg.label}</Badge>
                      {v.binding_path && (
                        <span className="text-[10px] text-gray-400 font-mono">→ {v.binding_path}</span>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                        navigator.clipboard.writeText(`{{${v.key}}}`);
                        toast.success("Token copied to clipboard");
                      }}>
                        <Copy size={12} />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toast("Edit variable coming soon")}>
                        <Edit2 size={12} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredDefinitions.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Braces className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No variables match your search</p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Sets */}
      {activeTab === "sets" && (
        <div className="space-y-3">
          {filteredSets.map(set => {
            const items = variableSetItems.filter(i => i.variable_set_id === set.id);
            const defs = items.map(i => variableDefinitions.find(d => d.id === i.variable_definition_id)).filter(Boolean) as VariableDefinition[];
            return (
              <Card key={set.id} className="border border-gray-200 shadow-none">
                <CardContent className="p-0">
                  <button
                    onClick={() => setExpandedSet(expandedSet === set.id ? null : set.id)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedSet === set.id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                      <div>
                        <span className="text-sm font-medium text-[#1B2A4A]">{set.name}</span>
                        <span className="text-xs text-gray-400 ml-2">({set.variable_ids.length} variables)</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 ml-2">{set.doc_type}</Badge>
                      {set.template_version_id && (
                        <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-600 ml-1">Template-bound</Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{set.created_at}</span>
                  </button>
                  {expandedSet === set.id && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                      <div className="grid grid-cols-2 gap-2">
                        {defs.map(d => {
                          const item = items.find(i => i.variable_definition_id === d.id);
                          return (
                            <div key={d.id} className="flex items-center justify-between bg-white rounded border border-gray-200 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <code className="text-xs font-mono text-gray-600">{`{{${d.key}}}`}</code>
                                {item?.required && <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600">Req</Badge>}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[9px]">{DATA_TYPE_CONFIG[d.data_type].label}</Badge>
                                {item && <Badge variant="outline" className={`text-[9px] ${item.fallback_mode === 'block_compile' ? 'bg-red-50 text-red-600' : item.fallback_mode === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-500'}`}>{item.fallback_mode}</Badge>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {defs.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-4">No variable definitions linked to this set</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {filteredSets.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No variable sets match your search</p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Override Precedence */}
      {activeTab === "overrides" && (
        <div className="space-y-4">
          <Card className="border border-gray-200">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-[#1B2A4A] mb-4">Token Resolution Precedence</h3>
              <p className="text-xs text-gray-500 mb-4">
                When resolving a token, the system checks each level in order. The first match wins.
                Higher priority overrides lower priority values.
              </p>
              <div className="space-y-2">
                {[
                  { level: 1, name: "Record Override", desc: "Per-document instance value set by the author in the composer", scope: "Per-document", color: "border-l-red-500 bg-red-50/30" },
                  { level: 2, name: "Template Default", desc: "Default value defined in the variable definition for the template", scope: "Per-template", color: "border-l-purple-500 bg-purple-50/30" },
                  { level: 3, name: "Data Binding", desc: "Auto-resolved from live data source (e.g., customer.name → SABIC)", scope: "Per-binding", color: "border-l-blue-500 bg-blue-50/30" },
                  { level: 4, name: "Global Default", desc: "Fallback value from the variable definition's default_value_json", scope: "Global", color: "border-l-gray-400 bg-gray-50/30" },
                ].map(level => (
                  <div key={level.level} className={`flex items-center gap-4 p-3 rounded border-l-4 ${level.color} border border-gray-200`}>
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-bold text-[#1B2A4A]">
                      {level.level}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#1B2A4A]">{level.name}</span>
                        <Badge variant="outline" className="text-[10px]">{level.scope}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{level.desc}</p>
                    </div>
                    {level.level < 4 && <ArrowRight size={14} className="text-gray-300" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-[#1B2A4A] mb-4">Active Overrides ({totalOverrides})</h3>
              <div className="space-y-2">
                {docVariableOverrides.map(ov => (
                  <div key={ov.id} className="flex items-center justify-between bg-gray-50 rounded border border-gray-200 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <code className="text-xs font-mono text-[#1B2A4A] bg-white px-1.5 py-0.5 rounded border border-gray-200">{`{{${ov.key}}}`}</code>
                      <ArrowRight size={12} className="text-gray-300" />
                      <span className="text-xs font-medium text-emerald-700">{String(ov.value_json)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">Doc: {ov.doc_instance_id.slice(0, 12)}...</span>
                      <span className="text-[10px] text-gray-400">by {ov.created_by}</span>
                      <span className="text-[10px] text-gray-400">{ov.created_at}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-[#1B2A4A] mb-3">AI Isolation Rules</h3>
              <p className="text-xs text-gray-500 mb-3">
                AI/bot services are restricted from modifying variable values directly. They may only suggest values which require human approval.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded border border-red-200 bg-red-50/30">
                  <p className="text-xs font-medium text-red-700 mb-1">AI Cannot:</p>
                  <ul className="text-xs text-red-600 space-y-0.5">
                    <li>• Write to variable definitions</li>
                    <li>• Modify variable sets</li>
                    <li>• Override token values</li>
                    <li>• Change resolution precedence</li>
                  </ul>
                </div>
                <div className="p-3 rounded border border-emerald-200 bg-emerald-50/30">
                  <p className="text-xs font-medium text-emerald-700 mb-1">AI Can:</p>
                  <ul className="text-xs text-emerald-600 space-y-0.5">
                    <li>• Read variable definitions</li>
                    <li>• Resolve tokens (read-only)</li>
                    <li>• Suggest values (draft only)</li>
                    <li>• Generate draft text with tokens</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Variable Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#1B2A4A]">Create Variable Definition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Key</label>
              <Input
                placeholder="customer.name"
                value={newVar.key}
                onChange={(e) => setNewVar({ ...newVar, key: e.target.value })}
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-gray-400 mt-1">Dot-separated key — e.g. customer.name, quote.total, sla.penalty_rate</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Label</label>
              <Input
                placeholder="Customer Name"
                value={newVar.label}
                onChange={(e) => setNewVar({ ...newVar, label: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Data Type</label>
                <Select value={newVar.data_type} onValueChange={(v) => setNewVar({ ...newVar, data_type: v as VariableDataType })}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DATA_TYPE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Scope</label>
                <Select value={newVar.scope} onValueChange={(v) => setNewVar({ ...newVar, scope: v as VariableScope })}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCOPE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Source</label>
                <Select value={newVar.source} onValueChange={(v) => setNewVar({ ...newVar, source: v as VariableSource })}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {newVar.source === "binding" && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Binding Path</label>
                <Input
                  placeholder="customer.name"
                  value={newVar.binding_path}
                  onChange={(e) => setNewVar({ ...newVar, binding_path: e.target.value })}
                  className="font-mono text-sm"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Default Value</label>
              <Input
                placeholder="Optional default value"
                value={newVar.default_value}
                onChange={(e) => setNewVar({ ...newVar, default_value: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
              <Input
                placeholder="Brief description of this variable"
                value={newVar.description}
                onChange={(e) => setNewVar({ ...newVar, description: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Allowed Doc Types (comma-separated, empty = all)</label>
              <Input
                placeholder="proposal, quote, sla"
                value={newVar.allowed_in_doc_types}
                onChange={(e) => setNewVar({ ...newVar, allowed_in_doc_types: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateVariable} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]">Create Variable</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
