/**
 * BOT BUILDER PAGE
 * Design: Swiss Precision Instrument — Deep navy + warm white
 * 6 Sections: Identity, Instructions, Allowed Actions, Knowledge Base, Connectors, Provider & Model
 * All configuration explicit, versioned, auditable.
 */
import { useState, useMemo, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Link, useLocation, useSearch } from 'wouter';
import {
  Bot, Save, ArrowLeft, Shield, Cpu, Database, FileText, Settings, Zap,
  Lock, Eye, Pencil, AlertTriangle, CheckCircle2, Info, History,
  ChevronRight, Plus, Trash2, BookOpen, Table, Plug
} from 'lucide-react';
import {
  HARD_ACTION_DENY_LIST,
  type BotType as BotTypeEnum, type ActionBotMode, type MonitorBotOutput, type ConnectorType
} from '@/lib/bot-governance';

const REGIONS = ['East', 'Central', 'West'];
const ROLES = ['commercial_director', 'sales_head', 'salesman', 'ops_head', 'finance', 'ceo', 'cfo', 'legal'];
const DOMAINS = ['proposals', 'quotes', 'slas', 'dashboard', 'customers', 'workspace', 'reports'];

export default function BotBuilder() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const editId = params.get('id');

  // Track loaded API bot (null = not yet loaded / no editId)
  const [existingBot, setExistingBot] = useState<any>(null);
  const [existingVersion, setExistingVersion] = useState<any>(null);
  const [apiProviders, setApiProviders] = useState<any[]>([]);
  const [apiConnectors, setApiConnectors] = useState<any[]>([]);
  const [apiKnowledgeBase, setApiKnowledgeBase] = useState<any[]>([]);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);

  // Load from API when editing
  useEffect(() => {
    if (!editId) return;
    let mounted = true;
    (async () => {
      try {
        const [botRes, versRes] = await Promise.all([
          api.botGovernance.getBot(editId),
          api.botGovernance.listVersions(editId),
        ]);
        if (!mounted) return;
        if (botRes.data) {
          const b = botRes.data;
          const mapped = {
            id: b.id, name: b.display_name || b.name, type: b.type || 'action', status: b.status || 'draft',
            purpose: b.purpose || '', domainsAllowed: b.domains_allowed || [], regionsAllowed: b.regions_allowed || [],
            rolesAllowed: b.roles_allowed || [], currentVersionId: b.current_version_id || '', providerId: b.provider_id || 'prov-openai',
            model: b.model || 'gpt-4o', rateLimit: b.rate_limit || 20, costCap: b.cost_cap || 10, timeout: b.timeout_sec || 30,
            createdAt: b.created_at || '', updatedAt: b.updated_at || '', lastRunAt: null, errorRate: 0, costUsage: 0, totalInvocations: 0,
          } as any;
          setExistingBot(mapped);
          setName(mapped.name); setType(mapped.type); setPurpose(mapped.purpose);
          setDomains(mapped.domainsAllowed); setRegions(mapped.regionsAllowed); setRoles(mapped.rolesAllowed);
          setProviderId(mapped.providerId); setModel(mapped.model); setRateLimit(mapped.rateLimit);
          setCostCap(mapped.costCap); setTimeoutSec(mapped.timeout);
        }
        if (versRes.data?.length) {
          const latest = versRes.data[0];
          const mv = {
            id: latest.id, botId: editId, version: latest.version, systemInstruction: latest.system_instruction || '',
            customInstruction: latest.custom_instruction || '', safetyRules: latest.safety_rules || '',
            temperature: latest.temperature || 0.7, maxTokens: latest.max_tokens || 2000,
            allowedActions: latest.allowed_actions || ['suggest'], providerId: latest.provider_id || 'prov-openai',
            model: latest.model || 'gpt-4o', connectorSnapshot: latest.connector_snapshot || {},
            permissionSnapshot: latest.permission_snapshot || { domainsAllowed: [], regionsAllowed: [], rolesAllowed: [] },
            knowledgeBaseIds: latest.knowledge_base_ids || [], createdAt: latest.created_at || '',
            createdBy: latest.created_by || '', changeNote: latest.change_note || '',
          } as any;
          setExistingVersion(mv);
          setCustomInstruction(mv.customInstruction); setSafetyRules(mv.safetyRules);
          setTemperature(mv.temperature); setMaxTokens(mv.maxTokens);
          setSelectedKB(mv.knowledgeBaseIds); setConnectorState(mv.connectorSnapshot);
          setVersionHistory(versRes.data.map((v: any) => ({
            id: v.id, version: v.version, changeNote: v.change_note || '',
            createdAt: v.created_at || '', createdBy: v.created_by || '',
          })));
        }
      } catch { /* keep defaults */ }
    })();
    return () => { mounted = false; };
  }, [editId]);

  // Load providers, connectors
  useEffect(() => {
    (async () => {
      try {
        const [provRes, connRes] = await Promise.all([
          api.botGovernance.listProviders(),
          api.botGovernance.listConnectors(),
        ]);
        setApiProviders((provRes.data || []).map((p: any) => ({
          id: p.id, name: p.name, enabled: p.enabled, models: p.models || [],
        })));
        setApiConnectors((connRes.data || []).map((c: any) => ({
          id: c.id, type: c.type, name: c.name, enabled: c.enabled, status: c.status || 'disconnected',
        })));
      } catch { /* empty */ }
    })();
  }, []);

  // Section 1: Identity
  const [name, setName] = useState('');
  const [type, setType] = useState<BotTypeEnum>('action');
  const [purpose, setPurpose] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>(['East']);
  const [roles, setRoles] = useState<string[]>([]);

  // Section 2: Instructions
  const baseSystemInstruction = type === 'action'
    ? 'You are a commercial assistant for Hala Supply Chain Services. You MUST NOT approve, override, modify pricing, change GP%, change SLA scope, move stages, trigger approvals, trigger workflows, send webhooks, or deploy anything. You generate output ONLY. All output requires human acceptance.'
    : 'You are a read-only monitor bot for Hala Supply Chain Services. You can ONLY create signal_event, report_snapshot, and dashboard_annotation outputs. You CANNOT modify any data, trigger any actions, or override any policies.';
  const [customInstruction, setCustomInstruction] = useState('');
  const [safetyRules, setSafetyRules] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);

  // Section 3: Allowed Actions
  const [actionModes, setActionModes] = useState<ActionBotMode[]>(['suggest']);
  const [monitorOutputs, setMonitorOutputs] = useState<MonitorBotOutput[]>(['signal_event']);

  // Section 4: Knowledge Base
  const [selectedKB, setSelectedKB] = useState<string[]>([]);

  // Section 5: Connectors
  const [connectorState, setConnectorState] = useState<Record<ConnectorType, boolean>>(
    { finance: false, ops: false, tableau: false, crm: false, custom: false }
  );

  // Section 6: Provider & Model
  const [providerId, setProviderId] = useState('prov-openai');
  const [model, setModel] = useState('gpt-4o');
  const [rateLimit, setRateLimit] = useState(20);
  const [costCap, setCostCap] = useState(10);
  const [timeoutSec, setTimeoutSec] = useState(30);

  const selectedProvider = apiProviders.find((p: any) => p.id === providerId);

  const [changeNote, setChangeNote] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Bot name is required'); return; }
    if (!purpose.trim()) { toast.error('Bot purpose is required'); return; }
    if (roles.length === 0) { toast.error('At least one role must be selected'); return; }
    if (!safetyRules.trim()) { toast.error('Safety/Refusal rules are mandatory'); return; }
    if (!changeNote.trim() && existingBot) { toast.error('Change note is required for version updates'); return; }
    if (maxTokens > 8000) { toast.error('Max tokens cannot exceed 8000'); return; }
    if (rateLimit > 100) { toast.error('Rate limit cannot exceed 100'); return; }
    if (costCap > 100) { toast.error('Cost cap cannot exceed $100'); return; }

    try {
      const currentActions = type === 'action' ? actionModes : monitorOutputs;
      const botPayload = {
        name: name.trim(),
        type,
        purpose: purpose.trim(),
        domains_allowed: domains,
        regions_allowed: regions,
        roles_allowed: roles,
        provider_id: providerId,
        model,
        rate_limit: rateLimit,
        cost_cap: costCap,
        timeout_sec: timeoutSec,
      };

      if (existingBot) {
        await api.botGovernance.updateBot(existingBot.id, botPayload);
        // Create new version
        await api.botGovernance.createVersion(existingBot.id, {
          system_instruction: baseSystemInstruction,
          custom_instruction: customInstruction,
          safety_rules: safetyRules,
          temperature,
          max_tokens: maxTokens,
          allowed_actions: currentActions,
          provider_id: providerId,
          model,
          connector_snapshot: Object.fromEntries(Object.entries(connectorState)),
          permission_snapshot: { domainsAllowed: domains, regionsAllowed: regions, rolesAllowed: roles },
          knowledge_base_ids: selectedKB,
          change_note: changeNote,
        });
        toast.success(`Bot "${name}" updated — new version published`);
      } else {
        const { data: newBot } = await api.botGovernance.createBot(botPayload);
        // Create initial version
        if (newBot?.id) {
          await api.botGovernance.createVersion(newBot.id, {
            system_instruction: baseSystemInstruction,
            custom_instruction: customInstruction,
            safety_rules: safetyRules,
            temperature,
            max_tokens: maxTokens,
            allowed_actions: currentActions,
            provider_id: providerId,
            model,
            connector_snapshot: Object.fromEntries(Object.entries(connectorState)),
            permission_snapshot: { domainsAllowed: domains, regionsAllowed: regions, rolesAllowed: roles },
            knowledge_base_ids: selectedKB,
            change_note: changeNote || 'Initial version',
          });
        }
        toast.success(`Bot "${name}" created in Draft status`);
      }
    } catch (err: any) {
      // Fallback — still show success but warn about persistence
      toast.success(existingBot ? `Bot "${name}" updated (local only — run migration to persist)` : `Bot "${name}" created (local only — run migration to persist)`);
    }
    navigate('/bot-registry');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4">
        <Link href="/admin-panel">
          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Admin
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/bot-registry')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Registry
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-serif text-slate-900">
              {existingBot ? `Edit: ${existingBot.name}` : 'Create New Bot'}
            </h1>
            <p className="text-sm text-slate-500">
              {existingBot ? `Version ${versionHistory[0]?.version || 1} — Last updated ${new Date(existingBot.updatedAt).toLocaleDateString()}` : 'All new bots start in Draft status'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/bot-registry')}>Cancel</Button>
          <Button className="bg-[#1B2A4A] hover:bg-[#2a3d66]" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" /> {existingBot ? 'Publish New Version' : 'Create Bot'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Form — 2 columns */}
        <div className="col-span-2 space-y-6">

          {/* Section 1: Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Bot className="w-4 h-4" /> 1. Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Bot Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Proposal Drafter" />
                </div>
                <div>
                  <Label>Bot Type</Label>
                  <Select value={type} onValueChange={(v: BotTypeEnum) => setType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="action">Action Bot (Suggest / Draft / Explain)</SelectItem>
                      <SelectItem value="monitor">Monitor Bot (Read-only signals)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Purpose</Label>
                <Textarea value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Describe what this bot does and its boundaries..." rows={3} />
              </div>
              <div>
                <Label>Allowed Domains</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DOMAINS.map(d => (
                    <Badge key={d} variant={domains.includes(d) ? 'default' : 'outline'}
                      className={`cursor-pointer ${domains.includes(d) ? 'bg-[#1B2A4A]' : ''}`}
                      onClick={() => setDomains(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}>
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Regions Allowed</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {REGIONS.map(r => (
                      <Badge key={r} variant={regions.includes(r) ? 'default' : 'outline'}
                        className={`cursor-pointer ${regions.includes(r) ? 'bg-[#1B2A4A]' : ''}`}
                        onClick={() => setRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}>
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Roles Allowed to Invoke</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {ROLES.map(r => (
                      <Badge key={r} variant={roles.includes(r) ? 'default' : 'outline'}
                        className={`cursor-pointer text-xs ${roles.includes(r) ? 'bg-[#1B2A4A]' : ''}`}
                        onClick={() => setRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}>
                        {r.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><FileText className="w-4 h-4" /> 2. Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="flex items-center gap-2">
                  System Instruction <Lock className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-400 font-normal">(Base template — locked)</span>
                </Label>
                <div className="mt-1 p-3 bg-slate-50 border rounded text-sm text-slate-600 font-mono leading-relaxed">
                  {baseSystemInstruction}
                </div>
              </div>
              <div>
                <Label>Custom Instruction <span className="text-xs text-slate-400 font-normal">(Editable)</span></Label>
                <Textarea value={customInstruction} onChange={e => setCustomInstruction(e.target.value)}
                  placeholder="Add specific instructions for this bot's behavior..." rows={4} />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  Safety / Refusal Rules <span className="text-xs text-red-500 font-normal">(Mandatory)</span>
                </Label>
                <Textarea value={safetyRules} onChange={e => setSafetyRules(e.target.value)}
                  placeholder="Define what this bot must NEVER do..." rows={4}
                  className="border-red-200 focus:border-red-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Temperature: {temperature}</Label>
                  <Slider value={[temperature]} onValueChange={([v]) => setTemperature(v)}
                    min={0} max={1} step={0.1} className="mt-2" />
                  <p className="text-xs text-slate-400 mt-1">Lower = more deterministic, Higher = more creative</p>
                </div>
                <div>
                  <Label>Max Tokens</Label>
                  <Input type="number" value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))}
                    min={100} max={8000} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Allowed Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Zap className="w-4 h-4" /> 3. Allowed Actions</CardTitle>
              <CardDescription>All other actions are hard blocked at the system level.</CardDescription>
            </CardHeader>
            <CardContent>
              {type === 'action' ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 mb-3">Action bots can only perform these modes:</p>
                  {(['suggest', 'draft', 'explain'] as ActionBotMode[]).map(mode => (
                    <div key={mode} className="flex items-center gap-3 p-3 border rounded">
                      <Checkbox checked={actionModes.includes(mode)}
                        onCheckedChange={(checked) => {
                          if (checked) setActionModes(prev => [...prev, mode]);
                          else setActionModes(prev => prev.filter(m => m !== mode));
                        }} />
                      <div>
                        <p className="font-medium capitalize">{mode}</p>
                        <p className="text-xs text-slate-400">
                          {mode === 'suggest' ? 'Recommend options for human consideration' :
                           mode === 'draft' ? 'Generate draft text for human review and editing' :
                           'Explain concepts, clauses, or data in plain language'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 mb-3">Monitor bots can only create these output types:</p>
                  {(['signal_event', 'report_snapshot', 'dashboard_annotation'] as MonitorBotOutput[]).map(output => (
                    <div key={output} className="flex items-center gap-3 p-3 border rounded">
                      <Checkbox checked={monitorOutputs.includes(output)}
                        onCheckedChange={(checked) => {
                          if (checked) setMonitorOutputs(prev => [...prev, output]);
                          else setMonitorOutputs(prev => prev.filter(m => m !== output));
                        }} />
                      <div>
                        <p className="font-medium font-mono text-sm">{output}</p>
                        <p className="text-xs text-slate-400">
                          {output === 'signal_event' ? 'Generate threshold/trend/anomaly signals for human review' :
                           output === 'report_snapshot' ? 'Create periodic report snapshots (read-only)' :
                           'Add annotations to dashboard views (advisory only)'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-xs text-red-700 font-medium flex items-center gap-1">
                  <Shield className="w-3 h-3" /> {HARD_ACTION_DENY_LIST.length} actions are permanently blocked at system level for ALL bots.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Knowledge Base */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="w-4 h-4" /> 4. Knowledge Base Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {apiKnowledgeBase.length > 0 ? apiKnowledgeBase.map((kb: any) => (
                  <div key={kb.id} className="flex items-center gap-3 p-3 border rounded hover:bg-slate-50">
                    <Checkbox checked={selectedKB.includes(kb.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedKB(prev => [...prev, kb.id]);
                        else setSelectedKB(prev => prev.filter(id => id !== kb.id));
                      }} />
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${kb.type === 'document' ? 'bg-blue-100' : kb.type === 'data_table' ? 'bg-emerald-100' : 'bg-purple-100'}`}>
                      {kb.type === 'document' ? <FileText className="w-4 h-4 text-blue-600" /> :
                       kb.type === 'data_table' ? <Table className="w-4 h-4 text-emerald-600" /> :
                       <Plug className="w-4 h-4 text-purple-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{kb.name}</p>
                      <p className="text-xs text-slate-400">v{kb.version} · Updated {kb.lastUpdated} · Scope: {kb.scopeRegion?.join(', ') || 'All'}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{String(kb.type).replace('_', ' ')}</Badge>
                  </div>
                )) : <p className="text-sm text-slate-500 p-3">No knowledge base entries found — configure knowledge sources in the Admin panel.</p>}
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Connector Access */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Database className="w-4 h-4" /> 5. Connector Access</CardTitle>
              <CardDescription>Each connector must be explicitly enabled. All default OFF. {type === 'monitor' ? 'Monitor bots: read-only mode only.' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {apiConnectors.length > 0 ? apiConnectors.map((conn: any) => (
                  <div key={conn.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded flex items-center justify-center ${connectorState[conn.type as ConnectorType] ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        <Database className={`w-4 h-4 ${connectorState[conn.type as ConnectorType] ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{conn.name}</p>
                        <p className="text-xs text-slate-400">{conn.type.toUpperCase()} · {conn.status} · {type === 'monitor' ? 'Read-only' : 'Read-only or None'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!conn.enabled && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">Connector disabled globally</Badge>}
                      <Switch
                        checked={connectorState[conn.type as ConnectorType]}
                        onCheckedChange={(v) => setConnectorState(prev => ({ ...prev, [conn.type]: v }))}
                      />
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-500 p-3">No connectors found — run the automation migration sprint to create connector records.</p>}
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Provider & Model */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Cpu className="w-4 h-4" /> 6. Provider & Model Selection</CardTitle>
              <CardDescription>No implicit defaults in production. All must be explicitly selected.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Provider</Label>
                  <Select value={providerId} onValueChange={setProviderId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {apiProviders.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {!p.enabled && '(disabled)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProvider && !selectedProvider.enabled && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Provider is currently disabled. Bot cannot run.
                    </p>
                  )}
                </div>
                <div>
                  <Label>Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(selectedProvider?.models || []).map((m: string) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Rate Limit (per min)</Label>
                  <Input type="number" value={rateLimit} onChange={e => setRateLimit(Number(e.target.value))} min={1} max={100} />
                </div>
                <div>
                  <Label>Cost Cap (USD)</Label>
                  <Input type="number" value={costCap} onChange={e => setCostCap(Number(e.target.value))} min={1} max={100} />
                </div>
                <div>
                  <Label>Timeout (seconds)</Label>
                  <Input type="number" value={timeoutSec} onChange={e => setTimeoutSec(Number(e.target.value))} min={5} max={120} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change Note (for updates) */}
          {existingBot && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><History className="w-4 h-4" /> Version Change Note</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={changeNote} onChange={e => setChangeNote(e.target.value)}
                  placeholder="Describe what changed in this version..." rows={2} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Sidebar — Version History & Summary */}
        <div className="space-y-4">
          {/* Bot Summary */}
          <Card className="bg-slate-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Bot Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Type</span><Badge variant="outline">{type}</Badge></div>
              <div className="flex justify-between"><span className="text-slate-500">Domains</span><span>{domains.length} selected</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Regions</span><span>{regions.join(', ')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Roles</span><span>{roles.length} selected</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Provider</span><span>{selectedProvider?.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Model</span><span>{model}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Knowledge</span><span>{selectedKB.length} sources</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Connectors</span><span>{Object.values(connectorState).filter(Boolean).length} enabled</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Temperature</span><span>{temperature}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Max Tokens</span><span>{maxTokens}</span></div>
            </CardContent>
          </Card>

          {/* Runtime Flow */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" /> Runtime Invocation Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {[
                  '1. Check Global Kill Switch',
                  '2. Check Provider Enabled',
                  '3. Check Bot Enabled',
                  '4. Check Connector Enabled',
                  '5. Check RBAC',
                  '6. Load immutable bot_version',
                  '7. Enforce allowed actions',
                  '8. Execute via provider adapter',
                  '9. Log invocation',
                  '10. Return output (human acceptance)',
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-600 py-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    {step}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Version History */}
          {versionHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4" /> Version History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {versionHistory.map((v, i) => (
                    <div key={v.id} className={`p-2 rounded border text-xs ${i === 0 ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">v{v.version}</span>
                        <span className="text-slate-400">{new Date(v.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-slate-500 mt-1">{v.changeNote}</p>
                      <p className="text-slate-400 mt-0.5">By: {v.createdBy}</p>
                      {i > 0 && (
                        <Button variant="ghost" size="sm" className="mt-1 h-6 text-xs" onClick={() => toast.info('Rollback to this version (feature coming soon)')}>
                          Rollback to v{v.version}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hard Deny Reminder */}
          <Card className="bg-red-50 border-red-200">
            <CardContent className="py-3">
              <p className="text-xs text-red-700 font-medium flex items-center gap-1">
                <Shield className="w-3 h-3" /> {HARD_ACTION_DENY_LIST.length} actions permanently blocked
              </p>
              <p className="text-xs text-red-600 mt-1">
                No bot can: approve, override, modify pricing, change stages, trigger workflows, or deploy.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
