# PDF Design Spec — From Uploaded Hala Samples

## KEY DESIGN PRINCIPLES FROM THE SAMPLES:

### 1. NO SEPARATE PAGES FOR EACH SECTION — Content flows continuously
- Page 2 has BOTH "Confidentiality Statement" AND "Introduction" AND "Geographic Locations" map — all on ONE page
- Page 3 has "HSCS Customers & Certificates" (images) AND "Scope of Work" (bullet list) — all on ONE page
- Page 4 has "Commercial Proposal" pricing table AND "Note" section — all on ONE page
- Content FLOWS from section to section without forced page breaks

### 2. DENSE CONTENT — No wasted whitespace
- Every page is FULL of content from top to bottom
- Sections flow directly into each other with just a heading + small gap
- No half-empty pages

### 3. HEADER — Consistent on every page
- Top band: HALA logo (left) + document title (center) + customer logo (right)
- Gray/light background behind the header
- Below header: thin line separator

### 4. FOOTER — Consistent on every page
- "COMPLETED BY: Hala SCS | DATE: 22 07 2025 | REF: HSCS_22072025"
- "Page X of Y" right-aligned
- Small text, bottom of page

### 5. TYPOGRAPHY
- Section headings: Large, bold, dark blue/teal color (#1a5276 or similar)
- Body text: Regular weight, 11-12pt equivalent, justified
- Table headers: White text on dark blue background
- Bullet lists: a., b., c. style lettering, indented

### 6. TABLES
- Header row: Dark blue background (#1a3c5e), white text, bold
- Body rows: Alternating white/light gray
- Borders: Thin, light gray
- Numbers: Right-aligned
- "Minimum Pallet Positions" row: Bold italic, highlighted

### 7. COVER PAGE
- Full bleed image with overlay
- Title at bottom-left in white
- Date below title

### 8. WHAT MY CURRENT RENDERER DOES WRONG:
- Forces ONE section per page = massive whitespace
- Each section gets its own A4 page even if it's 3 lines of text
- Confidentiality is alone on a page (should flow into Introduction)
- Introduction is alone on a page (should flow into Scope of Work)
- Certificates page says "Content to be added" — placeholder
- Terms page is sparse

### 9. THE FIX:
- REMOVE forced page breaks between sections
- Let content FLOW continuously
- Only force page break BEFORE cover page and BEFORE signature block
- Let the browser/print engine handle natural page breaks
- Use CSS `break-inside: avoid` on tables and signature blocks
- Use `break-after: page` only on cover page

### 10. TERMS PAGE (Page 6-7)
- Terms flow as a., b., c. lettered list with sub-items as 1., 2., 3.
- Some terms have bold inline text (e.g., "Option 1 & 2", "Option 3")
- Terms continue across pages naturally — no forced break

### 11. CLOSING PAGE (Page 7)
- Closing paragraph: "We thank you for giving Hala Supply Chain Services Co..."
- "Kind Regards," then name bold, title bold
- Contact info: PO Box, Mobile, Website links
- Company stamp/seal image on the right
- This is NOT a dual-signature block — it's a single signoff from Hala

### 12. KEY TAKEAWAY:
- The sample PDF is 7 pages with DENSE content on every page
- My current renderer produces 9 pages with SPARSE content and half-empty pages
- The fix is: REMOVE all forced page breaks, let content flow continuously
