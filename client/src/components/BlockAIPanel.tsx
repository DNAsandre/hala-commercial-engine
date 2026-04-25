/**
 * BlockAIPanel — Left slide-in panel for block-level AI generation
 * Sprint 10: Editor AI Pop-up + Bot Selector + Transcript Document Bots
 *
 * Opens when user clicks the AI sparkle on a block.
 * Human-first: AI output is always staged as draft, never auto-committed.
 *
 * Design: White panel, subtle borders, enterprise SaaS aesthetic matching DocumentComposer
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  X, Sparkles, Bot, Send, Check, XCircle,
  Mic, Upload, FileText, ChevronDown, ChevronRight,
  Loader2, AlertTriangle, Wand2, PenTool, Shield,
  Scale, CheckCircle, RefreshCw, Eye, Copy,
  Zap, Brain, CloudOff, BookOpen,
} from "lucide-react";
import {
  type EditorBot, type AIRun,
  getBlockBots, getEditorBotById,
  createAIRun, applyAIRun, discardAIRun,
  generateBlockContent,
} from "@/lib/ai-runs";
import { getBlockByKey } from "@/lib/document-composer";
import type { ComposerBlock } from "@/components/DocumentComposer";

// ============================================================
// ICON MAP
// ============================================================

const BOT_ICON_MAP: Record<string, typeof Bot> = {
  PenTool, Shield, FileText, Scale, CheckCircle, RefreshCw, Bot, Brain, Wand2,
};

function getBotIcon(iconName: string) {
  return BOT_ICON_MAP[iconName] || Bot;
}

// ============================================================
// PROPS
// ============================================================

interface BlockAIPanelProps {
  open: boolean;
  onClose: () => void;
  block: ComposerBlock | null;
  docType: string;
  docInstanceId: string;
  workspaceId: string | null;
  customerName: string;
  onApplyContent: (blockId: string, content: string, mode: "insert" | "replace") => void;
}

// ============================================================
// COMPONENT
// ============================================================

export default function BlockAIPanel({
  open, onClose, block, docType, docInstanceId, workspaceId,
  customerName, onApplyContent,
}: BlockAIPanelProps) {
  // Bot selection
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [promptText, setPromptText] = useState("");
  const [insertMode, setInsertMode] = useState<"insert" | "replace">("replace");

  // Transcript
  const [transcriptText, setTranscriptText] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [showContext, setShowContext] = useState(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [edgeFunctionError, setEdgeFunctionError] = useState(false);
  const [draftCitations, setDraftCitations] = useState<{ source: string; chunkIndex: number; snippet: string }[]>([]);
  const [draftChunkCount, setDraftChunkCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available bots for this doc type (async — reads from Supabase)
  const [availableBots, setAvailableBots] = useState<EditorBot[]>([]);
  useEffect(() => {
    let cancelled = false;
    getBlockBots(docType).then(bots => {
      if (!cancelled) setAvailableBots(bots);
    });
    return () => { cancelled = true; };
  }, [docType]);

  // Auto-select first bot
  useEffect(() => {
    if (availableBots.length > 0 && !selectedBotId) {
      setSelectedBotId(availableBots[0].id);
    }
  }, [availableBots, selectedBotId]);

  // Reset state when block changes
  useEffect(() => {
    setDraftContent(null);
    setCurrentRunId(null);
    setIsGenerating(false);
    setEdgeFunctionError(false);
    setDraftCitations([]);
    setDraftChunkCount(0);
  }, [block?.id]);

  const [selectedBot, setSelectedBot] = useState<EditorBot | null>(null);
  useEffect(() => {
    if (!selectedBotId) { setSelectedBot(null); return; }
    let cancelled = false;
    getEditorBotById(selectedBotId).then(bot => {
      if (!cancelled) setSelectedBot(bot);
    });
    return () => { cancelled = true; };
  }, [selectedBotId]);

  const blockDef = block ? getBlockByKey(block.block_key) : null;

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleGenerate = useCallback(async () => {
    if (!block || !selectedBot) return;

    setIsGenerating(true);
    setEdgeFunctionError(false);
    setDraftContent(null);

    try {
      const result = await generateBlockContent(
        selectedBot.id,
        blockDef?.family || "commercial",
        promptText,
        block.content,
        transcriptText || null,
      );

      // Create AI run record
      const run = createAIRun({
        doc_instance_id: docInstanceId,
        workspace_id: workspaceId,
        bot_id: selectedBot.id,
        bot_name: selectedBot.name,
        bot_type: "block",
        target_scope: "block",
        target_block_ids: [block.id],
        input_prompt: promptText,
        input_transcript_ref: transcriptText ? "inline-text" : null,
        output_text: result.content,
        provider: selectedBot.provider,
        model: selectedBot.model,
        run_mode: null,
        created_by: "current-user",
      });

      setDraftContent(result.content);
      setCurrentRunId(run.id);
      setDraftCitations(result.citations || []);
      setDraftChunkCount(result.retrieved_chunks?.length || 0);
      toast.success(`AI draft ready — ${result.retrieved_chunks?.length || 0} KB chunks used`);
    } catch (err) {
      setEdgeFunctionError(true);
      toast.error("AI generation failed — check provider configuration");
    } finally {
      setIsGenerating(false);
    }
  }, [block, selectedBot, promptText, transcriptText, docInstanceId, workspaceId, blockDef]);

  const handleApply = useCallback(() => {
    if (!block || !draftContent || !currentRunId) return;

    applyAIRun(currentRunId);
    onApplyContent(block.id, draftContent, insertMode);
    setDraftContent(null);
    setCurrentRunId(null);
  }, [block, draftContent, currentRunId, insertMode, onApplyContent]);

  const handleDiscard = useCallback(() => {
    if (currentRunId) {
      discardAIRun(currentRunId);
    }
    setDraftContent(null);
    setCurrentRunId(null);
    toast.info("AI draft discarded");
  }, [currentRunId]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".txt") && !file.name.endsWith(".md")) {
      toast.error("Only .txt and .md files are supported");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setTranscriptText(text);
      setShowTranscript(true);
      toast.success(`Transcript loaded: ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  // ============================================================
  // RENDER
  // ============================================================

  if (!open || !block) return null;

  const BotIcon = selectedBot ? getBotIcon(selectedBot.icon) : Bot;

  return (
    <div className="w-80 border-r border-gray-200 bg-white flex flex-col shrink-0 shadow-lg z-30 animate-in slide-in-from-left duration-200">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-white">
        <div className="p-1.5 rounded-lg bg-amber-100">
          <Sparkles size={14} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-semibold text-[#1B2A4A]">Block AI Assistant</h3>
          <p className="text-[10px] text-gray-500 truncate">
            {blockDef?.display_name || block.block_key}
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">

          {/* Phase 0: Edge Function Error State */}
          {edgeFunctionError && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50">
              <div className="flex items-center gap-2 mb-1.5">
                <CloudOff size={14} className="text-red-500" />
                <span className="text-xs font-semibold text-red-700">AI Providers Not Deployed</span>
              </div>
              <p className="text-[10px] text-red-600 leading-relaxed">
                Edge Functions for AI generation are not yet deployed. Please configure AI providers in Admin → AI Providers, and deploy the Supabase Edge Functions.
              </p>
            </div>
          )}

          {/* Bot Selector */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Select Bot
            </label>
            {availableBots.length === 0 ? (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-center">
                <AlertTriangle size={16} className="mx-auto mb-1 text-amber-500" />
                <p className="text-[10px] text-amber-700">No bots available for {docType} documents</p>
              </div>
            ) : (
              <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choose a bot..." />
                </SelectTrigger>
                <SelectContent>
                  {availableBots.map(bot => {
                    const Icon = getBotIcon(bot.icon);
                    return (
                      <SelectItem key={bot.id} value={bot.id}>
                        <div className="flex items-center gap-2">
                          <Icon size={12} className="text-amber-600" />
                          <span>{bot.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Bot Info (read-only provider/model) */}
          {selectedBot && (
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <BotIcon size={14} className="text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-500">{selectedBot.description}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[9px] h-4 capitalize">{selectedBot.provider}</Badge>
                  <Badge variant="outline" className="text-[9px] h-4">{selectedBot.model}</Badge>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Insert / Replace Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Mode</label>
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setInsertMode("replace")}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                  insertMode === "replace" ? "bg-white shadow-sm text-[#1B2A4A]" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Replace
              </button>
              <button
                onClick={() => setInsertMode("insert")}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                  insertMode === "insert" ? "bg-white shadow-sm text-[#1B2A4A]" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Insert
              </button>
            </div>
          </div>

          {/* Prompt Editor */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Prompt
            </label>
            <Textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder={`e.g., Write a ${blockDef?.display_name || "section"} for ${customerName || "the client"}...`}
              className="text-xs min-h-[80px] resize-none"
            />
          </div>

          {/* Transcript Section */}
          <div>
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 w-full"
            >
              <ChevronRight size={10} className={`transition-transform ${showTranscript ? "rotate-90" : ""}`} />
              Transcript Input
              {transcriptText && <Badge className="text-[8px] h-3.5 bg-emerald-100 text-emerald-700 border-0 ml-auto">Loaded</Badge>}
            </button>
            {showTranscript && (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  placeholder="Paste meeting transcript or notes here..."
                  className="text-xs min-h-[60px] resize-none"
                />
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={10} className="mr-1" /> Upload .txt/.md
                  </Button>
                  <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => toast.info("Audio recording — paste transcript text as v1")}>
                    <Mic size={10} className="mr-1" /> Record
                  </Button>
                  {transcriptText && (
                    <Button variant="ghost" size="sm" className="text-[10px] h-6 text-red-500" onClick={() => setTranscriptText("")}>
                      Clear
                    </Button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFileUpload} />
              </div>
            )}
          </div>

          {/* Context Preview */}
          <div>
            <button
              onClick={() => setShowContext(!showContext)}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 w-full"
            >
              <ChevronRight size={10} className={`transition-transform ${showContext ? "rotate-90" : ""}`} />
              Context Preview
            </button>
            {showContext && (
              <div className="mt-2 space-y-2">
                <div className="p-2 rounded border border-gray-100 bg-gray-50">
                  <div className="text-[10px] font-medium text-gray-500 mb-1">Current Block Text</div>
                  <div className="text-[10px] text-gray-600 max-h-[80px] overflow-auto prose prose-xs"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.content || "<em>Empty block</em>") }} />
                </div>
                <div className="p-2 rounded border border-gray-100 bg-gray-50">
                  <div className="text-[10px] font-medium text-gray-500 mb-1">Document Metadata</div>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span className="text-gray-400">Type</span>
                    <span className="text-gray-700 capitalize">{docType}</span>
                    <span className="text-gray-400">Customer</span>
                    <span className="text-gray-700">{customerName || "—"}</span>
                    <span className="text-gray-400">Block</span>
                    <span className="text-gray-700">{blockDef?.display_name || block.block_key}</span>
                    <span className="text-gray-400">Family</span>
                    <span className="text-gray-700 capitalize">{blockDef?.family || "—"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedBot || availableBots.length === 0}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs h-9"
          >
            {isGenerating ? (
              <><Loader2 size={14} className="mr-1.5 animate-spin" /> Generating...</>
            ) : (
              <><Zap size={14} className="mr-1.5" /> Generate Draft</>
            )}
          </Button>

          {/* Draft Preview */}
          {draftContent && (
            <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-200 bg-amber-100/50">
                <Sparkles size={12} className="text-amber-600" />
                <span className="text-[10px] font-semibold text-amber-700">AI Draft</span>
                <Badge className="text-[8px] h-3.5 bg-amber-200 text-amber-800 border-0 ml-auto">
                  {insertMode === "replace" ? "Will Replace" : "Will Insert"}
                </Badge>
              </div>
              <div className="p-3">
                <div className="prose prose-xs max-w-none text-amber-900/80 max-h-[200px] overflow-auto"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(draftContent) }} />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-2 border-t border-amber-200 bg-amber-50">
                <Button size="sm" onClick={handleApply}
                  className="flex-1 h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Check size={11} className="mr-1" /> Apply to Block
                </Button>
                <Button size="sm" variant="outline" onClick={handleDiscard}
                  className="h-7 text-[10px] border-red-300 text-red-600 hover:bg-red-50">
                  <XCircle size={11} className="mr-1" /> Discard
                </Button>
              </div>
            </div>
          )}

          {/* KB Citations */}
          {draftCitations.length > 0 && draftContent && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-indigo-200 bg-indigo-100/50">
                <BookOpen size={11} className="text-indigo-600" />
                <span className="text-[10px] font-semibold text-indigo-700">KB Sources ({draftChunkCount} chunks retrieved)</span>
              </div>
              <div className="p-2 space-y-1.5 max-h-[120px] overflow-auto">
                {draftCitations.map((c, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px]">
                    <span className="shrink-0 w-4 h-4 rounded bg-indigo-200 text-indigo-700 flex items-center justify-center font-mono text-[8px]">{i + 1}</span>
                    <div className="min-w-0">
                      <span className="font-medium text-indigo-800">{c.source} #{c.chunkIndex}</span>
                      <p className="text-indigo-600/70 truncate">{c.snippet}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Human-first reminder */}
          <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 border border-blue-100">
            <Eye size={12} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-blue-700 leading-relaxed">
              AI output is always staged as a draft. You must review and click <strong>Apply</strong> to commit changes to the block. AI cannot modify pricing, ECR scores, or approval gates.
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
