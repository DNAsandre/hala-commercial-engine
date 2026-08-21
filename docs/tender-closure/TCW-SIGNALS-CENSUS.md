# TCW false-signal / disabled-op census (feeds LEFT-BEHIND-INVENTORY + correction worklist)

> Extracted verbatim from the lane agent's final report.

Both re-verifications match the pre-termination results exactly. All investigation sections are complete. Here is the deliverable.

---

# TCW-MAP-SIGNALS — Tender Surface Honesty Audit
**Repo:** `C:\ANtigravity Apps\Hala App - Amin review\hala-clean-commercial-engine` @ `master` / tag `tender-closure-start` (HEAD `93799d3`)
**Scope:** tender surface only. Reachability verdicts below rest on two verified facts: (1) all child-collection reads are stubs — `fetchTenderPacks`/`fetchTenderPlaceholders` return empty (`supabase-tender-data.ts:700-708`), `fetchTenderRequiredDocuments`/`fetchTenderComplianceItems` return `{loaded:false, items:[]}` (`:725-733`), `fetchTenderSplitChecks`/`fetchTenderPackOutputs`/`fetchTenderSubmissionEmails` return `[]` (`:756-791`) — so `ws.packs`, `ws.placeholders`, `ws.complianceItems`, `ws.requiredDocuments`, `ws.splitChecks`, `ws.packOutputs`, `ws.submissionEmails` are always empty and `ws.readinessScore` is always 0; (2) `normalizeTenderInternalStage` always returns one of the 15 stage keys (`tender-stage-source-truth.ts:224-229`), so `buildStageConfig`'s `default` case and every generic tab route it would feed are unreachable.

---

## §B — False business signals

**Known suspects — all four located** in `src/lib/tender-stage-config.ts` (`buildStageConfig`). Critical nuance: this function is imported only by `TenderWorkspace.tsx:34` and **only `.tabs` is consumed** (`TenderWorkspace.tsx:1572-1576`) — the `indicators` array containing all four verdicts is computed every render but never displayed. They are **dormant** false signals: any future consumer of `indicators` reactivates them verbatim.

