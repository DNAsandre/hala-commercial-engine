# Tender and Proposal AI Destination Readiness Audit

**Application:** `hala-clean-commercial-engine`  
**Audit date:** 2026-08-24  
**Audited branch:** `proposal-functional-closure`  
**Audited commit:** `e0c7062f1168ba5596cab6c3d52c453103e9efb2`  
**Mode:** Read-only product, code, test, and browser audit  
**Verdict:** NOT READY for reliable automated document-to-field population

## 1. Executive Verdict

The Tender and Proposal workspaces are now credible human workbenches. They load real records, expose the two trackers, allow unrestricted manual stage navigation, and have working persistence foundations. Tender has already passed a controlled 15-stage human UAT. Proposal has passed automated tests and a live read-only walkthrough, but it has not yet passed the equivalent controlled write, reload, edit, and reload UAT across all 11 stages.

That does **not** mean they are ready for AI to populate every field safely.

The missing layer is an authoritative machine-readable destination contract. A document-extraction bot needs an exact map for every destination: stable field ID, stage, data type, units, allowed values, sanitizer, persistence path, repeated-row identity, source evidence, and downstream PDF consumer. Neither process currently has that complete map.

Current readiness estimates are:

| Area | Human workflow readiness | Safe AI destination readiness |
|---|---:|---:|
| Tender | 95% | 55% |
| Proposal | 88% | 45% |
| Combined | 92% | 50% |

These percentages are engineering estimates, not acceptance certificates. A truthful 100% sign-off is impossible until the repair wave and controlled UAT described below pass.

## 2. Evidence Reproduced

The following checks passed on the audited commit:

- TypeScript: 0 errors.
- Automated tests: 70 files, 978 tests passed.
- Production build: 2,495 modules bundled successfully.
- Live Proposal route: both CRM Pipeline and Internal Proposal trackers rendered, with all 11 internal stages visible.
- Live Tender route: both CRM Pipeline and Internal Tender Process trackers rendered, with all 15 internal stages visible.
- Old application source was not used by the running clean application during this audit.

## 3. Confirmed Strengths

### 3.1 Tender

- The 15-stage human workflow is present and previously passed save, read-back, reload, edit, and adjacent-stage preservation UAT.
- The current Tender persistence layer uses exact record identity, revision checks, patch-merge behavior in the repaired facets, read-back verification, and audit outcomes.
- Documents, stage registers, both trackers, Final Pack, and browser PDF handoff have been exercised.
- Manual human navigation remains available; this audit proposes no gates or stage locks.

### 3.2 Proposal

- All 11 stage workbenches are present.
- The common save path uses exact ticket ID, ticket type, active-row targeting, revision comparison, read-back verification, and an audit record (`src/lib/proposal-workspace-persistence.ts:3003`).
- Both CRM and Internal Proposal tracker changes persist through the established columns.
- Proposal drafting, quote, documents, and PDF Studio handoff exist.
- The current data model is substantial: 65 top-level stage data groups and approximately 431 leaf-level destinations are declared in `ProposalWorkspaceData` (`src/components/proposal-workspace/proposal-workspace-state.ts:671`).

## 4. Release-Blocking Gaps for AI Population

### ADR-01: No complete canonical field manifest

**Severity:** Critical  
**Processes:** Tender and Proposal

There is no single source of truth that describes every writable leaf field and repeated-row collection. Proposal stage keys remain generic strings (`src/components/proposal-workspace/proposal-stages.ts:8`), while Tender stage truth is structurally `Record<string, unknown>` (`src/lib/tender-stage-source-truth.ts:28`).

**Risk:** A bot can write to the wrong path, use the wrong type or unit, omit a required sibling, or populate a field that the UI or PDF never reads.

**Required outcome:** One generated, testable field manifest per process, covering every leaf destination.

### ADR-02: Proposal partial population can erase sibling fields

**Severity:** Critical  
**Process:** Proposal

