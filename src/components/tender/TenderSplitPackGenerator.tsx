/**
 * TND-007: Tender Split Pack Review
 *
 * TCW-T5 LEFT-BEHIND (pending integration ruling): DEAD SURFACE — its only openers lived in the
 * dead packs branch TCW-T2 removed; nothing renders it, and the clean bundle loads no packs, so
 * `masterPack` is always undefined and this component would render null even if mounted.
 *
 * Reviews Supabase-backed split checks and existing output records.
 * It does not generate local test outputs or write fake document records.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, XCircle, CheckCircle2, FileOutput, Info, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  type TenderWorkspace,
  getSplitCheckStatusLabel,
  getSplitCheckStatusColor,
  getSplitCheckCategoryLabel,
  getPackOutputStatusLabel,
  getPackOutputStatusColor,
} from "@/lib/tender-workspace-data";

export default function TenderSplitPackGenerator({ ws, onClose }: { ws: TenderWorkspace; onClose: () => void }) {
  const masterPack = ws.packs.find((p) => p.isMaster);
  const externalPacks = ws.packs.filter((p) => p.isExternalSubmittable);

  const [targetPackId, setTargetPackId] = useState<string>(externalPacks[0]?.id || "");
  const [checksRun, setChecksRun] = useState(false);

  const targetPack = ws.packs.find((p) => p.id === targetPackId);
  const checksForTarget = (ws.splitChecks ?? []).filter((c) => c.targetPackId === targetPackId);
  const outputs = ws.packOutputs ?? [];

  const passCount = checksForTarget.filter((c) => c.status === "pass").length;
  const warnCount = checksForTarget.filter((c) => c.status === "warning").length;
  const blockCount = checksForTarget.filter((c) => c.status === "would_block" || c.status === "fail").length;

  function handleRunChecks() {
    setChecksRun(true);
    toast.info(`Split checks reviewed for ${targetPack?.packName ?? "selected pack"}.`, {
      description: `${blockCount} signal(s) flagged for review. Advisory only.`,
    });
  }

  if (!masterPack) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background rounded-xl border shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-serif font-bold">Split Pack Review</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Verified checks only. No local outputs are generated.</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><XCircle className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 flex items-center gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-xs text-blue-700">This tool reviews existing workspace records. If split checks or outputs are missing, the app shows an empty state instead of inventing them.</p>
          </div>

          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Step 1 - Source Pack</h4>
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
              <p className="text-xs font-medium">{masterPack.packName}</p>
              <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Internal Master is source only. It is not externally submittable.</p>
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Step 2 - Target Output Pack</h4>
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">{masterPack.packName}</p>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              <Select value={targetPackId} onValueChange={(v) => { setTargetPackId(v); setChecksRun(false); }}>
                <SelectTrigger size="sm" className="w-[240px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{externalPacks.map((p) => <SelectItem key={p.id} value={p.id} className="text-xs">{p.packName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Step 3 - Split Checks</h4>
              {!checksRun && <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={handleRunChecks}><CheckCircle2 className="w-3 h-3" /> Review Checks</Button>}
            </div>

            {checksRun ? (
              checksForTarget.length > 0 ? (
                <>
                  <div className="flex gap-3 mb-3">
                    <Badge variant="outline" className="text-[9px] text-emerald-700 bg-emerald-50 border-emerald-200">{passCount} Pass</Badge>
                    <Badge variant="outline" className="text-[9px] text-amber-700 bg-amber-50 border-amber-200">{warnCount} Warning</Badge>
                    <Badge variant="outline" className="text-[9px] text-amber-700 bg-amber-50 border-amber-200">{blockCount} Review Rec.</Badge>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Check</th>
                          <th className="px-3 py-2 text-left font-semibold">Category</th>
                          <th className="px-3 py-2 text-left font-semibold">Status</th>
                          <th className="px-3 py-2 text-center font-semibold">Review?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {checksForTarget.map((c) => {
                          const isBlock = c.status === "would_block" || c.status === "fail";
                          return (
                            <tr key={c.id} className={`border-t border-border ${isBlock ? "bg-red-50/40 border-l-2 border-l-red-400" : c.status === "warning" ? "bg-amber-50/20 border-l-2 border-l-amber-300" : ""}`}>
                              <td className="px-3 py-2">
                                <p className="font-medium">{c.checkName}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{c.description}</p>
                              </td>
                              <td className="px-3 py-2"><Badge variant="outline" className="text-[9px]">{getSplitCheckCategoryLabel(c.category)}</Badge></td>
                              <td className="px-3 py-2"><Badge variant="outline" className={`text-[9px] ${getSplitCheckStatusColor(c.status)}`}>{getSplitCheckStatusLabel(c.status)}</Badge></td>
                              <td className="px-3 py-2 text-center">
                                {c.wouldBlockInProduction && c.status !== "pass" ? (
                                  <Badge variant="outline" className="text-[9px] text-amber-700 bg-amber-50 border-amber-200">Review Rec.</Badge>
                                ) : c.status === "pass" ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                                ) : <span className="text-muted-foreground">-</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                  <p className="text-xs text-amber-800 font-medium">No verified split checks found for this target pack.</p>
                  <p className="text-[10px] text-amber-700 mt-0.5">Nothing is generated locally. Capture or import real checks before producing outputs.</p>
                </div>
              )
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">Review split checks to evaluate output readiness.</p>
            )}
          </div>

          {checksRun && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Step 4 - Output Generation</h4>
              <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" disabled>
                <FileOutput className="w-3.5 h-3.5" /> Document Output Disabled
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1">The discontinued document-output studio is isolated. No output is generated from this review.</p>
            </div>
          )}

          {outputs.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Output Register</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Output Name</th>
                      <th className="px-3 py-2 text-left font-semibold">Target Pack</th>
                      <th className="px-3 py-2 text-left font-semibold">Format</th>
                      <th className="px-3 py-2 text-left font-semibold">Version</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-3 py-2 text-center font-semibold">Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outputs.map((o) => (
                      <tr key={o.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <p className="font-medium">{o.outputName}</p>
                          {o.watermark && <p className="text-[9px] text-red-600 font-mono mt-0.5">{o.watermark}</p>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{o.packName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{o.format}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{o.version}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[9px] ${getPackOutputStatusColor(o.status)}`}>{getPackOutputStatusLabel(o.status)}</Badge></td>
                        <td className="px-3 py-2 text-center font-mono">{o.readinessWarningsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t flex items-center justify-end">
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
