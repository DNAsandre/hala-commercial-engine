/**
 * ECR Upgrade Modal — Screen 3 from ECR Evolution Patch
 * Reusable modal for requesting ECR rule version upgrades.
 * Used on: Renewal Detail, Proposal Version, SLA Version pages.
 *
 * Shows: current rule set, target rule set, estimated impact,
 * requires reason, creates upgrade event with status "requested".
 */
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ArrowRight, AlertTriangle, CheckCircle2, Shield, TrendingUp,
  TrendingDown, Minus, Lock, Dna, XCircle
} from 'lucide-react';
import {
  mockRuleSets, getActiveRuleSet,
  type EcrRuleSet, type Grade
} from '@/lib/ecr';
import {
  estimateUpgradeImpact, requestUpgrade,
  type UpgradeContextType
} from '@/lib/ecr-evolution';

interface EcrUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextType: UpgradeContextType;
  contextId: string;
  customerId: string;
  customerName: string;
  currentRuleSetId: string;
  onUpgradeRequested?: (upgradeEventId: string) => void;
}

function getGradeBg(grade: Grade): string {
  switch (grade) {
    case 'A': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'B': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'C': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'D': return 'bg-red-100 text-red-700 border-red-200';
  }
}

export default function EcrUpgradeModal({
  open, onOpenChange, contextType, contextId,
  customerId, customerName, currentRuleSetId, onUpgradeRequested
}: EcrUpgradeModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentRuleSet = mockRuleSets.find(rs => rs.id === currentRuleSetId);
  const activeRuleSet = getActiveRuleSet();

  // If current rule set IS the active one, there's no upgrade available
  const targetRuleSet = activeRuleSet && activeRuleSet.id !== currentRuleSetId ? activeRuleSet : null;

  const impact = useMemo(() => {
    if (!targetRuleSet) return null;
    return estimateUpgradeImpact(customerId, currentRuleSetId, targetRuleSet.id);
  }, [customerId, currentRuleSetId, targetRuleSet]);

  const handleSubmit = () => {
    if (!targetRuleSet) return;
    if (!reason || reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters');
      return;
    }

    setSubmitting(true);
    const result = requestUpgrade({
      context_type: contextType,
      context_id: contextId,
      customer_id: customerId,
      customer_name: customerName,
      from_rule_set_id: currentRuleSetId,
      to_rule_set_id: targetRuleSet.id,
      reason,
      userId: 'user-admin',
      userName: 'Amin Al-Rashid',
      userRole: 'admin',
    });

    setSubmitting(false);

    if (result.success) {
      toast.success('Upgrade request submitted for approval');
      setReason('');
      onOpenChange(false);
      onUpgradeRequested?.(result.upgrade_event_id!);
    } else {
      toast.error(result.error || 'Failed to submit upgrade request');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Dna className="w-5 h-5 text-violet-600" />
            Upgrade ECR to New Rule Set
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Customer */}
          <div className="text-sm text-slate-600">
            Customer: <span className="font-semibold text-slate-900">{customerName}</span>
            <span className="text-slate-400 ml-2">({contextType})</span>
          </div>

          {/* No target available */}
          {!targetRuleSet && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
              <Shield className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600 font-medium">No upgrade available</p>
              <p className="text-xs text-slate-500 mt-1">
                {currentRuleSet?.id === activeRuleSet?.id
                  ? 'This context is already using the active rule set.'
                  : 'No active rule set found.'}
              </p>
            </div>
          )}

          {/* Upgrade comparison */}
          {targetRuleSet && (
            <>
              {/* From → To */}
              <div className="flex items-center gap-3">
                <div className="flex-1 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Current</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{currentRuleSet?.name}</p>
                  <p className="text-xs text-slate-400">v{currentRuleSet?.versionNumber}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="flex-1 p-3 bg-violet-50 rounded-lg border border-violet-200">
                  <p className="text-xs text-violet-600 uppercase tracking-wider">Target (Active)</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{targetRuleSet.name}</p>
                  <p className="text-xs text-violet-500">v{targetRuleSet.versionNumber}</p>
                </div>
              </div>

              {/* Estimated Impact */}
              {impact && (
                <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Estimated Impact</p>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-slate-500">New Grade</p>
                      {impact.to_grade ? (
                        <Badge variant="outline" className={`mt-1 ${getGradeBg(impact.to_grade)}`}>
                          {impact.to_grade}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="mt-1 bg-red-50 text-red-600 border-red-200">Blocked</Badge>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">New Score</p>
                      <p className="text-lg font-bold text-slate-900 mt-0.5">
                        {impact.to_score !== null ? impact.to_score.toFixed(1) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Confidence</p>
                      <p className="text-lg font-bold text-slate-900 mt-0.5">
                        {impact.to_confidence !== null ? `${(impact.to_confidence * 100).toFixed(0)}%` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Score Delta</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {impact.score_delta !== null ? (
                          <>
                            {impact.score_delta > 0 ? (
                              <TrendingUp className="w-4 h-4 text-emerald-600" />
                            ) : impact.score_delta < 0 ? (
                              <TrendingDown className="w-4 h-4 text-red-600" />
                            ) : (
                              <Minus className="w-4 h-4 text-slate-400" />
                            )}
                            <span className={`text-lg font-bold ${
                              impact.score_delta > 0 ? 'text-emerald-600' : impact.score_delta < 0 ? 'text-red-600' : 'text-slate-600'
                            }`}>
                              {impact.score_delta > 0 ? '+' : ''}{impact.score_delta.toFixed(1)}
                            </span>
                          </>
                        ) : (
                          <span className="text-lg font-bold text-slate-400">—</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Missing metrics warning */}
                  {impact.to_missing_metrics.length > 0 && (
                    <div className="flex items-start gap-2 p-2 bg-amber-50 rounded border border-amber-200 text-xs text-amber-700">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>Missing metrics: {impact.to_missing_metrics.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Reason */}
              <div>
                <Label className="text-sm font-medium text-slate-700">Reason for Upgrade (required)</Label>
                <Textarea
                  placeholder="Explain why this context should be upgraded to the new rule set..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
                <p className="text-xs text-slate-400 mt-1">Minimum 10 characters. This will be recorded in the audit trail.</p>
              </div>

              {/* Approval notice */}
              <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <Lock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <span>This request requires approval from a Director or CEO/CFO. No silent upgrades. The upgrade event is immutable and fully audited.</span>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {targetRuleSet && (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !reason || reason.trim().length < 10}
            >
              <Dna className="w-4 h-4 mr-2" />
              Request Upgrade
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
