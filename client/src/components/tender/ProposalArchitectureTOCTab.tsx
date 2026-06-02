/**
 * ProposalArchitectureTOCTab — Tab 1 of Tender Drafting
 *
 * The proposal spine. Defines the Table of Contents before blocks are created.
 * TOC → Create Blocks → Edit Blocks → Proposal.
 *
 * No AI. No mock data. No fake TOC. No PDF Studio mutation.
 */
import { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import {
  Save, Loader2, Plus, Trash2, ArrowUp, ArrowDown, Copy, Sparkles,
  ClipboardList, BarChart3, Layers, ChevronDown, ChevronRight, Info,
  Zap, UserCheck,
} from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { normalizeTenderPricingData } from "@/lib/tender-pricing-types";
import { updateTenderDraftingData } from "@/lib/supabase-tender-actions";
import {
  generateBlockContent,
  getBlockBots,
  getBotChainConfig,
  generateAllBlocksSequentially,
  type BlockChainProgress,
  type BlockChainResult,
  type BotChainConfig,
} from "@/lib/ai-runs";
import { buildInitialEditorContent } from "./TenderProposalEditorBlock";
import BlockChainProgressPanel from "./BlockChainProgressPanel";

// ─── Types ──────────────────────────────────────────────────
interface TOCSection {
  id: string;
  section_number: string;
  section_title: string;
  volume: string;
  section_purpose: string;
  source_stages: string;
  required_source_data: string;
  required_evidence: string;
  pdf_studio_target: string;
  owner: string;
  include_in_proposal: boolean;
  status: string;
}

interface TOCVersion {
  id: string;
  version: number;
  status: string;
  sections: TOCSection[];
  created_at: string;
  updated_at: string;
}

const VOLUMES = ["Technical", "Commercial", "Shared", "Appendix"];
const TOC_STATUSES = ["Draft", "Human Edited", "Selected for Build", "Blocks Created", "Revised"];

function emptySection(sectionNumber: string): TOCSection {
  return {
    id: nanoid(8),
    section_number: sectionNumber,
    section_title: "",
    volume: "Technical",
    section_purpose: "",
    source_stages: "",
    required_source_data: "",
    required_evidence: "",
    pdf_studio_target: "",
    owner: "",
    include_in_proposal: true,
    status: "Draft",
  };
}

// ─── Source Intelligence Summary ────────────────────────────
function SourceIntelligenceSummary({ ws }: { ws: TenderWorkspace }) {
  const [open, setOpen] = useState(false);
  const t = ws.tender;
  const pricing = useMemo(() => normalizeTenderPricingData(t.pricingData), [t.pricingData]);
  const sd = (t.solutionDesignData ?? {}) as any;
  const bnb = (t.bidNoBidData ?? {}) as any;
  const docs = ws.documents ?? [];
  const nc = "Not captured";

  function row(label: string, value: string) {
    return (
      <div className="flex justify-between text-[11px] py-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className={value === nc ? "text-muted-foreground" : "font-medium"}>{value}</span>
      </div>
    );
  }

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="py-2 px-4 cursor-pointer bg-muted/20 border-b border-border" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-xs font-semibold">Source Intelligence Summary</span>
          <Badge variant="outline" className="text-[8px] ml-auto">read-only</Badge>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="space-y-0.5 rounded-md border border-border p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Customer / Tender</p>
              {row("Customer", t.customerName || nc)}
              {row("Tender", t.title || nc)}
              {row("Sector", (t as any).sector || nc)}
            </div>
            <div className="space-y-0.5 rounded-md border border-border p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Bid / No-Bid</p>
              {row("Decision", bnb.bid_decision?.decision || nc)}
              {row("Win Strategy", bnb.win_strategy ? "Captured" : nc)}
            </div>
            <div className="space-y-0.5 rounded-md border border-border p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Solution Design</p>
              {row("Configuration", sd.configuration?.selected_modules || nc)}
              {row("HOP", sd.hop ? "Captured" : nc)}
              {row("HAM", sd.ham ? "Captured" : nc)}
              {row("HIP", sd.hip ? "Captured" : nc)}
              {row("Scope Matrix", sd.scope_matrix ? "Captured" : nc)}
              {row("SLA/KPI", sd.sla_kpi ? "Captured" : nc)}
            </div>
            <div className="space-y-0.5 rounded-md border border-border p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">P&L / Pricing</p>
              {row("Snapshot", pricing.pnl_snapshot?.snapshot_status !== "No Snapshot" ? pricing.pnl_snapshot?.snapshot_status : nc)}
              {row("Commercial Terms", pricing.commercial_terms ? "Captured" : nc)}
              {row("Pricing Approval", pricing.approval?.summary?.approval_status !== "Not Submitted" ? pricing.approval.summary.approval_status : nc)}
            </div>
            <div className="space-y-0.5 rounded-md border border-border p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Documents</p>
              {row("Total", String(docs.length))}
              {row("Source", String(docs.filter((d: any) => d.document_category === "Source").length))}
              {row("Supporting", String(docs.filter((d: any) => d.document_category === "Supporting").length))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────
interface Props { ws: TenderWorkspace; reload: () => void }

export default function ProposalArchitectureTOCTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
  const saved = drafting.proposal_architecture ?? {};
  const existingBlocks = Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [];

  // Load or create TOC version
  const [tocVersions, setTocVersions] = useState<TOCVersion[]>(() => {
    if (Array.isArray(saved.toc_versions) && saved.toc_versions.length > 0) return saved.toc_versions;
    return [{
      id: nanoid(8),
      version: 1,
      status: "Draft",
      sections: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }];
  });
  const [tocStatus, setTocStatus] = useState(saved.status || "Draft");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState<TOCSection[] | null>(null);

  // ── Bot chaining state ──
  const [showChainDialog, setShowChainDialog] = useState(false);
  const [chainConfig, setChainConfig] = useState<BotChainConfig | null>(null);
  const [tocBotId, setTocBotId] = useState<string | null>(null);
  const [chainProgress, setChainProgress] = useState<BlockChainProgress | null>(null);
  const [chainResult, setChainResult] = useState<BlockChainResult | null>(null);
  const [isChaining, setIsChaining] = useState(false);
  const chainAbortRef = useRef<AbortController | null>(null);

  // Active version is the last one
  const activeVersion = tocVersions[tocVersions.length - 1];
  const sections = activeVersion.sections;
  const blocksCreated = existingBlocks.length > 0;

  // ─── Section CRUD ──────────────────────────────────────────
  const updateSections = (newSections: TOCSection[]) => {
    const updated = tocVersions.map((v, i) =>
      i === tocVersions.length - 1 ? { ...v, sections: newSections, updated_at: new Date().toISOString() } : v
    );
    setTocVersions(updated);
    setDirty(true);
  };

  const addSection = () => {
    const nextNum = String(sections.length + 1);
    updateSections([...sections, emptySection(nextNum)]);
  };

  const updateSection = (id: string, patch: Partial<TOCSection>) => {
    updateSections(sections.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const removeSection = (id: string) => {
    const filtered = sections.filter(s => s.id !== id);
    // Renumber
    const renumbered = filtered.map((s, i) => ({ ...s, section_number: String(i + 1) }));
    updateSections(renumbered);
  };

  const duplicateSection = (id: string) => {
    const idx = sections.findIndex(s => s.id === id);
    if (idx < 0) return;
    const source = sections[idx];
    const copy: TOCSection = { ...source, id: nanoid(8), section_title: `${source.section_title} (copy)`, status: "Draft" };
    const newSections = [...sections];
    newSections.splice(idx + 1, 0, copy);
    const renumbered = newSections.map((s, i) => ({ ...s, section_number: String(i + 1) }));
    updateSections(renumbered);
  };

  const moveSection = (id: string, dir: -1 | 1) => {
    const idx = sections.findIndex(s => s.id === id);
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    const arr = [...sections];
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    const renumbered = arr.map((s, i) => ({ ...s, section_number: String(i + 1) }));
    updateSections(renumbered);
  };

  // ─── Generate TOC Suggestion via AI ─────────────────────────
  const generateTOCSuggestion = useCallback(async () => {
    setGenerating(true);
    setAiPreview(null);
    try {
      const t = ws.tender;
      const sd = (t.solutionDesignData ?? {}) as any;
      const bnb = (t.bidNoBidData ?? {}) as any;
      const sowQ = (t.sowQualificationData ?? {}) as any;
      const techQ = (t.technicalQualificationData ?? {}) as any;
      const risk = (t.riskSnapshotData ?? {}) as any;
      const sow = (t.sowData ?? {}) as any;
      const pricing = normalizeTenderPricingData(t.pricingData);

      // Build structured context for the AI
      const contextParts: string[] = [
        `TENDER: ${t.title}`,
        `CUSTOMER: ${t.customerName}`,
        `REGION: ${t.region || "Not captured"}`,
        `DEADLINE: ${t.submissionDeadline || "Not captured"}`,
        `EST. VALUE: ${t.estimatedValue ? `SAR ${t.estimatedValue.toLocaleString()}` : "Not captured"}`,
      ];

      if (sow.scope_summary) contextParts.push(`\nSCOPE SUMMARY:\n${sow.scope_summary}`);
      if (Array.isArray(sow.service_lines) && sow.service_lines.length > 0) {
        contextParts.push(`\nSERVICE LINES:\n${sow.service_lines.map((s: any) => `- ${s.name}: ${s.description || ""} (${s.status || ""})`).join("\n")}`);
      }
      if (sowQ.outcome?.recommendation) contextParts.push(`\nSOW QUALIFICATION OUTCOME: ${sowQ.outcome.recommendation}`);
      if (techQ.recommendation?.outcome) contextParts.push(`TECHNICAL QUALIFICATION: ${techQ.recommendation.outcome}`);
      if (bnb.bid_decision?.decision) contextParts.push(`BID DECISION: ${bnb.bid_decision.decision}`);
      if (bnb.win_strategy?.win_themes && Array.isArray(bnb.win_strategy.win_themes)) {
        contextParts.push(`\nWIN THEMES:\n${bnb.win_strategy.win_themes.map((w: string) => `- ${w}`).join("\n")}`);
      }
      if (sd.configuration?.selected_modules) contextParts.push(`\nSOLUTION: ${sd.configuration.selected_modules}`);
      if (sd.hop) contextParts.push(`HOP: Captured`);
      if (sd.ham) contextParts.push(`HAM: Captured`);
      if (sd.hip) contextParts.push(`HIP: Captured`);
      if (Array.isArray(risk.risk_rows) && risk.risk_rows.length > 0) {
        contextParts.push(`\nRISKS: ${risk.risk_rows.length} risks (${risk.risk_rows.filter((r: any) => r.risk_level === "High").length} high)`);
      }

      const prompt = [
        `You are generating a Table of Contents (TOC) for a tender proposal document.`,
        `Based on the tender context below, generate a structured TOC with 8-15 sections.`,
        `Each section should have: section_number, section_title, volume (Technical/Commercial/Shared/Appendix), section_purpose, source_stages, required_source_data.`,
        ``,
        `Return ONLY valid JSON — an array of objects with these fields:`,
        `[{"section_number":"1","section_title":"...","volume":"Technical","section_purpose":"...","source_stages":"...","required_source_data":"..."}]`,
        ``,
        `TENDER CONTEXT:`,
        contextParts.join("\n"),
      ].join("\n");

      // Resolve bot from Bot Builder (governed system)
      const bots = await getBlockBots("tenders");
      const botId = bots.length > 0 ? bots[0].id : "ebot-tender-proposal-writer";
      setTocBotId(botId);

      const result = await generateBlockContent(
        botId,
        "toc_generation",
        prompt,
        "", // no existing block content
        null, // no transcript
        undefined,
        tenderId,
      );

      // Parse the AI response — extract JSON array
      let parsed: any[] = [];
      const content = result.content;
      // Try to extract JSON from markdown code blocks or raw response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          toast.error("AI returned invalid JSON. Try again.");
          return;
        }
      } else {
        toast.error("AI did not return a TOC structure. Try again.");
        return;
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        toast.error("AI returned empty TOC. Try again.");
        return;
      }

      // Convert to TOCSection[]
      const aiSections: TOCSection[] = parsed.map((s: any, i: number) => ({
        id: nanoid(8),
        section_number: s.section_number || String(i + 1),
        section_title: s.section_title || `Section ${i + 1}`,
        volume: VOLUMES.includes(s.volume) ? s.volume : "Technical",
        section_purpose: s.section_purpose || "",
        source_stages: s.source_stages || "",
        required_source_data: s.required_source_data || "",
        required_evidence: s.required_evidence || "",
        pdf_studio_target: s.pdf_studio_target || "",
        owner: s.owner || "",
        include_in_proposal: true,
        status: "Draft",
      }));

      setAiPreview(aiSections);
      toast.success(`AI generated ${aiSections.length} TOC sections — review below.`);
    } catch (e: any) {
      toast.error(e.message || "AI generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [ws, tenderId]);

  // Accept AI preview → replace current TOC sections + check chain config
  const acceptAiPreview = useCallback(async () => {
    if (!aiPreview) return;
    updateSections(aiPreview);
    setAiPreview(null);
    toast.success("AI TOC sections applied. Review and save.");

    // Check if the TOC bot has a chain config
    if (tocBotId) {
      const cfg = await getBotChainConfig(tocBotId);
      if (cfg?.next_bot_id) {
        setChainConfig(cfg);
        if (cfg.prompt_user) {
          setShowChainDialog(true);
        }
      }
    }
  }, [aiPreview, updateSections, tocBotId]);

  const dismissAiPreview = useCallback(() => {
    setAiPreview(null);
  }, []);

  // ── Bot Chain: Auto-draft all blocks ──
  const handleAutoDraftAll = useCallback(async () => {
    if (!chainConfig?.next_bot_id) return;
    setShowChainDialog(false);
    setIsChaining(true);
    setChainProgress(null);
    setChainResult(null);

    // 1. Create blocks from TOC first (if not already created)
    const includedSections = sections.filter(s => s.include_in_proposal);
    if (includedSections.length === 0) {
      toast.error("No sections marked 'Include in Proposal'.");
      setIsChaining(false);
      return;
    }

    // Create blocks
    const newBlocks = includedSections.map(s => ({
      id: nanoid(10),
      toc_section_id: s.id,
      section_number: s.section_number,
      title: s.section_title,
      block_key: s.section_title,
      block_type: s.section_title,
      volume: s.volume,
      intended_section: s.section_title,
      source_stages: s.source_stages,
      required_source_data: s.required_source_data,
      required_evidence: s.required_evidence,
      pdf_studio_target: s.pdf_studio_target,
      owner: s.owner,
      editor_stage: "structure" as const,
      editor_content: buildInitialEditorContent(s.section_title, s.section_title),
      draft_content: "",
      is_canon_locked: false,
      notes: "",
      section_name: s.section_title,
      draft_status: "Ready to Draft",
      approval_status: "Draft",
      reviewer: "",
      review_notes: "",
      approved_at: "",
      approved_by: "",
      last_updated: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }));

    // Save blocks first
    try {
      const blockRes = await updateTenderDraftingData(tenderId, "proposal_blocks", newBlocks, "Blocks created from TOC (chain)");
      if (!blockRes.success) {
        toast.error(blockRes.error || "Failed to create blocks.");
        setIsChaining(false);
        return;
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to create blocks.");
      setIsChaining(false);
      return;
    }

    // 2. Build tender context
    const t = ws.tender;
    const tenderContext = [
      `## Tender Context`,
      `Tender: ${t.title || "Untitled"}`,
      `Customer: ${t.customerName || "Unknown"}`,
      `Submission Deadline: ${t.submissionDeadline || "Not captured"}`,
      `Region: ${t.region || "Not captured"}`,
    ].join("\n");

    // 3. Run sequential generation
    const abortController = new AbortController();
    chainAbortRef.current = abortController;

    const result = await generateAllBlocksSequentially(
      chainConfig.next_bot_id!,
      newBlocks,
      tenderContext,
      (progress) => setChainProgress(progress),
      abortController.signal,
    );

    chainAbortRef.current = null;

    // 4. Save AI-drafted content back to blocks
    if (Object.keys(result.results).length > 0) {
      const updatedBlocks = newBlocks.map(b => {
        const aiContent = result.results[b.id];
        if (aiContent) {
          return {
            ...b,
            editor_content: aiContent,
            draft_content: aiContent,
            draft_status: "AI Drafted",
            editor_stage: "draft" as const,
          };
        }
        return b;
      });

      try {
        await updateTenderDraftingData(tenderId, "proposal_blocks", updatedBlocks, "AI auto-drafted blocks via chain");
      } catch (e: any) {
        console.error("[TOC Chain] Failed to save AI-drafted blocks:", e.message);
      }
    }

    setChainResult(result);
    setChainProgress(null);
    setIsChaining(false);
    toast.success(`Auto-draft complete: ${result.completed} drafted, ${result.failed} failed`);
    reload();
  }, [chainConfig, sections, tenderId, ws, reload]);

  const handleCancelChain = useCallback(() => {
    chainAbortRef.current?.abort();
  }, []);

  const handleChainDone = useCallback(() => {
    setChainResult(null);
    setChainProgress(null);
  }, []);

  // ─── Create Blocks from TOC ────────────────────────────────
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  const createBlocksFromTOC = useCallback(async (mode: "add_missing" | "replace_all") => {
    const includedSections = sections.filter(s => s.include_in_proposal);
    if (includedSections.length === 0) {
      toast.error("No sections marked 'Include in Proposal'.");
      return;
    }

    let newBlocks: any[];
    if (mode === "replace_all") {
      newBlocks = includedSections.map(s => ({
        id: nanoid(10),
        toc_section_id: s.id,
        section_number: s.section_number,
        title: s.section_title,
        block_key: s.section_title,
        block_type: s.section_title,
        volume: s.volume,
        intended_section: s.section_title,
        source_stages: s.source_stages,
        required_source_data: s.required_source_data,
        required_evidence: s.required_evidence,
        pdf_studio_target: s.pdf_studio_target,
        owner: s.owner,
        editor_stage: "structure",
        editor_content: buildInitialEditorContent(s.section_title, s.section_title),
        draft_content: "",
        is_canon_locked: false,
        notes: "",
        section_name: s.section_title,
        draft_status: "Ready to Draft",
        approval_status: "Draft",
        reviewer: "",
        review_notes: "",
        approved_at: "",
        approved_by: "",
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }));
    } else {
      // Add missing only — keep existing blocks, add blocks for TOC sections not yet linked
      const existingTocIds = new Set(existingBlocks.map((b: any) => b.toc_section_id).filter(Boolean));
      const missingSections = includedSections.filter(s => !existingTocIds.has(s.id));
      if (missingSections.length === 0) {
        toast.info("All included TOC sections already have blocks.");
        setShowBlockConfirm(false);
        return;
      }
      const additions = missingSections.map(s => ({
        id: nanoid(10),
        toc_section_id: s.id,
        section_number: s.section_number,
        title: s.section_title,
        block_key: s.section_title,
        block_type: s.section_title,
        volume: s.volume,
        intended_section: s.section_title,
        source_stages: s.source_stages,
        required_source_data: s.required_source_data,
        required_evidence: s.required_evidence,
        pdf_studio_target: s.pdf_studio_target,
        owner: s.owner,
        editor_stage: "structure",
        editor_content: buildInitialEditorContent(s.section_title, s.section_title),
        draft_content: "",
        is_canon_locked: false,
        notes: "",
        section_name: s.section_title,
        draft_status: "Ready to Draft",
        approval_status: "Draft",
        reviewer: "",
        review_notes: "",
        approved_at: "",
        approved_by: "",
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }));
      newBlocks = [...existingBlocks, ...additions];
    }

    setSaving(true);
    try {
      // Save blocks
      const blockRes = await updateTenderDraftingData(tenderId, "proposal_blocks", newBlocks, "Blocks created from TOC");
      if (!blockRes.success) { toast.error(blockRes.error || "Failed to create blocks."); return; }

      // Update TOC status to "Blocks Created"
      const updatedStatus = "Blocks Created";
      setTocStatus(updatedStatus);
      const tocPayload = {
        active_toc_id: activeVersion.id,
        status: updatedStatus,
        toc_versions: tocVersions.map((v, i) =>
          i === tocVersions.length - 1 ? { ...v, status: updatedStatus, sections: sections.map(s => ({
            ...s, status: s.include_in_proposal ? "Blocks Created" : s.status,
          })), updated_at: new Date().toISOString() } : v
        ),
      };
      await updateTenderDraftingData(tenderId, "proposal_architecture", tocPayload, "TOC status updated after block creation");

      toast.success(`${mode === "replace_all" ? newBlocks.length : newBlocks.length - existingBlocks.length} blocks created from TOC.`);
      setShowBlockConfirm(false);
      setDirty(false);
      reload();
    } catch (e: any) { toast.error(e.message || "Failed."); }
    finally { setSaving(false); }
  }, [sections, existingBlocks, tenderId, tocVersions, tocStatus, activeVersion.id, reload]);

  const handleDraftManually = useCallback(async () => {
    setShowChainDialog(false);
    // Just create blocks from TOC without AI drafting
    await createBlocksFromTOC(existingBlocks.length > 0 ? "add_missing" : "replace_all");
  }, [createBlocksFromTOC, existingBlocks.length]);

  const handleCreateBlocks = () => {
    if (existingBlocks.length > 0) {
      setShowBlockConfirm(true);
    } else {
      createBlocksFromTOC("replace_all");
    }
  };

  // ─── Save TOC ──────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        active_toc_id: activeVersion.id,
        status: tocStatus,
        toc_versions: tocVersions.map((v, i) =>
          i === tocVersions.length - 1 ? { ...v, status: tocStatus, updated_at: new Date().toISOString() } : v
        ),
      };
      const res = await updateTenderDraftingData(tenderId, "proposal_architecture", payload, "TOC saved");
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Proposal Architecture / TOC saved.");
      setDirty(false);
      reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [tocVersions, tocStatus, tenderId, reload, activeVersion.id]);


  // ─── Summary ───────────────────────────────────────────────
  const includedCount = sections.filter(s => s.include_in_proposal).length;
  const techCount = sections.filter(s => s.include_in_proposal && (s.volume === "Technical" || s.volume === "Shared")).length;
  const commCount = sections.filter(s => s.include_in_proposal && (s.volume === "Commercial" || s.volume === "Shared")).length;

  return (
    <div className="space-y-4">
      {/* Source Intelligence Summary */}
      <SourceIntelligenceSummary ws={ws} />

      {/* TOC Workspace Header */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs font-semibold">Proposal Architecture / Table of Contents</span>
              <Badge variant="outline" className={`text-[8px] ${tocStatus === "Blocks Created" ? "border-emerald-200 text-emerald-600" : "border-blue-200 text-blue-600"}`}>{tocStatus}</Badge>
              <Badge variant="outline" className="text-[8px]">v{activeVersion.version}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Select value={tocStatus} onValueChange={v => { setTocStatus(v); setDirty(true); }}>
                <SelectTrigger className="h-7 text-[10px] w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{TOC_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save TOC
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-5 gap-3 text-center">
            {[
              ["Sections", sections.length],
              ["Included", includedCount],
              ["Technical", techCount],
              ["Commercial", commCount],
              ["Blocks Created", blocksCreated ? "Yes" : "No"],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-md border border-border p-2">
                <p className="text-lg font-bold">{val}</p>
                <p className="text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generate TOC Suggestion — AI-powered */}
      <div className="space-y-2 px-1">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={generating || isChaining} onClick={generateTOCSuggestion}>
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? "Generating..." : "Generate TOC Suggestion"}
          </Button>
          <span className="text-[10px] text-muted-foreground italic">
            {generating ? "AI is reading tender context and building TOC..." : "Uses AI to suggest TOC sections from prior-stage intelligence."}
          </span>
        </div>

        {/* AI Preview Panel */}
        {aiPreview && aiPreview.length > 0 && (
          <Card className="border-indigo-200 bg-indigo-50/30 shadow-none">
            <CardHeader className="py-2 px-4 bg-indigo-50/50 border-b border-indigo-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-semibold text-indigo-800">AI TOC Suggestion — {aiPreview.length} sections</span>
                  <Badge variant="outline" className="text-[8px] border-indigo-300 text-indigo-600">Preview</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-7 text-[10px] gap-1 bg-indigo-600 hover:bg-indigo-700" onClick={acceptAiPreview}>
                    Accept & Apply
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={dismissAiPreview}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-[11px]">
                <thead className="bg-indigo-50/80 border-b border-indigo-200">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold w-10">#</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Section Title</th>
                    <th className="px-2 py-1.5 text-left font-semibold w-24">Volume</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Purpose</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Source Stages</th>
                  </tr>
                </thead>
                <tbody>
                  {aiPreview.map(s => (
                    <tr key={s.id} className="border-t border-indigo-100 hover:bg-indigo-50/50">
                      <td className="px-2 py-1.5 text-muted-foreground font-mono">{s.section_number}</td>
                      <td className="px-2 py-1.5 font-medium">{s.section_title}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{s.volume}</td>
                      <td className="px-2 py-1.5 text-muted-foreground text-[10px]">{s.section_purpose}</td>
                      <td className="px-2 py-1.5 text-muted-foreground text-[10px]">{s.source_stages}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* ── Bot Chain Dialog ── */}
        {showChainDialog && chainConfig && (
          <Card className="border-violet-200 bg-violet-50/30 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
                  <Sparkles className="h-5 w-5 text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-violet-800">
                    TOC Created — {sections.filter(s => s.include_in_proposal).length} sections
                  </p>
                  <p className="mt-1 text-xs text-violet-700">
                    Would you like AI to auto-draft content for all {sections.filter(s => s.include_in_proposal).length} blocks?
                  </p>
                  <p className="mt-1 text-[10px] text-violet-600 italic">
                    This will generate content for each block sequentially using the Section Writer bot. You can cancel at any time.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" className="h-8 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700" onClick={handleAutoDraftAll}>
                      <Zap className="w-3.5 h-3.5" /> {chainConfig.chain_label || "Auto-draft all blocks"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50" onClick={handleDraftManually}>
                      <UserCheck className="w-3.5 h-3.5" /> I'll draft each block manually
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-slate-500" onClick={() => setShowChainDialog(false)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Bot Chain Progress ── */}
        {(isChaining || chainResult) && (
          <BlockChainProgressPanel
            progress={chainProgress}
            result={chainResult}
            onCancel={handleCancelChain}
            onDone={handleChainDone}
          />
        )}
      </div>

      {/* Editable TOC Table */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs font-semibold">Table of Contents</span>
              <Badge variant="outline" className="text-[8px]">{sections.length} section{sections.length !== 1 ? "s" : ""}</Badge>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={addSection}>
              <Plus className="w-3 h-3" /> Add Section
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No TOC sections yet. Click "Add Section" to begin.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold w-10">#</th>
                    <th className="px-2 py-2 text-left font-semibold">Section Title</th>
                    <th className="px-2 py-2 text-left font-semibold w-24">Volume</th>
                    <th className="px-2 py-2 text-left font-semibold w-20">Include</th>
                    <th className="px-2 py-2 text-left font-semibold w-28">Status</th>
                    <th className="px-2 py-2 text-left font-semibold w-20">Owner</th>
                    <th className="px-2 py-2 text-center font-semibold w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((s, i) => (
                    <>
                      <tr key={s.id} className={`border-t border-border hover:bg-muted/30 cursor-pointer ${expandedRow === s.id ? "bg-indigo-50 dark:bg-indigo-950/20" : ""}`} onClick={() => setExpandedRow(expandedRow === s.id ? null : s.id)}>
                        <td className="px-2 py-1.5 text-muted-foreground font-mono">{s.section_number}</td>
                        <td className="px-2 py-1.5">
                          <Input className="h-6 text-[10px] border-0 bg-transparent p-0 font-medium" value={s.section_title} onClick={e => e.stopPropagation()} onChange={e => updateSection(s.id, { section_title: e.target.value, status: s.status === "Draft" || s.status === "Revised" ? "Human Edited" : s.status })} placeholder="Section title" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Select value={s.volume} onValueChange={v => updateSection(s.id, { volume: v })}>
                            <SelectTrigger className="h-6 text-[10px] border-0 bg-transparent p-0 w-20" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger>
                            <SelectContent>{VOLUMES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Checkbox checked={s.include_in_proposal} onCheckedChange={(checked) => { updateSection(s.id, { include_in_proposal: !!checked }); }} onClick={e => e.stopPropagation()} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Select value={s.status} onValueChange={v => updateSection(s.id, { status: v })}>
                            <SelectTrigger className="h-6 text-[10px] border-0 bg-transparent p-0 w-24" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger>
                            <SelectContent>{TOC_STATUSES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Input className="h-6 text-[10px] border-0 bg-transparent p-0" value={s.owner} onClick={e => e.stopPropagation()} onChange={e => updateSection(s.id, { owner: e.target.value })} placeholder="—" />
                        </td>
                        <td className="px-2 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-0.5">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={i === 0} onClick={() => moveSection(s.id, -1)}><ArrowUp className="w-3 h-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={i === sections.length - 1} onClick={() => moveSection(s.id, 1)}><ArrowDown className="w-3 h-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => duplicateSection(s.id)}><Copy className="w-3 h-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeSection(s.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                          </div>
                        </td>
                      </tr>
                      {expandedRow === s.id && (
                        <tr key={`${s.id}-detail`} className="border-t border-dashed border-border bg-muted/10">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground">Section Purpose</label>
                                <Textarea className="text-xs mt-1 min-h-[40px]" value={s.section_purpose} onChange={e => updateSection(s.id, { section_purpose: e.target.value })} placeholder="Why this section exists in the proposal" />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground">Source Stages</label>
                                <Input className="h-8 text-xs mt-1" value={s.source_stages} onChange={e => updateSection(s.id, { source_stages: e.target.value })} placeholder="e.g. Solution Design, P&L" />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground">Required Source Data</label>
                                <Input className="h-8 text-xs mt-1" value={s.required_source_data} onChange={e => updateSection(s.id, { required_source_data: e.target.value })} placeholder="e.g. HOP scope, SLA table" />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground">Required Evidence</label>
                                <Input className="h-8 text-xs mt-1" value={s.required_evidence} onChange={e => updateSection(s.id, { required_evidence: e.target.value })} placeholder="e.g. ISO cert, fleet list" />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-muted-foreground">PDF Studio Target</label>
                                <Input className="h-8 text-xs mt-1" value={s.pdf_studio_target} onChange={e => updateSection(s.id, { pdf_studio_target: e.target.value })} placeholder="e.g. Section 3 — Proposed Solution" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Blocks from TOC */}
      <Card className="border-border shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold">Create Blocks from TOC</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Creates one proposal block per included TOC section. Block body content will be heading-only.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {includedCount === 0 && <span className="text-[10px] text-amber-600">No sections included.</span>}
              <Button size="sm" className="h-8 text-xs gap-1.5" disabled={includedCount === 0 || saving} onClick={handleCreateBlocks}>
                <Layers className="w-3.5 h-3.5" /> Create Blocks from TOC
              </Button>
            </div>
          </div>

          {/* Block confirmation dialog */}
          {showBlockConfirm && (
            <div className="mt-3 p-3 border border-amber-200 bg-amber-50 rounded-md space-y-2">
              <p className="text-xs font-semibold text-amber-800">Blocks already exist ({existingBlocks.length} blocks).</p>
              <p className="text-[10px] text-amber-700">How should the system handle existing blocks?</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => createBlocksFromTOC("add_missing")}>Add Missing Only</Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px] border-red-200 text-red-700 hover:bg-red-50" onClick={() => createBlocksFromTOC("replace_all")}>Replace All</Button>
                <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setShowBlockConfirm(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
