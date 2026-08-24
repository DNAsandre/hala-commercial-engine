# 10 — SPRINT X DEFERRED OBSERVATIONS
Per the audit's human-first boundary these are **observations only — no solutions designed or debated here**.

1. Block-AI execution, AI audit logging, and AI output validation are excluded from this build (runtime refuses with "deferred to Sprint X - SX-001/SX-011"); sparkle menus list bots as runnable before the refusal.
2. Stage-9 "Final Approval Check" bot run is likewise a refusal stub, and its stored verdict still feeds the advisory "Ready for Assembly" badge.
3. Governance enforcement remains advisory ("advisory before Sprint X" labeling in GovernanceConsole); no `bot-governance.ts` mock exists in this repo.
4. A server-side faithful HTML→PDF renderer is referenced by both the inert `VITE_FPS_SERVER_PDF` flag and the deliberate 501 route, and does not exist.
5. The anon key can list the private `documents` storage bucket's folder structure, and `commercial_tickets`/`commercial_ticket_audit` remain anon-readable — the standing Wave-0 CRITICAL RLS finding, reconfirmed in passing; no hardening proposed here.
6. `fetchAllFinalPackInstances` returns every account's final-pack documents to any signed-in `/pdf-studio` user with no ownership scoping.
7. The loader ingests drafted blocks regardless of `approval_status`/departmental review outcomes while Stage 9 presents approval counts alongside the always-enabled studio link.
8. Legacy dead modules (`supabase-sync.ts` doc-instance paths, the unused hook save family) are candidates for ordinary deletion in a future sprint.
9. A periodic read-only reconciliation report across storage/vault/register stores would surface the orphan classes recorded in doc 07 (observation only).
10. Bundle size: 5 chunks exceed 500kB (PdfStudio 636kB, html2pdf 976kB, TenderWorkspace 1,189kB).
11. Autosave/undo/renderer test coverage gaps (doc 09) noted for a future hardening sprint.