| # | file:line | Rendered claim (exact) | Data-derivable? | Honest alternative | Live? |
|---|---|---|---|---|---|
| B1 | `lib/tender-stage-config.ts:253` | `{ type: "status", label: "Final Approval", state: "Approved", color: "text-emerald-600 ..." }` | No — literal; ignores `type_details.final_approved.approval_record.decision` which exists and is written by `updateTenderFinalApprovedData` | Derive from stored `approval_record.decision`; "Not recorded" when absent | Dormant |
| B2 | `lib/tender-stage-config.ts:256` | `{ type: "status", label: "Version Integrity", state: "Verified", ... }` | No — literal; no version-integrity check exists anywhere | "Not recorded" (no derivable source exists) | Dormant |
| B3 | `lib/tender-stage-config.ts:335` | `{ type: "status", label: "Evaluation", state: "In Progress", ... }` | No — literal; ignores `client_evaluation.evaluation_status.overall_status` which is stored by ClientEvaluationStatusTab | Derive from stored `evaluation_status`; "Not recorded" | Dormant |
| B4 | `lib/tender-stage-config.ts:224` | `{ type: "status", label: "Legal Review", state: "Not Started", ... }` | No — literal; ignores `tender_drafting.departmental_reviews.legal` / block `legal_status` which are stored | Derive from stored legal review records | Dormant |
| B5 | `lib/tender-stage-config.ts:222-223` | Ops Review `reviewPct > 0 ? "In Review" : "Not Started"`; Finance Review `reviewPct >= 80 ? "Complete" : "Pending"` | Mislabeled proxy — `reviewPct` is pack-section drafting %, not ops/finance review data; and packs are always `[]` so it is frozen at "Not Started"/"Pending" | Derive from `departmental_reviews.{operations,finance}.submitted_at` | Dormant |
| B6 | `lib/tender-stage-config.ts:255, 152, 167` etc. | "Open Signals" / "Resource Burden" / "Complexity Risk" = `criticalGates + warnGates` rendered emerald at 0 | Computed over `ws.complianceItems` which is **never read** (stub `loaded:false`) — always 0/green | Respect `ws.riskInputsAssessed` (already exists, W04-C4) → "Not assessed" | Dormant |
| B7 | `lib/tender-stage-config.ts:137-139, 151, 165-166` | "Technical Fit"/"Customer Fit"/"Strategic Fit"/"Feasibility"/"Requirement Cover" gauges = `compliancePct`/`docsPct` | Computed over never-read collections and empty packs — always 0% | "Not assessed" per W04-C4 pattern | Dormant |
| B8 | `components/tender/ProposalBlockWorkbenchTab.tsx:818-821` | `✓ Tender bot connected — use ✨ AI Draft in the editor toolbar` (emerald, per expanded block) | No — unconditional literal; no bot lookup behind it, and AI Draft always throws `AI_UNAVAILABLE` (`lib/ai-runs.ts:445-456`) | Remove, or state "AI drafting not available in this build (Sprint X)" | **LIVE** |
| B9 | `components/tender/FinalApprovedStage.tsx:234, 454, 616, 730` | `saved={true}` → permanent green **"Saved"** badge (`ProcessStageTaskShell.tsx:74-78`, `data-testid="stage-save-status"`) on all 4 Final Approved tabs — including the Approval Record form while it holds unsaved edits | No — literal `true`; dirty state exists in the form but is not wired | Wire to actual dirty/save state (pattern exists: `ProposalBlockWorkbenchTab.tsx:724-725`) | **LIVE** |
| B10 | `components/tender/ApprovalMatrixStage.tsx:373, 609, 700, 766` | `saved={true}` → permanent green "Saved" on all 4 Approval Matrix tabs | No — literal | Same as B9 | **LIVE** |
| B11 | `components/tender/DepartmentalReviewTab.tsx:490`, `InternalReviewDashboardTab.tsx:136`, `InternalReviewExceptionsTab.tsx:~106` | bare `saved` prop → permanent green "Saved" | No — literal | Same as B9 | **LIVE** |
| B12 | `components/tender/IdentifiedStageShared.tsx:52` (+ Identified tabs passing only `unsaved={dirty}`) | After a successful save, badge falls to grey **"Not Saved"** (`ProcessStageTaskShell.tsx:79-82` default branch) | Inverse defect: save state IS derivable but `saved` is never passed | Pass `saved` on clean state after persist | **LIVE** |
| B13 | `components/tender/TenderGlobalIntelligenceDrawer.tsx:378-379` | Submission tile: `signalCount > 0 ? \`${signalCount} signals\` : "Ready"` — always renders emerald **"Ready"** | `signalCount` computed over never-read `ws.complianceItems` (`TenderWorkspace.tsx:1655-1657`) → always 0 | "Not assessed" (compliance never read) | **LIVE** (drawer reachable from every stage shell) |
| B14 | `components/tender/TenderGlobalIntelligenceDrawer.tsx:301, 327-329` | "Tender Readiness" gauge: `{readinessPct}%` + "Action Required" — always red 0% | `ws.readinessScore` is a mean over always-empty packs; header was corrected to "not measured (no packs configured)" (`TenderWorkspace.tsx:1709-1714`) but this drawer was not | "Not measured" | **LIVE** |
| B15 | `components/tender/TenderGlobalIntelligenceDrawer.tsx:451-461` | Stage Intelligence checks hardcoded `false`: P&L Pricing `[hasValue(pricingData), false, false, false]`; Tender Drafting last two `false`; Internal Review `[false,false,false,false]`; Approval Matrix `[false,false,false,false]` — recorded reviews/approvals can never display as done | No — literals; the data (departmental_reviews, approval_matrix.approvals) exists and is rendered correctly elsewhere (`PreviousStageIntelligence.tsx:543-566`) | Derive as PreviousStageIntelligence does | **LIVE** |
| B16 | `components/tender/TenderGlobalIntelligenceDrawer.tsx:443-449` | Solution Design checks read keys `solution_configuration`, `hop_operations_model`, `ham_manpower_model`, `hip_systems_ip_model`, `sla_kpi_model` | Wrong keys — writers store `configuration/hop/ham/hip/sla_kpi` (`supabase-tender-actions.ts:946`, `FinalApprovedStage.tsx:392`) → permanently false even with data | Read the real keys | **LIVE** |
| B17 | `components/tender/FinalApprovedStage.tsx:859-863` | Intel metric `Documents: ${docsUploaded}/${REQUIRED_DOCS.length} uploaded` | Denominator is the hardcoded 14-item constant (`:56-71`), not a recorded requirement set for this tender | `buildRequiredDocumentsProgress` (`tender-workspace-data.ts:548-583`) already implements the honest version — unused here | **LIVE** |
| B18 | `components/tender/FinalApprovedStage.tsx:635-644` | Submission Checklist per-row green "Uploaded" via `uploadedNames.some(n => n.includes(doc.doc.toLowerCase().split(" ")[0]))` — first-word fuzzy match ("OBK Signed/Stamped PDF" satisfied by any name containing "obk") | Exactly the pattern the W04-C4 comment says was removed (`tender-workspace-data.ts:522-535`: "fuzzy-matched on the FIRST WORD … None of that denominator belonged to the tender") — still live in this tab | Full-name match against a recorded set, or "Not recorded" | **LIVE** |
| B19 | `components/tender/TenderSubmissionGatesTab.tsx:100-129` | Heading "Current Readiness Signals **(Live from Supabase)**" + green-check rows: Compliance Matrix status `"ok"` and Placeholders `"ok"` (value "None") | Derived from never-read `complianceItems` and always-empty packs — green checks over unread data under a "Live" label | "Not assessed"; drop the "Live from Supabase" claim for stubbed inputs | Dormant (dead route, see §LB2) |
| B20 | `components/tender/TenderPlaceholdersTab.tsx:58`, `TenderComplianceMatrixTab.tsx:46` | Static modal text "Status changes persist to Supabase." | False — the wired actions always refuse (`disabledLegacyTenderChildWrite`) | Remove claim or state the disable | Dormant (dead route) |
| B21 | `components/tender/SubmittedVersionTab.tsx:5, 118` | Header comment "frozen read-only snapshot of proposal blocks"; green "Frozen" badge when `version_label`/`frozen_at` present | Nothing is frozen: the record is an editable form, blocks stay editable in Tender Drafting, no snapshot is taken | Label as "Version facts recorded (manual)"; drop "Frozen" | **LIVE** |
| B22 | `components/tender/SubmissionLogTab.tsx:~88` | Banner "This creates an immutable log entry for audit purposes." | False — writes a mutable `type_details.submission.submission_record` facet; audit append is best-effort/swallowed (§C/D) | State: manual record, overwritable, audit append not guaranteed | **LIVE** |
| B23 | `pages/TenderOverview.tsx:143-148` | `getTenderAttention` fallthrough `return { level: "green", label: "On Track" }` | Partially derivable, but absence collapses to green: a tender with no deadline, no GP, 0 days-in-status renders green "On Track" | Grey "Not enough data" when inputs absent | **LIVE** |
| B24 | `lib/tender-stage-config.ts:25-82` (`buildSignals`) | Compliance-gap / missing-doc signals | Can never fire (collections never read) — the signal panel is structurally blind while appearing watchful | Gate on `riskInputsAssessed` | Dormant |

