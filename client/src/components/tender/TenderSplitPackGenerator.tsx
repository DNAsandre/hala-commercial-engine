/**
 * TND-007: Tender Split Pack Generator
 * Modal flow: Internal Master → Bulk/PGP external output with mock split checks and test output register.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, XCircle, CheckCircle2, FileOutput, Info, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  type TenderWorkspace,
  type TenderSplitCheck,
  type TenderPackOutput,
  getSplitCheckStatusLabel,
  getSplitCheckStatusColor,
  getSplitCheckCategoryLabel,
  getPackOutputStatusLabel,
  getPackOutputStatusColor,
} from "@/lib/tender-workspace-data";
import { insertTenderPackOutput } from "@/lib/supabase-tender-data";

// ─── MOCK SPLIT CHECKS GENERATOR ─────────────────────────────

function generateSplitChecks(sourceId: string, targetId: string): TenderSplitCheck[] {
  const targetLabel = targetId.includes("bulk") ? "Bulk" : "PGP";
  const oppositeLabel = targetLabel === "Bulk" ? "PGP" : "Bulk";
  return [
    { id: "sc-01", checkName: `Remove ${oppositeLabel} content from ${targetLabel} output`, description: `All ${oppositeLabel}-specific sections, pricing, and references must be stripped from the ${targetLabel} output pack.`, category: "cross_references", sourcePackId: sourceId, targetPackId: targetId, status: "would_block", severity: "critical", wouldBlockInProduction: true, mockResolution: "Content filter would run automatically", notes: "" },
    { id: "sc-02", checkName: "Remove internal notes and draft comments", description: "All internal notes, working comments, and draft markers must be removed from the external output.", category: "internal_notes", sourcePackId: sourceId, targetPackId: targetId, status: "would_block", severity: "high", wouldBlockInProduction: true, mockResolution: "Internal note scanner would run automatically", notes: "" },
    { id: "sc-03", checkName: "Remove internal watermark from output", description: "Internal-only watermark must be replaced with client-facing formatting.", category: "output_format", sourcePackId: sourceId, targetPackId: targetId, status: "pass", severity: "medium", wouldBlockInProduction: false, mockResolution: "", notes: "" },
    { id: "sc-04", checkName: "Check cross-references to wrong pack", description: `Output must not reference ${oppositeLabel} pack content, pricing, or section numbers.`, category: "cross_references", sourcePackId: sourceId, targetPackId: targetId, status: "warning", severity: "high", wouldBlockInProduction: true, mockResolution: "Manual review required", notes: "Automated cross-ref scan not yet available." },
    { id: "sc-05", checkName: `Check ${targetLabel} placeholders completed`, description: `All submission-critical placeholders for the ${targetLabel} pack must have values.`, category: "placeholders", sourcePackId: sourceId, targetPackId: targetId, status: "would_block", severity: "critical", wouldBlockInProduction: true, mockResolution: "Placeholder register feeds this check", notes: "" },
    { id: "sc-06", checkName: `Check ${targetLabel} required documents ready`, description: `All required documents for the ${targetLabel} submission must be uploaded and approved.`, category: "required_documents", sourcePackId: sourceId, targetPackId: targetId, status: "would_block", severity: "high", wouldBlockInProduction: true, mockResolution: "Required documents register feeds this check", notes: "" },
    { id: "sc-07", checkName: "Check compliance gaps resolved", description: "Non-compliant and clarification-required items must be resolved before production output.", category: "compliance", sourcePackId: sourceId, targetPackId: targetId, status: "warning", severity: "medium", wouldBlockInProduction: false, mockResolution: "Compliance matrix feeds this check", notes: "" },
    { id: "sc-08", checkName: "Check submission gates passed", description: "All critical submission gates must pass before production output generation.", category: "submission_gates", sourcePackId: sourceId, targetPackId: targetId, status: "would_block", severity: "high", wouldBlockInProduction: true, mockResolution: "Submission gates engine feeds this check", notes: "" },
    { id: "sc-09", checkName: `Check ${targetLabel} external submittable flag`, description: `The ${targetLabel} pack must be flagged as externally submittable.`, category: "submittable_flag", sourcePackId: sourceId, targetPackId: targetId, status: "pass", severity: "medium", wouldBlockInProduction: false, mockResolution: "", notes: "" },
    { id: "sc-10", checkName: "Check final output naming convention", description: "Output file must follow the required naming convention for client submission.", category: "output_format", sourcePackId: sourceId, targetPackId: targetId, status: "pass", severity: "low", wouldBlockInProduction: false, mockResolution: "", notes: "" },
    { id: "sc-11", checkName: "Check final read-through complete", description: "A human read-through confirmation is required before production output.", category: "final_review", sourcePackId: sourceId, targetPackId: targetId, status: "not_checked", severity: "medium", wouldBlockInProduction: true, mockResolution: "Manual confirmation required", notes: "" },
    { id: "sc-12", checkName: "Apply TEST OUTPUT watermark for development", description: "In development mode, all outputs are watermarked TEST OUTPUT — NOT FOR CLIENT SUBMISSION.", category: "output_format", sourcePackId: sourceId, targetPackId: targetId, status: "pass", severity: "low", wouldBlockInProduction: false, mockResolution: "", notes: "Development watermark applied automatically." },
  ];
}

// ─── MAIN COMPONENT ──────────────────────────────────────────

export default function TenderSplitPackGenerator({ ws, onClose }: { ws: TenderWorkspace; onClose: () => void }) {
  const masterPack = ws.packs.find(p => p.isMaster);
  const externalPacks = ws.packs.filter(p => p.isExternalSubmittable);

  const [targetPackId, setTargetPackId] = useState<string>(externalPacks[0]?.id || "");
  const [checksRun, setChecksRun] = useState(false);
  const [outputs, setOutputs] = useState<TenderPackOutput[]>(ws.packOutputs && ws.packOutputs.length > 0 ? ws.packOutputs : []);

  // Require Supabase-backed split checks — no silent frontend mock fallback
  const hasSupabaseChecks = (ws.splitChecks ?? []).length > 0;
  const supabaseChecksForTarget = hasSupabaseChecks ? (ws.splitChecks ?? []).filter(c => c.targetPackId === targetPackId) : [];
  const hasSupabaseChecksForTarget = supabaseChecksForTarget.length > 0;

  // Determine which checks to use
  let displayChecks: TenderSplitCheck[] = [];
  let checksSource: 'supabase' | 'missing' | 'none' = 'none';

  if (hasSupabaseChecks) {
    if (hasSupabaseChecksForTarget) {
      displayChecks = supabaseChecksForTarget;
      checksSource = 'supabase';
    } else {
      // We have split checks in Supabase but none for this target pack — explicit missing state
      checksSource = 'missing';
    }
  } else {
    // No Supabase data at all — show error state
    checksSource = 'missing';
  }

  const targetPack = ws.packs.find(p => p.id === targetPackId);
  const passCount = displayChecks.filter(c => c.status === "pass").length;
  const warnCount = displayChecks.filter(c => c.status === "warning").length;
  const blockCount = displayChecks.filter(c => c.status === "would_block" || c.status === "fail").length;

  function handleRunChecks() {
    setChecksRun(true);
    toast.info(`Split checks run for ${targetPack?.packName}. ${blockCount} would block production output, but testing continues.`);
  }

  function handleGenerateOutput() {
    if (!targetPack || !masterPack) return;
    const newOutput: TenderPackOutput = {
      id: `po-${Date.now()}`,
      outputName: `${targetPack.packName} — TEST OUTPUT`,
      tenderPackId: targetPack.id,
      packName: targetPack.packName,
      sourcePackId: masterPack.id,
      outputType: "Split Pack Output",
      format: "PDF Mock",
      version: `v0.${outputs.length + 1}-test`,
      status: blockCount > 0 ? "generated_with_warnings" : "generated_mock",
      generatedBy: "Amin Al-Halabi",
      generatedAt: new Date().toISOString(),
      watermark: "TEST OUTPUT — NOT FOR CLIENT SUBMISSION",
      isTestOutput: true,
      wouldBeSubmittableInProduction: blockCount === 0,
      mockWarningsCount: warnCount + blockCount,
      notes: "",
    };
    setOutputs(prev => [...prev, newOutput]);
    // NOTE: Supabase write-back is intentionally excluded from SUPA-006C (read/parity sprint).
    // Writes belong to SUPA-008 (controlled mock actions + activity/audit).
    // Outputs are seeded in Supabase; new outputs are session-only until SUPA-008.
    toast.info(`Test output generated: "${newOutput.outputName}". This is not a client-submittable document.`, { description: "No real PDF was created." });
  }

  if (!masterPack) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background rounded-xl border shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-serif font-bold">Split Pack Generator (Mock)</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Development mode — no real documents are generated.</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><XCircle className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Dev banner */}
          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">Development mode: Split Pack Generator creates mock output records only. No real document is generated, submitted, or locked.</p>
          </div>

          {/* Step 1: Source Pack */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Step 1 — Source Pack</h4>
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
              <p className="text-xs font-medium">{masterPack.packName}</p>
              <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Internal Master is source only. It is not externally submittable.</p>
            </div>
          </div>

          {/* Step 2: Target Pack */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Step 2 — Target Output Pack</h4>
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">{masterPack.packName}</p>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              <Select value={targetPackId} onValueChange={(v) => { setTargetPackId(v); setChecksRun(false); }}>
                <SelectTrigger size="sm" className="w-[240px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{externalPacks.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.packName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {targetPackId === masterPack.id && (
              <div className="mt-2 p-2 rounded-md border border-red-200 bg-red-50">
                <p className="text-[10px] text-red-700 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Mock Gate: Internal Master Pack is not externally submittable. Testing may continue only as simulation.</p>
              </div>
            )}
          </div>

          {/* Step 3: Split Checks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Step 3 — Mock Split Checks</h4>
              {!checksRun && <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={handleRunChecks}><CheckCircle2 className="w-3 h-3" /> Run Split Checks</Button>}
            </div>
            {checksRun ? (
              <>
                <div className="flex gap-3 mb-3">
                  <Badge variant="outline" className="text-[9px] text-emerald-700 bg-emerald-50 border-emerald-200">{passCount} Pass</Badge>
                  <Badge variant="outline" className="text-[9px] text-amber-700 bg-amber-50 border-amber-200">{warnCount} Warning</Badge>
                  <Badge variant="outline" className="text-[9px] text-red-700 bg-red-50 border-red-200">{blockCount} Would Block</Badge>
                </div>
                {checksSource === 'missing' && (
                  <div className="mb-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <p className="text-xs text-amber-800 font-medium">Supabase split check data not found.</p>
                    <p className="text-[10px] text-amber-700 mt-0.5">Frontend mock fallback disabled for source-of-truth testing.</p>
                  </div>
                )}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Check</th>
                        <th className="px-3 py-2 text-left font-semibold">Category</th>
                        <th className="px-3 py-2 text-left font-semibold">Status</th>
                        <th className="px-3 py-2 text-center font-semibold">Block?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayChecks.map(c => {
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
                                <Badge variant="outline" className="text-[9px] text-amber-700 bg-amber-50 border-amber-200">Would Block</Badge>
                              ) : c.status === "pass" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {blockCount > 0 && (
                  <div className="mt-2 p-2 rounded-md border border-amber-200 bg-amber-50/50">
                    <p className="text-[10px] text-amber-700">{blockCount} check(s) would block production output, but testing continues.</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">Run split checks to evaluate output readiness.</p>
            )}
          </div>

          {/* Step 4: Generate Test Output */}
          {checksRun && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Step 4 — Generate Test Output</h4>
              <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={handleGenerateOutput}>
                <FileOutput className="w-3.5 h-3.5" /> Generate Test Output
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1">No real PDF or DOCX will be created.</p>
            </div>
          )}

          {/* Output Register */}
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
                      <th className="px-3 py-2 text-center font-semibold">Test?</th>
                      <th className="px-3 py-2 text-center font-semibold">Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outputs.map(o => (
                      <tr key={o.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <p className="font-medium">{o.outputName}</p>
                          <p className="text-[9px] text-red-600 font-mono mt-0.5">{o.watermark}</p>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{o.packName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{o.format}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{o.version}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[9px] ${getPackOutputStatusColor(o.status)}`}>{getPackOutputStatusLabel(o.status)}</Badge></td>
                        <td className="px-3 py-2 text-center"><Badge variant="outline" className="text-[9px] text-red-700 bg-red-50 border-red-200">TEST</Badge></td>
                        <td className="px-3 py-2 text-center font-mono">{o.mockWarningsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Future note */}
          <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <p className="text-[10px] text-blue-700">Future: Split Pack Generator will produce real PDF/DOCX outputs with automated content filtering, watermark control, and submission-ready formatting.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex items-center justify-end">
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
