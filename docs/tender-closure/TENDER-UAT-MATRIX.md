# TENDER-UAT-MATRIX
**Wave:** Tender Functional Closure · **State:** EXECUTED — one consolidated authenticated session (Amin Al-Rashid, admin) · **Tree under test:** integration `276a28d` served at http://localhost:5310 (Vite dev + tsx server on 5311) · **Date:** 2026-08-21

## Protocol (as executed)
One UAT tender was created through the clean intake (exact id captured below). For every one of the 15 stages: open → enter identifiable content (`TCW-UAT-S<n>-819` markers; numeric markers where fields are numeric) → save → reload → confirm exact content → edit → reload → confirm the edit → verify adjacent-stage facets untouched. Then: the three submission-readiness registers, supporting-document upload/classify/listing, activity note, CRM + Internal tracker independent moves, FinalPack handoff, PDF export content check. The browser was the architect's own Chrome (Claude-in-Chrome extension), signed in personally by the architect — no credentials were ever handled by the orchestrator. Verification was double-sourced on every step: on-screen read-back **plus** an independent read-only DB probe (`.tcw-evidence/uat-probe.mjs`, anon key) against `commercial_tickets.type_details`.

Linde (`7483c493-0098-40a9-9e5f-76007bc62cd1`) was READ-ONLY reference throughout — verified unchanged at close (updated_at `2026-08-19T09:38:11.074248+00:00`, audit count 194, both identical to wave start).

## Captured ids
| Record | Exact id | Created | Deleted |
|---|---|---|---|
| UAT tender (`commercial_tickets`) | `09f1e3fd-f96e-4ac9-92dc-156d44280874` — "TCW UAT Tender - 2026-08-21" | via clean intake, 2026-08-21 | ✅ service-role DELETE by `id=eq.`, 1 row returned, read-back 0 |
| Audit rows (`commercial_ticket_audit`) | 46 rows scoped `ticket_id=eq.09f1e3fd-…` | during UAT | ✅ 46 rows returned by DELETE, read-back 0 |
| FinalPack instance (`doc_instances`) | `420e4411-2c19-4ab5-a633-08df76ceac4f` | via Final Pack Studio | ✅ deleted through the app's own authenticated client, read-back 0 |
| Upload vault row (`generated_documents`) | `0e01655a-c95e-423f-a79f-bcf9232fc244` | via document upload | ✅ service-role DELETE by `id=eq.`, 1 row returned, read-back 0 |
| Storage object (`documents` bucket) | `customers/unknown/workspaces/unassigned/Tenders/2026-08-21-TCW_UAT_DOC_819_Technical_Compliance_Sta-dad9f47c.txt` | via document upload | ✅ storage DELETE 200 "Successfully deleted", list read-back 0 |
| Local temp upload file | `C:\Temp\TCW-UAT-DOC-819 Technical Compliance Statement.txt` | for the upload step | ✅ removed |

Post-cleanup DB population = exactly the pre-UAT population: Linde tender + KAFD proposal only (verified by full ticket listing).

## Stage results
All stages: content entered with the stage marker, saved, browser reloaded, content confirmed on screen **and** via DB probe, edited, reloaded again, edit confirmed, and the other stages' facets verified untouched (final probe shows all 16 `type_details` facets coexisting with zero clobber).

