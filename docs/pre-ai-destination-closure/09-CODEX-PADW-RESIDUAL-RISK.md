# Pre-AI Destination Closure - Residual Risk Register

**Date:** 2026-08-25

**Boundary:** Only remaining human-workflow and PDF delivery risks. Sprint X and AI runtime design are excluded.

## Current Residuals

| ID | Residual | Impact | Disposition |
|---|---|---|---|
| PADW-R1 | Native Print / Save as PDF opens the browser's print workflow, so the app cannot prove the user completed the operating-system save dialog. | Low functional risk; the correct edited document reaches the print workflow, but final filesystem save is outside browser control. | Keep as an honest product limitation. Automated export and fidelity tests pass. |
| PADW-R2 | Several production chunks exceed 500 kB, including Tender Workspace and PDF Studio. | Slower first load on weak connections; no data-loss or correctness impact found. | Performance optimization after functional MVP, before broad production rollout. |
| PADW-R3 | The two exact synthetic UAT tickets and their pack/audit rows remain because the available database execution channel is read-only for mutations. | Test-data clutter only; all system data is currently test data per architect ruling. | Remove later through an architect-approved writable database channel or a real product delete workflow. Exact IDs are in the closure evidence. |
| PADW-R4 | FinalPack has truthful missing-source warnings where the UAT records contain no pricing scenarios or other source material. | Exported content remains incomplete until users or future AI populate those source destinations. | Expected data condition, not a wiring defect. |
| PADW-R5 | Four verified PDF commercial-grade gaps remain: exports are not written to the document vault; `doc_instances.updated_at` has no database trigger; instance-version numbering still uses client-side `max + 1`; replacing or removing a cover does not remove the previous private-bucket object. | May affect archive automation, concurrent editing, or storage cleanup under production scale. Direct human export still works. | Close in the PDF Studio completion programme; these do not block tracker persistence or direct export testing. |

## Go / No-Go Statement

**GO for the next AI integration build phase** against the Tender and Proposal destination contracts.

**Not yet a claim of AI production readiness.** The extraction runtime, document parsing, confidence/provenance payloads, preview-and-accept behavior, bot selection, run logging, and Tender/Proposal-specific bot instructions still have to be built and tested through the Admin/Bot system.

No workflow gate, lock, approval enforcement, security control, AI policy, or compliance mechanism was added in this closure pass.