---

## §A — Disabled / refusing operations

Write layer — `src/lib/supabase-tender-actions.ts`; all return `disabledLegacyTenderChildWrite(...)`: *"…is disabled until it is rebuilt on verified commercial_tickets lineage. Legacy tender child tables must not be repopulated."* (`:61-66`)

| # | Operation | file:line | UI caller | Verdict for the wave |
|---|---|---|---|---|
| A1 | `updatePlaceholderStatus` | `:1360-1370` | `TenderPlaceholdersTab.tsx:40` — modal "Mark as approved"; on failure `toast.warning('Status change failed — UI not blocked.')` | **IN SCOPE** (known stub, correction A). Note: route dead + `ws.placeholders` always empty → button currently uninvokable; lane must also restore a data source or retire the tab |
| A2 | `updateRequiredDocStatus` | `:1375-1384` | `TenderRequiredDocumentsTab.tsx:~44` (same pattern, "marked as approved") | **IN SCOPE** (known stub). Same reachability caveat |
| A3 | `updateComplianceStatus` | `:1389-1399` | `TenderComplianceMatrixTab.tsx:29, 114-116` — "Mark Compliant" button | **IN SCOPE** (known stub). Same caveat |
| A4 | `updatePackStatus` | `:1346-1355` | **none** (grep-verified) | Left-behind; retire or leave frozen |
| A5 | `updateGateStatus` | `:1404-1414` | **none** | **EXCLUDED** — standing ruling: gates stay advisory/disabled |
| A6 | `logMockBypass` | `:1419-1427` | **none** | **EXCLUDED** with gates |
| A7 | `logEmailSimulation` | `:1456-1463` — "Submission simulation is disabled until a verified submission workflow exists." | **none** | **EXCLUDED** (no submission simulation) |
| A8 | `insertTenderPackOutput` | `supabase-tender-data.ts:766-786` — `console.warn(...); return false;` | **none** | **EXCLUDED** (verified lineage required); left-behind |

