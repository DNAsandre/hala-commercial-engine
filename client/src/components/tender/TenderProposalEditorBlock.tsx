/**
 * TenderProposalEditorBlock
 *
 * Hala-native rich editor block for Tender Drafting proposal blocks.
 * Phase One scope: manual editing, lifecycle stage control, and canon lock.
 * No AI execution, no PDF Studio mutation, no Authorpreneur persistence imports.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Lock,
  Pilcrow,
  Quote,
  Redo2,
  Save,
  ShieldCheck,
  Sparkles,
  Type,
  Underline as UnderlineIcon,
  Undo2,
  Unlock,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type TenderProposalEditorStage = "structure" | "sprint" | "draft" | "canon";

export const TENDER_EDITOR_STAGE_CONFIG: Record<TenderProposalEditorStage, { label: string; badge: string; border: string }> = {
  structure: {
    label: "Structure",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    border: "border-l-emerald-400",
  },
  sprint: {
    label: "Sprint",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    border: "border-l-blue-400",
  },
  draft: {
    label: "Draft",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    border: "border-l-amber-400",
  },
  canon: {
    label: "Canon",
    badge: "border-slate-300 bg-slate-100 text-slate-700",
    border: "border-l-slate-500",
  },
};

export interface TenderProposalEditorBlockValue {
  id: string;
  title: string;
  block_key: string;
  volume: string;
  section_name: string;
  draft_status: string;
  approval_status: string;
  draft_content: string;
  editor_stage?: TenderProposalEditorStage;
  editor_content?: string;
  is_canon_locked?: boolean;
  ai_suggestions?: Record<string, unknown>;
}

export type AIDraftAction = "replace" | "append" | "insert_cursor" | "cancel";

interface TenderProposalEditorBlockProps {
  block: TenderProposalEditorBlockValue;
  saving?: boolean;
  onChange: (patch: Partial<TenderProposalEditorBlockValue>) => void;
  onRequestSave: () => void;
  /** AI integration props */
  onAIGenerate?: (blockId: string) => void;
  aiGenerating?: boolean;
  aiDraftContent?: string | null;
  onAIDraftAction?: (mode: AIDraftAction) => void;
}

const STAGES: TenderProposalEditorStage[] = ["structure", "sprint", "draft", "canon"];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildInitialEditorContent(title: string, blockType: string): string {
  const heading = escapeHtml(title.trim() || blockType.trim() || "Proposal Block");
  return `<h2>${heading}</h2><p></p>`;
}

export function normalizeEditorStage(value: unknown): TenderProposalEditorStage {
  return STAGES.includes(value as TenderProposalEditorStage) ? (value as TenderProposalEditorStage) : "structure";
}

function stripHtml(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent || el.innerText || "").replace(/\s+/g, " ").trim();
}

