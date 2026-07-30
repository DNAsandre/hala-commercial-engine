/**
 * LossReasonTab — Tab 1 of Lost/Withdrawn Stage
 *
 * Capture the formal loss/withdrawal reason.
 * Outcome type, primary reason, client feedback, contributing factors.
 *
 * Data: type_details.lost_withdrawn_data.loss_reason
 * No AI. No mock data.
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Loader2, Info, XCircle, AlertTriangle } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderLostWithdrawnData } from "@/lib/supabase-tender-actions";

interface Props { ws: TenderWorkspace; reload: () => void }

const OUTCOME_TYPES = [
  { value: "lost_on_price", label: "Lost — Price" },
  { value: "lost_on_technical", label: "Lost — Technical" },
  { value: "lost_on_experience", label: "Lost — Experience / Track Record" },
  { value: "lost_on_compliance", label: "Lost — Non-Compliance" },
  { value: "lost_on_relationship", label: "Lost — Client Relationship" },
  { value: "withdrawn_no_fit", label: "Withdrawn — No Strategic Fit" },
  { value: "withdrawn_resource", label: "Withdrawn — Resource Constraint" },
  { value: "withdrawn_risk", label: "Withdrawn — Risk Too High" },
  { value: "withdrawn_cancelled", label: "Withdrawn — Client Cancelled" },
  { value: "other", label: "Other" },
] as const;

export default function LossReasonTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.lost_withdrawn_data?.loss_reason ?? {};

  const [outcomeType, setOutcomeType] = useState(saved.outcome_type || "");
  const [primaryReason, setPrimaryReason] = useState(saved.primary_reason || "");
  const [clientFeedback, setClientFeedback] = useState(saved.client_feedback || "");
  const [winningBidder, setWinningBidder] = useState(saved.winning_bidder || "");
  const [winningPrice, setWinningPrice] = useState<number>(saved.winning_price ?? 0);
  const [ourPrice, setOurPrice] = useState<number>(saved.our_price ?? ((ws.tender as any).estimatedValue || 0));
  const [lossDate, setLossDate] = useState(saved.loss_date || "");
  const [notifiedBy, setNotifiedBy] = useState(saved.notified_by || "");
  const [contributingFactors, setContributingFactors] = useState(saved.contributing_factors || "");
  const [notes, setNotes] = useState(saved.notes || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);

  const formatSar = (n: number) => n >= 1_000_000 ? `SAR ${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `SAR ${(n / 1_000).toFixed(0)}K` : `SAR ${n.toLocaleString()}`;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        outcome_type: outcomeType, primary_reason: primaryReason, client_feedback: clientFeedback,
        winning_bidder: winningBidder, winning_price: winningPrice, our_price: ourPrice,
        loss_date: lossDate, notified_by: notifiedBy, contributing_factors: contributingFactors, notes,
      };
      const res = await updateTenderLostWithdrawnData(tenderId, "loss_reason", payload, outcomeType || "Loss reason captured");
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Loss reason saved."); setDirty(false); reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [outcomeType, primaryReason, clientFeedback, winningBidder, winningPrice, ourPrice, lossDate, notifiedBy, contributingFactors, notes, tenderId, reload]);

  const isWithdrawn = outcomeType.startsWith("withdrawn");

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-red-50 border border-red-100 rounded-md px-3 py-2">
        <XCircle className="w-3.5 h-3.5 mt-0.5 text-red-500 shrink-0" />
        <span>Record the formal reason for loss or withdrawal. This is critical for learning and improving future bids.</span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Outcome</span>
        {outcomeType && <Badge variant="outline" className={`text-[8px] ${isWithdrawn ? "border-amber-300 text-amber-700 bg-amber-50" : "border-red-300 text-red-700 bg-red-50"}`}>{isWithdrawn ? "Withdrawn" : "Lost"}</Badge>}
        {lossDate && <span className="text-[10px] text-muted-foreground">Date: {lossDate}</span>}
        {winningPrice > 0 && <span className="text-[10px] font-mono text-red-600">Winner: {formatSar(winningPrice)}</span>}
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {/* Outcome Details */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-semibold">Loss / Withdrawal Details</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-[10px] font-semibold text-muted-foreground">Outcome Type</label>
              <Select value={outcomeType} onValueChange={v => { setOutcomeType(v); mark(); }}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select outcome..." /></SelectTrigger>
                <SelectContent>{OUTCOME_TYPES.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Loss / Withdrawal Date</label>
              <Input type="date" className="h-8 text-xs mt-1" value={lossDate} onChange={e => { setLossDate(e.target.value); mark(); }} /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Notified By</label>
              <Input className="h-8 text-xs mt-1" value={notifiedBy} onChange={e => { setNotifiedBy(e.target.value); mark(); }} placeholder="Who communicated the result" /></div>
            <div className="col-span-3"><label className="text-[10px] font-semibold text-muted-foreground">Primary Reason</label>
              <Textarea className="text-xs mt-1 min-h-[50px]" value={primaryReason} onChange={e => { setPrimaryReason(e.target.value); mark(); }} placeholder="Main reason for the loss/withdrawal — be specific..." /></div>
          </div>
        </CardContent>
      </Card>

      {/* Competitor Info */}
      {!isWithdrawn && (
        <Card className="border-border shadow-none">
          <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-[#075eea]" />
              <span className="text-xs font-semibold">Winning Bidder</span>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <div><label className="text-[10px] font-semibold text-muted-foreground">Winning Company</label>
                <Input className="h-8 text-xs mt-1" value={winningBidder} onChange={e => { setWinningBidder(e.target.value); mark(); }} placeholder="Competitor name" /></div>
              <div><label className="text-[10px] font-semibold text-muted-foreground">Winning Price (SAR)</label>
                <Input type="number" min={0} className="h-8 text-xs mt-1" value={winningPrice} onChange={e => { setWinningPrice(parseFloat(e.target.value) || 0); mark(); }} /></div>
              <div><label className="text-[10px] font-semibold text-muted-foreground">Our Price (SAR)</label>
                <Input type="number" min={0} className="h-8 text-xs mt-1" value={ourPrice} onChange={e => { setOurPrice(parseFloat(e.target.value) || 0); mark(); }} /></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client Feedback & Contributing Factors */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Client Feedback & Contributing Factors</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div><label className="text-[10px] font-semibold text-muted-foreground">Client Feedback (verbatim if possible)</label>
              <Textarea className="text-xs mt-1 min-h-[50px]" value={clientFeedback} onChange={e => { setClientFeedback(e.target.value); mark(); }} placeholder="What did the client say about why we lost/withdrew?" /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Contributing Factors</label>
              <Textarea className="text-xs mt-1 min-h-[50px]" value={contributingFactors} onChange={e => { setContributingFactors(e.target.value); mark(); }} placeholder="Internal factors that contributed (e.g. late submission, pricing errors, missing docs...)" /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Notes</label>
              <Textarea className="text-xs mt-1 min-h-[40px]" value={notes} onChange={e => { setNotes(e.target.value); mark(); }} placeholder="Any other relevant notes..." /></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