UI-level controls that refuse or no-op:

| # | Control | file:line | Behaviour | Verdict |
|---|---|---|---|---|
| A9 | "Run Final Check" (enabled primary button) | `FinalApprovedStage.tsx:470-473` → `:421` `generateAIUnavailable()` throws `"Final Approval AI check is not available in this build (deferred to Sprint X - SX-001/SX-011)."` (`:39`) | Always `toast.error` — after performing 2 live `ai_bots`/`ai_bot_versions` reads (`:408-412`). No pre-click unavailability labeling | **EXCLUDED** (Sprint X AI stays refused) — but the unlabeled enabled button is a UX honesty gap for the closure narrative |
| A10 | "Run AI {Dept} Review" | `DepartmentalReviewTab.tsx:502-511` → `:31-33` throws same class | Refuses when any drafted blocks exist; the all-blocks-empty branch honestly persists NOT-DRAFTED flags (`:303-320`) | **EXCLUDED** (Sprint X) |
| A11 | "Generate TOC" (AI) | `ProposalArchitectureTOCTab.tsx:783` → `generateBlockContent` throws (`ai-runs.ts:445-456`); Auto-draft chain refuses before any write per SX-011 (`:475-479, 504-512`) | Always errors | **EXCLUDED** (Sprint X) |
| A12 | Editor "✨ AI Draft" | `ProposalBlockWorkbenchTab.tsx:585-654` | Always errors; §B8 badge claims it works | **EXCLUDED** (Sprint X); badge is correction-B |
| A13 | Pack advisory action buttons | `TenderWorkspace.tsx:2155` — `toast.info("Action not connected.", { description: "No workflow was created." })` | No-op toast | Left-behind (dead branch, §LB3) |
| A14 | "Document Output Disabled" + "Review Checks" | `TenderSplitPackGenerator.tsx:149-151` (disabled button), `:37-42` (`handleRunChecks` = setState + `toast.info` only, runs nothing) | Deliberate isolation of discontinued output studio | Left-behind (unreachable, §LB4) |
| A15 | RBAC absent | `InternalReviewStage.tsx:22` — "TODO: RBAC — filter visible tabs by user role when authentication is implemented." | All departmental review tabs visible/actionable by anyone | IN SCOPE flag (documented TODO) |
| A16 | Gate hardening | `TenderSubmissionGatesTab.tsx:92` — "TODO (Hardening): Define gate rules → wire enforcement → test…" | Advisory-only panel | **EXCLUDED** by ruling (gates stay advisory); tab itself dead (§LB2) |

