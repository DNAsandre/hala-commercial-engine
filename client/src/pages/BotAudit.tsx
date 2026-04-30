import { Link } from "wouter";
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
  type BotInvocation
} from '@/lib/bot-governance';
import { api } from '@/lib/api-client';

// Map DB snake_case to component camelCase
function mapInvocation(row: any): BotInvocation {
  return {
    id: row.id,
    botId: row.bot_id || row.botId,
    botVersionId: row.bot_version_id || row.botVersionId || '',
    userId: row.user_id || row.userId,
    userRole: row.user_role || row.userRole,
    timestamp: row.invoked_at || row.timestamp,
    context: row.context,
    contextType: row.context_type || row.contextType || 'workspace',
    inputPayloadHash: row.input_payload_hash || row.inputPayloadHash || '',
    knowledgeSourcesUsed: row.knowledge_sources_used || row.knowledgeSourcesUsed || [],
    connectorCallsMade: row.connector_calls_made || row.connectorCallsMade || [],
    output: row.output,
    accepted: row.accepted,
    edited: row.edited ?? false,
    cost: row.cost ?? 0,
    latencyMs: row.latency_ms ?? row.latencyMs ?? 0,
    gateChecks: row.gate_checks || row.gateChecks || { globalKillSwitch: false, providerEnabled: true, botEnabled: true, connectorsEnabled: true, rbacPassed: true },
  };
}

