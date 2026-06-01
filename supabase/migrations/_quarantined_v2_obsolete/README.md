Commercial V2 Quarantine
========================

These SQL files are obsolete prototype migrations. Do not run them as part of the active Hala Commercial Engine schema.

Reason:
- The V2 pages were a test path and are no longer the approved architecture.
- Live Supabase inspection on 2026-05-20 showed only `commercial_v2_documents` exists; the main V2 ticket/proposal/tender/approval/activity tables were not present in the schema cache.
- The unified intake system must not be built on `commercial_v2_*`.

Current doctrine:
- CRM Pipeline is the parent revenue truth.
- Proposal, Tender, Renewal, and SLA must use an approved non-V2 intake architecture after human sign-off.
- No bot may run these migrations or use these files as production source of truth.

