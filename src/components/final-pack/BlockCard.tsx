/**
 * BlockCard.tsx
 * ─────────────
 * FPS-015 — Individual block card in the canvas.
 *
 * Features: drag handle, eye toggle, expand/collapse, type icon, title, family badge.
 * Hidden blocks render dimmed with dashed border.
 */

import { forwardRef, useState } from "react";
import {
  GripVertical, Eye, EyeOff, ChevronDown, ChevronRight,
  FileText, Table, Scale, Pen, BookOpen, Image, Lock, Type, Library, Sparkles, X, Copy, Trash2, Check,
  RotateCcw,
} from "lucide-react";
import type { OutputBlock } from "@/lib/final-pack-loader";
import {
  filterDiscoveryByBlockType,
  EMPTY_DISCOVERY,
  type BotDiscoveryResult,
  type DiscoveredBot,
} from "@/lib/final-pack-bots";
import { runBlockAIMicrobot, type BlockAIPreview } from "@/lib/final-pack-bot-runtime";
import type { BlockAIDocContext } from "@/lib/final-pack-bot-context";
import BlockAISparkleMenu from "./BlockAISparkleMenu";
import BlockAIPreviewCard from "./BlockAIPreviewCard";

/** Editor modes that expose an editable text surface (sparkle eligible). */
const EDITABLE_MODES = new Set(["wysiwyg", "form", "clause"]);

/** Escape + wrap plain AI text into safe HTML paragraphs for content.html. */
function aiTextToHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter((para) => para.length > 0)
    .map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Is the block's stored HTML effectively empty (no visible text)? */
function htmlIsEmpty(html: string | undefined): boolean {
  if (!html) return true;
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim().length === 0;
}

interface BlockCardProps {
  block: OutputBlock;
  onToggleVisibility: () => void;
  onContentChange: (content: Partial<OutputBlock["content"]>) => void;
  /** Save this block to the reusable library (FPS-003) */
  onSaveReusable?: () => void;
  /** Duplicate this block (FPS-008-13) — inserts an independent copy below. */
  onDuplicate?: () => void;
  /** Remove this block (FPS-010) — non-required only; undoable. */
  onRemove?: () => void;
  /**
   * PADW T06c (PDS-10): reset THIS block's content to its creation-time
   * source snapshot. Confirmed inline; undoable via the block undo stack.
   */
  onResetFromSource?: () => void;
  /** Render function for the expanded editor */
  renderEditor?: (block: OutputBlock, onContentChange: (c: Partial<OutputBlock["content"]>) => void) => React.ReactNode;
  /** Drag handle attributes from @dnd-kit */
  dragHandleProps?: Record<string, any>;
  /** Drag active styling */
  isDragging?: boolean;
  /**
   * Discovered Bot Builder microbots for the whole document (FPS-008). The card
   * narrows them to THIS block's render_key. AI is preview-only and runtime is
   * not wired here — selecting a bot only raises onSelectBot.
   */
  aiBots?: BotDiscoveryResult;
  /** Loading flag for the discovery query (advisory). */
  aiBotsLoading?: boolean;
  /** Optional observer when a bot is chosen (analytics/audit hook). */
  onSelectBot?: (bot: DiscoveredBot, block: OutputBlock) => void;
  /** Document framing for the AI context assembler (FPS-008-08). */
  docContext?: BlockAIDocContext;
}

/** Icon mapping by render_key prefix */
function getBlockIcon(renderKey: string, family: string) {
  if (renderKey.startsWith("cover")) return FileText;
  if (renderKey.startsWith("pricing") || renderKey.startsWith("quote_pricing")) return Table;
  if (renderKey.startsWith("scope_table")) return Table;
  if (renderKey.startsWith("totals")) return Table;
  if (renderKey.startsWith("annexure_sla")) return Scale;
  if (renderKey.startsWith("annexure_rate")) return Table;
  if (renderKey.startsWith("signature")) return Pen;
  if (renderKey.startsWith("confidentiality")) return Lock;
  if (renderKey.startsWith("legal") || renderKey.startsWith("terms")) return BookOpen;
  if (renderKey.startsWith("toc")) return BookOpen;
  if (renderKey.startsWith("facility")) return Image;
  if (family === "legal") return BookOpen;
  if (family === "data_bound") return Table;
  if (family === "annexure") return FileText;
  return Type;
}

/** Family badge color */
function getFamilyColor(family: string): string {
  switch (family) {
    case "commercial": return "bg-blue-500/10 text-blue-600";
    case "data_bound": return "bg-amber-500/10 text-amber-600";
    case "legal": return "bg-purple-500/10 text-purple-600";
    case "annexure": return "bg-emerald-500/10 text-emerald-600";
    case "asset": return "bg-cyan-500/10 text-cyan-600";
    default: return "bg-gray-500/10 text-gray-600";
  }
}

