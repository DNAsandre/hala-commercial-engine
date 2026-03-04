# PDF System Audit — Real User Flow Testing

## Quote Editor (from Workspace → Documents → New Quote)
The quote editor is actually a rich block-based document editor with:
- Breadcrumb: Workspaces > SABIC > Quotation
- Tabs: Draft | Canon
- Toolbar: Template, Blocks, AI Document, Save, Compile, Output Studio
- Rich text formatting toolbar (H1-H3, Bold, Italic, etc.)
- Token insertion ({{title}}, {{customer_name}}, etc.)
- Right sidebar: Linked Customer (SABIC), Branding, Document Info, Block Navigator, Version History, AI Run History

## Blocks present in the quote:
1. Cover Page — Hero Form (with tokens)
2. Confidentiality Notice Clause
3. Introduction / Narrative (WYSIWYG, AI-generatable)
4. Scope of Services (WYSIWYG, AI-generatable)
5. Pricing Table — Single Option (Data-Bound, Read-Only)
6. Totals — Number to Words (Data-Bound, Read-Only)
7. Terms & Conditions
8. Dual Signature Block

## Key buttons to test:
- "Compile" — should compile the document
- "Output Studio" — should open the PDF output view
- "Save" — saves the draft

## Compile button findings:
- Opens a "PDF Preview" modal popup — THIS IS THE PROBLEM the user is complaining about
- It's a narrow, cramped popup (~350px wide) showing the compiled document in a tiny scrollable area
- The content IS there (cover, confidentiality, executive summary, scope of services, pricing)
- BUT it's displayed in a terrible narrow popup that's impractical to review
- Token Status shows "All tokens resolved" with green checkmark
- Bottom bar: "Fix & Recompile" and "Approve & Save to Documents"

## CRITICAL ISSUES TO FIX:
1. **PDF Preview is a tiny popup** — needs to be a full-page view, not a modal
2. **The preview looks like plain text** — no professional formatting, no cover page styling, no tables
3. **No proper A4 page layout** — just flowing text in a narrow column
4. **Need to test Output Studio button** — may be the actual PDF viewer
5. **Dashboard 404** — broken route

## Output Studio findings (the /composer/{id}/view page):
- This is a SEPARATE full page at /composer/{id}/view — much better than the popup
- Left sidebar: Token Health (6/6 resolved), Styling (branding profile, spacing), Actions, Document Vault
- Right panel: Shows the compiled document with all sections
- BUT the document preview is STILL just plain text — no professional PDF styling
- Pricing table shows as: "ServiceUnitRate (SAR)Est. VolumeMonthly (SAR)" — all mashed together, no actual table
- Cover page is just text "SABIC / Quotation — v1" with a line — not the professional cover from PDF Studio
- No A4 page boundaries, no headers/footers, no professional formatting
- "Compile Final PDF" button exists but the preview itself is terrible

## PLAN — What needs to be completely rebuilt:
1. The Output Studio (/composer/{id}/view) needs to use the PDF renderer from pdf-renderer.ts
2. The compile modal needs to be replaced with a proper full-page view
3. The PDF renderer needs to be connected to the actual document data (blocks, tokens, customer)
4. Need proper A4 page layout with cover page, headers, footers, tables
5. Arabic/dual-language support needs to work from the workspace flow
6. Fix Dashboard 404