---

## §C/D — Success-without-persistence & swallowed audit failures

**D1 (systemic, by design, documented):** every facet write reports success on the `commercial_tickets` row only; the `commercial_ticket_audit` append is fire-and-forget. `runBestEffortAuditWrite` (`supabase-tender-actions.ts:72-90`) is **not awaited**, races a 4s timeout, and on failure only `console.warn`s — *"Callers must not treat this as evidence that anything was stored"* (`:114-117`). Affected writers (~26): `updateTenderPhase`, `updateTenderCrmStage`, `updateTenderProbability`, `updateTenderTeamMembers`, `updateTenderExecutionScope`, `updateTenderSowData`, `updateTenderCustomerFitData`, `updateTenderSowQualificationData`, `updateTenderTechnicalQualificationData`, `updateTenderRiskSnapshotData`, `updateTenderBidNoBidData`, `updateTenderSolutionDesignData`, `updateTenderPricingData`, `updateTenderDraftingData`, `updateTenderApprovalMatrixData`, `updateTenderFinalApprovedData`, `updateTenderSubmissionData`, `updateTenderIdentifiedData`, `updateTenderClientEvaluationData`, `updateTenderClarificationData`, `updateTenderNegotiationData`, `updateTenderAwardedData`, `updateTenderLostWithdrawnData`, `addTenderDocument`, `updateTenderDocumentMetadata`, `changeTenderDocumentStatus`. User-facing success lines meanwhile read e.g. `toast.success('CRM Pipeline moved to X', { description: 'Persisted to Supabase.' })` (`TenderWorkspace.tsx:1745, 2305, 2338`) — true for the primary row, silent about the audit row that the Activity/Audit tabs then render from. Fixed exception: `createActivityNote` awaits + reads back the stored id (`:133-153, 1438-1451`), and both note UIs surface failure loudly (`TenderActivityTab.tsx:139-156`, `TenderGlobalIntelligenceDrawer.tsx:183-192`).

**D2 — phantom second audit stream:** `_insertAuditEvent` (`supabase-tender-actions.ts:322-339`) is `void params;` — a complete no-op — yet is called inside `Promise.all` by 12 writers (`:371, 417, 459, 499, 571, 625, 682, 737, 794, 853, 909, 961`), implying a second audit record that never existed.

**C1 — unchecked second write:** `ProposalArchitectureTOCTab.tsx:663` — `await updateTenderDraftingData(tenderId, "proposal_architecture", tocPayload, ...)` result ignored; success toast `"...blocks created from TOC."` (`:665`) fires even if the TOC-status write failed (the blocks write at `:648-649` IS checked).

**C2 — pre-save green status:** `SubmissionLogTab.tsx:~104-107` — the "Receipt Confirmed" dot renders emerald from **local component state** (`receiptConfirmed`) the moment the checkbox is toggled, before any save.

**C3 — "Saved" without dirty tracking:** stage shells passing `saved={hasStoredData}` (`SubmittedStage.tsx:218-226`, `AwardedStage.tsx:215-224`, `ClarificationStage.tsx:237-245`, `ClientEvaluationStage.tsx:271-281`, `NegotiationStage.tsx:217-226`, `LostWithdrawnStage.tsx:218-227`, `TechnicalVolumeTab.tsx:76`, `CommercialVolumeTab.tsx:76`) show green "Saved" while the user holds unsaved edits — data-presence, not save-state.

---

## §Fabricated records