| # | Stage | Save | Reload | Edit | Re-reload | Adjacent intact | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Identified | ✅ | ✅ | ✅ | ✅ | ✅ | `identified` facet; marker `TCW-UAT-S1-819` probe-true at close |
| 2 | Qualification | ✅ | ✅ | ✅ | ✅ | ✅ | `sow_qualification_data`; marker probe-true |
| 3 | Bid / No-Bid | ✅ | ✅ | ✅ | ✅ | ✅ | `bid_no_bid_data`; honest "Not decided yet" before outcome recorded |
| 4 | Solution Design | ✅ | ✅ | ✅ | ✅ | ✅ | `solution_design_data`; an initial empty-note save (typing race) was caught by the DB probe and redone — the probe catching it is itself evidence the verification loop is honest |
| 5 | P&L / Pricing | ✅ | ✅ | ✅ | ✅ | ✅ | numeric fields — markers used were value **SAR 819,000** / GP **21%** (text markers don't fit numeric inputs); both render in the workspace header after reload and `819000` is probe-true in `pricing` |
| 6 | Tender Drafting | ✅ | ✅ | ✅ | ✅ | ✅ | `tender_drafting.proposal_blocks`; block body `TCW-UAT-S6-819 body text for PDF export.` + `-EDIT` suffix — this exact text later appeared in the FinalPack preview and the PDF export window |
| 7 | Internal Review | ✅ | ✅ | ✅ | ✅ | ✅ | review state lives on the drafting blocks — `ops_reviewer` = "Amin Al-Rashid" with real timestamps (actor-truth check), probe-true |
| 8 | Approval Matrix | ✅ | ✅ | ✅ | ✅ | ✅ | `approval_matrix`; `decided_by` = real signed-in user |
| 9 | Final Approved | ✅ | ✅ | ✅ | ✅ | ✅ | `final_approved`; checklist derives from this tender's registers + block reviews ("data sourced from this tender only" wording live) |
| 10 | Submitted | ✅ | ✅ | ✅ | ✅ | ✅ | `submission`; honest non-frozen wording visible (no false "records frozen" claim) |
| 11 | Clarification | ✅ | ✅ | ✅ | ✅ | ✅ | `clarification`; marker probe-true |
| 12 | Client Evaluation | ✅ | ✅ | ✅ | ✅ | ✅ | `client_evaluation`; no fabricated "In Progress" default — state reflects entered data only |
| 13 | Negotiation | ✅ | ✅ | ✅ | ✅ | ✅ | `negotiation_data`; marker probe-true |
| 14 | Awarded | ✅ | ✅ | ✅ | ✅ | ✅ | `awarded_data`; edit marker `TCW-UAT-S14-819-REF-EDIT` probe-true at close |
| 15 | Lost / Withdrawn | ✅ | ✅ | ✅ | ✅ | ✅ | `lost_withdrawn_data`; marker probe-true; recording it did NOT gate or corrupt other stages (free movement preserved) |

Final-close probe (2026-08-21, after all steps, before cleanup): 13/15 dashed markers `true`, S5 via `819000` `true`, S7 via `ops_reviewer`+actor `true`, `-EDIT` `true` — all 15 stages simultaneously holding their saved content in one `type_details` document with 16 facets and zero cross-stage clobber.

## Cross-cutting results
| Check | Result | Evidence |
|---|---|---|
| Placeholders register (add/edit/status/reload) | ✅ | `TCW-UAT-REG-819` row added; per-item status change by exact row id; "Confirmed against the stored register" toast; probe-true in `submission_readiness` at close |
| Required documents register (+linked upload) | ✅ | register row + status transition (missing → uploaded via Radix select); confirmed-against-register toast; survives reload |
| Compliance register (+evidence field) | ✅ | register row with evidence text; status transition; confirmed toast; survives reload |
| Supporting document upload → classify → listing | ✅ | `TCW-UAT-DOC-819 Technical Compliance Statement` uploaded through the 3-step chain — toast "Document uploaded to tender documents. Storage, vault record and tender listing all confirmed"; classified Source – Technical Requirements v1, Qualification stage; appears in drawer groupings (Qualification / Source / Recently Added) after reload; audit row `field_changed: documents 0→1` |
| Activity note + history after reload | ✅ | `TCW-UAT-NOTE-819 activity note` present in `commercial_ticket_audit.notes` after reload |
| CRM tracker move (independent) | ✅ | `crm_pipeline_stage = qualified`; header "Saved CRM stage: qualified" |
| Internal stage move (independent; both survive reload) | ✅ | `internal_stage = qualification`; both pointers re-confirmed by DB probe and on-screen after final reload; advisory (non-blocking) confirm dialog on movement |
| Stage meters reflect saved work | ✅ | stage-task meters show filled segments for stages with saved content after reload (e.g. SOW Qualification green); header GP/value tiles show the saved SAR 819,000 / 21% |
| Stale-edit protection | ✅ (automated) | not re-run live in the human UAT (not in the wave's human-UAT list); covered by the P2 save/read-back contract tests in the 945-test suite — stale revision token → honest `stale` outcome, zero-row disambiguation, no silent overwrite |
| Actor truth across the trail | ✅ | all 46 audit rows `user_name = "Amin Al-Rashid"`; `ops_reviewer`/`decided_by`/`recorded_by`/`updated_by` all the real signed-in user; zero "Current User"/"System" literals |
| Audit honesty | ✅ | every save produced a persisted audit row (46 total for the session); no silent-success paths observed |
| FinalPack handoff loads the UAT tender's edited blocks | ✅ | Full Commercial Proposal instance `420e4411…` (13 blocks); preview iframe contained `TCW-UAT-S6-819`; instance resumed after full page reload twice ("Resume Existing … draft · updated 21 Aug 2026") |
| PDF export contains the edited content | ✅ | trusted-click "Final PDF" invoked the print pipeline — export window `TCW_UAT_Tender_-_2026-08-21_FINAL_2026-08-21` contained the complete document: branded cover (TCW UAT Tender - 2026-08-21 · Ref 09f1e3fd · Prepared for TCW UAT Customer), ToC, and the exact edited block text `TCW-UAT-S6-819 body text for PDF export.` + `-EDIT` (full text extracted). Honesty checks: an untrusted (scripted) click produced "Export failed — Could not open the print window…" with no false success; the pipeline message states it cannot confirm the file write (the physical PDF byte-write is Chrome's native Save-as-PDF dialog — outside DOM automation reach). Same-document guarantee: stage-6 save → `tender_drafting.proposal_blocks` → FinalPack loader → preview → export window all carried the identical marker text. |
| Cleanup by exact id; Linde untouched | ✅ | table above; Linde `updated_at` and 194 audit rows byte-identical to wave start; remaining tickets = Linde + KAFD only |

## Observations (non-blocking, recorded for the drift register)
1. **Upload dialog requires Owner** — `canSave` demands owner text; the disabled Upload button gives no inline hint which field is missing. Friction, not a defect.
2. **SowQualification snapshot residue** — a "READINESS 0%" fragment renders in the Tender Intake Snapshot panel even with no packs configured; header readiness is honest ("not measured (no packs configured)"), so this is cosmetic residue in one sub-panel.
3. **PDF export under automation** — the print pipeline requires a trusted user gesture (pop-up rules) and ends at a native dialog; both failure modes surface honest messages. By design the app never claims a file was written.
4. **Driving-tool incidents (not app defects)**: renderer screenshot timeouts while `window.print()` was pending; one stray text entry into a background page input during an unscoped `querySelectorAll` (page-state only, cleared on reload, no persisted effect — verified by probe).