The generic Proposal save sanitizes the supplied stage object and replaces the complete stage `data` envelope (`src/lib/proposal-workspace-persistence.ts:3030-3044`). This is appropriate when the human workbench submits the complete stage. It is unsafe when a future bot submits only extracted fields: omitted human-entered siblings would be removed.

**Required outcome:** A clean-owned path-level patch API that merges only explicitly addressed fields, retains every unaddressed sibling, enforces the current revision, reads back the result, and reports the audit outcome.

### ADR-03: Tender's existing orchestration registry is obsolete and incomplete

**Severity:** Critical  
**Process:** Tender

The existing registry has 33 broad bucket-level paths, 3 `UNKNOWN` paths, and only 11 apply-enabled paths (`src/lib/orchestration-core.ts:213-299`). It maps whole objects such as pricing or drafting sections, not the individual leaf fields a reliable extractor needs.

The associated apply function still refuses live persistence (`src/lib/orchestration.ts:377-400`), yet the live Tender workspace still exposes an **AI Orchestration Review** panel (`src/pages/TenderWorkspace.tsx:2161`). The visible panel therefore suggests an operating capability that does not exist.

**Required outcome:** Remove the stale panel and obsolete registry from the product surface, or replace them later with the new canonical destination contract. Do not leave both systems active.

### ADR-04: No uniform field-level source lineage

**Severity:** Critical  
**Processes:** Tender and Proposal

Some screens have free-text `evidence`, `source_evidence`, or `documentRef` fields. There is no universal per-field source record containing a real document ID, page or section, source quotation, extraction reference, and confidence. Tender's existing `type_details.extraction.evidence` is read-side data, not a complete writer contract (`src/lib/tender-source-record.ts:193`).

**Risk:** Users cannot reliably verify where a populated value came from, and later corrections cannot be traced back to a precise source.

**Required outcome:** A separate, non-destructive provenance sidecar keyed by process ID plus canonical field ID. Business values remain human-editable.

### ADR-05: Repeated rows lack extraction idempotency

**Severity:** High  
**Processes:** Tender and Proposal

There are 46 code sites in the two component trees generating row IDs with `Date.now()`, `Math.random()`, or `nanoid()` (17 Proposal, 29 Tender). Those IDs are acceptable for manual row creation. They do not let a document extractor recognize that the same source item has already been populated.

**Risk:** Reprocessing the same document can duplicate requirements, pricing lines, risks, contacts, evidence items, or revisions.

**Required outcome:** Repeated destinations need a stable source fingerprint or explicit idempotency key and tested update-versus-create behavior.

### ADR-06: Units and allowed values are scattered

**Severity:** High  
**Processes:** Tender and Proposal

Dates, amounts, percentages, volumes, statuses, and free text are represented across local TypeScript interfaces and UI controls. No canonical registry states the expected unit, precision, date format, enum values, null behavior, or normalization rule for every destination.

**Risk:** Extracted `15`, `15%`, `0.15`, `SAR 15m`, and `15000000` can be interpreted inconsistently.

**Required outcome:** Every canonical field declares its data type and normalization contract. The same declaration must drive extraction validation, persistence validation, and test fixtures.

### ADR-07: No complete document-to-field runtime exists

**Severity:** Critical for AI activation; not a human-workflow defect  
**Processes:** Tender and Proposal

The clean server currently exposes document listing, download, and PDF source-truth verification routes (`server/app.ts:13-33`, `server/routes/documents.ts:111-340`). It has no operational OCR, DOCX/PDF text extraction, page-aware parsing, chunking, or structured extraction endpoint. AI generation and AI-run mutation deliberately refuse in the current build (`src/lib/ai-runs.ts:36-38`).

This belongs to the later authorized AI activation program. It must not be disguised as working today.

### ADR-08: Proposal controlled write UAT is incomplete

**Severity:** Critical  
**Process:** Proposal

Automated tests and the read-only browser walkthrough pass. The Proposal closeout still lacks the Tender-equivalent test that enters, saves, reloads, edits, reloads, and checks adjacent-stage preservation for all 11 stages and both trackers.

