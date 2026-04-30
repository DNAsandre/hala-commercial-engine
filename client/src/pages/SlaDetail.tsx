import { useState, useEffect } from 'react';
import { Link, useParams } from 'wouter';
import {
  ArrowLeft, FileSignature, CheckCircle, Clock, XCircle, AlertTriangle,
  Calendar, Shield, Dna, History, TrendingUp, TrendingDown, Minus, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { type SLARecord } from '@/pages/SLAs';
import { getEcrScoreByCustomerName, getGradeColor, getActiveRuleSet } from '@/lib/ecr';
import EcrUpgradeModal from '@/components/EcrUpgradeModal';
import { api } from '@/lib/api-client';
import { useCustomers } from '@/hooks/useSupabase';

const statusConfig: Record<SLARecord['status'], { label: string; color: string; icon: React.ElementType }> = {
  active:       { label: 'Active',        color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  draft:        { label: 'Draft',         color: 'bg-gray-100 text-gray-700 border-gray-200',          icon: Clock },
  expired:      { label: 'Expired',       color: 'bg-red-100 text-red-700 border-red-200',             icon: XCircle },
  under_review: { label: 'Under Review',  color: 'bg-amber-100 text-amber-700 border-amber-200',       icon: AlertTriangle },
};

const kpiColors: Record<string, { row: string; badge: string }> = {
  met:     { row: 'bg-emerald-50 border-emerald-100', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  warning: { row: 'bg-amber-50 border-amber-100',     badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  breach:  { row: 'bg-red-50 border-red-100',         badge: 'bg-red-100 text-red-700 border-red-200' },
  pending: { row: 'bg-slate-50 border-slate-100',     badge: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function KpiStatusIcon({ status }: { status: string }) {
  if (status === 'met')     return <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />;
  if (status === 'warning') return <TrendingDown className="w-3.5 h-3.5 text-amber-600" />;
  if (status === 'breach')  return <TrendingDown className="w-3.5 h-3.5 text-red-600" />;
  return <Minus className="w-3.5 h-3.5 text-slate-400" />;
}

export default function SlaDetail() {
  const params = useParams<{ id: string }>();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [, setRefresh] = useState(0);
  const forceUpdate = () => setRefresh(n => n + 1);
  const { data: customers } = useCustomers();
  const [sla, setSla] = useState<SLARecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.slas.get(params.id!);
        const row = res?.data || res;
        if (row && !cancelled) {
          const cust = customers.find(c => c.id === row.customer_id);
          const kpiRows: any[] = Array.isArray(row.kpi_rows) ? row.kpi_rows : [];
          const kpis = kpiRows.map((k: any) => ({
            name: k.name || '', target: k.target || '', actual: k.actual || '-',
            status: (k.status || 'pending') as any,
          }));
          setSla({
            id: row.id,
            customerName: cust?.name || row.customer_id || '',
            customerId: row.customer_id || '',
            title: row.title || row.sla_number || '',
            status: row.status === 'approved' ? 'active' : (row.status === 'superseded' ? 'expired' : row.status) as any,
            version: row.version_number || 1,
            effectiveDate: row.effective_date || '-',
            expiryDate: row.review_date || '-',
            kpis,
            lastReview: '-',
            nextReview: row.review_date || '-',
          });
        }
      } catch { /* handled below */ }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [params.id, customers]);

  const ecr = sla ? getEcrScoreByCustomerName(sla.customerName) : undefined;

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!sla) {
    return (
      <div className="p-8 text-center space-y-3">
        <FileSignature className="w-12 h-12 text-slate-200 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-700">SLA not found</h2>
        <p className="text-sm text-slate-400">No SLA with ID "{params.id}".</p>
        <Link href="/slas">
          <Button variant="outline" className="mt-2">Back to SLAs</Button>
        </Link>
      </div>
    );
  }

  const sc = statusConfig[sla.status];
  const StatusIcon = sc.icon;

  const metCount     = sla.kpis.filter(k => k.status === 'met').length;
  const warningCount = sla.kpis.filter(k => k.status === 'warning').length;
  const breachCount  = sla.kpis.filter(k => k.status === 'breach').length;
  const pendingCount = sla.kpis.filter(k => k.status === 'pending').length;

  return (
    <div className="space-y-6 p-6 max-w-[1200px] mx-auto">
      {/* Back */}
      <div>
        <Link href="/slas">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to SLAs
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-50 border border-purple-100 mt-0.5">
            <FileSignature className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-serif text-slate-900">{sla.title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className={`text-xs ${sc.color}`}>
                <StatusIcon className="w-3 h-3 mr-1" /> {sc.label}
              </Badge>
              <span className="text-xs text-slate-400">v{sla.version}</span>
              <span className="text-xs text-slate-500">{sla.customerName}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline" size="sm"
            onClick={() => toast.info('PDF export will be available when governance is activated.')}
          >
            <Calendar className="w-3.5 h-3.5 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" disabled title="Governance not yet active">
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Activate
          </Button>
          <Button variant="outline" size="sm" disabled title="Governance not yet active" className="opacity-50">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Flag for Review
          </Button>
        </div>
      </div>

      {/* KPI summary bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Met',     value: metCount,     color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Warning', value: warningCount, color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
          { label: 'Breach',  value: breachCount,  color: 'text-red-600',     bg: 'bg-red-50 border-red-100' },
          { label: 'Pending', value: pendingCount, color: 'text-slate-500',   bg: 'bg-slate-50 border-slate-100' },
        ].map(stat => (
          <Card key={stat.label} className={`border ${stat.bg}`}>
            <CardContent className="py-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">KPIs {stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="kpis">KPIs</TabsTrigger>
          <TabsTrigger value="terms">Terms</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-4">
              {/* SLA details */}
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-3 font-medium">SLA Details</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Title</p>
                      <p className="font-medium text-slate-900 mt-0.5">{sla.title}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Status</p>
                      <Badge variant="outline" className={`mt-0.5 text-xs ${sc.color}`}>
                        <StatusIcon className="w-3 h-3 mr-1" /> {sc.label}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Customer</p>
                      <p className="font-medium text-slate-900 mt-0.5">{sla.customerName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Version</p>
                      <p className="font-medium text-slate-900 mt-0.5">v{sla.version}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Effective Date</p>
                      <p className="font-medium text-slate-900 mt-0.5">{sla.effectiveDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Expiry Date</p>
                      <p className={`font-medium mt-0.5 ${sla.status === 'expired' ? 'text-red-600' : 'text-slate-900'}`}>
                        {sla.expiryDate}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Last Review</p>
                      <p className="font-medium text-slate-900 mt-0.5">{sla.lastReview === '-' ? '—' : sla.lastReview}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Next Review</p>
                      <p className={`font-medium mt-0.5 ${
                        sla.nextReview !== '-' && new Date(sla.nextReview) <= new Date('2025-05-01')
                          ? 'text-amber-600'
                          : 'text-slate-900'
                      }`}>
                        {sla.nextReview === '-' ? '—' : sla.nextReview}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* KPI health summary */}
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-3 font-medium">KPI Health Summary</p>
                  <div className="space-y-2">
                    {sla.kpis.map(kpi => {
                      const colors = kpiColors[kpi.status];
                      return (
                        <div key={kpi.name} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${colors.row}`}>
                          <div className="flex items-center gap-2">
                            <KpiStatusIcon status={kpi.status} />
                            <span className="text-sm font-medium text-slate-700">{kpi.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-slate-400">Target: <span className="font-medium text-slate-600">{kpi.target}</span></span>
                            <span className="text-slate-400">Actual: <span className="font-medium text-slate-700">{kpi.actual}</span></span>
                            <Badge variant="outline" className={`text-[10px] capitalize ${colors.badge}`}>{kpi.status}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
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

        {/* ── KPIs ── */}
        <TabsContent value="kpis" className="mt-6">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-4 font-medium">KPI Performance Detail</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-4">KPI</th>
                      <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-4">Target</th>
                      <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-4">Actual</th>
                      <th className="text-left text-xs font-medium text-slate-400 pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sla.kpis.map(kpi => {
                      const colors = kpiColors[kpi.status];
                      return (
                        <tr key={kpi.name} className="py-2">
                          <td className="py-3 pr-4 font-medium text-slate-800">{kpi.name}</td>
                          <td className="py-3 pr-4 text-slate-600">{kpi.target}</td>
                          <td className="py-3 pr-4">
                            <span className={`font-semibold ${
                              kpi.status === 'met'     ? 'text-emerald-700' :
                              kpi.status === 'warning' ? 'text-amber-700' :
                              kpi.status === 'breach'  ? 'text-red-700' :
                              'text-slate-500'
                            }`}>{kpi.actual}</span>
                          </td>
                          <td className="py-3">
                            <Badge variant="outline" className={`text-[10px] capitalize ${colors.badge}`}>
                              {kpi.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TERMS ── */}
        <TabsContent value="terms" className="mt-6 space-y-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-3 font-medium">Contract Period</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-400">Effective Date</p>
                  <p className="font-medium text-slate-900 mt-0.5">{sla.effectiveDate}</p>
                </div>
                <div className={`p-3 rounded-lg border ${sla.status === 'expired' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-200'}`}>
                  <p className="text-xs text-slate-400">Expiry Date</p>
                  <p className={`font-medium mt-0.5 ${sla.status === 'expired' ? 'text-red-700' : 'text-slate-900'}`}>{sla.expiryDate}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-400">Last Review</p>
                  <p className="font-medium text-slate-900 mt-0.5">{sla.lastReview === '-' ? 'Not reviewed yet' : sla.lastReview}</p>
                </div>
                <div className={`p-3 rounded-lg border ${
                  sla.nextReview !== '-' && new Date(sla.nextReview) <= new Date('2025-05-01')
                    ? 'bg-amber-50 border-amber-100'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <p className="text-xs text-slate-400">Next Review</p>
                  <p className={`font-medium mt-0.5 ${
                    sla.nextReview !== '-' && new Date(sla.nextReview) <= new Date('2025-05-01')
                      ? 'text-amber-700'
                      : 'text-slate-900'
                  }`}>
                    {sla.nextReview === '-' ? 'Not scheduled' : sla.nextReview}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <FileSignature className="w-4 h-4" />
                <span className="text-sm font-medium text-slate-600">Extended terms not yet captured</span>
              </div>
              <p className="text-xs text-slate-400 ml-6">
                Service scope, penalty clauses, exclusions, and customer responsibilities will be stored here once the SLA wizard persists structured fields to the database.
              </p>
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
                SLA activation, review actions, KPI breach responses, and override records will appear here when governance gates are enabled.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ECR Upgrade Modal */}
      <EcrUpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        contextType="sla"
        contextId={sla.id}
        customerId={ecr?.customerId || sla.customerId}
        customerName={sla.customerName}
        currentRuleSetId={ecr?.ruleSetId || getActiveRuleSet()?.id || ''}
        onUpgradeRequested={() => forceUpdate()}
      />
    </div>
  );
}
