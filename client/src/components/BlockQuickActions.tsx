/**
 * BlockQuickActions — One-click AI assistant buttons on document editor blocks
 * Sprint 3B: Translate, Restyle, Rewrite, Summarize, Expand
 *
 * Appears on hover over each block. Does NOT open BlockAIPanel —
 * makes a direct server-side LLM call for predefined operations.
 *
 * UX: Click action → loading spinner → diff view → Accept/Reject
 * Human-first: content is always staged as draft, never auto-committed.
 */

import { useState, useCallback } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Languages, PenTool, Zap, RefreshCw, FileText,
  Plus, Loader2, Check, XCircle, ChevronDown, Sparkles,
} from "lucide-react";
import { api } from "@/lib/api-client";

// ============================================================
// TYPES
// ============================================================

export type QuickActionType =
  | "translate-arabic"
  | "translate-english"
  | "restyle-formal"
  | "restyle-concise"
  | "rewrite-improve"
  | "summarize"
  | "expand";

interface QuickAction {
  id: QuickActionType;
  label: string;
  shortLabel: string;
  icon: typeof Languages;
  group: "translate" | "restyle" | "transform";
  description: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "translate-arabic", label: "Translate → Arabic", shortLabel: "عربي", icon: Languages, group: "translate", description: "Translate to formal Arabic (فصحى)" },
  { id: "translate-english", label: "Translate → English", shortLabel: "EN", icon: Languages, group: "translate", description: "Translate to professional English" },
  { id: "restyle-formal", label: "Formal Tone", shortLabel: "Formal", icon: PenTool, group: "restyle", description: "Rewrite in formal business tone" },
  { id: "restyle-concise", label: "Make Concise", shortLabel: "Concise", icon: Zap, group: "restyle", description: "Shorten to 50% while keeping key points" },
  { id: "rewrite-improve", label: "Improve", shortLabel: "Improve", icon: RefreshCw, group: "transform", description: "Improve clarity, grammar, and persuasiveness" },
  { id: "summarize", label: "Summarize", shortLabel: "Summary", icon: FileText, group: "transform", description: "Condense to 2-3 bullet points" },
  { id: "expand", label: "Expand", shortLabel: "Expand", icon: Plus, group: "transform", description: "Add more detail and examples" },
];

// ============================================================
// PROPS
// ============================================================

interface BlockQuickActionsProps {
  blockId: string;
  blockContent: string;
  isLocked: boolean;
  isCanon: boolean;
  onApply: (blockId: string, content: string) => void;
  visible: boolean;
}

// ============================================================
// COMPONENT
// ============================================================