const BlockCard = forwardRef<HTMLDivElement, BlockCardProps>(
  function BlockCard(
    { block, onToggleVisibility, onContentChange, onSaveReusable, onDuplicate, onRemove, onResetFromSource, renderEditor, dragHandleProps, isDragging, aiBots, aiBotsLoading, onSelectBot, docContext },
    ref,
  ) {
    const [expanded, setExpanded] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);
    const [aiMenuOpen, setAiMenuOpen] = useState(false);
    const [aiRunning, setAiRunning] = useState(false);
    const [aiRegenerating, setAiRegenerating] = useState(false);
    const [aiPreview, setAiPreview] = useState<BlockAIPreview | null>(null);
    const [lastBot, setLastBot] = useState<DiscoveredBot | null>(null);
    const Icon = getBlockIcon(block.render_key, block.family);
    const familyColor = getFamilyColor(block.family);

    // FPS-008: bots eligible for THIS block type. Empty result = no sparkle.
    const blockBots = filterDiscoveryByBlockType(aiBots ?? EMPTY_DISCOVERY, block.render_key);
    const isEditable = EDITABLE_MODES.has(block.editor_mode);
    const showSparkle = isEditable && blockBots.totalBots > 0;

    // FPS-008-09: run the chosen bot → PREVIEW-ONLY local state. Never mutates
    // the block, source, template, reusable blocks, or export. Never throws.
    async function handleSelectBot(bot: DiscoveredBot) {
      setAiMenuOpen(false);
      setLastBot(bot);
      onSelectBot?.(bot, block);
      if (!docContext) {
        setAiPreview({
          status: "error",
          bot_id: bot.id,
          bot_name: bot.display_name,
          bot_category: bot.category,
          version_id: bot.current_version_id ?? null,
          context: {} as BlockAIPreview["context"],
          created_at: new Date().toISOString(),
          error: "Document context unavailable — open the document to run AI.",
        });
        return;
      }
      setAiRunning(true);
      setAiPreview({
        status: "running",
        bot_id: bot.id,
        bot_name: bot.display_name,
        bot_category: bot.category,
        version_id: bot.current_version_id ?? null,
        context: {} as BlockAIPreview["context"],
        created_at: new Date().toISOString(),
      });
      const preview = await runBlockAIMicrobot({ bot, block, doc: docContext });
      setAiPreview(preview);
      setAiRunning(false);
    }

    // FPS-008-14: best-effort audit of a human action on the current preview.
    // Never awaited into the UI path — audit failure must never block an action.
    function auditAction(action: string) {
      if (!aiPreview) return;
      // SC-01 (deferred to Sprint X - SX-001/SX-011): AI audit logging removed with AI execution;
      // aiPreview can only exist after a successful run, which cannot occur here.
      void action;
    }

    // ── FPS-008-12 human actions — the ONLY way AI text reaches the block.
    // All write content.html for THIS block via onContentChange (existing
    // autosave/versioning path). None touch source/template/reusable/export.
    function writeHtml(html: string) {
      onContentChange({ html, source_status: "populated" });
      setExpanded(false); // re-mount the editor so it re-reads the new content
    }
    function handleApply(text: string) {
      auditAction("apply");
      writeHtml(aiTextToHtml(text));
      setAiPreview(null);
    }
    function handleAppend(text: string) {
      auditAction("append");
      const existing = block.content.html || "";
      writeHtml(existing + aiTextToHtml(text));
      setAiPreview(null);
    }
    function handleReplace(text: string) {
      // Confirmation (when content is non-empty) is handled inside the card.
      auditAction("replace");
      writeHtml(aiTextToHtml(text));
      setAiPreview(null);
    }
    function handleDiscard() {
      auditAction("discard");
      setAiPreview(null);
    }
    function handleReject() {
      // Local only; no mutation. Logged as a rejected action (best-effort).
      auditAction("reject");
      setAiPreview(null);
    }
    async function handleRegenerate() {
      auditAction("regenerate");
      if (!lastBot || !docContext) {
        setAiPreview((p) =>
          p ? { ...p, status: "error", error: "Cannot regenerate without document context." } : p,
        );
        return;
      }
      // Keep the current preview visible; show a clear regenerating state.
      setAiRegenerating(true);
      const preview = await runBlockAIMicrobot({ bot: lastBot, block, doc: docContext });
      setAiPreview(preview);
      setAiRegenerating(false);
    }

    return (
      <div
        ref={ref}
        className="fps-block-card"
        data-dragging={isDragging ? "true" : undefined}
        data-hidden={!block.visible ? "true" : undefined}
      >
        {/* ── Header row ── */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* Drag handle */}
          <div className="fps-drag-handle" {...(dragHandleProps || {})}>
            <GripVertical className="h-4 w-4" />
          </div>

          {/* Type icon */}
          <div className="flex-shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Title + order */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 flex items-center gap-2 text-left min-w-0"
          >
            <span className="text-sm font-medium text-foreground truncate">
              {block.display_name}
            </span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              #{block.order}
            </span>
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            )}
          </button>

          {/* Family badge */}
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${familyColor}`}>
            {block.family}
          </span>

          {/* Source status */}
          {block.content.source_status === "not_captured" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 flex-shrink-0">
              not captured
            </span>
          )}

          {/* Required badge */}
          {block.required && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 flex-shrink-0">
              required
            </span>
          )}

          {/* AI sparkle menu (FPS-008) — only on editable blocks with eligible bots */}
          {showSparkle && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setAiMenuOpen((o) => !o)}
                className="p-1 rounded hover:bg-accent transition-colors"
                title="AI assistants for this block"
                data-ai-sparkle="true"
                aria-expanded={aiMenuOpen}
              >
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              </button>
              {aiMenuOpen && (
                <BlockAISparkleMenu
                  result={blockBots}
                  loading={aiBotsLoading}
                  onSelect={handleSelectBot}
                  onClose={() => setAiMenuOpen(false)}
                />
              )}
            </div>
          )}

          {/* Duplicate block (FPS-008-13) — independent copy below the original */}
          {/* PADW T06c (PDS-10): per-card reset-from-source with inline confirm */}
          {onResetFromSource && (
            confirmReset ? (
              <span className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => { onResetFromSource(); setConfirmReset(false); }}
                  className="p-1 rounded hover:bg-amber-500/10 transition-colors"
                  title={`Confirm reset "${block.display_name}" to its source snapshot`}
                  data-reset-confirm="true"
                >
                  <Check className="h-3.5 w-3.5 text-amber-600" />
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="p-1 rounded hover:bg-accent transition-colors"
                  title="Cancel"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="p-1 rounded hover:bg-accent transition-colors flex-shrink-0"
                title="Reset this block to its source snapshot (undoable)"
                data-reset-block="true"
              >
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )
          )}

          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="p-1 rounded hover:bg-accent transition-colors flex-shrink-0"
              title="Duplicate block"
              data-duplicate-block="true"
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}

          {/* Remove block (FPS-010) — inline confirm; undoable. Non-required only. */}
          {onRemove && (
            confirmRemove ? (
              <span className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => { onRemove(); setConfirmRemove(false); }}
                  className="p-1 rounded hover:bg-red-500/10 transition-colors"
                  title="Confirm remove"
                  data-remove-confirm="true"
                >
                  <Check className="h-3.5 w-3.5 text-red-500" />
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="p-1 rounded hover:bg-accent transition-colors"
                  title="Cancel"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmRemove(true)}
                className="p-1 rounded hover:bg-accent transition-colors flex-shrink-0"
                title="Remove block"
                data-remove-block="true"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )
          )}

          {/* Save as reusable (FPS-003) */}
          {onSaveReusable && (
            <button
              onClick={onSaveReusable}
              className="p-1 rounded hover:bg-accent transition-colors flex-shrink-0"
              title="Save as reusable block"
            >
              <Library className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}

          {/* Visibility toggle */}
          <button
            onClick={onToggleVisibility}
            className="p-1 rounded hover:bg-accent transition-colors flex-shrink-0"
            title={block.visible ? "Hide block" : "Show block"}
          >
            {block.visible ? (
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
          </button>
        </div>

        {/* FPS-008-11/12 AI preview surface + human-controlled actions. */}
        {aiPreview && (
          <BlockAIPreviewCard
            preview={aiPreview}
            regenerating={aiRegenerating}
            blockHasContent={!htmlIsEmpty(block.content.html)}
            onApply={handleApply}
            onAppend={handleAppend}
            onReplace={handleReplace}
            onDiscard={handleDiscard}
            onReject={handleReject}
            onRegenerate={handleRegenerate}
          />
        )}

        {/* ── Expanded editor area ── */}
        {expanded && (
          <div className="border-t border-border px-4 py-3">
            {renderEditor ? (
              renderEditor(block, onContentChange)
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Editor not available for this block type ({block.render_key})
              </p>
            )}
          </div>
        )}
      </div>
    );
  },
);

export default BlockCard;
