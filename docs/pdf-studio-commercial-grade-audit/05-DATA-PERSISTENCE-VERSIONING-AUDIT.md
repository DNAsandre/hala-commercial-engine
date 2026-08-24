# 05 — DATA PERSISTENCE & VERSIONING AUDIT
**Baseline:** `e0c7062` · Tables: `doc_instances`, `doc_instance_versions`, `doc_compiled_outputs` (all exist live — 200 `[]` under anon = table present, contents authenticated-only). Register refs → [07](07-DEFECT-AND-GAP-REGISTER.md).

## Contract table
| Behavior | Verdict | Key evidence |
|---|---|---|
| Create instance | COMPLETE (caveat) | client UUID, insert-only, documented select-after-insert avoidance, honest error (`useFinalPackInstance.ts:209-256`); 20s-timeout orphan edge (PDS-55); **no read-back on create** |
| Load / list | COMPLETE + TESTED | three-state honest (error ≠ not-found ≠ loaded); list filters exact (`:470-497`); `final-pack-reads.test.ts` |
| Active autosave (`PdfStudio.tsx:178-228`) | PARTIAL | 2s debounce; exact-id + `.eq("updated_at", token)` optimistic concurrency; `.select("id")` zero-row detection; conflict banner Keep-mine/Reload-latest; honest "Not saved"+Retry. Gaps: **no payload read-back** (row-match only), **no zero-row disambiguation** (deleted/RLS masquerade as conflict), **false conflict after branding change destroys trust** (PDS-13 HIGH) |
| Legacy hook save path | DEFECTIVE, latent | `saveInstance`/`updateBlocks`/`updateStatus`/`updateBranding`: no token, no read-back, success=error:null, console-only failures — **zero callers** (PDS-56) |
| Versioning | COMPLETE writes / PARTIAL feature | real `doc_instance_versions` appends (post-confirmed-save, ≥30s throttle) + History UI + explicit restore; restore is **blocks-only** despite migration intent (PDS-53); `max+1` client-side numbering race (PDS-52) |
| `updated_at` trigger | ABSENT (reverified in DDL) | token is client-authored convention — any non-convention writer breaks protection silently (PDS-51) |
| Status lifecycle | DEFECTIVE (vestigial) | `draft|compiled|exported` typed; no transition ever; export writes only audit rows. **Live-confirmed: all 4 instances "draft"** incl. previously-exported ones (PDS-42) |
| Actor truth | PARTIAL | `created_by` real-or-"Unauthenticated"; version rows real; `last_edited_by` never written; `"User"` literal fallback in `useInstanceVersions.append` (unreachable today) + `saveRecipeVersion` hardcoded "User" (reachable — PDS-54) |
| Source snapshot | PARTIAL | rich at creation (`_hash`, `_original_blocks`, source data, layout, volumes); never versioned, never refreshable; "Refresh from source" restores stale (PDS-05) |
| `normalize-final-pack-snapshot` | COMPLETE | display-only defaults, honestly flagged `*_legacy`, never mutates rows — no data loss |

## Vs the tender-wave save-contract standard
`commercial_tickets` writes: server-authored revision (DB trigger) + exact-id + expectedRevision + zero-row **recheck disambiguation** (`stale`/`not_found`/`failed`) + read-back + audit row per save. `doc_instances` falls short on: client-authored token (no trigger), no disambiguation, self-inflicted token break (branding), no typed outcome, no per-save audit, no payload read-back. Two-tab FPS↔FPS editing genuinely works (both follow the convention) with explicit non-trapping recovery; outside that pairing protection degrades to false positives or silent last-write-wins.

## Test coverage
Directly tested: list reads, drift honesty, export audit persistence, date rendering. **Untested: the entire active save path** (token guard, zero-row, conflict, retry), createInstance, version append/restore, branding persistence — the most safety-critical persistence code has zero automated coverage (PDS-73).

## Completeness: **~68%**
Real optimistic-concurrency autosave with honest failure UI and real versioning — nothing Potemkin — but one live false-conflict defect, missing read-back/disambiguation, vestigial status, blocks-only restore, and no tests on the critical path.