| # | file:line | Fabrication |
|---|---|---|
| F1 | `ApprovalMatrixStage.tsx:235` | `decided_by: "Current User"` — literal string **persisted** as the approval decider, then displayed as the decider in Sign-off Log / Decision History / Governance Audit Trail (`:543, 667, 825`) and in FinalApprovedStage Approval Record (`FinalApprovedStage.tsx:822`). Real actor helper exists (`actor()`, `supabase-tender-actions.ts:54-57`); `TenderPnLCalculatorPanel` uses `user.name` correctly |
| F2 | `FinalApprovedStage.tsx:709` | `recorded_by: "Current User"` persisted on the final approval record; `:435` `ran_by: "Current User"` (currently unreachable path) |
| F3 | `supabase-tender-actions.ts:1480` + `DepartmentalReviewTab.tsx:227, 244, 263` | `updateBlockReviewStatus(..., reviewerName = "System")` default; approve/reject/reset omit the arg → `${dept}_reviewer: "System"` **persisted** with a fresh timestamp and displayed "Reviewed by: **System**" (`DepartmentalReviewTab.tsx:810`) for a human click. `InternalReviewExceptionsTab.tsx:~85` records the phrase `"Resubmitted by drafter"` as the reviewer name |
| F4 | `FinalApprovedStage.tsx:56-71, 622-650` | `REQUIRED_DOCS` — static 14-item array rendered as this tender's "Required Documents for Submission" (badge "14 items") with per-row Uploaded/Missing verdicts; comment claims "(from governance config)" but it is a code literal (see B17/B18); `:403` computes `missing_count: REQUIRED_DOCS.length - ws.documents.length` (can go negative) |
| F5 | `supabase-tender-data.ts:736-754` + `TenderGlobalIntelligenceDrawer.tsx:159-172, 197-200` | `fetchTenderActivityEvents` and `fetchTenderAuditEntries` read the **same** `commercial_ticket_audit` rows; the drawer merges both lists → every stored event appears **twice** in the unified timeline and "Total" = 2× the real row count |
| F6 | `TenderActivityTab.tsx:22-48`, `TenderAuditTrailTab.tsx:19-46` | Inverse fabrication: stored audit/activity rows whose text contains `mock/sample/simulated/fake/development mode/coming soon` are silently **hidden** from the operational timeline and the governance Audit Trail (a human note containing the word "mock" vanishes); all summary counters computed post-filter |
| F7 | `ScopeOfWorkCapture.tsx:285-294` | On mount seeds `DEFAULT_KPI_NAMES` rows into SOW state; saving untouched persists template KPI rows as captured scope (minor — names only, values empty) |
| F8 | `SubmittedStage.tsx:96-101, 128-133, 160-165` | Section menus present two distinct views ("Submission Record"/"Receipt Confirmation", "Version Snapshot"/"Block Snapshot", "Pipeline Transition"/"Sync Details") that render the **same component twice** — implied views that don't exist |

---

## §Shared-file map (blast radius for build lanes)

