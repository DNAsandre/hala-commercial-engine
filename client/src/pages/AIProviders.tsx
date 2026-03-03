/**
 * AIProviders — Admin AI Provider Management + Cost Analytics
 * Sprint 9 + 9b: Toggle providers, set default models, test connections,
 * view usage, and estimate costs per provider/model.
 *
 * Design: Swiss Precision Instrument
 * Deep navy accents, warm white background, IBM Plex Sans
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Brain,
  Zap,
  RefreshCw,
  CheckCircle2,
  XCircle,
  BarChart3,
  Shield,
  Activity,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Server,
  DollarSign,
  TrendingUp,
  Layers,
  PieChart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  fetchAIProviders,
  updateAIProvider,
  testProviderConnection,
  fetchAIUsageLogs,
  fetchAIUsageStats,
  computeLogCost,
  formatCost,
  getModelPricing,
  MODEL_PRICING,
  type AIProvider,
  type AIUsageLog,
  type AIProviderName,
  type AIUsageStatsWithCost,
  type ProviderCostBreakdown,
  type ModelCostBreakdown,
} from "@/lib/ai-client";

// ============================================================
// PROVIDER BRANDING
// ============================================================

const providerBranding: Record<string, {
  icon: string;
  gradient: string;
  accent: string;
  bgLight: string;
  borderActive: string;
  barColor: string;
}> = {
  openai: {
    icon: "🤖",
    gradient: "from-emerald-500 to-teal-600",
    accent: "text-emerald-700",
    bgLight: "bg-emerald-50",
    borderActive: "border-emerald-300",
    barColor: "bg-emerald-500",
  },
  google: {
    icon: "✦",
    gradient: "from-blue-500 to-indigo-600",
    accent: "text-blue-700",
    bgLight: "bg-blue-50",
    borderActive: "border-blue-300",
    barColor: "bg-blue-500",
  },
};

// ============================================================
// PROVIDER CARD
// ============================================================

function ProviderCard({
  provider,
  onToggle,
  onModelChange,
}: {
  provider: AIProvider;
  onToggle: (id: string, enabled: boolean) => void;
  onModelChange: (id: string, model: string) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    error?: string;
    content?: string;
  } | null>(null);
  const [showTestOutput, setShowTestOutput] = useState(false);

  const brand = providerBranding[provider.name] || providerBranding.openai;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testProviderConnection(provider.name);
      setTestResult(result);
      if (result.success) {
        toast.success(`${provider.displayName} connection successful (${result.latencyMs}ms)`);
      } else {
        toast.error(`${provider.displayName} connection failed: ${result.error}`);
      }
    } catch (err: any) {
      setTestResult({ success: false, latencyMs: 0, error: err.message });
      toast.error(err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className={`border transition-all duration-200 ${
      provider.enabled ? `${brand.borderActive} shadow-sm` : "border-border opacity-75"
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${brand.gradient} flex items-center justify-center text-white text-xl shadow-sm`}>
              {brand.icon}
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{provider.displayName}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Default: <span className="font-mono text-[11px]">{provider.modelDefault}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={provider.enabled
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-gray-50 text-gray-500 border-gray-200"
              }
            >
              {provider.enabled ? "Active" : "Disabled"}
            </Badge>
            <Switch
              checked={provider.enabled}
              onCheckedChange={(checked) => onToggle(provider.id, checked)}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Default Model
          </Label>
          <Select
            value={provider.modelDefault}
            onValueChange={(val) => onModelChange(provider.id, val)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {provider.models.map((m) => (
                <SelectItem key={m} value={m}>
                  <span className="font-mono text-xs">{m}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            API key stored in Edge Function
          </span>
          <span className="flex items-center gap-1">
            <Server className="w-3 h-3" />
            Max {provider.config?.max_tokens || 4096} tokens
          </span>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing || !provider.enabled}
            className="gap-1.5"
          >
            {testing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {testing ? "Testing..." : "Test Connection"}
          </Button>

          {testResult && (
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs text-emerald-700 font-medium">
                    Connected ({testResult.latencyMs}ms)
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowTestOutput(!showTestOutput)}
                  >
                    {showTestOutput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </Button>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-xs text-red-700 font-medium truncate max-w-[200px]">
                    {testResult.error || "Failed"}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {showTestOutput && testResult?.content && (
          <div className="bg-muted rounded-md p-3 text-xs text-foreground font-mono leading-relaxed">
            {testResult.content}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// USAGE LOG TABLE (with cost column)
// ============================================================

function UsageLogTable({ logs }: { logs: AIUsageLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm font-medium">No usage logs yet</p>
        <p className="text-xs mt-1">AI usage will appear here after the first call</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Provider</th>
            <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Model</th>
            <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">User</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tokens In</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tokens Out</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Est. Cost</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Latency</th>
            <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
            <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const cost = computeLogCost(log);
            return (
              <tr key={log.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {log.provider}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs font-mono text-muted-foreground">{log.model}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs">{log.userName || log.userId}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="text-xs font-mono">{log.tokensInput.toLocaleString()}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="text-xs font-mono">{log.tokensOutput.toLocaleString()}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="text-xs font-mono font-semibold text-amber-700">
                    {formatCost(cost)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="text-xs font-mono text-muted-foreground">
                    {log.latencyMs ? `${log.latencyMs}ms` : "—"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {log.status === "success" ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]" variant="outline">
                      Success
                    </Badge>
                  ) : (
                    <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]" variant="outline">
                      Error
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// COST ANALYTICS VIEW
// ============================================================

function CostAnalytics({ stats }: { stats: AIUsageStatsWithCost }) {
  const providerEntries = useMemo(
    () => Object.values(stats.byProvider).sort((a, b) => b.cost - a.cost),
    [stats.byProvider]
  );

  const maxProviderCost = useMemo(
    () => Math.max(...providerEntries.map((p) => p.cost), 0.001),
    [providerEntries]
  );

  if (stats.totalCalls === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm font-medium">No cost data yet</p>
        <p className="text-xs mt-1">Cost analytics will populate after AI calls are made</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {providerEntries.map((p) => {
          const brand = providerBranding[p.provider] || providerBranding.openai;
          const costPercent = stats.totalCost > 0 ? (p.cost / stats.totalCost) * 100 : 0;

          return (
            <Card key={p.provider} className={`border ${brand.borderActive}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${brand.gradient} flex items-center justify-center text-white text-lg shadow-sm`}>
                      {brand.icon === "🤖" ? "🤖" : "✦"}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold capitalize">{p.provider === "openai" ? "OpenAI" : "Google AI"}</CardTitle>
                      <p className="text-[10px] text-muted-foreground">
                        {p.calls.toLocaleString()} calls · {costPercent.toFixed(1)}% of total
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground">{formatCost(p.cost)}</div>
                    <div className="text-[10px] text-muted-foreground">estimated</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Cost bar */}
                <div className="space-y-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${brand.barColor} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max((p.cost / maxProviderCost) * 100, 2)}%` }}
                    />
                  </div>
                </div>

                {/* Token summary */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-muted/50 rounded-md p-2">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Input Tokens</div>
                    <div className="font-mono font-semibold mt-0.5">{p.tokensIn.toLocaleString()}</div>
                  </div>
                  <div className="bg-muted/50 rounded-md p-2">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Output Tokens</div>
                    <div className="font-mono font-semibold mt-0.5">{p.tokensOut.toLocaleString()}</div>
                  </div>
                </div>

                {/* Per-model breakdown */}
                {p.models.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Model Breakdown
                      </div>
                      {p.models.map((m) => {
                        const modelPercent = p.cost > 0 ? (m.cost / p.cost) * 100 : 0;
                        const pricing = getModelPricing(m.model);
                        return (
                          <div key={m.model} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[11px] truncate">{m.model}</span>
                              <Badge variant="outline" className="text-[9px] shrink-0">
                                {m.calls} calls
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] text-muted-foreground">
                                ${pricing.inputPer1M}/{pricing.outputPer1M} per 1M
                              </span>
                              <span className="font-mono font-semibold text-amber-700 min-w-[60px] text-right">
                                {formatCost(m.cost)}
                              </span>
                              <span className="text-[10px] text-muted-foreground w-[40px] text-right">
                                {modelPercent.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pricing Reference Table */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            Token Pricing Reference
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Model</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Input / 1M Tokens</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Output / 1M Tokens</th>
                  <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Avg Cost / 1K Call</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(MODEL_PRICING).map(([model, pricing]) => {
                  // Estimate average cost per 1K calls assuming ~500 in / ~500 out tokens per call
                  const avgCostPer1K = ((500 / 1_000_000) * pricing.inputPer1M + (500 / 1_000_000) * pricing.outputPer1M) * 1000;
                  return (
                    <tr key={model} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs font-medium">{model}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="font-mono text-xs">${pricing.inputPer1M.toFixed(3)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="font-mono text-xs">${pricing.outputPer1M.toFixed(3)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="font-mono text-xs text-amber-700 font-semibold">
                          ${avgCostPer1K.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function AIProviders() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [usageLogs, setUsageLogs] = useState<AIUsageLog[]>([]);
  const [usageStats, setUsageStats] = useState<AIUsageStatsWithCost>({
    totalCalls: 0, totalTokensIn: 0, totalTokensOut: 0, totalCost: 0, byProvider: {}, byModel: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"providers" | "usage" | "costs">("providers");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [provs, logs, stats] = await Promise.all([
        fetchAIProviders(true),
        fetchAIUsageLogs({ limit: 50 }),
        fetchAIUsageStats(),
      ]);
      setProviders(provs);
      setUsageLogs(logs);
      setUsageStats(stats);
    } catch (err) {
      console.error("[AIProviders] loadData error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle = async (id: string, enabled: boolean) => {
    const prev = providers.find((p) => p.id === id);
    if (!prev) return;
    setProviders((ps) => ps.map((p) => (p.id === id ? { ...p, enabled } : p)));
    const result = await updateAIProvider(id, { enabled });
    if (!result) {
      setProviders((ps) => ps.map((p) => (p.id === id ? { ...p, enabled: prev.enabled } : p)));
      toast.error("Failed to update provider");
      return;
    }
    toast.success(`${prev.displayName} ${enabled ? "enabled" : "disabled"}`);
  };

  const handleModelChange = async (id: string, model: string) => {
    const prev = providers.find((p) => p.id === id);
    if (!prev) return;
    setProviders((ps) => ps.map((p) => (p.id === id ? { ...p, modelDefault: model } : p)));
    const result = await updateAIProvider(id, { modelDefault: model });
    if (!result) {
      setProviders((ps) => ps.map((p) => (p.id === id ? { ...p, modelDefault: prev.modelDefault } : p)));
      toast.error("Failed to update default model");
      return;
    }
    toast.success(`Default model set to ${model}`);
  };

  // Compute total log cost for display
  const totalLogCost = useMemo(
    () => usageLogs.reduce((sum, log) => sum + computeLogCost(log), 0),
    [usageLogs]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            AI Providers
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure AI model providers, test connections, monitor usage and costs
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards — 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Providers
            </div>
            <div className="text-xl font-bold text-foreground">
              {providers.filter((p) => p.enabled).length}
              <span className="text-sm font-normal text-muted-foreground">/{providers.length}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">active</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              API Calls
            </div>
            <div className="text-xl font-bold text-foreground">
              {usageStats.totalCalls.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">all time</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Tokens In
            </div>
            <div className="text-xl font-bold text-foreground">
              {usageStats.totalTokensIn.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">input</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Tokens Out
            </div>
            <div className="text-xl font-bold text-foreground">
              {usageStats.totalTokensOut.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">output</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-1 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Est. Cost
            </div>
            <div className="text-xl font-bold text-amber-800">
              {formatCost(usageStats.totalCost)}
            </div>
            <div className="text-[10px] text-amber-600 mt-0.5">total estimated</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Avg / Call
            </div>
            <div className="text-xl font-bold text-foreground">
              {usageStats.totalCalls > 0
                ? formatCost(usageStats.totalCost / usageStats.totalCalls)
                : "$0.00"
              }
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">per request</div>
          </CardContent>
        </Card>
      </div>

      {/* Security Notice */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-emerald-800">Secure Architecture</h3>
              <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                All AI API calls are routed through Supabase Edge Functions. API keys (OPENAI_API_KEY,
                GOOGLE_AI_API_KEY) are stored as Supabase secrets and never exposed to the client bundle.
                Every call is rate-limited, logged, and cost-estimated for audit compliance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Toggle — 3 views */}
      <div className="flex items-center gap-2">
        <Button
          variant={activeView === "providers" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("providers")}
          className="gap-1.5"
        >
          <Brain className="w-3.5 h-3.5" />
          Providers
        </Button>
        <Button
          variant={activeView === "costs" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("costs")}
          className="gap-1.5"
        >
          <PieChart className="w-3.5 h-3.5" />
          Cost Analytics
        </Button>
        <Button
          variant={activeView === "usage" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("usage")}
          className="gap-1.5"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Usage Logs
        </Button>
      </div>

      {/* Provider Cards */}
      {activeView === "providers" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-2 flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : providers.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No AI providers configured</p>
              <p className="text-xs mt-1">
                Run the migration script (009_ai_providers.sql) to set up providers
              </p>
            </div>
          ) : (
            providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onToggle={handleToggle}
                onModelChange={handleModelChange}
              />
            ))
          )}
        </div>
      )}

      {/* Cost Analytics */}
      {activeView === "costs" && (
        <CostAnalytics stats={usageStats} />
      )}

      {/* Usage Logs */}
      {activeView === "usage" && (
        <Card className="border-border overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent AI Usage</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                  {formatCost(totalLogCost)} est.
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {usageLogs.length} entries
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <UsageLogTable logs={usageLogs} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
