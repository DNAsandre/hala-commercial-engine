/**
 * ECR UPGRADES — Admin Audit Console (Screen 4)
 * Design: Swiss Precision — white cards, subtle borders
 * Shows all upgrade events with approve/reject workflow.
 * Fully audited. No silent upgrades.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Dna, Search, CheckCircle2, XCircle, Clock, ArrowRight,
  TrendingUp, TrendingDown, Minus, Shield, AlertTriangle,
  User, Calendar, Filter, Eye
} from 'lucide-react';
import {
  ecrUpgradeEvents, approveUpgrade, rejectUpgrade,
  type EcrRuleUpgradeEvent, type UpgradeStatus
} from '@/lib/ecr-evolution';
import { mockRuleSets } from '@/lib/ecr';

const statusConfig: Record<UpgradeStatus, { label: string; color: string; icon: React.ReactNode }> = {
  requested: { label: 'Pending', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock className="w-3 h-3" /> },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" /> },
};

export default function EcrUpgrades() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<UpgradeStatus | 'all'>('all');
  const [reviewModal, setReviewModal] = useState<EcrRuleUpgradeEvent | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewReason, setReviewReason] = useState('');
  const [, setRefresh] = useState(0);
  const forceUpdate = () => setRefresh(n => n + 1);

  const events = useMemo((): EcrRuleUpgradeEvent[] => {
    return (ecrUpgradeEvents as EcrRuleUpgradeEvent[])
      .filter((e: EcrRuleUpgradeEvent) => {
        if (statusFilter !== 'all' && e.status !== statusFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (
            !e.customer_name.toLowerCase().includes(q) &&
            !e.context_type.toLowerCase().includes(q) &&
            !e.requested_by.toLowerCase().includes(q) &&
            !e.id.toLowerCase().includes(q)
          ) return false;
        }
        return true;
      })
      .sort((a: EcrRuleUpgradeEvent, b: EcrRuleUpgradeEvent) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
  }, [searchQuery, statusFilter, reviewModal]); // reviewModal dependency forces re-render after actions

  const pendingCount = ecrUpgradeEvents.filter((e: EcrRuleUpgradeEvent) => e.status === 'requested').length;
  const approvedCount = ecrUpgradeEvents.filter((e: EcrRuleUpgradeEvent) => e.status === 'approved').length;
  const rejectedCount = ecrUpgradeEvents.filter((e: EcrRuleUpgradeEvent) => e.status === 'rejected').length;

  const getRuleSetName = (id: string) => {
    const rs = mockRuleSets.find(r => r.id === id);
    return rs ? `${rs.name} (v${rs.versionNumber})` : id;
  };

  const handleReview = () => {
    if (!reviewModal) return;
    if (!reviewReason.trim()) {
      toast.error('Review reason is required');
      return;
    }

    if (reviewAction === 'approve') {
      const result = approveUpgrade(reviewModal.id, 'user-cfo', 'Khalid Al-Mansour', 'ceo_cfo', reviewReason);
      if (result.success) {
        toast.success('Upgrade approved', { description: `ECR upgrade for ${reviewModal.customer_name} approved.` });
      } else {
        toast.error(result.error || 'Failed to approve');
      }
    } else {
      const result = rejectUpgrade(reviewModal.id, 'user-cfo', 'Khalid Al-Mansour', 'ceo_cfo', reviewReason);
      if (result.success) {
        toast.success('Upgrade rejected', { description: `ECR upgrade for ${reviewModal.customer_name} rejected.` });
      } else {
        toast.error(result.error || 'Failed to reject');
      }
    }

    setReviewModal(null);
    setReviewReason('');
    forceUpdate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-slate-900">ECR Upgrades</h1>
          <p className="text-sm text-slate-500 mt-1">Audit console for all ECR rule version upgrade requests. Manual approval required.</p>
        </div>
        <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
          <Dna className="w-3.5 h-3.5 mr-1" /> Evolution Control
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Requests</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{ecrUpgradeEvents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Pending Review</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Approved</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Rejected</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{rejectedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by customer, context, requester..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as UpgradeStatus | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="requested">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="applied">Applied</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Upgrade Event Cards */}
      {events.length === 0 ? (
        <Card className="bg-slate-50">
          <CardContent className="py-12 text-center">
            <Dna className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No upgrade events found</p>
            <p className="text-sm text-slate-400 mt-1">Upgrade requests will appear here when initiated from Renewal, Proposal, or SLA pages.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event: EcrRuleUpgradeEvent) => {
            const status = statusConfig[event.status];
            return (
              <Card key={event.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      {/* Top row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${status.color}`}>
                          {status.icon}
                          <span className="ml-1">{status.label}</span>
                        </Badge>
                        <span className="text-sm font-semibold text-slate-900">{event.customer_name}</span>
                        <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-200">
                          {event.context_type}
                        </Badge>
                        <code className="text-[10px] text-slate-400 font-mono">{event.id}</code>
                      </div>

                      {/* Rule set transition */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-600">{getRuleSetName(event.from_rule_set_id)}</span>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-violet-700">{getRuleSetName(event.to_rule_set_id)}</span>
                      </div>

                      {/* Impact preview */}
                      {event.impact_summary && (
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>
                            Score: {event.impact_summary.from_score?.toFixed(1) ?? '—'}
                            {' → '}
                            <span className="font-medium text-slate-700">{event.impact_summary.to_score?.toFixed(1) ?? '—'}</span>
                          </span>
                          {event.impact_summary.score_delta !== null && (
                            <span className={`flex items-center gap-0.5 font-medium ${
                              event.impact_summary.score_delta > 0 ? 'text-emerald-600' :
                              event.impact_summary.score_delta < 0 ? 'text-red-600' : 'text-slate-500'
                            }`}>
                              {event.impact_summary.score_delta > 0 ? <TrendingUp className="w-3 h-3" /> :
                               event.impact_summary.score_delta < 0 ? <TrendingDown className="w-3 h-3" /> :
                               <Minus className="w-3 h-3" />}
                              {event.impact_summary.score_delta > 0 ? '+' : ''}{event.impact_summary.score_delta.toFixed(1)}
                            </span>
                          )}
                          {event.impact_summary.to_confidence !== null && (
                            <span>Confidence: {(event.impact_summary.to_confidence * 100).toFixed(0)}%</span>
                          )}
                          {event.impact_summary.to_missing_metrics.length > 0 && (
                            <span className="flex items-center gap-1 text-amber-600">
                              <AlertTriangle className="w-3 h-3" />
                              {event.impact_summary.to_missing_metrics.length} missing metric(s)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reason */}
                      <p className="text-xs text-slate-500 italic">"{event.reason}"</p>

                      {/* Meta */}
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {event.requested_by}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {new Date(event.requested_at).toLocaleString()}
                        </span>
                        {event.approved_by && (
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Reviewed by {event.approved_by}
                          </span>
                        )}
                      </div>

                      {/* Review reason if exists */}
                      {(event.approval_reason || event.rejection_reason) && (
                        <p className="text-xs text-slate-500 bg-slate-50 rounded p-2 border border-slate-200">
                          <span className="font-medium">Review note:</span> {event.approval_reason || event.rejection_reason}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {event.status === 'requested' && (
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => { setReviewModal(event); setReviewAction('approve'); setReviewReason(''); }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => { setReviewModal(event); setReviewAction('reject'); setReviewReason(''); }}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Governance Notice */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <Shield className="w-4 h-4" />
            <span className="font-medium">No Silent Upgrades:</span>
            <span className="text-amber-700">Every ECR rule version change requires explicit request, reason, and approval. All events are immutable and audited.</span>
          </div>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!reviewModal} onOpenChange={open => { if (!open) setReviewModal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {reviewAction === 'approve' ? 'Approve' : 'Reject'} ECR Upgrade
            </DialogTitle>
          </DialogHeader>
          {reviewModal && (
            <div className="space-y-4">
              <div className="text-sm text-slate-600">
                <p>Customer: <span className="font-semibold text-slate-900">{reviewModal.customer_name}</span></p>
                <p className="mt-1">Context: <span className="font-medium">{reviewModal.context_type}</span></p>
                <p className="mt-1">
                  {getRuleSetName(reviewModal.from_rule_set_id)} → {getRuleSetName(reviewModal.to_rule_set_id)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Review Reason (required)</Label>
                <Textarea
                  placeholder={reviewAction === 'approve'
                    ? 'Confirm the business justification for this upgrade...'
                    : 'Explain why this upgrade request is being rejected...'}
                  value={reviewReason}
                  onChange={e => setReviewReason(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewModal(null)}>Cancel</Button>
            <Button
              onClick={handleReview}
              disabled={!reviewReason.trim()}
              className={reviewAction === 'approve'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-red-600 hover:bg-red-700'}
            >
              {reviewAction === 'approve' ? (
                <><CheckCircle2 className="w-4 h-4 mr-1" /> Approve Upgrade</>
              ) : (
                <><XCircle className="w-4 h-4 mr-1" /> Reject Upgrade</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
