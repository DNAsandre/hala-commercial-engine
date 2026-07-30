/**
 * CustomTextEditor.tsx
 * ────────────────────
 * FPS-022 — Free-text block using TipTap.
 * FPS-008 hardening (Part D) — deep toolbar: Paragraph, H1–H4, Bold, Italic,
 * Underline, lists, Quote, indent/outdent, alignment, link, HR, clear, undo/redo.
 *
 * Label: "Custom block — not linked to tender source"
 * Source-truth safety: Writes to output copy only (content.html, unchanged model).
 */

import { useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { OutputBlock, BlockContent } from "@/lib/final-pack-loader";
import { richTextExtensions, RichTextToolbar } from "./RichTextToolbar";

interface CustomTextEditorProps {
  block: OutputBlock;
  onContentChange: (content: Partial<BlockContent>) => void;
}

export default function CustomTextEditor({ block, onContentChange }: CustomTextEditorProps) {
  const initialHtml = block.content.html || "";

  // Stable ref to avoid stale closures in TipTap onUpdate
  const onChangeRef = useRef(onContentChange);
  useEffect(() => {
    onChangeRef.current = onContentChange;
  }, [onContentChange]);

  const editor = useEditor({
    extensions: richTextExtensions("Type your custom content here…"),
    content: initialHtml,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[80px] px-3 py-2 text-foreground",
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
      {/* Custom block label */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>✏️</span>
        <span>Custom block — not linked to tender source</span>
      </div>

      <RichTextToolbar editor={editor} />

      {/* Editor */}
      <div className="border border-border rounded-md bg-background">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
