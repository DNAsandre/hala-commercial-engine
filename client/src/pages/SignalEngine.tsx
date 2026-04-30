import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
/**
 * SIGNAL ENGINE PAGE
 * Design: Swiss Precision Instrument — Deep navy + warm white
 * Sections: Signal Rules, Active Signals, Escalation Matrix, Explainability
 * All signals are advisory — human must acknowledge and decide.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  AlertTriangle, Bell, Activity, TrendingUp, TrendingDown, BarChart3,
  Clock, CheckCircle2, XCircle, Eye, Shield, Zap, Filter, ArrowUp,
  ArrowDown, Minus, AlertOctagon, Radio, ChevronRight, Info, Plus, Settings, Loader2
} from 'lucide-react';
import {
  type SignalRule, type SignalEvent
} from '@/lib/bot-governance';
import { api } from '@/lib/api-client';

const severityConfig = {
  fyi: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Info, label: 'FYI' },
  needs_review: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: AlertTriangle, label: 'Needs Review' },
  escalate: { color: 'bg-red-100 text-red-800 border-red-200', icon: AlertOctagon, label: 'Escalate' },
};

const metricConfig: Record<string, { icon: typeof TrendingUp; color: string }> = {
  gp_drop: { icon: TrendingDown, color: 'text-red-500' },
  dso_spike: { icon: TrendingUp, color: 'text-amber-500' },
  volume_anomaly: { icon: BarChart3, color: 'text-blue-500' },
  cost_overrun: { icon: AlertTriangle, color: 'text-red-500' },
  sla_breach: { icon: AlertOctagon, color: 'text-red-600' },
  approval_delay: { icon: Clock, color: 'text-amber-500' },
  error_rate_spike: { icon: Zap, color: 'text-red-500' },
};

// Map DB snake_case to component camelCase
function mapRule(r: any): SignalRule {
  return {
    id: r.id, botId: r.bot_id || r.botId, name: r.name, type: r.type,
    metric: r.metric, threshold: r.threshold, trendDirection: r.trend_direction ?? r.trendDirection ?? null,
    timeRangeHours: r.time_range_hours ?? r.timeRangeHours ?? 24,
    severity: r.severity, notifyRoles: r.notify_roles || r.notifyRoles || [],
    enabled: r.enabled, description: r.description, condition: r.condition,
    timeWindow: r.time_window || r.timeWindow || '24h',
    cooldownMinutes: r.cooldown_minutes ?? r.cooldownMinutes ?? 60,
  };
}

function mapEvent(e: any): SignalEvent {
  return {
    id: e.id, ruleId: e.rule_id || e.ruleId, botId: e.bot_id || e.botId,
    timestamp: e.triggered_at || e.timestamp, severity: e.severity, metric: e.metric,
    thresholdTriggered: e.threshold_triggered || e.thresholdTriggered || '',
    timeRangeAnalyzed: e.time_range_analyzed || e.timeRangeAnalyzed || '',
    message: e.message, acknowledged: e.acknowledged,
    acknowledgedBy: e.acknowledged_by || e.acknowledgedBy || null,
    acknowledgedAt: e.acknowledged_at || e.acknowledgedAt || null,
    explainability: e.explainability, suggestedAction: e.suggested_action || e.suggestedAction || '',
  };
}

export default function SignalEngine() {
  const [rules, setRules] = useState<SignalRule[]>([]);
  const [events, setEvents] = useState<SignalEvent[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [, setRefresh] = useState(0);
  const [showAddRule, setShowAddRule] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [bots, setBots] = useState<any[]>([]);
  const [newRule, setNewRule] = useState({ name: '', metric: 'gp_drop', type: 'threshold' as const, threshold: 15, severity: 'needs_review' as const, description: '' });

  // Load from API
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [rulesRes, eventsRes, botsRes] = await Promise.all([
          api.botGovernance.listSignalRules(),
          api.botGovernance.listSignalEvents(),
          api.botGovernance.listBots(),
        ]);
        if (!mounted) return;
        setRules((rulesRes.data || []).map(mapRule));
        setEvents((eventsRes.data || []).map(mapEvent));
        setBots(botsRes.data || []);
      } catch { /* empty state is honest */ }
    })();
    return () => { mounted = false; };
  }, []);

  const activeEvents = events.filter(e => !e.acknowledged);
  const escalateCount = activeEvents.filter(e => e.severity === 'escalate').length;
  const reviewCount = activeEvents.filter(e => e.severity === 'needs_review').length;
  const fyiCount = activeEvents.filter(e => e.severity === 'fyi').length;

  const filteredEvents = events.filter(e => {
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
    return true;
  });

  const handleAcknowledge = async (eventId: string) => {
    setEvents(prev => prev.map(e =>
      e.id === eventId ? { ...e, acknowledged: true, acknowledgedBy: 'Amin Al-Rashid', acknowledgedAt: new Date().toISOString() } : e
    ));
    try {
      await api.botGovernance.acknowledgeSignal(eventId);
      toast.success('Signal acknowledged');
    } catch {
      // Rollback
      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, acknowledged: false, acknowledgedBy: null, acknowledgedAt: null } : e
      ));
      toast.error('Failed to acknowledge signal — reverted');
    }
  };

  const handleToggleRule = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    const newEnabled = rule ? !rule.enabled : true;
    setRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, enabled: newEnabled } : r
    ));
    try {
      await api.botGovernance.updateSignalRule(ruleId, { enabled: newEnabled });
      toast.success(`Rule ${newEnabled ? 'enabled' : 'disabled'}`);
    } catch {
      // Rollback
      setRules(prev => prev.map(r =>
        r.id === ruleId ? { ...r, enabled: !newEnabled } : r
      ));
      toast.error('Failed to update rule — reverted');
    }
  };

  const handleAddRule = async () => {
    if (!newRule.name.trim()) { toast.error('Rule name is required'); return; }
    if (!newRule.description.trim()) { toast.error('Description is required'); return; }
    const rulePayload = {
      bot_id: bots[0]?.id || 'bot-monitor',
      name: newRule.name.trim(),
      type: newRule.type,
      metric: newRule.metric,
      threshold: newRule.threshold,
      severity: newRule.severity,
      description: newRule.description.trim(),
      condition: `${newRule.metric} ${newRule.type === 'threshold' ? '>' : 'trend'} ${newRule.threshold}`,
      enabled: true,
      notify_roles: ['commercial_director', 'admin'],
      time_window: '24h',
      cooldown_minutes: 60,
    };
    try {
      const { data } = await api.botGovernance.createSignalRule(rulePayload);
      if (data) {
        setRules(prev => [mapRule(data), ...prev]);
      } else {
        setRules(prev => [{ id: `rule-${Date.now()}`, botId: rulePayload.bot_id, name: rulePayload.name, type: rulePayload.type as any, metric: rulePayload.metric, threshold: rulePayload.threshold, trendDirection: null, timeRangeHours: 24, severity: rulePayload.severity, notifyRoles: rulePayload.notify_roles, enabled: true, description: rulePayload.description, condition: rulePayload.condition, timeWindow: '24h', cooldownMinutes: 60 }, ...prev]);
      }
      toast.success(`Rule "${newRule.name}" created`);
    } catch {
      setRules(prev => [{ id: `rule-${Date.now()}`, botId: rulePayload.bot_id, name: rulePayload.name, type: rulePayload.type as any, metric: rulePayload.metric, threshold: rulePayload.threshold, trendDirection: null, timeRangeHours: 24, severity: rulePayload.severity, notifyRoles: rulePayload.notify_roles, enabled: true, description: rulePayload.description, condition: rulePayload.condition, timeWindow: '24h', cooldownMinutes: 60 }, ...prev]);
      toast.success(`Rule "${newRule.name}" created (local only)`);
    }
    setNewRule({ name: '', metric: 'gp_drop', type: 'threshold', threshold: 15, severity: 'needs_review', description: '' });
    setShowAddRule(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="mb-4">
        <Link href="/admin-panel">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
          </Button>
        </Link>
      </div>
      <h1 className="text-2xl font-bold font-serif text-slate-900">Signal Engine</h1>
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-slate-500">Monitor bots generate signals. Humans review and decide. No auto-action.</p>
          <Button
            size="sm"
            className="text-xs h-7 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            disabled={scanning}
            onClick={async () => {
              setScanning(true);
              toast.info('Scanning business data...');
              try {
                const res = await api.botGovernance.runSignalScanner();
                if (res.data) {
                  toast.success(`Scan complete — ${res.data.scanned} rules evaluated, ${res.data.triggered} signals triggered`);
                  // Refresh events
                  const eventsRes = await api.botGovernance.listSignalEvents();
                  if (eventsRes.data?.length) setEvents(eventsRes.data.map(mapEvent));
                }
              } catch { toast.error('Signal scan failed'); }
              finally { setScanning(false); }
            }}
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />} {scanning ? 'Scanning...' : 'Scan Now'}
          </Button>
        </div>
      </div>

      {/* Signal Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card className={`${escalateCount > 0 ? 'border-red-300 bg-red-50' : ''}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Escalations</p>
                <p className={`text-3xl font-bold mt-1 ${escalateCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{escalateCount}</p>
              </div>
              <AlertOctagon className={`w-8 h-8 ${escalateCount > 0 ? 'text-red-400 animate-pulse' : 'text-slate-300'}`} />
            </div>
          </CardContent>
        </Card>
        <Card className={`${reviewCount > 0 ? 'border-amber-300 bg-amber-50' : ''}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Needs Review</p>
                <p className={`text-3xl font-bold mt-1 ${reviewCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{reviewCount}</p>
              </div>
              <AlertTriangle className={`w-8 h-8 ${reviewCount > 0 ? 'text-amber-400' : 'text-slate-300'}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">FYI</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{fyiCount}</p>
              </div>
              <Info className="w-8 h-8 text-blue-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Active Rules</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{rules.filter(r => r.enabled).length}</p>
                <p className="text-xs text-slate-400">{rules.length} total</p>
              </div>
              <Settings className="w-8 h-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Signal Events</TabsTrigger>
          <TabsTrigger value="rules">Signal Rules</TabsTrigger>
          <TabsTrigger value="escalation">Escalation Matrix</TabsTrigger>
          <TabsTrigger value="explainability">Explainability</TabsTrigger>
        </TabsList>

        {/* Signal Events */}
        <TabsContent value="events" className="space-y-4">
          <div className="flex items-center justify-between">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Filter by severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="escalate">Escalate Only</SelectItem>
                <SelectItem value="needs_review">Needs Review</SelectItem>
                <SelectItem value="fyi">FYI Only</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => {
              setEvents(prev => prev.map(e => ({ ...e, acknowledged: true, acknowledgedBy: 'Amin Al-Rashid', acknowledgedAt: new Date().toISOString() })));
              toast.success('All signals acknowledged');
            }}>
              Acknowledge All
            </Button>
          </div>

          <div className="space-y-3">
            {filteredEvents.map(event => {
              const config = severityConfig[event.severity];
              const Icon = config.icon;
              const bot = bots.find((b: any) => b.id === event.botId);
              const rule = rules.find(r => r.id === event.ruleId);
              return (
                <Card key={event.id} className={`${!event.acknowledged ? 'border-l-4' : 'opacity-70'} ${event.severity === 'escalate' ? 'border-l-red-500' : event.severity === 'needs_review' ? 'border-l-amber-500' : 'border-l-blue-400'}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={config.color}>
                            <Icon className="w-3 h-3 mr-1" /> {config.label}
                          </Badge>
                          <span className="text-xs text-slate-400">{new Date(event.timestamp).toLocaleString()}</span>
                          {event.acknowledged && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Acknowledged by {event.acknowledgedBy}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-900 mt-2">{event.message}</p>
                        <div className="mt-3 grid grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 block">Metric</span>
                            <span className="font-medium text-slate-700">{event.metric}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Threshold</span>
                            <span className="font-medium text-slate-700">{event.thresholdTriggered}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Time Range</span>
                            <span className="font-medium text-slate-700">{event.timeRangeAnalyzed}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Bot</span>
                            <span className="font-medium text-slate-700">{bot?.name || 'Unknown'}</span>
                          </div>
                        </div>
                        {event.explainability && (
                          <div className="mt-3 p-2 bg-slate-50 rounded border text-xs">
                            <span className="text-slate-400 font-medium">Explainability: </span>
                            <span className="text-slate-600">{event.explainability}</span>
                          </div>
                        )}
                        {event.suggestedAction && (
                          <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200 text-xs">
                            <span className="text-blue-600 font-medium">Suggested Action: </span>
                            <span className="text-blue-800">{event.suggestedAction}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        {!event.acknowledged && (
                          <Button variant="outline" size="sm" onClick={() => handleAcknowledge(event.id)}>
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Signal Rules */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-500">Configure which metrics trigger signals and at what thresholds.</p>
            <Button variant="outline" size="sm" onClick={() => setShowAddRule(!showAddRule)}>
              <Plus className="w-3 h-3 mr-1" /> {showAddRule ? 'Cancel' : 'Add Rule'}
            </Button>
          </div>

          {showAddRule && (
            <Card className="border-2 border-dashed border-blue-200 bg-blue-50/30">
              <CardContent className="py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Rule Name</Label>
                    <Input placeholder="e.g., GP Drop Alert" value={newRule.name} onChange={e => setNewRule(prev => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Metric</Label>
                    <Select value={newRule.metric} onValueChange={v => setNewRule(prev => ({ ...prev, metric: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gp_drop">GP Drop</SelectItem>
                        <SelectItem value="dso_spike">DSO Spike</SelectItem>
                        <SelectItem value="volume_anomaly">Volume Anomaly</SelectItem>
                        <SelectItem value="cost_overrun">Cost Overrun</SelectItem>
                        <SelectItem value="sla_breach">SLA Breach</SelectItem>
                        <SelectItem value="approval_delay">Approval Delay</SelectItem>
                        <SelectItem value="error_rate_spike">Error Rate Spike</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select value={newRule.type} onValueChange={(v: any) => setNewRule(prev => ({ ...prev, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="threshold">Threshold</SelectItem>
                        <SelectItem value="trend">Trend</SelectItem>
                        <SelectItem value="anomaly">Anomaly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Threshold</Label>
                    <Input type="number" value={newRule.threshold} onChange={e => setNewRule(prev => ({ ...prev, threshold: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Severity</Label>
                    <Select value={newRule.severity} onValueChange={(v: any) => setNewRule(prev => ({ ...prev, severity: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fyi">FYI</SelectItem>
                        <SelectItem value="needs_review">Needs Review</SelectItem>
                        <SelectItem value="escalate">Escalate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Input placeholder="What does this rule monitor?" value={newRule.description} onChange={e => setNewRule(prev => ({ ...prev, description: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowAddRule(false)}>Cancel</Button>
                  <Button size="sm" className="bg-[#1B2A4A]" onClick={handleAddRule}>Create Rule</Button>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {rules.map(rule => {
              const mc = metricConfig[rule.metric] || { icon: Activity, color: 'text-slate-500' };
              const MetricIcon = mc.icon;
              return (
                <Card key={rule.id} className={`${!rule.enabled ? 'opacity-50' : ''}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100`}>
                          <MetricIcon className={`w-5 h-5 ${mc.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-slate-900">{rule.name}</h3>
                            <Badge variant="outline" className={severityConfig[rule.severity]?.color || ''}>{rule.severity}</Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{rule.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <span>Metric: <span className="font-medium text-slate-600">{rule.metric}</span></span>
                            <span>Condition: <span className="font-medium text-slate-600">{rule.condition} {rule.threshold}</span></span>
                            <span>Window: <span className="font-medium text-slate-600">{rule.timeWindow}</span></span>
                            <span>Cooldown: <span className="font-medium text-slate-600">{rule.cooldownMinutes}min</span></span>
                          </div>
                        </div>
                      </div>
                      <Switch checked={rule.enabled} onCheckedChange={() => handleToggleRule(rule.id)} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Escalation Matrix */}
        <TabsContent value="escalation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Escalation Matrix</CardTitle>
              <CardDescription>Defines who gets notified at each severity level and the required response time.</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-slate-500 font-medium">Severity</th>
                    <th className="text-left py-2 text-slate-500 font-medium">Notify</th>
                    <th className="text-left py-2 text-slate-500 font-medium">Response SLA</th>
                    <th className="text-left py-2 text-slate-500 font-medium">Auto-Escalate</th>
                    <th className="text-left py-2 text-slate-500 font-medium">Channel</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3"><Badge className="bg-red-100 text-red-800 border-red-200">Escalate</Badge></td>
                    <td className="py-3 text-slate-700">Commercial Director + CEO</td>
                    <td className="py-3 text-slate-700">1 hour</td>
                    <td className="py-3 text-slate-700">After 2 hours → CEO direct</td>
                    <td className="py-3 text-slate-700">Email + SMS + Dashboard</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3"><Badge className="bg-amber-100 text-amber-800 border-amber-200">Needs Review</Badge></td>
                    <td className="py-3 text-slate-700">Sales Head + Commercial Director</td>
                    <td className="py-3 text-slate-700">4 hours</td>
                    <td className="py-3 text-slate-700">After 8 hours → Escalate</td>
                    <td className="py-3 text-slate-700">Email + Dashboard</td>
                  </tr>
                  <tr>
                    <td className="py-3"><Badge className="bg-blue-100 text-blue-800 border-blue-200">FYI</Badge></td>
                    <td className="py-3 text-slate-700">Relevant team lead</td>
                    <td className="py-3 text-slate-700">24 hours</td>
                    <td className="py-3 text-slate-700">After 48 hours → Needs Review</td>
                    <td className="py-3 text-slate-700">Dashboard only</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-amber-800 text-sm">
                <Shield className="w-4 h-4" />
                <span className="font-medium">Escalation is advisory only.</span>
                <span className="text-amber-600">No signal triggers automatic action. Humans must acknowledge and decide on every signal.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Explainability */}
        <TabsContent value="explainability" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Explainability Requirements</CardTitle>
              <CardDescription>Every signal must include a human-readable explanation of why it was triggered.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-slate-50">
                  <CardContent className="py-4">
                    <h4 className="font-medium text-sm mb-2">Required Fields</h4>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Metric name and current value</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Threshold that was triggered</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Time range analyzed</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Plain-language explanation</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Suggested action (advisory)</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Source bot identification</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Data sources used</li>
                    </ul>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50">
                  <CardContent className="py-4">
                    <h4 className="font-medium text-sm mb-2">Transparency Rules</h4>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li className="flex items-center gap-2"><Shield className="w-3 h-3 text-blue-500" /> No black-box signals — all must be explainable</li>
                      <li className="flex items-center gap-2"><Shield className="w-3 h-3 text-blue-500" /> Signal source (bot + version) always visible</li>
                      <li className="flex items-center gap-2"><Shield className="w-3 h-3 text-blue-500" /> Confidence score when applicable</li>
                      <li className="flex items-center gap-2"><Shield className="w-3 h-3 text-blue-500" /> Historical context for trend signals</li>
                      <li className="flex items-center gap-2"><Shield className="w-3 h-3 text-blue-500" /> No hidden auto-actions from signals</li>
                      <li className="flex items-center gap-2"><Shield className="w-3 h-3 text-blue-500" /> All signal data exportable for audit</li>
                      <li className="flex items-center gap-2"><Shield className="w-3 h-3 text-blue-500" /> Signal history retained indefinitely</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Example Signal Explanation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-slate-50 rounded border font-mono text-xs space-y-2">
                    <div><span className="text-slate-400">signal_id:</span> <span className="text-slate-700">SIG-2026-0215-001</span></div>
                    <div><span className="text-slate-400">metric:</span> <span className="text-slate-700">gp_drop</span></div>
                    <div><span className="text-slate-400">current_value:</span> <span className="text-red-600">12.3%</span></div>
                    <div><span className="text-slate-400">threshold:</span> <span className="text-slate-700">&lt; 15%</span></div>
                    <div><span className="text-slate-400">time_range:</span> <span className="text-slate-700">Last 7 days</span></div>
                    <div><span className="text-slate-400">explanation:</span> <span className="text-slate-700">"GP% for customer ACME-001 dropped from 18.2% to 12.3% over the past 7 days. This is below the 15% warning threshold. The drop correlates with 3 new quotes at reduced margins submitted by Sales Rep Ahmed K."</span></div>
                    <div><span className="text-slate-400">suggested_action:</span> <span className="text-blue-600">"Review recent quotes for ACME-001. Consider whether volume justifies margin reduction."</span></div>
                    <div><span className="text-slate-400">source_bot:</span> <span className="text-slate-700">GP Monitor v2.1 (bot-002)</span></div>
                    <div><span className="text-slate-400">data_sources:</span> <span className="text-slate-700">["quotes_table", "customer_master", "finance_connector"]</span></div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