| File | Tender lanes that would touch it | Non-tender consumers (breakage risk) |
|---|---|---|
| `lib/supabase-tender-actions.ts` | A (stubs), C/D (audit), F (actors) | **None** — tender-exclusive (62 tender importers + `TenderKnowledgeBaseSection`) — safe lane ownership |
| `lib/supabase-tender-data.ts` | B (stub reads), C/D | Only `hooks/useTenderWorkspaceData` + `TenderWorkspace` — tender-exclusive |
| `lib/tender-workspace-data.ts` | B (progress helpers) | Tender-exclusive (all importers are tender surface) |
| `lib/tender-stage-config.ts` | B (all four known verdicts) | Tender-exclusive (only `TenderWorkspace.tsx`) |
| `lib/tender-engine.ts` | B (labels/colors) | **`lib/supabase-data.ts`** (system-wide store) — edits here ripple beyond tender |
| `lib/tender-type-details.ts` | any normalization change | **`lib/supabase-data.ts`** — shared with system store |
| `lib/tender-stage-source-truth.ts` | routing/stage truth | `lib/tender-ticket-adapter.ts` → **TenderOverview/TenderPortfolio pages** |
| `lib/tender-pricing-types.ts` | B | Tender-only + tender libs |
| `lib/process-isolation.ts` | read-layer guards | **`crm-sync-engine`, `intake-save`, `pipeline-tickets`, `supabase-data`, `pages/Dashboard`, `pages/PdfStudio`, `components/WorkspaceSlaContractSection`** — high blast radius, do not edit in a tender lane without integration sign-off |
| `lib/ai-runs.ts` | A (refusal text), left-behind AI paths | **`lib/supabase-data.ts`**; Sprint-X boundary file — frozen by ruling |
| `lib/document-vault.ts` | document upload/link | **`components/DocumentViewer`, `components/proposal-workspace/SupportingDocumentsPanel`, `pages/ProposalWorkspace`** — shared with Proposal surface |
| `lib/pipeline-tickets.ts` | Overview/Portfolio pages | **CrmPipeline, CustomerCommandCenter, ProposalOverview, ProposalPortfolio, `components/crm/PipelineCard`** |
| `lib/unified-ticket-types.ts` | adapter edits | **UnifiedIntakeModal, commercial-runtime, supabase-commercial-data, supabase-data** |
| `lib/intake-save.ts` | (read-only for tender) | **UnifiedIntakeModal, commercial-runtime, supabase-commercial-data, supabase-data, CrmPipeline** |
| `components/process/ProcessStageTaskShell.tsx` | B9-B12 ("Saved" badge semantics) | **`components/proposal-workspace/ProposalStageWorkbench.tsx`** — changing badge logic hits Proposal stage shells |
| `components/proposal-workspace/CrmPipelineStrip.tsx` | CRM strip behaviour | **ProposalOverview, ProposalWorkspace** |
| `pages/PdfStudio.tsx` (route target of `/tenders/:id/final-pack`, `CleanApp.tsx:102`) | final-pack tender path | Shared final-pack studio (proposal/standalone sources; FPS-validated) — treat as separate surface |
| `lib/tender-ticket-adapter.ts`, `lib/tender-local-intelligence.ts`, `lib/tender-knowledge-base.ts`, `components/tenders/*`, `components/orchestration/TenderOrchestrationReviewSection` + `lib/orchestration*` | pages/panels | Tender-exclusive |
| `lib/crm-sync-engine.ts` | — (tender CrmSyncTab does **not** use it; manual record only) | **Admin, CRMSyncBadge** — out of tender lanes |
| `lib/workspace-integration.ts` | — no tender path (renewals/supporting docs) | Renewals surface — out of wave scope, no tender coupling found |

---

## §Left-behind candidates

