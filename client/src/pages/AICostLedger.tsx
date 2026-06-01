/**
 * AICostLedger — Zero Creep AI Cost Monitoring
 * Every AI token, every bot, every dollar — tracked and visible.
 * No AI cost allowed that does not go through this ledger.
 */
import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { estimateCost, formatCost } from "@/lib/ai-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, DollarSign, Bot, Activity, TrendingUp,
  Zap, Users, Cpu, Calendar, RefreshCw, AlertTriangle,
  ArrowUpDown, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";

// ── Types ──
interface UsageRow {
  id: string;
  user_id: string;
  user_name: string | null;
  provider: string;
  model: string;
  tokens_input: number;
  tokens_output: number;
  latency_ms: number | null;
  workspace_id: string | null;
  action: string | null;
  status: string;
  error_message: string | null;
  cost_usd: number | null;
  bot_id: string | null;
  bot_name: string | null;
  created_at: string;
}

type SortField = "created_at" | "cost_usd" | "tokens_input" | "tokens_output";
type SortDir = "asc" | "desc";

// ── Helpers ──
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function dayKey(iso: string): string {
  return iso.substring(0, 10);
}

// ── Summary Cards ──
function SummaryCards({ rows }: { rows: UsageRow[] }) {
  const totalCost = rows.reduce((s, r) => s + (r.cost_usd ?? estimateCost(r.model, r.tokens_input, r.tokens_output)), 0);
  const totalCalls = rows.length;
  const totalTokensIn = rows.reduce((s, r) => s + r.tokens_input, 0);
  const totalTokensOut = rows.reduce((s, r) => s + r.tokens_output, 0);
  const avgCost = totalCalls > 0 ? totalCost / totalCalls : 0;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const monthRows = rows.filter(r => r.created_at >= thirtyDaysAgo);
  const monthCost = monthRows.reduce((s, r) => s + (r.cost_usd ?? estimateCost(r.model, r.tokens_input, r.tokens_output)), 0);

  const successRate = totalCalls > 0
    ? ((rows.filter(r => r.status === "success").length / totalCalls) * 100).toFixed(1)
    : "0.0";

  const cards = [
    { label: "Total Spend", value: formatCost(totalCost), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Last 30 Days", value: formatCost(monthCost), icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Total Calls", value: formatNumber(totalCalls), icon: Activity, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Avg Cost/Call", value: formatCost(avgCost), icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Total Tokens", value: formatNumber(totalTokensIn + totalTokensOut), icon: Zap, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Success Rate", value: `${successRate}%`, icon: Activity, color: "text-teal-600", bg: "bg-teal-50" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => (
        <Card key={c.label} className="border shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                <c.icon className={`w-4 h-4 ${c.color}`} />
              </div>
            </div>
            <div className="text-lg font-bold font-mono">{c.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Per-Bot Breakdown ──
function BotBreakdown({ rows }: { rows: UsageRow[] }) {
  const byBot = useMemo(() => {
    const map: Record<string, { name: string; calls: number; tokensIn: number; tokensOut: number; cost: number }> = {};
    for (const r of rows) {
      const key = r.bot_id || "__system__";
      const name = r.bot_name || "(System / Legacy)";
      if (!map[key]) map[key] = { name, calls: 0, tokensIn: 0, tokensOut: 0, cost: 0 };
      map[key].calls++;
      map[key].tokensIn += r.tokens_input;
      map[key].tokensOut += r.tokens_output;
      map[key].cost += r.cost_usd ?? estimateCost(r.model, r.tokens_input, r.tokens_output);
    }
    return Object.values(map).sort((a, b) => b.cost - a.cost);
  }, [rows]);

  const totalCost = byBot.reduce((s, b) => s + b.cost, 0);

  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-serif flex items-center gap-2">
          <Bot className="w-4 h-4" /> Per-Bot Cost Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-2 font-semibold text-muted-foreground uppercase">Bot</th>
              <th className="text-right p-2 font-semibold text-muted-foreground uppercase">Calls</th>
              <th className="text-right p-2 font-semibold text-muted-foreground uppercase">Tokens In</th>
              <th className="text-right p-2 font-semibold text-muted-foreground uppercase">Tokens Out</th>
              <th className="text-right p-2 font-semibold text-muted-foreground uppercase">Cost</th>
              <th className="text-right p-2 font-semibold text-muted-foreground uppercase">% Total</th>
            </tr>
          </thead>
          <tbody>
            {byBot.map(b => (
              <tr key={b.name} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="p-2 font-medium">{b.name}</td>
                <td className="p-2 text-right font-mono">{b.calls}</td>
                <td className="p-2 text-right font-mono">{formatNumber(b.tokensIn)}</td>
                <td className="p-2 text-right font-mono">{formatNumber(b.tokensOut)}</td>
                <td className="p-2 text-right font-mono font-semibold">{formatCost(b.cost)}</td>
                <td className="p-2 text-right font-mono text-muted-foreground">{totalCost > 0 ? ((b.cost / totalCost) * 100).toFixed(1) : "0"}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {byBot.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">No AI calls recorded yet</p>}
      </CardContent>
    </Card>
  );
}

// ── Per-User Breakdown ──
function UserBreakdown({ rows }: { rows: UsageRow[] }) {
  const byUser = useMemo(() => {
    const map: Record<string, { name: string; calls: number; cost: number; lastCall: string }> = {};
    for (const r of rows) {
      const key = r.user_id;
      const name = r.user_name || "Unknown User";
      if (!map[key]) map[key] = { name, calls: 0, cost: 0, lastCall: r.created_at };
      map[key].calls++;
      map[key].cost += r.cost_usd ?? estimateCost(r.model, r.tokens_input, r.tokens_output);
      if (r.created_at > map[key].lastCall) map[key].lastCall = r.created_at;
    }
    return Object.values(map).sort((a, b) => b.cost - a.cost);
  }, [rows]);

  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-serif flex items-center gap-2">
          <Users className="w-4 h-4" /> Per-User Cost Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-2 font-semibold text-muted-foreground uppercase">User</th>
              <th className="text-right p-2 font-semibold text-muted-foreground uppercase">Calls</th>
              <th className="text-right p-2 font-semibold text-muted-foreground uppercase">Cost</th>
              <th className="text-right p-2 font-semibold text-muted-foreground uppercase">Last Call</th>
            </tr>
          </thead>
          <tbody>
            {byUser.map(u => (
              <tr key={u.name} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="p-2 font-medium">{u.name}</td>
                <td className="p-2 text-right font-mono">{u.calls}</td>
                <td className="p-2 text-right font-mono font-semibold">{formatCost(u.cost)}</td>
                <td className="p-2 text-right font-mono text-muted-foreground">{formatDate(u.lastCall)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {byUser.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">No AI calls recorded yet</p>}
      </CardContent>
    </Card>
  );
}

// ── Per-Model Breakdown ──
function ModelBreakdown({ rows }: { rows: UsageRow[] }) {
  const byModel = useMemo(() => {
    const map: Record<string, { model: string; provider: string; calls: number; cost: number }> = {};
    for (const r of rows) {
      const key = `${r.provider}:${r.model}`;
      if (!map[key]) map[key] = { model: r.model, provider: r.provider, calls: 0, cost: 0 };
      map[key].calls++;
      map[key].cost += r.cost_usd ?? estimateCost(r.model, r.tokens_input, r.tokens_output);
    }
    return Object.values(map).sort((a, b) => b.cost - a.cost);
  }, [rows]);

  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-serif flex items-center gap-2">
          <Cpu className="w-4 h-4" /> Per-Model Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-2 font-semibold text-muted-foreground uppercase">Model</th>
              <th className="text-left p-2 font-semibold text-muted-foreground uppercase">Provider</th>
              <th className="text-right p-2 font-semibold text-muted-foreground uppercase">Calls</th>
              <th className="text-right p-2 font-semibold text-muted-foreground uppercase">Cost</th>
            </tr>
          </thead>
          <tbody>
            {byModel.map(m => (
              <tr key={`${m.provider}:${m.model}`} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="p-2 font-medium font-mono">{m.model}</td>
                <td className="p-2"><Badge variant="outline" className="text-[10px]">{m.provider}</Badge></td>
                <td className="p-2 text-right font-mono">{m.calls}</td>
                <td className="p-2 text-right font-mono font-semibold">{formatCost(m.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {byModel.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">No AI calls recorded yet</p>}
      </CardContent>
    </Card>
  );
}

// ── Daily Spend Trend (CSS bar chart) ──
function DailyTrend({ rows }: { rows: UsageRow[] }) {
  const daily = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      const dk = dayKey(r.created_at);
      map[dk] = (map[dk] || 0) + (r.cost_usd ?? estimateCost(r.model, r.tokens_input, r.tokens_output));
    }
    // Last 30 days
    const result: { day: string; cost: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const dk = d.toISOString().substring(0, 10);
      result.push({ day: dk, cost: map[dk] || 0 });
    }
    return result;
  }, [rows]);

  const maxCost = Math.max(...daily.map(d => d.cost), 0.001);

  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-serif flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Daily Spend — Last 30 Days
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end gap-[2px] h-[120px]">
          {daily.map(d => (
            <div key={d.day} className="flex-1 flex flex-col items-center justify-end group relative">
              <div
                className="w-full rounded-t bg-emerald-500/70 hover:bg-emerald-500 transition-colors min-h-[2px]"
                style={{ height: `${Math.max((d.cost / maxCost) * 100, 1.5)}%` }}
              />
              {/* Tooltip */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block z-10
                bg-foreground text-background text-[9px] px-2 py-1 rounded whitespace-nowrap font-mono shadow-lg">
                {d.day}: {formatCost(d.cost)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground mt-1 font-mono">
          <span>{daily[0]?.day}</span>
          <span>{daily[daily.length - 1]?.day}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Raw Transaction Log ──
function TransactionLog({ rows }: { rows: UsageRow[] }) {
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [botFilter, setBotFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCount, setShowCount] = useState(50);

  const botNames = useMemo(() => {
    const set = new Set(rows.map(r => r.bot_name || "(System)"));
    return Array.from(set).sort();
  }, [rows]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />;
    return sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />;
  };

  const filtered = useMemo(() => {
    let result = [...rows];
    if (botFilter !== "all") result = result.filter(r => (r.bot_name || "(System)") === botFilter);
    if (statusFilter !== "all") result = result.filter(r => r.status === statusFilter);
    result.sort((a, b) => {
      const aVal = sortField === "created_at" ? new Date(a.created_at).getTime() : (a[sortField] ?? 0);
      const bVal = sortField === "created_at" ? new Date(b.created_at).getTime() : (b[sortField] ?? 0);
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return result;
  }, [rows, botFilter, statusFilter, sortField, sortDir]);

  const visible = filtered.slice(0, showCount);

  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-serif flex items-center gap-2">
            <Activity className="w-4 h-4" /> Transaction Log
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={botFilter} onValueChange={setBotFilter}>
              <SelectTrigger className="w-44 h-7 text-[10px]"><SelectValue placeholder="All Bots" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bots</SelectItem>
                {botNames.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 h-7 text-[10px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-[10px]">{filtered.length} entries</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 font-semibold text-muted-foreground uppercase cursor-pointer select-none" onClick={() => toggleSort("created_at")}>
                  <span className="flex items-center gap-1">Timestamp <SortIcon field="created_at" /></span>
                </th>
                <th className="text-left p-2 font-semibold text-muted-foreground uppercase">User</th>
                <th className="text-left p-2 font-semibold text-muted-foreground uppercase">Bot</th>
                <th className="text-left p-2 font-semibold text-muted-foreground uppercase">Model</th>
                <th className="text-right p-2 font-semibold text-muted-foreground uppercase cursor-pointer select-none" onClick={() => toggleSort("tokens_input")}>
                  <span className="flex items-center gap-1 justify-end">Tok In <SortIcon field="tokens_input" /></span>
                </th>
                <th className="text-right p-2 font-semibold text-muted-foreground uppercase cursor-pointer select-none" onClick={() => toggleSort("tokens_output")}>
                  <span className="flex items-center gap-1 justify-end">Tok Out <SortIcon field="tokens_output" /></span>
                </th>
                <th className="text-right p-2 font-semibold text-muted-foreground uppercase cursor-pointer select-none" onClick={() => toggleSort("cost_usd")}>
                  <span className="flex items-center gap-1 justify-end">Cost <SortIcon field="cost_usd" /></span>
                </th>
                <th className="text-left p-2 font-semibold text-muted-foreground uppercase">Action</th>
                <th className="text-center p-2 font-semibold text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => {
                const cost = r.cost_usd ?? estimateCost(r.model, r.tokens_input, r.tokens_output);
                return (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="p-2 font-mono text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</td>
                    <td className="p-2">{r.user_name || "—"}</td>
                    <td className="p-2">{r.bot_name || <span className="text-muted-foreground italic">system</span>}</td>
                    <td className="p-2 font-mono">{r.model}</td>
                    <td className="p-2 text-right font-mono">{formatNumber(r.tokens_input)}</td>
                    <td className="p-2 text-right font-mono">{formatNumber(r.tokens_output)}</td>
                    <td className="p-2 text-right font-mono font-semibold">{formatCost(cost)}</td>
                    <td className="p-2">{r.action || "—"}</td>
                    <td className="p-2 text-center">
                      <Badge variant="outline" className={`text-[9px] ${r.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && <p className="text-xs text-center text-muted-foreground py-8">No AI calls recorded yet</p>}
        {filtered.length > showCount && (
          <div className="flex justify-center pt-3">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowCount(s => s + 50)}>
              Show more ({filtered.length - showCount} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──
export default function AICostLedger() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_usage_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) {
      console.error("[AICostLedger] fetch error:", error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-2">
            <Link href="/admin-panel">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-serif font-bold flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" /> AI Cost Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Zero Creep Policy — Every AI token, every bot, every dollar tracked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">✓ Supabase-Backed</Badge>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="text-xs gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Zero Creep Banner */}
      <div className="p-3 rounded-lg border-2 border-amber-200 bg-amber-50/50 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-amber-900">Zero AI Creep Policy</div>
          <p className="text-xs text-amber-800 leading-relaxed mt-0.5">
            Every AI call in the system flows through a single <code className="bg-amber-100 px-1 rounded text-[10px]">generateAI()</code> gateway
            that logs to this ledger on both success and failure. No AI cost can bypass this tracking.
            If a bot, model, or action appears here, it is legitimate. If it does not appear, it is not happening.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <SummaryCards rows={rows} />

          <DailyTrend rows={rows} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BotBreakdown rows={rows} />
            <UserBreakdown rows={rows} />
          </div>

          <ModelBreakdown rows={rows} />

          <TransactionLog rows={rows} />
        </>
      )}
    </div>
  );
}
