# TENDER-UAT-MATRIX
**Wave:** Tender Functional Closure · **State:** PREPARED — awaiting the authenticated session (one consolidated sign-in) · **Tree under test:** integration `0035872` served on the dev stack

## Protocol
One UAT tender is created through the clean intake (its exact id captured here at creation). For EVERY one of the 15 stages: open → enter identifiable content (`TCW-UAT-<stage>-819`-style markers) → save → reload the browser → confirm exact content → edit → reload → confirm the edit → verify adjacent-stage data untouched. Then: placeholders + required documents + compliance registers (add rows, statuses, reload), supporting document upload/classify/link/download, activity history (add note, reload), CRM tracker + Internal tracker independent moves, FinalPack handoff, PDF export (content spot-check against the edited blocks). Linde (`7483c493-…`) is READ-ONLY reference — never edited. Cleanup: delete ONLY the captured UAT records by exact id (audit rows first — FK RESTRICT), verified gone.

## Captured ids
| Record | Exact id | Created | Deleted |
|---|---|---|---|
| UAT tender | — | — | — |
| doc_instances (FinalPack) | — | — | — |
| generated_documents (upload) | — | — | — |
| storage object path | — | — | — |

## Stage results
| # | Stage | Save | Reload | Edit | Re-reload | Adjacent intact | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Identified | — | — | — | — | — | |
| 2 | Qualification | — | — | — | — | — | |
| 3 | Bid / No-Bid | — | — | — | — | — | |
| 4 | Solution Design | — | — | — | — | — | cross-tab clobber regression check: save two tabs sequentially |
| 5 | P&L / Pricing | — | — | — | — | — | |
| 6 | Tender Drafting | — | — | — | — | — | blocks feed the PDF later |
| 7 | Internal Review | — | — | — | — | — | reviewer = real user check |
| 8 | Approval Matrix | — | — | — | — | — | decided_by = real user check |
| 9 | Final Approved | — | — | — | — | — | registers + checklist derivation |
| 10 | Submitted | — | — | — | — | — | honest non-frozen wording visible |
| 11 | Clarification | — | — | — | — | — | |
| 12 | Client Evaluation | — | — | — | — | — | |
| 13 | Negotiation | — | — | — | — | — | |
| 14 | Awarded | — | — | — | — | — | |
| 15 | Lost / Withdrawn | — | — | — | — | — | |

## Cross-cutting results
| Check | Result | Evidence |
|---|---|---|
| Placeholders register (add/edit/status/reload) | — | |
| Required documents register (+linked upload) | — | |
| Compliance register (+evidence field) | — | |
| Supporting document upload → classify → stage link → download | — | |
| Activity note + history after reload | — | |
| CRM tracker move (independent) | — | |
| Internal stage move (independent; both survive reload) | — | |
| Stage meters reflect saved work (non-zero after entry) | — | |
| Stale-edit protection (two-tab concurrent edit → honest stale, no data loss) | — | |
| FinalPack handoff loads the UAT tender's edited blocks | — | |
| PDF export contains the edited content (spot text check) | — | |
| Cleanup: UAT records deleted by exact id, verified gone; Linde untouched (audit count + updated_at unchanged) | — | |
