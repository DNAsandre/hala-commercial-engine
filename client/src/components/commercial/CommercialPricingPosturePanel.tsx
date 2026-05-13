/**
 * CW-006: Pricing Posture Panel
 * Mock-only — no real pricing engine.
 * SUPA-004: Actions now write to Supabase.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, AlertTriangle, ShieldAlert, Eye, Play } from "lucide-react";
import { toast } from "sonner";
import { logMockAction, type ActionActor } from "@/lib/supabase-commercial-actions";
import { useAuth } from "@/contexts/AuthContext";

// ─── TYPES ─────────────────────────────────────────────────

export type PostureValue = "Aggressive" | "Balanced" | "Hold Ground" | "Reprice" | "Walk Away";
export type PostureSeverity = "Low" | "Medium" | "High" | "Critical";

export interface CommercialPricingPosture {
  scenarioId: string;
  posture: PostureValue;
  recommendation: string;
  decisionOwner: string;
  severity: PostureSeverity;
  rationale: string;
  pressureSignals: string[];
  supportingSignals: string[];
  riskSignals: string[];
  recommendedActions: string[];
  wouldEscalate: boolean;
  mockEscalationCreated: boolean;
  allowTestBypass: boolean;
  runtimeMode: string;
  lastReviewed: string;
  reviewedBy: string;
  notes: string;
}

// ─── HELPERS ───────────────────────────────────────────────

const postureColors: Record<PostureValue, { bg: string; text: string; border: string }> = {
  Aggressive: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  Balanced: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Hold Ground": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  Reprice: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Walk Away": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

const sevColors: Record<PostureSeverity, string> = {
  Low: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Medium: "text-amber-700 bg-amber-50 border-amber-200",
  High: "text-red-600 bg-red-50 border-red-200",
  Critical: "text-red-700 bg-red-50 border-red-200",
};

const chipColor = (type: "pressure" | "support" | "risk") =>
  type === "pressure" ? "bg-amber-100 text-amber-800 border-amber-200" :
  type === "support" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
  "bg-red-100 text-red-800 border-red-200";

// ─── MAIN PANEL ────────────────────────────────────────────

export default function CommercialPricingPosturePanel({ p, workspaceId, onActionComplete }: { p: CommercialPricingPosture; workspaceId?: string; onActionComplete?: () => void }) {
  const { appUser } = useAuth();
  const actor: ActionActor = { name: appUser?.name ?? 'Development User', role: appUser?.role ?? 'Commercial Tester' };
  const mkAction = async (eventType: string, title: string, desc: string, code: string, after: string) => {
    if (!workspaceId) { toast.info(`${title}. No backend update.`); return; }
    const result = await logMockAction(
      { workspaceId, eventType, title, description: desc, category: 'Pricing Posture', actor, severity: 'Info', relatedModule: 'Pricing Posture' },
      { workspaceId, eventCode: code, eventName: title, description: desc, category: 'PRICING_POSTURE', actor, entityType: 'Pricing Posture', entityName: p.posture, beforeState: p.posture, afterState: after, severity: 'Info' }
    );
    if (result.success) { toast.success(`${title} saved to Supabase.`); onActionComplete?.(); }
    else { toast.error(`Mock action could not be saved: ${result.error}`); }
  };
  const pc = postureColors[p.posture];
  const isRed = p.severity === "High" || p.severity === "Critical";

  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-serif flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--color-hala-navy)]" /> Pricing Posture
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`text-[9px] font-bold ${pc.text} ${pc.bg} ${pc.border}`}>{p.posture}</Badge>
            <Badge variant="outline" className={`text-[9px] font-bold ${sevColors[p.severity]}`}>{p.severity}</Badge>
            <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Mock</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Recommendation", value: p.recommendation },
            { label: "Decision Owner", value: p.decisionOwner },
            { label: "Escalation", value: p.mockEscalationCreated ? "Active" : "None" },
          ].map(m => (
            <div key={m.label} className="bg-muted/30 rounded-lg p-1.5 text-center">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
              <p className="text-[10px] font-bold mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Rationale */}
        <div className={`rounded-lg p-2 ${pc.bg} ${pc.border} border`}>
          <p className={`text-xs font-semibold ${pc.text}`}>Rationale</p>
          <p className={`text-[10px] mt-0.5 ${pc.text}`}>{p.rationale}</p>
        </div>

        {/* Signal chips */}
        {[
          { label: "Pressure Signals", items: p.pressureSignals, type: "pressure" as const },
          { label: "Supporting Signals", items: p.supportingSignals, type: "support" as const },
          { label: "Risk Signals", items: p.riskSignals, type: "risk" as const },
        ].filter(g => g.items.length > 0).map(g => (
          <div key={g.label}>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{g.label}</p>
            <div className="flex flex-wrap gap-1">
              {g.items.map((s, i) => (
                <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded border ${chipColor(g.type)}`}>{s}</span>
              ))}
            </div>
          </div>
        ))}

        {/* Recommended actions */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Recommended Actions</p>
          <ul className="text-[10px] text-foreground space-y-0.5 list-disc pl-3">
            {p.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>

        {/* Escalation */}
        {isRed && p.mockEscalationCreated && (
          <div className="p-2 rounded border border-red-200 bg-red-50 text-xs text-red-800 flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            {p.severity === "Critical" ? "Critical Pricing Posture" : "High Pricing Risk"} — Mock escalation created. Testing may continue.
          </div>
        )}
        {!isRed && p.severity === "Medium" && (
          <div className="p-2 rounded border border-amber-200 bg-amber-50 text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Amber Review — protect price and confirm Ops capacity. Current mode: mock warning only.
          </div>
        )}

        {/* Dev note */}
        <div className="text-[10px] text-muted-foreground bg-muted/20 rounded-lg p-2">
          <span className="font-medium">Development mode:</span> Pricing posture is a mock signal. It guides quote review but does not enforce decisions or sync with CRM/Finance.
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-dashed">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => mkAction('pricing_posture_reviewed_mock','Pricing posture reviewed (mock)',`Pricing posture (${p.posture}) reviewed. No enforcement.`,'PRICING_POSTURE_REVIEWED_MOCK','Mock Reviewed')}>
            <Eye className="w-3 h-3" /> Review Posture Mock
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-blue-700 border-blue-200" onClick={() => mkAction('pricing_posture_bypass_mock','Pricing posture testing bypass',`Continue for testing — pricing posture enforcement not applied.`,'PRICING_POSTURE_BYPASS_MOCK','Testing Bypass')}>
            <Play className="w-3 h-3" /> Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