function ToolbarButton({
  active,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md border text-slate-500 transition-colors",
        active ? "border-slate-300 bg-slate-100 text-slate-900" : "border-transparent hover:border-slate-200 hover:bg-slate-50",
        disabled && "cursor-not-allowed opacity-40 hover:border-transparent hover:bg-transparent",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function EditorToolbar({ editor, disabled, onAIGenerate, aiGenerating }: { editor: Editor | null; disabled: boolean; onAIGenerate?: () => void; aiGenerating?: boolean }) {
  const setLink = useCallback(() => {
    if (!editor || disabled) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }, [disabled, editor]);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-2 py-1.5">
      <ToolbarButton icon={Undo2} label="Undo" disabled={!editor || disabled} onClick={() => editor?.chain().focus().undo().run()} />
      <ToolbarButton icon={Redo2} label="Redo" disabled={!editor || disabled} onClick={() => editor?.chain().focus().redo().run()} />
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <ToolbarButton icon={Bold} label="Bold" disabled={!editor || disabled} active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} />
      <ToolbarButton icon={Italic} label="Italic" disabled={!editor || disabled} active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} />
      <ToolbarButton icon={UnderlineIcon} label="Underline" disabled={!editor || disabled} active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
      <ToolbarButton icon={Type} label="Highlight" disabled={!editor || disabled} active={editor?.isActive("highlight")} onClick={() => editor?.chain().focus().toggleHighlight().run()} />
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <ToolbarButton icon={Pilcrow} label="Paragraph" disabled={!editor || disabled} active={editor?.isActive("paragraph")} onClick={() => editor?.chain().focus().setParagraph().run()} />
      <ToolbarButton icon={Heading1} label="Heading 1" disabled={!editor || disabled} active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} />
      <ToolbarButton icon={Heading2} label="Heading 2" disabled={!editor || disabled} active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <ToolbarButton icon={List} label="Bullet list" disabled={!editor || disabled} active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
      <ToolbarButton icon={ListOrdered} label="Numbered list" disabled={!editor || disabled} active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
      <ToolbarButton icon={Quote} label="Quote" disabled={!editor || disabled} active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <ToolbarButton icon={AlignLeft} label="Align left" disabled={!editor || disabled} active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()} />
      <ToolbarButton icon={AlignCenter} label="Align center" disabled={!editor || disabled} active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()} />
      <ToolbarButton icon={AlignRight} label="Align right" disabled={!editor || disabled} active={editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()} />
      <ToolbarButton icon={Link2} label="Link" disabled={!editor || disabled} active={editor?.isActive("link")} onClick={setLink} />
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || aiGenerating || !onAIGenerate}
          title={onAIGenerate ? "Generate with AI" : "AI not available for this block"}
          onClick={onAIGenerate}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition-colors",
            aiGenerating
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : onAIGenerate && !disabled
                ? "border-amber-200 bg-amber-50 text-amber-600 hover:border-amber-300 hover:bg-amber-100"
                : "cursor-not-allowed border-transparent text-slate-300"
          )}
        >
          {aiGenerating ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
          ) : (
            <><Sparkles className="h-3.5 w-3.5" /> AI Draft</>
          )}
        </button>
      </div>
    </div>
  );
}

