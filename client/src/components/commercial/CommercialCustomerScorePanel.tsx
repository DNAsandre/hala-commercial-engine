/**
 * CW-004: Customer Score / ECR Decomposition Panel
 * Mock-only — no real ECR engine, no CRM sync, no grade override.
 * SUPA-004: Actions now write to Supabase.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, ShieldCheck, AlertTriangle, TrendingUp, BarChart3,
  Eye, Play, Ban, CheckCircle2, Info, Star,
} from "lucide-react";
import { toast } from "sonner";
import { logMockAction, type ActionActor } from "@/lib/supabase-commercial-actions";
import { useAuth } from "@/contexts/AuthContext";

// ─── TYPES ─────────────────────────────────────────────────

export type CustomerGrade = "A" | "B" | "C" | "D" | "F";
export type IcpFit = "Strong ICP Fit" | "Moderate ICP Fit" | "Weak ICP Fit" | "Not ICP Fit";
export type DiscountSuitability = "Eligible" | "Limited" | "Not Recommended" | "Commercial Director Review Future";
export type PursuitRecommendation = "Fight" | "Protect" | "Monitor" | "Reprice" | "Walk Away" | "Replace / Exit Later";
export type OverrideStatus = "No Override" | "Mock Review Only" | "Future Commercial Director Override Required";

export interface CommercialCustomerScore {
  customerName: string;
  workspaceId: string;
  overallGrade: CustomerGrade;
  overallScore: number;
  financialStrength: { score: number; grade: CustomerGrade; reason: string };
  operationalBehavior: { score: number; grade: CustomerGrade; reason: string };
  strategicFit: { score: number; grade: CustomerGrade; reason: string };
  commercialFit: { score: number; grade: CustomerGrade; reason: string };
  icpFit: IcpFit;
  paymentStatus: string;
  dsoDays: number;
  discountSuitability: DiscountSuitability;
  pursuitRecommendation: PursuitRecommendation;
  riskReasons: string[];
  positiveReasons: string[];
  overrideStatus: OverrideStatus;
  overrideAllowedFutureRole: string;
  wouldEscalate: boolean;
  mockEscalationCreated: boolean;
  lastReviewed: string;
  reviewedBy: string;
  notes: string;
}

// ─── HELPERS ───────────────────────────────────────────────

const gradeColors: Record<CustomerGrade, string> = {
  A: "text-emerald-700 bg-emerald-50 border-emerald-200",
  B: "text-emerald-600 bg-emerald-50 border-emerald-200",
  C: "text-amber-700 bg-amber-50 border-amber-200",
  D: "text-red-600 bg-red-50 border-red-200",
  F: "text-red-700 bg-red-50 border-red-200",
};

const pursuitColors: Record<PursuitRecommendation, string> = {
  "Fight": "text-emerald-700 bg-emerald-50",
  "Protect": "text-blue-700 bg-blue-50",
  "Monitor": "text-amber-700 bg-amber-50",
  "Reprice": "text-orange-700 bg-orange-50",
  "Walk Away": "text-red-700 bg-red-50",
  "Replace / Exit Later": "text-red-700 bg-red-50",
};

function scoreBarColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 55) return "bg-amber-500";
  return "bg-red-500";
}

// ─── SCORE CARD ────────────────────────────────────────────

function ScoreCard({ label, score, grade, reason }: { label: string; score: number; grade: CustomerGrade; reason: string }) {
  return (
    <div className="rounded-lg border p-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Badge variant="outline" className={`text-[9px] font-bold ${gradeColors[grade]}`}>{grade}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${scoreBarColor(score)}`} style={{ width: `${score}%` }} />
        </div>
        <span className="text-xs font-bold w-7 text-right">{score}</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">{reason}</p>
    </div>
  );
}

// ─── MAIN PANEL ────────────────────────────────────────────

interface Props {
  score: CommercialCustomerScore;
  gpPercent?: number;
  workspaceId?: string;
  onActionComplete?: () => void;
}

export default function CommercialCustomerScorePanel({ score, gpPercent, workspaceId, onActionComplete }: Props) {
  const { appUser } = useAuth();
  const actor: ActionActor = { name: appUser?.name ?? 'Development User', role: appUser?.role ?? 'Commercial Tester' };

  const isLowGp = (gpPercent ?? 100) < 10;
  const showEscalation = score.mockEscalationCreated || (isLowGp && score.overallGrade >= "C");

  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-serif flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--color-hala-navy)]" /> Customer Score / ECR
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`text-[9px] font-bold ${gradeColors[score.overallGrade]}`}>
              Grade {score.overallGrade} · {score.overallScore}/100
            </Badge>
            <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Mock</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {/* Top-line summary */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: "ICP Fit", value: score.icpFit.replace(" ICP Fit", ""), color: score.icpFit.includes("Strong") ? "text-emerald-600" : score.icpFit.includes("Moderate") ? "text-amber-600" : "text-red-600" },
            { label: "Payment", value: score.paymentStatus, color: score.paymentStatus.includes("Good") ? "text-emerald-600" : "text-amber-600" },
            { label: "DSO", value: `${score.dsoDays}d`, color: score.dsoDays <= 45 ? "text-emerald-600" : score.dsoDays <= 60 ? "text-amber-600" : "text-red-600" },
            { label: "Discount", value: score.discountSuitability, color: score.discountSuitability === "Eligible" ? "text-emerald-600" : score.discountSuitability === "Not Recommended" ? "text-red-600" : "text-amber-600" },
            { label: "Pursuit", value: score.pursuitRecommendation, color: "" },
            { label: "Escalation", value: showEscalation ? "Active" : "None", color: showEscalation ? "text-red-600" : "text-emerald-600" },
          ].map(i => (
            <div key={i.label} className="bg-muted/30 rounded-lg p-1.5 text-center">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{i.label}</p>
              <p className={`text-[10px] font-bold mt-0.5 ${i.color}`}>{i.value}</p>
            </div>
          ))}
        </div>

        {/* Pursuit badge */}
        <div className={`rounded-lg p-2 flex items-center gap-2 ${pursuitColors[score.pursuitRecommendation]}`}>
          <Star className="w-4 h-4 shrink-0" />
          <div>
            <p className="text-xs font-semibold">Recommended Posture: {score.pursuitRecommendation}</p>
            <p className="text-[10px] mt-0.5">
              {score.pursuitRecommendation === "Reprice" && "Discount not recommended — GP already below threshold and payment behavior watchlisted. Reprice or escalate mock review."}
              {score.pursuitRecommendation === "Fight" && "Customer is high-value and strategically aligned. Fight to win."}
              {score.pursuitRecommendation === "Protect" && "Existing customer worth protecting. Maintain margin discipline."}
              {score.pursuitRecommendation === "Monitor" && "Watch for deterioration. Review at next renewal."}
              {score.pursuitRecommendation === "Walk Away" && "Risk outweighs return. Consider exit strategy."}
              {score.pursuitRecommendation === "Replace / Exit Later" && "Replace with better-fit customer when pipeline allows."}
            </p>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="grid grid-cols-2 gap-2">
          <ScoreCard label="Financial Strength" score={score.financialStrength.score} grade={score.financialStrength.grade} reason={score.financialStrength.reason} />
          <ScoreCard label="Operational Behavior" score={score.operationalBehavior.score} grade={score.operationalBehavior.grade} reason={score.operationalBehavior.reason} />
          <ScoreCard label="Strategic Fit" score={score.strategicFit.score} grade={score.strategicFit.grade} reason={score.strategicFit.reason} />
          <ScoreCard label="Commercial Fit" score={score.commercialFit.score} grade={score.commercialFit.grade} reason={score.commercialFit.reason} />
        </div>

        {/* Risk + Positive */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-red-200 bg-red-50/30 p-2 space-y-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-red-700 flex items-center gap-1"><Ban className="w-3 h-3" /> Risk Reasons</p>
            <ul className="text-[10px] text-red-800 space-y-0.5 list-disc pl-3">
              {score.riskReasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-2 space-y-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Positive Signals</p>
            <ul className="text-[10px] text-emerald-800 space-y-0.5 list-disc pl-3">
              {score.positiveReasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>

        {/* Escalation banner */}
        {showEscalation && (
          <div className="p-2 rounded border border-red-200 bg-red-50 text-xs text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Customer Risk Signal — Mock escalation created. Low GP ({gpPercent?.toFixed(1)}%) + Grade {score.overallGrade} customer. Testing may continue.
          </div>
        )}

        {/* Override + dev note */}
        <div className="text-[10px] text-muted-foreground space-y-1 bg-muted/20 rounded-lg p-2">
          <p><span className="font-medium">Grade override:</span> {score.overrideStatus}. Future rule: customer grade override is {score.overrideAllowedFutureRole}-only.</p>
          <p><span className="font-medium">Development mode:</span> Customer score and ECR are mock signals. They guide quote review but do not block testing or change CRM data.</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-dashed">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={async () => {
            if (workspaceId) {
              const result = await logMockAction(
                { workspaceId, eventType: 'customer_score_reviewed_mock', title: 'Customer score reviewed (mock)',
                  description: `Customer score for ${score.customerName} reviewed. Grade: ${score.overallGrade}. No CRM update.`,
                  category: 'Customer Score', actor, severity: 'Info', relatedArtifact: score.customerName, relatedModule: 'Customer Score' },
                { workspaceId, eventCode: 'CUSTOMER_SCORE_REVIEWED_MOCK', eventName: 'Customer Score Reviewed Mock',
                  description: `Customer score reviewed: ${score.customerName} (${score.overallGrade})`,
                  category: 'CUSTOMER_SCORE', actor, entityType: 'Customer Score', entityName: score.customerName,
                  beforeState: score.overallGrade, afterState: 'Mock Reviewed', severity: 'Info' }
              );
              if (result.success) { toast.success("Customer score review saved to Supabase."); onActionComplete?.(); }
              else { toast.error(`Mock action could not be saved: ${result.error}`); }
            } else { toast.info("Customer score reviewed (mock). No backend update."); }
          }}>
            <Eye className="w-3 h-3" /> Review Score Mock
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={async () => {
            if (workspaceId) {
              const result = await logMockAction(
                { workspaceId, eventType: 'ecr_reviewed_mock', title: 'ECR marked reviewed (mock)',
                  description: `ECR reviewed for ${score.customerName}. No production grade override.`,
                  category: 'Customer Score', actor, severity: 'Info', relatedArtifact: score.customerName, relatedModule: 'Customer Score' },
                { workspaceId, eventCode: 'ECR_REVIEWED_MOCK', eventName: 'ECR Reviewed Mock',
                  description: `ECR reviewed: ${score.customerName}`,
                  category: 'CUSTOMER_SCORE', actor, entityType: 'ECR', entityName: score.customerName,
                  beforeState: 'Not Reviewed', afterState: 'Mock Reviewed', severity: 'Info' }
              );
              if (result.success) { toast.success("ECR review saved to Supabase."); onActionComplete?.(); }
              else { toast.error(`Mock action could not be saved: ${result.error}`); }
            } else { toast.info("ECR marked reviewed (mock). No backend update."); }
          }}>
            <ShieldCheck className="w-3 h-3" /> Mark ECR Reviewed
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-blue-700 border-blue-200" onClick={async () => {
            if (workspaceId) {
              const result = await logMockAction(
                { workspaceId, eventType: 'customer_score_bypass_mock', title: 'Customer score testing bypass',
                  description: `Continue for testing — customer score enforcement not applied for ${score.customerName}.`,
                  category: 'Customer Score', actor, severity: 'Info', relatedArtifact: score.customerName, relatedModule: 'Customer Score' },
                { workspaceId, eventCode: 'CUSTOMER_SCORE_BYPASS_MOCK', eventName: 'Customer Score Bypass Mock',
                  description: `Testing bypass: customer score for ${score.customerName}`,
                  category: 'CUSTOMER_SCORE', actor, entityType: 'Customer Score', entityName: score.customerName,
                  beforeState: score.overallGrade, afterState: 'Testing Bypass', severity: 'Info' }
              );
              if (result.success) { toast.success("Testing bypass saved to Supabase."); onActionComplete?.(); }
              else { toast.error(`Mock action could not be saved: ${result.error}`); }
            } else { toast.info("Continue for testing — no enforcement applied."); }
          }}>
            <Play className="w-3 h-3" /> Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