export default function BlockQuickActions({
  blockId, blockContent, isLocked, isCanon, onApply, visible,
}: BlockQuickActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAction, setActiveAction] = useState<QuickActionType | null>(null);
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isStub, setIsStub] = useState(false);

  const handleAction = useCallback(async (action: QuickActionType) => {
    if (isLocked || isCanon || !blockContent.trim()) return;

    setIsProcessing(true);
    setActiveAction(action);
    setDraftContent(null);
    setShowMenu(false);

    try {
      const res = await api.botGovernance.quickAction({
        action,
        content: blockContent,
        context_type: "document_block",
      });

      if (res.data) {
        setDraftContent(res.data.output);
        setIsStub(res.data.isStub || false);
        const actionDef = QUICK_ACTIONS.find(a => a.id === action);
        toast.success(`${actionDef?.label || action} ready — review the draft below`);
      }
    } catch (err) {
      toast.error("Quick action failed — check provider configuration");
    } finally {
      setIsProcessing(false);
    }
  }, [blockContent, isLocked, isCanon]);

  const handleAccept = useCallback(() => {
    if (draftContent) {
      onApply(blockId, draftContent);
      setDraftContent(null);
      setActiveAction(null);
      toast.success("AI content applied to block");
    }
  }, [blockId, draftContent, onApply]);

  const handleReject = useCallback(() => {
    setDraftContent(null);
    setActiveAction(null);
    toast.info("AI draft discarded");
  }, []);

  if (!visible || isLocked || isCanon) return null;

  return (
    <>
      {/* Floating Quick Action Toolbar */}
      <div className="absolute -top-1 right-2 z-20 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {/* Quick translate buttons */}
        <button
          onClick={() => handleAction("translate-arabic")}
          disabled={isProcessing}
          className="h-6 px-1.5 rounded text-[9px] font-semibold bg-white border border-gray-200 shadow-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-gray-500 transition-all disabled:opacity-50"
          title="Translate → Arabic"
        >
          عربي
        </button>
        <button
          onClick={() => handleAction("rewrite-improve")}
          disabled={isProcessing}
          className="h-6 px-1.5 rounded text-[9px] font-medium bg-white border border-gray-200 shadow-sm hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 text-gray-500 transition-all flex items-center gap-0.5 disabled:opacity-50"
          title="Improve clarity & grammar"
        >
          <RefreshCw size={9} /> Improve
        </button>

        {/* More actions dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            disabled={isProcessing}
            className="h-6 w-6 rounded bg-white border border-gray-200 shadow-sm hover:bg-violet-50 hover:border-violet-300 text-gray-500 hover:text-violet-700 transition-all flex items-center justify-center disabled:opacity-50"
            title="More AI actions"
          >
            {isProcessing ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <Sparkles size={10} />
            )}
          </button>

          {showMenu && !isProcessing && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg border border-gray-200 shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Group: Translate */}
              <div className="px-2 py-1">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Translate</span>
              </div>
              {QUICK_ACTIONS.filter(a => a.group === "translate").map(action => (
                <button
                  key={action.id}
                  onClick={() => handleAction(action.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <action.icon size={12} className="text-blue-500 shrink-0" />
                  <span>{action.label}</span>
                </button>
              ))}

              <div className="border-t border-gray-100 my-1" />

              {/* Group: Restyle */}
              <div className="px-2 py-1">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Restyle</span>
              </div>
              {QUICK_ACTIONS.filter(a => a.group === "restyle").map(action => (
                <button
                  key={action.id}
                  onClick={() => handleAction(action.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                >
                  <action.icon size={12} className="text-amber-500 shrink-0" />
                  <span>{action.label}</span>
                </button>
              ))}

              <div className="border-t border-gray-100 my-1" />

              {/* Group: Transform */}
              <div className="px-2 py-1">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Transform</span>
              </div>
              {QUICK_ACTIONS.filter(a => a.group === "transform").map(action => (
                <button
                  key={action.id}
                  onClick={() => handleAction(action.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                >
                  <action.icon size={12} className="text-violet-500 shrink-0" />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Click-away handler for dropdown */}
      {showMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
      )}

      {/* Draft Preview — shows below block when AI output is ready */}
      {draftContent && (
        <div className="mt-2 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-amber-200 bg-amber-100/50">
            <Sparkles size={11} className="text-amber-600" />
            <span className="text-[10px] font-semibold text-amber-700">
              {QUICK_ACTIONS.find(a => a.id === activeAction)?.label || "AI Draft"}
            </span>
            {isStub && (
              <Badge className="text-[8px] h-3.5 bg-gray-200 text-gray-600 border-0 ml-auto">
                Stub — No API Key
              </Badge>
            )}
            {!isStub && (
              <Badge className="text-[8px] h-3.5 bg-emerald-100 text-emerald-700 border-0 ml-auto">
                Real AI
              </Badge>
            )}
          </div>
          <div className="p-3">
            <div
              className="prose prose-xs max-w-none text-amber-900/80 max-h-[160px] overflow-auto"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(draftContent) }}
            />
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 border-t border-amber-200 bg-amber-50">
            <Button
              size="sm"
              onClick={handleAccept}
              className="flex-1 h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check size={11} className="mr-1" /> Apply
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReject}
              className="h-7 text-[10px] border-red-300 text-red-600 hover:bg-red-50"
            >
              <XCircle size={11} className="mr-1" /> Discard
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
