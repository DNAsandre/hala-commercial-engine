import { Link } from "wouter";
import { cleanHref } from "@clean/lib/clean-routing";
import { ArrowLeft } from "lucide-react";
/**
 * BOT AUDIT & TRACE PAGE
 * Design: Swiss Precision Instrument — Deep navy + warm white
 * Full invocation log with gate checks, cost tracking, and export capability.
 * Every bot action is logged, traceable, and exportable.
 */
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  FileText, Download, Search, Filter, CheckCircle2, XCircle, Clock,
  DollarSign, Activity, Shield, Eye, Pencil, AlertTriangle, Hash,
  Cpu, Database, User, ChevronDown, ChevronUp, BarChart3, Zap
} from 'lucide-react';
import {
  AI_USAGE_LOGS_TABLE,
  readAiBots,
  readAiProviders,
  readAiUsageLogs,
  resolveBotProviderLabel,
  summariseUsageNumber,
  type AiBotRecord,
  type AiProviderRecord,
  type AiUsageLogRecord,
  type RecordRead,
} from "@/lib/ops-runtime";

/*
 * SC-01 Wave 02 closure (SX-001/SX-004/SX-011): bot-governance and ai-client
 * are excluded; the old-server API is never called.
 *
 * SC-01 Wave 04 corrections on this page:
 *
 *  1. FABRICATED GATE CHECKS REMOVED. The old mapper hard-coded
 *       gateChecks: { globalKillSwitch: false, providerEnabled: true,
 *                     botEnabled: true, connectorsEnabled: true,
 *                     rbacPassed: true }
 *     for every row, and the expanded panel rendered them as five green
 *     ticks under the heading "Gate Checks (10-Step Runtime Flow)". No such
 *     check ran and no such column exists in `ai_usage_logs`: this page was
 *     inventing a passing compliance record and exporting it to CSV as audit
 *     evidence. Gate checks are now reported as not recorded.
 *
 *  2. ACCEPT / EDIT COUNTERS REMOVED. `accepted` was always null and `edited`
 *     always false, so "Accepted" and "Edited After Accept" could only ever
 *     read 0 while looking like measured outcomes. The table does record
 *     `human_action`, so the real recorded value is shown instead.
 *
 *  3. Reads are three-state (loading / failed / real empty) and every summary
 *     figure is computed over recorded values only — a null column reads
 *     "not recorded", never "$0.000" or "0ms".
 *
 * Source of truth: ai_usage_logs (projection AI_USAGE_LOGS_COLUMNS), plus
 * ai_bots and ai_providers for labels.
 */

/** Not-recorded gate fields, listed once so the UI and the CSV agree. */
const GATE_CHECK_LABELS = ['Kill Switch', 'Provider', 'Bot Enabled', 'Connectors', 'RBAC'] as const;

function invocationContext(row: AiUsageLogRecord): string {
  return [row.action, row.workspaceId].filter(Boolean).join(' @ ') || '(not recorded)';
}

function invocationOutcome(row: AiUsageLogRecord): string {
  if (row.status === 'error') return `ERROR: ${row.errorMessage || 'no message recorded'}`;
  return row.status || '(no status recorded)';
}

