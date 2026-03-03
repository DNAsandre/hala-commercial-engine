/**
 * DocumentAIPanel — Left slide-in panel for document-level AI generation
 * Sprint 10: Editor AI Pop-up + Bot Selector + Transcript Document Bots
 *
 * Opens from the "AI Document" toolbar button.
 * Supports transcript upload/paste, run modes, multi-block preview with per-block apply.
 * Human-first: All suggestions are staged, user selects which blocks to apply.
 *
 * Design: White panel, subtle borders, enterprise SaaS aesthetic
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  X, Sparkles, Bot, Check, XCircle,
  Upload, FileText, ChevronDown, ChevronRight,
  Loader2, AlertTriangle, Zap, Brain,
  Shield, RefreshCw, CheckCircle, Eye,
  CloudOff, PenTool, Scale, Mic, BookOpen,
} from "lucide-react";
import {
  type EditorBot, type DocumentBlockSuggestion, type DocumentRunMode,
  getDocumentBots, getEditorBotById,
  createAIRun, applyAIRun, discardAIRun,
  generateDocumentContent, DOCUMENT_RUN_MODES,
} from "@/lib/ai-runs";
import { getBlockByKey } from "@/lib/document-composer";
import type { ComposerBlock } from "@/components/DocumentComposer";

// ============================================================
// ICON MAP
// ============================================================

const BOT_ICON_MAP: Record<string, typeof Bot> = {
  PenTool, Shield, FileText, Scale, CheckCircle, RefreshCw, Bot, Brain,
};

function getBotIcon(iconName: string) {
  return BOT_ICON_MAP[iconName] || Bot;
}

const MODE_ICON_MAP: Record<string, typeof FileText> = {
  FileText, RefreshCw, Shield, CheckCircle,
};

// ============================================================
// PROPS
// ============================================================

interface DocumentAIPanelProps {
  open: boolean;
  onClose: () => void;
  blocks: ComposerBlock[];
  docType: string;
  docInstanceId: string;
  workspaceId: string | null;
  customerName: string;
  onApplyChanges: (changes: { blockId: string; content: string }[]) => void;
}

// ============================================================
// COMPONENT
// ============================================================

export default function DocumentAIPanel({
  open, onClose, blocks, docType, docInstanceId, workspaceId,
  customerName, onApplyChanges,
}: DocumentAIPanelProps) {
  // Bot selection
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [runMode, setRunMode] = useState<DocumentRunMode>("fill_missing");
  const [promptText, setPromptText] = useState("");

  // Transcript
  const [transcriptText, setTranscriptText] = useState("");

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<DocumentBlockSuggestion[]>([]);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [edgeFunctionError, setEdgeFunctionError] = useState(false);
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available bots
  const availableBots = useMemo(() => getDocumentBots(docType), [docType]);

  // Auto-select first bot
  useEffect(() => {
    if (availableBots.length > 0 && !selectedBotId) {
      setSelectedBotId(availableBots[0].id);
    }
  }, [availableBots, selectedBotId]);

  const selectedBot = useMemo(() =>
    selectedBotId ? getEditorBotById(selectedBotId) : null
  , [selectedBotId]);

  const selectedCount = suggestions.filter(s => s.selected).length;

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleGenerate = useCallback(async () => {
    if (!selectedBot) return;

    // Transcript required for fill_missing mode
    if (runMode === "fill_missing" && !transcriptText.trim()) {
      toast.error("Transcript is required for 'Fill Missing Blocks' mode");
      return;
    }

    setIsGenerating(true);
    setEdgeFunctionError(false);
    setSuggestions([]);

    try {
      const blockInputs = blocks
        .filter(b => !b.is_locked) // Skip locked blocks
        .map(b => {
          const def = getBlockByKey(b.block_key);
          return {
            id: b.id,
            key: b.block_key,
            name: def?.display_name || b.block_key,
            content: b.content,
          };
        });

      const result = await generateDocumentContent(
        selectedBot.id,
        blockInputs,
        promptText,
        transcriptText || null,
        runMode,
      );

      // Create AI run record
      const run = createAIRun({
        doc_instance_id: docInstanceId,
        workspace_id: workspaceId,
        bot_id: selectedBot.id,
        bot_name: selectedBot.name,
        bot_type: "document",
        target_scope: "document",
        target_block_ids: result.suggestions.map(s => s.block_id),
        input_prompt: promptText,
        input_transcript_ref: transcriptText ? "inline-text" : null,
        output_text: JSON.stringify(result.suggestions),
        provider: selectedBot.provider,
        model: selectedBot.model,
        run_mode: runMode,
        created_by: "current-user",
      });

      setSuggestions(result.suggestions);
      setCurrentRunId(run.id);

      // Auto-expand all blocks
      const expanded: Record<string, boolean> = {};
      result.suggestions.forEach(s => { expanded[s.block_id] = true; });
      setExpandedBlocks(expanded);

      toast.success(`${result.suggestions.length} block suggestion${result.suggestions.length !== 1 ? "s" : ""} ready — review before applying`);
    } catch (err) {
      setEdgeFunctionError(true);
      toast.error("AI generation failed — check provider configuration");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedBot, blocks, promptText, transcriptText, runMode, docInstanceId, workspaceId]);

  const toggleSuggestion = useCallback((blockId: string) => {
    setSuggestions(prev => prev.map(s =>
      s.block_id === blockId ? { ...s, selected: !s.selected } : s
    ));
  }, []);

  const toggleExpand = useCallback((blockId: string) => {
    setExpandedBlocks(prev => ({ ...prev, [blockId]: !prev[blockId] }));
  }, []);

  const handleApplySelected = useCallback(() => {
    const selected = suggestions.filter(s => s.selected);
    if (selected.length === 0) {
      toast.error("No blocks selected for apply");
      return;
    }

    if (currentRunId) {
      applyAIRun(currentRunId);
    }

    onApplyChanges(selected.map(s => ({
      blockId: s.block_id,
      content: s.suggested_text,
    })));

    setSuggestions([]);
    setCurrentRunId(null);
    toast.success(`Applied AI changes to ${selected.length} block${selected.length !== 1 ? "s" : ""}`);
  }, [suggestions, currentRunId, onApplyChanges]);

  const handleDiscardAll = useCallback(() => {
    if (currentRunId) {
      discardAIRun(currentRunId);
    }
    setSuggestions([]);
    setCurrentRunId(null);
    toast.info("All AI suggestions discarded");
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
      toast.success(`Transcript loaded: ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  // ============================================================
  // RENDER
  // ============================================================

  if (!open) return null;

  const BotIcon = selectedBot ? getBotIcon(selectedBot.icon) : Bot;
  const modeConfig = DOCUMENT_RUN_MODES.find(m => m.value === runMode);
  const ModeIcon = modeConfig ? (MODE_ICON_MAP[modeConfig.icon] || FileText) : FileText;

  return (
    <div className="w-96 border-r border-gray-200 bg-white flex flex-col shrink-0 shadow-lg z-30 animate-in slide-in-from-left duration-200">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-white">
        <div className="p-1.5 rounded-lg bg-violet-100">
          <Brain size={14} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-semibold text-[#1B2A4A]">Document AI Assistant</h3>
          <p className="text-[10px] text-gray-500">
            {blocks.filter(b => !b.is_locked).length} editable blocks · {blocks.filter(b => b.is_locked).length} locked
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">

          {/* Phase 0: Edge Function Error */}
          {edgeFunctionError && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50">
              <div className="flex items-center gap-2 mb-1.5">
                <CloudOff size={14} className="text-red-500" />
                <span className="text-xs font-semibold text-red-700">AI Providers Not Deployed</span>
              </div>
              <p className="text-[10px] text-red-600 leading-relaxed">
                Edge Functions for AI generation are not yet deployed. Configure providers in Admin → AI Providers.
              </p>
            </div>
          )}

          {/* Bot Selector */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Document Bot
            </label>
            {availableBots.length === 0 ? (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-center">
                <AlertTriangle size={16} className="mx-auto mb-1 text-amber-500" />
                <p className="text-[10px] text-amber-700">No document bots for {docType}</p>
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
                          <Icon size={12} className="text-violet-600" />
                          <span>{bot.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Bot Info */}
          {selectedBot && (
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <BotIcon size={14} className="text-violet-600 shrink-0" />
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

          {/* Run Mode */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Run Mode
            </label>
            <Select value={runMode} onValueChange={(v) => setRunMode(v as DocumentRunMode)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_RUN_MODES.map(mode => {
                  const Icon = MODE_ICON_MAP[mode.icon] || FileText;
                  return (
                    <SelectItem key={mode.value} value={mode.value}>
                      <div className="flex items-center gap-2">
                        <Icon size={12} className="text-violet-600" />
                        <div>
                          <span>{mode.label}</span>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {modeConfig && (
              <p className="text-[10px] text-gray-400 mt-1">{modeConfig.description}</p>
            )}
          </div>

          {/* Transcript Input */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              Transcript
              {runMode === "fill_missing" && <Badge className="text-[8px] h-3.5 bg-red-100 text-red-700 border-0">Required</Badge>}
            </label>
            <Textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Paste meeting transcript, notes, or source content here..."
              className="text-xs min-h-[100px] resize-none"
            />
            <div className="flex items-center gap-1.5 mt-1.5">
              <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => fileInputRef.current?.click()}>
                <Upload size={10} className="mr-1" /> Upload .txt/.md
              </Button>
              <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => toast.info("Audio recording — paste transcript text as v1")}>
                <Mic size={10} className="mr-1" /> Record
              </Button>
              {transcriptText && (
                <>
                  <Badge className="text-[8px] h-4 bg-emerald-100 text-emerald-700 border-0 ml-auto">
                    {transcriptText.split(/\s+/).length} words
                  </Badge>
                  <Button variant="ghost" size="sm" className="text-[10px] h-6 text-red-500" onClick={() => setTranscriptText("")}>
                    Clear
                  </Button>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFileUpload} />
          </div>

          {/* Optional Prompt */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Additional Instructions <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <Textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g., Focus on cold chain capabilities, emphasize cost savings..."
              className="text-xs min-h-[50px] resize-none"
            />
          </div>

          <Separator />

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedBot || availableBots.length === 0}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white text-xs h-9"
          >
            {isGenerating ? (
              <><Loader2 size={14} className="mr-1.5 animate-spin" /> Analyzing {blocks.filter(b => !b.is_locked).length} blocks...</>
            ) : (
              <><Zap size={14} className="mr-1.5" /> Generate Document Suggestions</>
            )}
          </Button>

          {/* Multi-Block Suggestions Preview */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={12} className="text-violet-600" />
                  <span className="text-xs font-semibold text-[#1B2A4A]">
                    {suggestions.length} Block Suggestion{suggestions.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <Badge className="text-[9px] h-4 bg-violet-100 text-violet-700 border-0">
                  {selectedCount} selected
                </Badge>
              </div>

              {suggestions.map((suggestion) => {
                const isExpanded = expandedBlocks[suggestion.block_id] !== false;
                return (
                  <div key={suggestion.block_id}
                    className={`rounded-lg border transition-colors ${
                      suggestion.selected ? "border-violet-300 bg-violet-50/30" : "border-gray-200 bg-gray-50/50"
                    }`}
                  >
                    {/* Block Header */}
                    <div className="flex items-center gap-2 px-2.5 py-2">
                      <Checkbox
                        checked={suggestion.selected}
                        onCheckedChange={() => toggleSuggestion(suggestion.block_id)}
                        className="h-3.5 w-3.5"
                      />
                      <button onClick={() => toggleExpand(suggestion.block_id)} className="flex-1 flex items-center gap-1.5 text-left">
                        <ChevronRight size={10} className={`text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        <span className="text-[10px] font-medium text-[#1B2A4A] truncate">{suggestion.block_name}</span>
                      </button>
                      <Badge variant="outline" className="text-[8px] h-3.5">{suggestion.block_key}</Badge>
                    </div>

                    {/* Expanded: Before / After */}
                    {isExpanded && (
                      <div className="px-2.5 pb-2.5 space-y-1.5">
                        {/* Original */}
                        <div className="rounded border border-gray-200 bg-white p-2">
                          <div className="text-[9px] font-semibold text-gray-400 uppercase mb-1">Current</div>
                          <div className="text-[10px] text-gray-600 max-h-[60px] overflow-auto prose prose-xs"
                            dangerouslySetInnerHTML={{ __html: suggestion.original_text || "<em>Empty</em>" }} />
                        </div>
                        {/* Suggested */}
                        <div className="rounded border-2 border-dashed border-violet-200 bg-violet-50/50 p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Sparkles size={8} className="text-violet-500" />
                            <span className="text-[9px] font-semibold text-violet-600 uppercase">AI Suggestion</span>
                          </div>
                          <div className="text-[10px] text-violet-900/80 max-h-[80px] overflow-auto prose prose-xs"
                            dangerouslySetInnerHTML={{ __html: suggestion.suggested_text }} />
                          {/* Per-block citations */}
                          {suggestion.citations && suggestion.citations.length > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-violet-200">
                              <div className="flex items-center gap-1 mb-1">
                                <BookOpen size={8} className="text-indigo-500" />
                                <span className="text-[8px] font-semibold text-indigo-600 uppercase">Sources</span>
                              </div>
                              <div className="space-y-0.5">
                                {suggestion.citations.map((c, ci) => (
                                  <div key={ci} className="text-[9px] text-indigo-600/80 truncate">
                                    <span className="font-mono text-[8px] bg-indigo-100 rounded px-0.5 mr-1">{ci + 1}</span>
                                    {c.source} #{c.chunkIndex}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Apply / Discard Actions */}
              <div className="flex items-center gap-1.5 pt-1">
                <Button size="sm" onClick={handleApplySelected} disabled={selectedCount === 0}
                  className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Check size={12} className="mr-1" /> Apply {selectedCount} Change{selectedCount !== 1 ? "s" : ""}
                </Button>
                <Button size="sm" variant="outline" onClick={handleDiscardAll}
                  className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50">
                  <XCircle size={12} className="mr-1" /> Discard All
                </Button>
              </div>
            </div>
          )}

          {/* Human-first reminder */}
          <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 border border-blue-100">
            <Eye size={12} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-blue-700 leading-relaxed">
              All suggestions are staged drafts. Select blocks to apply and click <strong>Apply Changes</strong>. Locked blocks are excluded. AI cannot modify pricing, ECR, or approval gates.
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
