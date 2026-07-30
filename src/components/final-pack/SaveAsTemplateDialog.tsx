/**
 * SaveAsTemplateDialog.tsx
 * ────────────────────────
 * FPS-005-11 — Save the current document as a NEW reusable template.
 *
 * Builds a recipe from the current blocks. Optionally converts customer-specific
 * values to {{placeholders}} so they don't leak into the reusable template.
 * NEVER mutates the current document, never carries a connected source binding,
 * never blocks export. Failure → advisory only.
 */

import { useMemo, useState } from "react";
import { X, Loader2, Check, AlertTriangle, FileStack } from "lucide-react";
import type { OutputBlock } from "@/lib/final-pack-loader";
import {
  useTemplates,
  TEMPLATE_DOC_TYPES,
  type RecipeEntry,
  type TemplateDocType,
  type TemplateClass,
  type TemplateScope,
} from "@/hooks/useTemplates";

interface SaveAsTemplateDialogProps {
  blocks: OutputBlock[];
  packType?: string;
  defaultName?: string;
  customerName?: string;
  refNumber?: string;
  brandingProfileId?: string | null;
  layout?: Record<string, unknown> | null;
  createdBy?: string;
  onClose: () => void;
}

/** Map a document intent / pack_type to a valid template doc_type (CHECK-safe). */
function packTypeToDocType(packType?: string): TemplateDocType {
  switch (packType) {
    case "quotation":
    case "bilingual_quotation":
      return "quote";
    case "combined_proposal":
      return "proposal";
    case "sla":
      return "sla";
    case "msa":
      return "msa";
    default:
      return "proposal";
  }
}

/** Replace literal customer-specific values with template variables. */
function placeholderize(html: string, customerName?: string, refNumber?: string): string {
  let out = html;
  const repl = (text: string | undefined, token: string) => {
    const t = (text || "").trim();
    if (t.length < 3) return; // avoid replacing trivially short strings
    out = out.split(t).join(token);
  };
  repl(customerName, "{{customer_name}}");
  repl(refNumber, "{{reference_number}}");
  return out;
}

const CLASSES: TemplateClass[] = ["customer_facing", "internal", "certificate"];
const SCOPES: TemplateScope[] = ["workspace", "personal", "hala_global"];

export default function SaveAsTemplateDialog({
  blocks, packType, defaultName, customerName, refNumber, brandingProfileId, layout, createdBy, onClose,
}: SaveAsTemplateDialogProps) {
  const { createTemplate } = useTemplates();

  const [name, setName] = useState(defaultName || "New Template");
  const [docType, setDocType] = useState<TemplateDocType>(() => packTypeToDocType(packType));
  const [cls, setCls] = useState<TemplateClass>("customer_facing");
  const [scope, setScope] = useState<TemplateScope>("workspace");
  const [convertPlaceholders, setConvertPlaceholders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whether customer-specific values still appear literally (advisory).
  const leakRisk = useMemo(() => {
    if (convertPlaceholders) return false;
    const blob = blocks.map((b) => b.content?.html || "").join(" ");
    return Boolean(
      (customerName && customerName.trim().length >= 3 && blob.includes(customerName.trim())) ||
      (refNumber && refNumber.trim().length >= 3 && blob.includes(refNumber.trim())),
    );
  }, [blocks, customerName, refNumber, convertPlaceholders]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const recipe: RecipeEntry[] = blocks.map((b, i) => {
        const raw = b.content?.html ?? null;
        const content = raw && convertPlaceholders ? placeholderize(raw, customerName, refNumber) : raw;
        return {
          block_key: b.block_key,
          order: i + 1,
          required: !!b.required,
          default_content_override: content,
          config_override: {},
        };
      });

      const t = await createTemplate({
        name,
        doc_type: docType,
        template_class: cls,
        scope,
        default_branding_profile_id: brandingProfileId ?? null,
        recipe,
        layout: layout ?? {},
        status: "draft",
        created_by: createdBy,
      });
      if (!t) {
        setError("Couldn’t save the template. Your document is unaffected — keep working.");
        return;
      }
      setDone(true);
      setTimeout(onClose, 900);
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileStack className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Save as template</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Creates a new draft template from this document’s {blocks.length} blocks. The current document and any connected source are untouched.
          </p>

          <label className="block space-y-1">
            <span className="text-xs font-medium">Template name</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium">Doc type</span>
              <select className={input} value={docType} onChange={(e) => setDocType(e.target.value as TemplateDocType)}>
                {TEMPLATE_DOC_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">Class</span>
              <select className={input} value={cls} onChange={(e) => setCls(e.target.value as TemplateClass)}>
                {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">Scope</span>
              <select className={input} value={scope} onChange={(e) => setScope(e.target.value as TemplateScope)}>
                {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={convertPlaceholders} onChange={(e) => setConvertPlaceholders(e.target.checked)} />
            Convert customer name / reference to {"{{placeholders}}"}
          </label>

          {leakRisk && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/5 text-amber-600 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>Customer-specific values may be baked into this template. Enable placeholder conversion to avoid leakage (advisory — you can still save).</span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/5 text-amber-600 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || done}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <Check className="h-3.5 w-3.5" /> : null}
            {done ? "Saved" : "Save template"}
          </button>
        </div>
      </div>
    </div>
  );
}