export default function BotAudit() {
  const [logsRead, setLogsRead] = useState<RecordRead<AiUsageLogRecord> | null>(null);
  const [botsRead, setBotsRead] = useState<RecordRead<AiBotRecord> | null>(null);
  const [providersRead, setProvidersRead] = useState<RecordRead<AiProviderRecord> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [botFilter, setBotFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLogsRead(null);
    setBotsRead(null);
    setProvidersRead(null);
    (async () => {
      const [logs, bots, providers] = await Promise.all([
        readAiUsageLogs(),
        readAiBots(),
        readAiProviders(),
      ]);
      if (!mounted) return;
      setLogsRead(logs);
      setBotsRead(bots);
      setProvidersRead(providers);
    })();
    return () => { mounted = false; };
  }, [reloadKey]);

  const invocations = logsRead?.rows ?? [];
  const bots = botsRead?.rows ?? [];
  const providers = providersRead?.rows ?? [];
  const logsLoaded = logsRead !== null && (logsRead.status === 'loaded' || logsRead.status === 'empty');

  const filteredInvocations = useMemo(() => {
    return invocations.filter(inv => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = [invocationContext(inv), inv.id, invocationOutcome(inv), inv.botName].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (botFilter !== 'all' && inv.botId !== botFilter) return false;
      // Filters are over RECORDED values only. There is no accepted/rejected
      // column, so no filter pretends to offer that distinction.
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      return true;
    });
  }, [searchQuery, botFilter, statusFilter, invocations]);

  const costSummary = summariseUsageNumber(invocations, r => r.costUsd);
  const latencySummary = summariseUsageNumber(invocations, r => r.latencyMs);
  const recordedStatuses = Array.from(new Set(invocations.map(i => i.status).filter(Boolean)));
  const recordedHumanActions = invocations.filter(i => i.humanAction !== null).length;

  const handleExport = () => {
    // The CSV mirrors exactly what the page can prove. The five gate-check
    // columns are gone: exporting invented "pass" values as audit evidence is
    // the most damaging form of the defect this wave removes.
    const csvHeader = 'ID,Bot ID,Bot Name,User ID,User Name,Timestamp,Action,Workspace,Provider,Model,Status,Error,Cost USD,Latency ms,Tokens In,Tokens Out,Human Action,Gate Checks\n';
    const csvRows = invocations.map(inv => [
      inv.id,
      inv.botId,
      `"${(inv.botName || '').replace(/"/g, '""')}"`,
      inv.userId,
      `"${(inv.userName || '').replace(/"/g, '""')}"`,
      inv.createdAt,
      inv.action,
      inv.workspaceId ?? '',
      inv.provider,
      inv.model,
      inv.status,
      `"${(inv.errorMessage ?? '').replace(/"/g, '""')}"`,
      inv.costUsd === null ? 'not recorded' : inv.costUsd.toFixed(6),
      inv.latencyMs === null ? 'not recorded' : String(inv.latencyMs),
      inv.tokensInput === null ? 'not recorded' : String(inv.tokensInput),
      inv.tokensOutput === null ? 'not recorded' : String(inv.tokensOutput),
      inv.humanAction ?? 'not recorded',
      'not recorded',
    ].join(',')).join('\n');

    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bot-usage-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${invocations.length} recorded usage rows as CSV`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4">
        <Link href={cleanHref("/system/admin")}>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-slate-900">Bot Usage Log</h1>
          {/* The old strapline — "Every invocation logged. Every gate check
              recorded." — was false on both counts for this build. */}
          <p className="text-sm text-slate-500 mt-1">
            Rows persisted in <span className="font-mono">{AI_USAGE_LOGS_TABLE}</span>. This build performs no bot
            invocation, so nothing here is produced by this application — these are historical records only, and no
            gate check is recorded against them.
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={!logsLoaded || invocations.length === 0}>
          <Download className="w-4 h-4 mr-2" /> Export recorded rows
        </Button>
      </div>

      {/* Read failure / real empty — three visibly different states. */}
      {logsRead !== null && (logsRead.status === 'error' || logsRead.status === 'unavailable') && (
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="py-6 space-y-2 text-center">
            <XCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm font-semibold text-red-700">The usage log could not be read</p>
            <p className="text-xs text-slate-500 max-w-xl mx-auto">
              No rows and no totals are shown. The number of recorded usage rows is unknown — it is not zero.
            </p>
            <p className="text-[11px] font-mono text-slate-500 break-all">{logsRead.error}</p>
            <Button variant="outline" size="sm" onClick={() => setReloadKey(k => k + 1)}>Retry</Button>
          </CardContent>
        </Card>
      )}
      {logsRead === null && (
        <Card><CardContent className="py-8 text-center text-sm text-slate-500">Reading the usage log…</CardContent></Card>
      )}
      {logsRead !== null && logsRead.status === 'empty' && (
        <Card>
          <CardContent className="py-10 text-center space-y-1">
            <Activity className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-medium">No usage records are visible to this account</p>
            <p className="text-xs text-slate-500 max-w-xl mx-auto">
              The read of <span className="font-mono">{AI_USAGE_LOGS_TABLE}</span> succeeded and returned zero rows.
              Rows hidden by row-level security would not appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {logsRead !== null && logsRead.status === 'loaded' && (
      <>
      {/* Stats — computed over recorded values only. A column with no recorded
          value reads "not recorded", never 0. */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Recorded Rows</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{invocations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Cost</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {costSummary.total === null ? '—' : `$${costSummary.total.toFixed(3)}`}
            </p>
            <p className="text-[10px] text-slate-400">{costSummary.recordedCount} of {invocations.length} rows record a cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Avg Latency</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {latencySummary.average === null ? '—' : `${latencySummary.average.toFixed(0)}ms`}
            </p>
            <p className="text-[10px] text-slate-400">{latencySummary.recordedCount} of {invocations.length} rows record latency</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Human Action Recorded</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{recordedHumanActions}</p>
            <p className="text-[10px] text-slate-400">rows with a human_action value</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Gate Checks</p>
            <p className="text-2xl font-bold text-slate-400 mt-1">—</p>
            <p className="text-[10px] text-slate-400">Not recorded by this table</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters — every option comes from a value actually present in the
          rows that were read, so no filter can select an empty universe. */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search recorded rows..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={botFilter} onValueChange={setBotFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by bot" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bots</SelectItem>
            {Array.from(new Set(invocations.map(i => i.botId).filter(Boolean))).map(id => (
              <SelectItem key={id} value={id}>
                {invocations.find(i => i.botId === id)?.botName || bots.find(b => b.id === id)?.name || id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Recorded status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All recorded statuses</SelectItem>
            {recordedStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Recorded usage rows */}
      <div className="space-y-2">
        {filteredInvocations.map(inv => {
          const bot = bots.find(b => b.id === inv.botId);
          const providerLabel = resolveBotProviderLabel(bot?.providerId ?? null, providers);
          const isError = inv.status === 'error';
          const isExpanded = expandedId === inv.id;

          return (
            <Card key={inv.id} className={`${isError ? 'border-l-4 border-l-red-400 bg-red-50/30' : ''} hover:shadow-sm transition-shadow`}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : inv.id)}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${isError ? 'bg-red-100' : 'bg-slate-100'}`}>
                      {isError ? <XCircle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900">{inv.botName || bot?.name || inv.botId || '(no bot recorded)'}</span>
                        <Badge variant="outline" className="text-xs">{inv.status || 'no status'}</Badge>
                        {inv.humanAction && (
                          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">
                            human action: {inv.humanAction}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{invocationContext(inv)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{inv.userName || inv.userId || 'not recorded'}</span>
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{inv.costUsd === null ? 'not recorded' : `$${inv.costUsd.toFixed(4)}`}</span>
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{inv.latencyMs === null ? 'not recorded' : `${inv.latencyMs}ms`}</span>
                    <span>{inv.createdAt ? new Date(inv.createdAt).toLocaleString() : 'no timestamp recorded'}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-4">
                    {/* Gate checks: NOT recorded. The previous version painted
                        five green "pass" tiles here for every row without a
                        single check having run. */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Gate Checks</h4>
                      <div className="grid grid-cols-5 gap-2">
                        {GATE_CHECK_LABELS.map(label => (
                          <div key={label} className="flex items-center gap-1.5 p-2 rounded border border-dashed border-slate-200 bg-slate-50 text-xs">
                            <AlertTriangle className="w-3 h-3 text-slate-400" />
                            <span className="text-slate-500">{label}: not recorded</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        <span className="font-mono">{AI_USAGE_LOGS_TABLE}</span> stores no gate-check result, and this
                        build runs no gate check. Neither a pass nor a failure is claimed for any row.
                      </p>
                    </div>

                    {/* Details — recorded columns only. */}
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block">Row ID</span>
                        <span className="font-mono text-slate-700">{inv.id}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Bot ID</span>
                        <span className="font-mono text-slate-700">{inv.botId || 'not recorded'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Workspace</span>
                        <span className="font-mono text-slate-700">{inv.workspaceId ?? 'not recorded'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">User</span>
                        <span className="text-slate-700">{inv.userName || 'not recorded'} <span className="font-mono text-slate-400">{inv.userId}</span></span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Provider / model recorded on the row</span>
                        <span className="text-slate-700">{inv.provider || 'not recorded'} / {inv.model || 'not recorded'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Provider on the bot record</span>
                        <span className={providerLabel.matched ? 'text-slate-700' : 'text-amber-600'}>
                          {bot ? providerLabel.label : 'no matching bot record'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Tokens in / out</span>
                        <span className="text-slate-700">
                          {inv.tokensInput ?? 'not recorded'} / {inv.tokensOutput ?? 'not recorded'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Recorded human action</span>
                        <span className="font-medium text-slate-700">{inv.humanAction ?? 'not recorded'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Accepted / edited</span>
                        <span className="text-slate-500">Not recorded by this table</span>
                      </div>
                    </div>

                    {/* Recorded outcome */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recorded outcome</h4>
                      <div className={`p-3 rounded border text-sm ${isError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                        {invocationOutcome(inv)}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        This is the recorded status value. The generated text itself is not stored in this table.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filteredInvocations.length === 0 && (
          <Card className="bg-slate-50">
            <CardContent className="py-12 text-center">
              <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No recorded rows match the current filters. {invocations.length} rows were read.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Retention note. The old copy asserted a 365-day retention policy and
          that all logs are "immutable and retained for compliance" — neither
          is implemented or verifiable from this application. */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="py-3">
          <div className="flex items-start gap-2 text-slate-700 text-sm">
            <Shield className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="text-xs">
              This build applies no retention policy and enforces no immutability on{' '}
              <span className="font-mono">{AI_USAGE_LOGS_TABLE}</span>: it neither deletes nor protects these rows.
              The export writes exactly the recorded columns shown above; fields the table does not record are
              exported as "not recorded" rather than as a value.
            </span>
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