**Required outcome:** Controlled disposable-record UAT across the full Proposal process, including document links and Proposal-to-PDF handoff.

### ADR-09: PDF consumption is not traced back to every canonical field

**Severity:** High  
**Processes:** Tender and Proposal

The application can hand edited content to Final Pack/PDF Studio, but no machine-checkable contract proves which canonical Tender and Proposal fields feed each document block. Default template prose must never be treated as extracted customer truth.

**Required outcome:** Every PDF block declares its source field IDs, fallback behavior, and empty-state behavior. Tests must prove source data reaches the edited document without substituting template prose as fact.

## 5. Required Pre-AI Repair Wave

This is ordinary product and data-contract work. It does not activate AI, bots, security controls, compliance enforcement, workflow gates, or stage locks.

### Ticket 1: Canonical destination contracts

- Inventory all Tender and Proposal leaf fields, arrays, and document links.
- Assign stable canonical field IDs.
- Record stage, tab, label, type, unit, enum, null behavior, sanitizer, persistence path, UI owner, and PDF consumer.
- Generate TypeScript key unions and validation from the manifests.
- Fail the build if a rendered editable field or PDF consumer is absent from the manifest.

### Ticket 2: Safe path-level persistence

- Add exact-path patch operations for both processes.
- Merge only the named fields and preserve all unaddressed human content.
- Retain exact ID, process type, active-row, revision, read-back, and audit behavior.
- Prevent any population operation from moving either tracker stage.
- Add no-sibling-loss tests for every stage and representative nested arrays.

### Ticket 3: Source lineage and repeated-row identity

- Add structured provenance separate from business values.
- Use real document IDs and page/section references where available.
- Add source fingerprints/idempotency keys for list items.
- Prove that reprocessing the same extraction updates the same source item instead of duplicating it.
- Keep all populated values editable by a human.

### Ticket 4: Remove contradictory legacy surfaces

- Remove the stale Tender AI Orchestration Review UI and its obsolete dry-run assumptions from normal human workflow.
- Retain no mock suggestions, fabricated completion, or disconnected write controls.
- Prove no approved Tender or Proposal page imports the obsolete registry after cleanup.

### Ticket 5: End-to-end destination and document verification

- Run controlled write/reload UAT through all 15 Tender stages as a regression.
- Run first complete controlled write/reload UAT through all 11 Proposal stages.
- Verify both CRM and internal trackers survive reload and are not changed by field population.
- Verify every canonical destination can be written, read back, edited by a human, and preserved on reload.
- Verify representative Tender and Proposal values reach Final Pack/PDF Studio correctly.
- Produce a field-coverage report with 100% manifest coverage and zero unexplained destinations.

## 6. Acceptance Standard Before Bot Integration

Bot integration may begin only after all of the following are proven:

1. Every editable Tender and Proposal destination has one stable canonical field ID.
2. Every destination has a declared type, normalization, persistence path, UI control, and document consumer or an explicit `not exported` classification.
3. Partial writes never delete unaddressed human data.
4. Repeated processing does not duplicate list items.
5. Every populated value can carry a verifiable source reference without locking the human value.
6. Tender 15-stage and Proposal 11-stage controlled UAT both pass.
7. Both trackers persist through reload and remain separate from content population.
8. Final Pack/PDF Studio receives the intended edited values with no fabricated template truth.
9. Type-check, automated tests, production build, route containment, and old-source absence all pass.
10. No stale orchestration shell, mock result, or disconnected write control remains on the approved surfaces.

## 7. Honest Bottom Line

The application is ready for humans to continue Tender work and is close for Proposal work. It is **not yet safe to connect document-extraction bots to all stage fields**. The primary missing product is not the model or prompt; it is the deterministic destination layer that tells any future extractor exactly where data belongs and guarantees that partial population cannot damage human work.

After the five-ticket repair wave passes, the system can move to an architect-authorized AI integration program with a stable, auditable destination surface. Until then, a claim of 100% bot readiness would be false.
