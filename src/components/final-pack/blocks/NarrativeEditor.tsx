/**
 * NarrativeEditor.tsx
 * ───────────────────
 * FPS-018 — Rich text editor for narrative blocks using TipTap.
 * FPS-008 hardening (Part D) — deep toolbar: Paragraph, H1–H4, Bold, Italic,
 * Underline, lists, Quote, indent/outdent, alignment, link, HR, clear, undo/redo.
 *
 * Content stored as HTML in block content.html (storage model unchanged).
 *
 * Source-truth safety: Writes to output copy only. Never touches commercial_tickets.
 */

import { useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { OutputBlock, BlockContent } from "@/lib/final-pack-loader";
import { richTextExtensions, RichTextToolbar } from "./RichTextToolbar";

interface NarrativeEditorProps {
  block: OutputBlock;
  onContentChange: (content: Partial<BlockContent>) => void;
}

export default function NarrativeEditor({ block, onContentChange }: NarrativeEditorProps) {
  const initialHtml = block.content.html || block.default_content || "";

  // Stable ref to avoid stale closures in TipTap onUpdate
  const onChangeRef = useRef(onContentChange);
  useEffect(() => {
    onChangeRef.current = onContentChange;
  }, [onContentChange]);

  const editor = useEditor({
    extensions: richTextExtensions("Start writing…"),
    content: initialHtml,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[120px] px-3 py-2 text-foreground",
      },
    },
    onUpdate: ({ editor: e }) => {
      onChangeRef.current({
        html: e.getHTML(),
        source_status: "populated",
      });
    },
  });

  if (!editor) return null;

  return (
    <div className="space-y-2">
      <RichTextToolbar editor={editor} />

      {/* Editor */}
      <div className="border border-border rounded-md bg-background">
        <EditorContent editor={editor} />
      </div>

      {/* Source status */}
      {block.content.source_status === "not_captured" && (
        <p className="text-xs text-amber-600">
          Content not captured yet — you can write it here.
        </p>
      )}
    </div>
  );
}