| # | Item | Evidence |
|---|---|---|
| LB1 | `buildStageConfig` indicators/signals/nextAction — computed, never rendered | sole import `TenderWorkspace.tsx:34`; only `.tabs` consumed (`:1572-1576`). Contains B1-B7. Superseded by per-stage intel metrics in stage components |
| LB2 | Generic tab routing block `TenderWorkspace.tsx:2182-2187` — unreachable | every tabId it matches is either produced by no stage tab list (`placeholders`, `required_documents`, `technical_evidence`, `compliance_alignment`, `activity`, `response_history`) or intercepted first by stage-guarded routes at `:1978-2010` / `:2169-2180` (`submission_readiness`, `audit_trail`, `approval_record`, `compliance_matrix`, `clarification_log`, `negotiation_log`, `submission_log`); `default` stage config unreachable (stage normalizer total, `tender-stage-source-truth.ts:224-229`). Dead as routed: **TenderPlaceholdersTab, TenderComplianceMatrixTab, TenderRequiredDocumentsTab, TenderSubmissionGatesTab** (each imported only by `TenderWorkspace.tsx`, grep-verified). `TenderActivityTab`/`TenderAuditTrailTab` stay **alive** via stage components (Awarded/Clarification/ClientEvaluation/LostWithdrawn/Negotiation/Submitted imports, verified) |
| LB3 | Pack workbench branch `TenderWorkspace.tsx:2012-2167` — unreachable (`packs`/`tender_builder` in no stage list; `final_pack`/`submitted_version` intercepted at `:1978/:1983`; `ws.packs` always `[]`). Includes `PackCard` (`:1457-1490`, zero call sites), "Review Submission Email" button (`:2022`), no-op advisory buttons (`:2155`), `cleanProcessCopy`/`getCleanPackActionLabel` usages |
| LB4 | `TenderSplitPackGenerator` + `TenderSubmissionEmailReview` — only openable from LB3 (`splitGenOpen`/`emailSimOpen` set nowhere else, `:1553-1554, 2281-2282`); SplitPackGenerator additionally `if (!masterPack) return null;` with packs always empty |
| LB5 | Zero-caller disabled writers: `updatePackStatus`, `updateGateStatus`, `logMockBypass`, `logEmailSimulation`, `insertTenderPackOutput` (A4-A8; gates ones frozen by ruling, not deletable without a ruling) |
| LB6 | `_insertAuditEvent` no-op (`supabase-tender-actions.ts:322-339`) + its 12 call sites |
| LB7 | Unreachable AI success paths (dead code after always-throwing generation): `FinalApprovedStage.tsx:423-439` (incl. `toast.success('Final Approval Check: …')`), `DepartmentalReviewTab.tsx:378-460`, `ProposalArchitectureTOCTab.tsx:358-397, 406-422`, `ProposalBlockWorkbenchTab.tsx:645-647` + `handleAIDraftAction :656-710` (aiDrafts never populated), `BlockChainProgressPanel.tsx` (chain refuses before progress renders) |
| LB8 | Read-layer stubs feeding only dead surfaces: `fetchTenderPacks/Placeholders/SplitChecks/PackOutputs/SubmissionEmails` (`supabase-tender-data.ts:700-708, 756-764, 788-791`); bundle fields frozen at `crmSyncStatus:'not_synced'`, `submissionModel:'single_pack'` (`:900-901`) rendered as header badge "CRM: Not Synced" (`TenderWorkspace.tsx:1688`) |
| LB9 | Stale comments claiming absent behaviour: `SubmittedVersionTab.tsx:5` ("frozen read-only snapshot"); `FinalApprovedStage.tsx:54` ("from governance config"); `DepartmentalReviewTab.tsx:1-12` header describing an AI review flow that refuses; `SubmissionLogTab` immutability banner (B22); `TenderPlaceholdersTab.tsx:58`/`TenderComplianceMatrixTab.tsx:46` persistence claims (B20) |
| LB10 | Duplicate-section shells (F8) — second section entries superseded/never differentiated |

---

## §Counts summary

| Category | Count | Of which LIVE (user-visible today) |
|---|---|---|
| §B false signals | 24 findings (B1-B24) | 14 live (B8-B18, B21-B23); 10 dormant incl. all 4 known suspects (B1-B4) |
| §A disabled/refusing ops | 16 (8 write-layer, 6 UI controls, 2 TODO declarations) | 3 known stubs IN SCOPE for correction A (A1-A3); 6 EXCLUDED by standing rulings (gates A5-A6, submission sim A7, lineage A8, Sprint-X AI A9-A12 behaviour); 2 zero-caller left-behind |
| §C/D success-without-persistence | 4 patterns; D1 spans ~26 writers + 12 no-op audit call sites | All live on every tender save |
| §Fabricated records | 8 clusters (F1-F8) | F1-F3 persist fabricated actor identities into stored records — highest severity |
| §Shared files flagged | 20 mapped; 7 high-blast-radius (process-isolation, supabase-data-coupled tender-engine/type-details, ProcessStageTaskShell, CrmPipelineStrip, document-vault, pipeline-tickets, PdfStudio) | — |
| §Left-behind candidates | 10 clusters, incl. 6 unreachable components and ~800 lines of dead routing/AI-success code | — |

**Sharpest correction targets for the wave:** B1-B4 sit in one dormant file (`tender-stage-config.ts`) — deletable or derivable without UI risk; the highest *live* dishonesty is the hardcoded "Saved" badges (B9-B11), the unconditional "✓ Tender bot connected" (B8), the always-"Ready" submission tile (B13), the hardcoded-false stage checks (B15-B16), the REQUIRED_DOCS fuzzy checklist (B17-B18), and the persisted "Current User"/"System" actor fabrications (F1-F3). Findings only; no fixes applied.