export default function TenderProposalEditorBlock({
  block, saving = false, onChange, onRequestSave,
  onAIGenerate, aiGenerating, aiDraftContent, onAIDraftAction,
}: TenderProposalEditorBlockProps) {
  const stage = normalizeEditorStage(block.editor_stage);
  const isCanonLocked = stage === "canon" || block.is_canon_locked === true;
  const initialContent = useMemo(
    () => block.editor_content || block.draft_content || buildInitialEditorContent(block.title, block.block_key),
    [block.block_key, block.draft_content, block.editor_content, block.title],
  );
  const [fallbackContent, setFallbackContent] = useState(initialContent);
  const [editorHeight, setEditorHeight] = useState(240);
  const lastContentRef = useRef(initialContent);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Placeholder.configure({ placeholder: "Write this proposal block..." }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-blue-700 underline underline-offset-2" },
      }),
    ],
    content: initialContent,
    editable: !isCanonLocked,
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML();
      lastContentRef.current = html;
      onChange({
        editor_content: html,
        draft_content: html,
        draft_status: block.draft_status === "Locked" ? "Locked" : "Human Edited",
      });
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable === !isCanonLocked) return;
    editor.setEditable(!isCanonLocked);
  }, [editor, isCanonLocked]);

  useEffect(() => {
    if (!editor) {
      setFallbackContent(initialContent);
      return;
    }
    if (initialContent !== lastContentRef.current && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent, { emitUpdate: false });
      lastContentRef.current = initialContent;
    }
  }, [editor, initialContent]);

  const setStage = useCallback((nextStage: TenderProposalEditorStage) => {
    if (nextStage === "canon") {
      onChange({ editor_stage: "canon", is_canon_locked: true, draft_status: "Locked", approval_status: "Locked" });
      return;
    }
    if (isCanonLocked) return;
    onChange({ editor_stage: nextStage, draft_status: nextStage === "draft" ? "Human Edited" : block.draft_status });
  }, [block.draft_status, isCanonLocked, onChange]);

  const unlockCanon = useCallback(() => {
    onChange({ editor_stage: "draft", is_canon_locked: false, draft_status: "Human Edited", approval_status: "Draft" });
  }, [onChange]);

  const lockCanon = useCallback(() => {
    onChange({ editor_stage: "canon", is_canon_locked: true, draft_status: "Locked", approval_status: "Locked" });
  }, [onChange]);

  const handleFallbackChange = (value: string) => {
    setFallbackContent(value);
    onChange({ editor_content: value, draft_content: value, draft_status: "Human Edited" });
  };

  const wordCount = editor ? editor.getText().trim().split(/\s+/).filter(Boolean).length : stripHtml(initialContent).split(/\s+/).filter(Boolean).length;
  const activeStage = TENDER_EDITOR_STAGE_CONFIG[stage];

  return (
    <div className={cn("overflow-hidden rounded-md border border-slate-200 border-l-4 bg-white shadow-none", activeStage.border)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-3 py-2">
        <div className="min-w-[220px] flex-1">
          <label className="text-[10px] font-semibold text-muted-foreground">Block Heading</label>
          <Input
            className="mt-1 h-8 bg-white text-xs font-medium"
            value={block.title}
            disabled={isCanonLocked}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="text-[10px] font-semibold text-muted-foreground">Section Name</label>
          <Input
            className="mt-1 h-8 bg-white text-xs"
            value={block.section_name}
            disabled={isCanonLocked}
            onChange={(event) => onChange({ section_name: event.target.value })}
          />
        </div>
        <div className="flex items-end gap-2 self-end">
          <Badge variant="outline" className={cn("h-7 text-[10px]", activeStage.badge)}>{activeStage.label}</Badge>
          {isCanonLocked && <Badge variant="outline" className="h-7 border-slate-300 bg-slate-100 text-[10px] text-slate-700"><Lock className="mr-1 h-3 w-3" /> Locked</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {STAGES.map((item) => (
            <button
              key={item}
              type="button"
              disabled={isCanonLocked && item !== "canon"}
              onClick={() => setStage(item)}
              className={cn(
                "h-7 rounded-md border px-2 text-[10px] font-medium transition-colors",
                stage === item ? TENDER_EDITOR_STAGE_CONFIG[item].badge : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                isCanonLocked && item !== "canon" && "cursor-not-allowed opacity-40",
              )}
            >
              {TENDER_EDITOR_STAGE_CONFIG[item].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{wordCount} words</span>
          {isCanonLocked ? (
            <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={unlockCanon}>
              <Unlock className="mr-1 h-3 w-3" /> Unlock
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={lockCanon}>
              <ShieldCheck className="mr-1 h-3 w-3" /> Lock Canon
            </Button>
          )}
          <Button type="button" size="sm" className="h-7 text-[10px]" disabled={saving} onClick={onRequestSave}>
            {saving ? <Check className="mr-1 h-3 w-3" /> : <Save className="mr-1 h-3 w-3" />} Save Draft
          </Button>
        </div>
      </div>

      <EditorToolbar
        editor={editor}
        disabled={isCanonLocked}
        onAIGenerate={!isCanonLocked && onAIGenerate ? () => onAIGenerate(block.id) : undefined}
        aiGenerating={aiGenerating}
      />

      {/* AI Draft Preview Panel */}
      {aiDraftContent && onAIDraftAction && (
        <div className="border-b-2 border-dashed border-amber-300 bg-amber-50/60">
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-100/50 px-3 py-1.5">
            <Sparkles className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] font-semibold text-amber-700">AI Draft Preview</span>
            <span className="ml-auto text-[9px] text-amber-600">Review before applying</span>
          </div>
          <div className="max-h-[320px] overflow-auto px-4 py-3">
            <div
              className="prose prose-sm max-w-none text-amber-900/80 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-2.5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_p]:mb-2.5 [&_p]:leading-relaxed [&_ul]:mb-2.5 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:mb-2.5 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:mb-1 [&_li]:leading-relaxed [&_table]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-amber-300 [&_th]:bg-amber-100/50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_td]:border [&_td]:border-amber-200 [&_td]:px-2 [&_td]:py-1.5 [&_td]:text-xs"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(aiDraftContent) }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 border-t border-amber-200 bg-amber-50 px-3 py-2">
            {/* If editor is empty, show simple Apply; otherwise show Replace/Append/Insert at Cursor */}
            {(() => {
              const hasContent = editor ? editor.getText().trim().length > 3 : stripHtml(block.editor_content || block.draft_content || "").length > 3;
              if (!hasContent) {
                return (
                  <Button type="button" size="sm" onClick={() => onAIDraftAction("replace")}
                    className="h-7 bg-emerald-600 text-[10px] text-white hover:bg-emerald-700">
                    <Check className="mr-1 h-3 w-3" /> Apply
                  </Button>
                );
              }
              return (
                <>
                  <Button type="button" size="sm" onClick={() => onAIDraftAction("replace")}
                    className="h-7 bg-amber-600 text-[10px] text-white hover:bg-amber-700">
                    Replace
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => onAIDraftAction("append")}
                    className="h-7 border-amber-300 text-[10px] text-amber-700 hover:bg-amber-100">
                    Append
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => onAIDraftAction("insert_cursor")}
                    className="h-7 border-amber-300 text-[10px] text-amber-700 hover:bg-amber-100">
                    Insert at Cursor
                  </Button>
                </>
              );
            })()}
            <Button type="button" size="sm" variant="ghost" onClick={() => onAIDraftAction("cancel")}
              className="h-7 text-[10px] text-slate-500 hover:text-red-600">
              <XCircle className="mr-1 h-3 w-3" /> Cancel
            </Button>
          </div>
        </div>
      )}

      <div
        className={cn("px-4 py-3 overflow-auto", isCanonLocked && "bg-slate-50/50")}
        style={{ height: editorHeight, minHeight: 180 }}
      >
        {editor ? (
          <EditorContent
            editor={editor}
            className={cn(
              "prose prose-sm max-w-none focus:outline-none",
              /* ProseMirror core */
              "[&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none",
              /* Headings — spacing + sizing */
              "[&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mt-6 [&_.ProseMirror_h1]:mb-3",
              "[&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:mt-5 [&_.ProseMirror_h2]:mb-2.5",
              "[&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3]:mb-2",
              /* Paragraphs */
              "[&_.ProseMirror_p]:mb-3 [&_.ProseMirror_p]:leading-relaxed",
              /* Lists */
              "[&_.ProseMirror_ul]:mb-3 [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ul]:list-disc",
              "[&_.ProseMirror_ol]:mb-3 [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_ol]:list-decimal",
              "[&_.ProseMirror_li]:mb-1.5 [&_.ProseMirror_li]:leading-relaxed",
              /* Blockquote */
              "[&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-slate-300 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:mb-3",
              /* Links */
              "[&_.ProseMirror_a]:text-blue-700",
              /* Tables */
              "[&_.ProseMirror_table]:mb-3 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse",
              "[&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-slate-300 [&_.ProseMirror_th]:bg-slate-50 [&_.ProseMirror_th]:px-2 [&_.ProseMirror_th]:py-1.5 [&_.ProseMirror_th]:text-left [&_.ProseMirror_th]:text-xs [&_.ProseMirror_th]:font-semibold",
              "[&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-slate-200 [&_.ProseMirror_td]:px-2 [&_.ProseMirror_td]:py-1.5 [&_.ProseMirror_td]:text-xs",
            )}
          />
        ) : (
          <textarea
            className="min-h-full w-full rounded-md border border-slate-200 p-3 text-xs outline-none focus:border-slate-400 disabled:bg-slate-50"
            style={{ height: "100%" }}
            disabled={isCanonLocked}
            value={fallbackContent}
            onChange={(event) => handleFallbackChange(event.target.value)}
          />
        )}
      </div>

      {/* Resize handle — drag to expand/shrink editor */}
      <div
        className="group flex h-5 cursor-ns-resize items-center justify-center border-t border-slate-200 bg-slate-50/80 hover:bg-blue-50 active:bg-blue-100 transition-colors select-none"
        title="Drag to resize editor"
        onMouseDown={(e) => {
          e.preventDefault();
          const startY = e.clientY;
          const startH = editorHeight;
          const onMove = (ev: MouseEvent) => {
            const delta = ev.clientY - startY;
            setEditorHeight(Math.max(180, Math.min(1200, startH + delta)));
          };
          const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }}
      >
        <div className="flex flex-col items-center gap-[2px]">
          <div className="h-[2px] w-8 rounded-full bg-slate-300 group-hover:bg-blue-400 transition-colors" />
          <div className="h-[2px] w-5 rounded-full bg-slate-300 group-hover:bg-blue-400 transition-colors" />
        </div>
      </div>
    </div>
  );
}