export default function BotAudit() {
  const [invocations, setInvocations] = useState<BotInvocation[]>([]);
  const [bots, setBots] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [botFilter, setBotFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load from API
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [invRes, botsRes, provRes] = await Promise.all([
          api.botGovernance.listInvocations(),
          api.botGovernance.listBots(),
          api.botGovernance.listProviders(),
        ]);
        if (!mounted) return;
        setInvocations((invRes.data || []).map(mapInvocation));
        setBots(botsRes.data || []);
        setProviders(provRes.data || []);
      } catch { /* empty state */ }
    })();
    return () => { mounted = false; };
  }, []);

  const filteredInvocations = useMemo(() => {
    return invocations.filter(inv => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!inv.context.toLowerCase().includes(q) && !inv.id.toLowerCase().includes(q) && !inv.output.toLowerCase().includes(q)) return false;
      }
      if (botFilter !== 'all' && inv.botId !== botFilter) return false;
      if (statusFilter === 'accepted' && inv.accepted !== true) return false;
      if (statusFilter === 'rejected' && inv.accepted !== false) return false;
      if (statusFilter === 'pending' && inv.accepted !== null) return false;
      if (statusFilter === 'blocked' && !inv.output.startsWith('BLOCKED')) return false;
      return true;
    });
  }, [searchQuery, botFilter, statusFilter, invocations]);

  const totalCost = invocations.reduce((sum, i) => sum + i.cost, 0);
  const avgLatency = invocations.length > 0 ? invocations.reduce((sum, i) => sum + i.latencyMs, 0) / invocations.length : 0;
  const acceptRate = invocations.filter(i => i.accepted === true).length;
  const editRate = invocations.filter(i => i.edited).length;

  const handleExport = () => {
    const csvHeader = 'ID,Bot,Version,User,Role,Timestamp,Context,Type,Cost,Latency(ms),Accepted,Edited,Kill Switch,Provider,Bot Enabled,Connectors,RBAC\n';
    const csvRows = invocations.map(inv => {
      const bot = bots.find((b: any) => b.id === inv.botId || b.id === (inv as any).bot_id);
      return [
        inv.id,
        bot?.name || inv.botId,
        inv.botVersionId,
        inv.userId,
        inv.userRole,
        inv.timestamp,
        `"${inv.context.replace(/"/g, '""')}"`,
        inv.contextType,
        inv.cost.toFixed(4),
        inv.latencyMs,
        inv.accepted === null ? 'pending' : inv.accepted ? 'yes' : 'no',
        inv.edited ? 'yes' : 'no',
        inv.gateChecks.globalKillSwitch ? 'blocked' : 'pass',
        inv.gateChecks.providerEnabled ? 'pass' : 'blocked',
        inv.gateChecks.botEnabled ? 'pass' : 'blocked',
        inv.gateChecks.connectorsEnabled ? 'pass' : 'blocked',
        inv.gateChecks.rbacPassed ? 'pass' : 'blocked',
      ].join(',');
    }).join('\n');

    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bot-audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Audit trail exported as CSV');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4">
        <Link href="/admin-panel">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-slate-900">Bot Audit & Trace</h1>
          <p className="text-sm text-slate-500 mt-1">Every invocation logged. Every gate check recorded. Fully exportable.</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" /> Export Audit Trail
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Invocations</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{invocations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Cost</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">${totalCost.toFixed(3)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Avg Latency</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{avgLatency.toFixed(0)}ms</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Accepted</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{acceptRate}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Edited After Accept</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{editRate}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search invocations..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={botFilter} onValueChange={setBotFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by bot" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bots</SelectItem>
            {bots.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invocation Log */}
      <div className="space-y-2">
        {filteredInvocations.map(inv => {
          const bot = bots.find((b: any) => b.id === inv.botId || b.id === (inv as any).bot_id);
          const provider = bot ? providers.find((p: any) => p.id === (bot.provider_id || bot.providerId)) : null;
          const isBlocked = inv.output.startsWith('BLOCKED');
          const isExpanded = expandedId === inv.id;

          return (
            <Card key={inv.id} className={`${isBlocked ? 'border-l-4 border-l-red-400 bg-red-50/30' : ''} hover:shadow-sm transition-shadow`}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : inv.id)}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${isBlocked ? 'bg-red-100' : inv.accepted === true ? 'bg-emerald-100' : inv.accepted === false ? 'bg-slate-100' : 'bg-amber-100'}`}>
                      {isBlocked ? <XCircle className="w-4 h-4 text-red-500" /> :
                       inv.accepted === true ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                       inv.accepted === false ? <XCircle className="w-4 h-4 text-slate-400" /> :
                       <Clock className="w-4 h-4 text-amber-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900">{bot?.name || inv.botId}</span>
                        <Badge variant="outline" className="text-xs">{inv.contextType}</Badge>
                        {inv.edited && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Edited</Badge>}
                        {isBlocked && <Badge variant="outline" className="text-xs bg-red-100 text-red-700 border-red-200">Blocked</Badge>}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{inv.context}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{inv.userId}</span>
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${inv.cost.toFixed(4)}</span>
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{inv.latencyMs}ms</span>
                    <span>{new Date(inv.timestamp).toLocaleString()}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-4">
                    {/* Gate Checks */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Gate Checks (10-Step Runtime Flow)</h4>
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { label: 'Kill Switch', passed: !inv.gateChecks.globalKillSwitch },
                          { label: 'Provider', passed: inv.gateChecks.providerEnabled },
                          { label: 'Bot Enabled', passed: inv.gateChecks.botEnabled },
                          { label: 'Connectors', passed: inv.gateChecks.connectorsEnabled },
                          { label: 'RBAC', passed: inv.gateChecks.rbacPassed },
                        ].map(gate => (
                          <div key={gate.label} className={`flex items-center gap-1.5 p-2 rounded border text-xs ${gate.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            {gate.passed ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                            <span className={gate.passed ? 'text-emerald-700' : 'text-red-700'}>{gate.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block">Invocation ID</span>
                        <span className="font-mono text-slate-700">{inv.id}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Bot Version</span>
                        <span className="font-mono text-slate-700">{inv.botVersionId || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Input Hash</span>
                        <span className="font-mono text-slate-700">{inv.inputPayloadHash || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">User / Role</span>
                        <span className="text-slate-700">{inv.userId} ({inv.userRole})</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Provider</span>
                        <span className="text-slate-700">{provider?.name || 'N/A'} / {bot?.model || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Knowledge Sources</span>
                        <span className="text-slate-700">{inv.knowledgeSourcesUsed.length > 0 ? inv.knowledgeSourcesUsed.join(', ') : 'None'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Connector Calls</span>
                        <span className="text-slate-700">{inv.connectorCallsMade.length > 0 ? inv.connectorCallsMade.join(', ') : 'None'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Accepted</span>
                        <span className={`font-medium ${inv.accepted === true ? 'text-emerald-600' : inv.accepted === false ? 'text-red-600' : 'text-amber-600'}`}>
                          {inv.accepted === null ? 'Pending' : inv.accepted ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Edited After Accept</span>
                        <span className={`font-medium ${inv.edited ? 'text-amber-600' : 'text-slate-600'}`}>
                          {inv.edited ? 'Yes — human modified output' : 'No'}
                        </span>
                      </div>
                    </div>

                    {/* Output */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Output</h4>
                      <div className={`p-3 rounded border text-sm ${isBlocked ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                        {inv.output}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredInvocations.length === 0 && (
        <Card className="bg-slate-50">
          <CardContent className="py-12 text-center">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No invocations match your filters</p>
          </CardContent>
        </Card>
      )}

      {/* Audit Compliance Note */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-blue-800 text-sm">
            <Shield className="w-4 h-4" />
            <span className="font-medium">Audit Retention: {365} days.</span>
            <span className="text-blue-600">All invocation logs are immutable and retained for compliance. Export available in CSV format for external audit systems.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
