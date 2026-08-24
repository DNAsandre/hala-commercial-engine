# Proposal Left-Behind Inventory

**Date:** 2026-08-24  
**Purpose:** Keep remaining work visible without blocking ordinary human Proposal use.

| # | Remaining item | Impact now | Treatment |
|---:|---|---|---|
| P-01 | Controlled live write/reload UAT has not yet been run across all 11 stages | Automated contracts are green, but 100% human acceptance is not yet proven | Run one dedicated UAT Proposal and remove only its captured records afterward |
| P-02 | The inspected Proposal has no P&L/pricing scenario | PDF Studio honestly shows pricing as not captured | Populate a UAT P&L, carry it into Quote, then verify PDF pricing |
| P-03 | Existing Final Pack contains default template prose where Proposal content is absent | Preview works, but defaults are not customer-specific Proposal truth | Future drafting/AI work must replace defaults with recorded Proposal content; never present defaults as extracted facts |
| P-04 | Final browser export opens the browser/print workflow | The app can prepare the correct document but cannot prove that the human saved the OS/browser file | Verify visually during UAT; this is a browser boundary, not a hidden success claim |
| P-05 | External CRM synchronization remains unavailable | Manual trackers work; outbound CRM actions do not | Keep honestly unavailable until its separate runtime integration sprint |
| P-06 | AI assistants shown by Final Pack have no activated Proposal-generation runtime in this closure | Manual Proposal/PDF workflow works; AI generation is not claimed | Start AI integration only after controlled Proposal UAT confirms every destination |
| P-07 | Dormant non-commercial legacy branches still exist in the shared `ProposalWorkspace.tsx` module | They are not reached by the clean commercial Proposal route, but they add code clutter | Remove in a bounded cleanup after UAT, without changing the working commercial path |

## Not left behind

- No clean Proposal route links back to old-app source.
- No separate Proposal PDF engine was created.
- No hard-coded Admin knowledge base was added.
- No mock Proposal records, fake counters, fake audit results, or fake AI results were added.
- No workflow gate, approval lock, AI activation, or security hardening was added.
