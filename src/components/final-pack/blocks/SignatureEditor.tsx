/**
 * SignatureEditor.tsx
 * ───────────────────
 * FPS-021 — Editable dual-signature block.
 *
 * Fields: company name, client name, signer fields. All editable.
 * Source-truth safety: Writes to output copy only.
 */

import { useCallback } from "react";
import type { OutputBlock, BlockContent } from "@/lib/final-pack-loader";

interface SignatureEditorProps {
  block: OutputBlock;
  onContentChange: (content: Partial<BlockContent>) => void;
}

export default function SignatureEditor({ block, onContentChange }: SignatureEditorProps) {
  const variables = block.content.variables || {};

  const handleChange = useCallback(
    (key: string, value: string) => {
      onContentChange({
        variables: { ...variables, [key]: value },
        source_status: "populated",
      });
    },
    [variables, onContentChange],
  );

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Hala side */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          First Party (Hala)
        </h4>
        <SignatureField
          id={`fps-sig-${block.id}-hala_company`}
          label="Company"
          value={variables.hala_company || ""}
          onChange={(v) => handleChange("hala_company", v)}
        />
        <SignatureField
          id={`fps-sig-${block.id}-hala_signatory`}
          label="Signatory Name"
          value={variables.hala_signatory || ""}
          onChange={(v) => handleChange("hala_signatory", v)}
        />
        <SignatureField
          id={`fps-sig-${block.id}-hala_title`}
          label="Title"
          value={variables.hala_title || ""}
          onChange={(v) => handleChange("hala_title", v)}
        />
        <div className="border-t border-dashed border-border mt-4 pt-2">
          <p className="text-[10px] text-muted-foreground">Signature line</p>
        </div>
      </div>

      {/* Client side */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Second Party (Client)
        </h4>
        <SignatureField
          id={`fps-sig-${block.id}-client_company`}
          label="Company"
          value={variables.client_company || ""}
          onChange={(v) => handleChange("client_company", v)}
        />
        <SignatureField
          id={`fps-sig-${block.id}-client_signatory`}
          label="Signatory Name"
          value={variables.client_signatory || ""}
          onChange={(v) => handleChange("client_signatory", v)}
        />
        <SignatureField
          id={`fps-sig-${block.id}-client_title`}
          label="Title"
          value={variables.client_title || ""}
          onChange={(v) => handleChange("client_title", v)}
        />
        <div className="border-t border-dashed border-border mt-4 pt-2">
          <p className="text-[10px] text-muted-foreground">Signature line</p>
        </div>
      </div>
    </div>
  );
}

function SignatureField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
