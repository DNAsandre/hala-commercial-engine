# Editor Rebuild TODO

## Phase 1: Architecture
- [ ] Re-read Truthpack editor requirements from saved summary
- [ ] Plan WYSIWYG editor architecture with TipTap

## Phase 2: WYSIWYG Editor Shell
- [ ] Install TipTap and extensions
- [ ] Build CommercialEditor component with full WYSIWYG rich text editing
- [ ] Implement toolbar (bold, italic, headings, lists, tables, links)
- [ ] Implement block-based sections with editable content
- [ ] Three-mode flow: Structure → Draft → Canon

## Phase 3: Connect to Quotes
- [ ] Quotes page: "New Quote" opens Editor with Quote template
- [ ] Quote-specific blocks (pricing table, terms, validity)
- [ ] Save quote back to store from Editor

## Phase 4: Connect to Proposals
- [ ] Proposals page: "New Proposal" opens Editor with Proposal template
- [ ] Proposal-specific sections (Executive Summary, SOW, Pricing, SLA, T&C)
- [ ] Save proposal back to store from Editor

## Phase 5: SLA Shell (NEW)
- [ ] Create SLA page with list of SLAs
- [ ] SLA-specific template in Editor (KPIs, penalties, measurement, review)
- [ ] Add SLA route and sidebar link

## Phase 6: AI Staging in Draft Mode
- [ ] AI prompt box generates content into WYSIWYG blocks
- [ ] Accept/Reject AI staging area
- [ ] Lock blocks as Canon (read-only)

## Phase 7: Test & Fix
- [ ] Test creating a Quote from scratch
- [ ] Test creating a Proposal from scratch
- [ ] Test creating an SLA from scratch
- [ ] Test PDF export from Editor
- [ ] Test Canon lock mode
