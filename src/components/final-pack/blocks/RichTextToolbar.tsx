/**
 * RichTextToolbar.tsx
 * ───────────────────
 * FPS-008 hardening (Part D) — shared deep WYSIWYG toolbar + extension set for
 * the FinalPackStudio narrative / custom-text editors.
 *
 * Adds real proposal/PDF authoring depth: Paragraph, H1–H4, Bold, Italic,
 * Underline, lists, Quote, Indent/Outdent (lists), alignment, clear formatting,
 * horizontal rule, link, undo/redo.
 *
 * IMPORTANT:
 *  - All controls operate on the TipTap document and serialize to HTML, which is
 *    stored unchanged in the existing `content.html` field. Storage model is
 *    untouched.
 *  - No source/template/reusable/export logic here.
 */

import type { Editor } from "@tiptap/react";
import { useState } from "react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Pilcrow, Heading1, Heading2, Heading3, Heading4,
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Quote,
  IndentIncrease, IndentDecrease, AlignLeft, AlignCenter, AlignRight,
  RemoveFormatting, Minus, Link as LinkIcon, Undo, Redo,
} from "lucide-react";

/** Shared extension set — H1–H4, underline, alignment, links, lists, quote, hr. */
export function richTextExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
    }),
    Underline,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Link.configure({ openOnClick: false, autolink: true }),
    Placeholder.configure({ placeholder }),
  ];
}

function Btn({
  active, onClick, title, children, disabled,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={
        "p-1.5 rounded transition-colors disabled:opacity-30 " +
        (active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

const Sep = () => <div className="mx-1 h-5 w-px bg-border" />;

export function RichTextToolbar({ editor }: { editor: Editor }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const openLinkEditor = () => {
    setLinkUrl((editor.getAttributes("link").href as string | undefined) || "");
    setLinkOpen(true);
  };
  const applyLink = (nextValue = linkUrl) => {
    const url = nextValue.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkOpen(false);
  };

  return (
    <div className="space-y-2 border-b border-border pb-2">
      <div className="flex flex-wrap items-center gap-0.5">
      {/* Block type */}
      <Btn active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()} title="Paragraph">
        <Pilcrow className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
        <Heading1 className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
        <Heading2 className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
        <Heading3 className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("heading", { level: 4 })} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} title="Heading 4">
        <Heading4 className="h-4 w-4" />
      </Btn>

      <Sep />

      {/* Inline marks */}
      <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
        <Bold className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
        <Italic className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
        <UnderlineIcon className="h-4 w-4" />
      </Btn>

      <Sep />

      {/* Lists + quote */}
      <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bulleted list">
        <List className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
        <ListOrdered className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">
        <Quote className="h-4 w-4" />
      </Btn>
      <Btn onClick={() => editor.chain().focus().sinkListItem("listItem").run()} title="Indent (list item)">
        <IndentIncrease className="h-4 w-4" />
      </Btn>
      <Btn onClick={() => editor.chain().focus().liftListItem("listItem").run()} title="Outdent (list item)">
        <IndentDecrease className="h-4 w-4" />
      </Btn>

      <Sep />

      {/* Alignment */}
      <Btn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align left">
        <AlignLeft className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Align center">
        <AlignCenter className="h-4 w-4" />
      </Btn>
      <Btn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align right">
        <AlignRight className="h-4 w-4" />
      </Btn>

      <Sep />

      {/* Insert + clear */}
      <Btn active={editor.isActive("link")} onClick={openLinkEditor} title="Link">
        <LinkIcon className="h-4 w-4" />
      </Btn>
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
        <Minus className="h-4 w-4" />
      </Btn>
      <Btn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Clear formatting">
        <RemoveFormatting className="h-4 w-4" />
      </Btn>

      <Sep />

      {/* History */}
      <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo className="h-4 w-4" />
      </Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo className="h-4 w-4" />
      </Btn>
      </div>
      {linkOpen && (
        <form className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted/20 p-2" onSubmit={(event) => { event.preventDefault(); applyLink(); }}>
          <label className="sr-only" htmlFor="fps-link-url">Link URL</label>
          <input id="fps-link-url" type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com" autoFocus className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs" />
          <button type="submit" className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Apply</button>
          <button type="button" onClick={() => applyLink("")} className="rounded border border-border px-2 py-1 text-xs">Remove</button>
          <button type="button" onClick={() => setLinkOpen(false)} className="rounded px-2 py-1 text-xs text-muted-foreground">Cancel</button>
        </form>
      )}
    </div>
  );
}
