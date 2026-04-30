import { useState } from 'react';
import { Link, useParams } from 'wouter';
import {
  ArrowLeft, BookOpen, Clock, Eye, Send, AlertTriangle, CheckCircle,
  Download, Shield, Dna, FileText, History,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProposals, useWorkspaces, useQuotesByWorkspace } from '@/hooks/useSupabase';
import {
  getEcrScoreByCustomerName, getGradeBg, getGradeColor, getActiveRuleSet,
} from '@/lib/ecr';
import { formatSAR } from '@/lib/store';
import EcrUpgradeModal from '@/components/EcrUpgradeModal';

const stateConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:                  { label: 'Draft',                color: 'bg-gray-100 text-gray-700 border-gray-200',        icon: Clock },
  ready_for_crm:          { label: 'Ready for CRM',        color: 'bg-cyan-100 text-cyan-700 border-cyan-200',        icon: Eye },
  sent:                   { label: 'Sent',                 color: 'bg-blue-100 text-blue-800 border-blue-200',        icon: Send },
  negotiation_active:     { label: 'Negotiation Active',   color: 'bg-amber-100 text-amber-800 border-amber-200',     icon: AlertTriangle },
  commercial_approved:    { label: 'Commercial Approved',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
};

export default function ProposalDetail() {
  const params = useParams<{ id: string }>();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [, setRefresh] = useState(0);
  const forceUpdate = () => setRefresh(n => n + 1);

  const { data: proposals, loading: propLoading } = useProposals();
  const { data: workspaces, loading: wsLoading } = useWorkspaces();

  const proposal = proposals.find(p => p.id === params.id);
  const workspace = proposal ? workspaces.find(w => w.id === proposal.workspaceId) : undefined;

  const { data: quotes, loading: quotesLoading } = useQuotesByWorkspace(workspace?.id || '');
  const latestQuote = quotes.length > 0
    ? [...quotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : undefined;

  const ecr = workspace ? getEcrScoreByCustomerName(workspace.customerName) : undefined;

  if (propLoading || wsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-8 text-center space-y-3">
        <BookOpen className="w-12 h-12 text-slate-200 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-700">Proposal not found</h2>
        <p className="text-sm text-slate-400">No proposal with ID "{params.id}".</p>
        <Link href="/proposals">
          <Button variant="outline" className="mt-2">Back to Proposals</Button>
        </Link>
      </div>
    );
  }

  const state = stateConfig[proposal.state] || stateConfig.draft;
  const StateIcon = state.icon;

  return (
    <div className="space-y-6 p-6 max-w-[1200px] mx-auto">
      {/* Back */}
      <div>
        <Link href="/proposals">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Proposals
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 mt-0.5">
            <BookOpen className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-serif text-slate-900">{proposal.title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className={`text-xs ${state.color}`}>
                <StateIcon className="w-3 h-3 mr-1" /> {state.label}
              </Badge>
              <span className="text-xs text-slate-400">v{proposal.version}</span>
              {workspace && <span className="text-xs text-slate-500">{workspace.customerName} — {workspace.title}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline" size="sm"
            onClick={() => toast.info('PDF export will be available when governance is activated.')}
          >
            <Download className="w-3.5 h-3.5 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" disabled title="Governance not yet active">
            <Send className="w-3.5 h-3.5 mr-1" /> Submit
          </Button>
          <Button size="sm" disabled title="Governance not yet active" className="opacity-50">
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-4">
              {/* Proposal details */}
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-3 font-medium">Proposal Details</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Title</p>
                      <p className="font-medium text-slate-900 mt-0.5">{proposal.title}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">State</p>
                      <Badge variant="outline" className={`mt-0.5 text-xs ${state.color}`}>
                        <StateIcon className="w-3 h-3 mr-1" /> {state.label}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Version</p>
                      <p className="font-medium text-slate-900 mt-0.5">v{proposal.version}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Created</p>
                      <p className="font-medium text-slate-900 mt-0.5">{new Date(proposal.createdAt).toLocaleDateString()}</p>
                    </div>
                    {workspace && (
                      <>
                        <div>
                          <p className="text-xs text-slate-400">Customer</p>
                          <p className="font-medium text-slate-900 mt-0.5">{workspace.customerName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Workspace</p>
                          <p className="font-medium text-slate-900 mt-0.5">{workspace.title}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Stage</p>
                          <p className="font-medium text-slate-900 mt-0.5 capitalize">{workspace.stage?.replace(/_/g, ' ') || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Region</p>
                          <p className="font-medium text-slate-900 mt-0.5">{workspace.region || '—'}</p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick financial snapshot if quote available */}
              {!quotesLoading && latestQuote && (
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Financial Snapshot</p>
                      <Badge variant="outline" className="text-[10px] text-slate-500">Quote v{latestQuote.version}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-400">Annual Revenue</p>
                        <p className="text-lg font-bold text-slate-900 mt-0.5">{formatSAR(latestQuote.annualRevenue)}</p>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                        <p className="text-xs text-emerald-600">GP %</p>
                        <p className="text-lg font-bold text-emerald-700 mt-0.5">{latestQuote.gpPercent.toFixed(1)}%</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-400">Pallet Volume</p>
                        <p className="text-lg font-bold text-slate-900 mt-0.5">{latestQuote.palletVolume.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ECR Panel */}
            <div>
              <Card className={ecr ? 'border-violet-200' : 'border-slate-200'}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Dna className="w-4 h-4 text-violet-600" />
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">ECR Rating</p>
                  </div>
                  {ecr ? (
                    <div className="space-y-3">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-bold ${getGradeColor(ecr.grade)}`}>{ecr.grade}</span>
                        <span className="text-xl font-bold text-slate-700">{ecr.totalScore.toFixed(1)}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Confidence</span>
                          <span className="font-medium text-slate-700">{ecr.confidenceScore}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Scored</span>
                          <span className="font-medium text-slate-700">{new Date(ecr.computedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-violet-200 text-violet-700 hover:bg-violet-50 text-xs"
                        onClick={() => setShowUpgradeModal(true)}
                      >
                        <Dna className="w-3.5 h-3.5 mr-1.5" /> Request Rule Upgrade
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Shield className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">No ECR score available</p>
                      <p className="text-xs text-slate-300 mt-0.5">Score an input snapshot first</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── PRICING ── */}
        <TabsContent value="pricing" className="mt-6">
          {quotesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : latestQuote ? (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Linked Quote Snapshot</p>
                  <Badge variant="outline" className="text-xs text-slate-500">
                    v{latestQuote.version} · <span className="capitalize ml-1">{latestQuote.state}</span>
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-400">Storage Rate</p>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{formatSAR(latestQuote.storageRate)}<span className="text-xs text-slate-400 font-normal ml-1">/pallet</span></p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-400">Inbound Rate</p>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{formatSAR(latestQuote.inboundRate)}<span className="text-xs text-slate-400 font-normal ml-1">/pallet</span></p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-400">Outbound Rate</p>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{formatSAR(latestQuote.outboundRate)}<span className="text-xs text-slate-400 font-normal ml-1">/pallet</span></p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-400">Pallet Volume</p>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{latestQuote.palletVolume.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-500">Monthly Revenue</p>
                    <p className="text-base font-bold text-blue-900 mt-0.5">{formatSAR(latestQuote.monthlyRevenue)}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-500">Annual Revenue</p>
                    <p className="text-base font-bold text-blue-900 mt-0.5">{formatSAR(latestQuote.annualRevenue)}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <p className="text-xs text-emerald-600">GP Amount</p>
                    <p className="text-base font-bold text-emerald-900 mt-0.5">{formatSAR(latestQuote.gpAmount)}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <p className="text-xs text-emerald-600">GP %</p>
                    <p className="text-base font-bold text-emerald-900 mt-0.5">{latestQuote.gpPercent.toFixed(1)}%</p>
                  </div>
                </div>
                {latestQuote.totalCost > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-6 text-xs text-slate-500">
                    <span>Total Cost: <span className="font-medium text-slate-700">{formatSAR(latestQuote.totalCost)}</span></span>
                    <span>Net: <span className="font-medium text-slate-700">{formatSAR(latestQuote.annualRevenue - latestQuote.totalCost)}</span></span>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-50">
              <CardContent className="py-12 text-center">
                <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">No linked quote</p>
                <p className="text-xs text-slate-300 mt-1">A quote must be linked to this proposal to show pricing.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── SECTIONS ── */}
        <TabsContent value="sections" className="mt-6">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-3 font-medium">Proposal Sections</p>
              {proposal.sections.length > 0 ? (
                <div className="space-y-2">
                  {proposal.sections.map((section, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {i + 1}
                      </div>
                      <span className="text-sm text-slate-800">{section}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No sections defined for this proposal.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AUDIT ── */}
        <TabsContent value="audit" className="mt-6">
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-amber-800 mb-1">
                <History className="w-4 h-4" />
                <span className="text-sm font-medium">Governance audit trail is not yet activated</span>
              </div>
              <p className="text-xs text-amber-700 ml-6">
                Proposal approval actions, state transitions, reviewer notes, and override records will appear here when governance gates are enabled.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ECR Upgrade Modal */}
      <EcrUpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        contextType="proposal"
        contextId={proposal.id}
        customerId={ecr?.customerId || workspace?.customerId || ''}
        customerName={workspace?.customerName || ''}
        currentRuleSetId={ecr?.ruleSetId || getActiveRuleSet()?.id || ''}
        onUpgradeRequested={() => forceUpdate()}
      />
    </div>
  );
}
