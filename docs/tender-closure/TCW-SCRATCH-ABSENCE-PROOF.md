# TCW-SCRATCH old-app-absence proof (verbatim; PASS at 0035872)

> Extracted verbatim from the lane agent's final report.

Scratch deleted and confirmed gone; C:\Temp is back to its pre-existing state (only `md2docx`). All steps complete. Final report follows.

---

# TCW-SCRATCH — Old-App-Absence Proof

**VERDICT: PASS**
**HEAD proven: `003587293da25c4853301a63bf7c4e1f676df2b2`** (integration worktree `C:\ANtigravity Apps\Hala App - Amin review\.tcw-trees\integration`)

The integrated tree was extracted via `git archive` into `C:\Temp\tcw-scratch` (old app never present in the scratch), and there it installed, typechecked, tested, built, and served — with live auth-gated API behavior and live DB reachability — with zero executable reference to the old application.

## Command / exit-code table

| # | Step | Command (in scratch unless noted) | Exit | Result |
|---|------|-----------------------------------|------|--------|
| 1 | HEAD | `git rev-parse HEAD` (integration) | 0 | `003587293da25c4853301a63bf7c4e1f676df2b2` |
| 2 | Extract | `mkdir -p /c/Temp/tcw-scratch && git archive $HEAD \| tar -x -C /c/Temp/tcw-scratch` | 0 | extracted |
| 3 | Count (git) | `git ls-tree -r $HEAD --name-only \| wc -l` | 0 | **399** |
| 4 | Count (scratch) | `find . -type f \| wc -l` | 0 | **399** — match |
| 5 | Spot-hash ×5 | sha256 of `git show $HEAD:<f>` vs scratch file | 0 | **5/5 MATCH** (package.json, pnpm-lock.yaml, server/app.ts, src/pages/TenderWorkspace.tsx, vite.config.ts) |
| 6 | .env copy | `cp integration/.env scratch/.env` | 0 | 460 bytes copied |
| 7 | Untracked audit | `diff` tracked-list vs scratch-list | 1 (expected) | only delta = `.env` |
| 8 | Link walk | `find . -type l` | 0 | **0 symlinks** |
| 9 | Junction walk | `cmd /c dir /AL /S` | 0 | **0 junctions** |
| 10 | Install | `pnpm install --frozen-lockfile` | 0 | 21s (pnpm: 20.3s) |
| 11 | Typecheck | `pnpm check` (tsc --noEmit) | 0 | **0 errors**, 24s |
| 12 | Tests | `npx vitest run` | 0 | **67/67 files, 943/943 tests passed**, 7.23s |
| 13 | Build | `pnpm build` | 0 | **2494 modules transformed**, built in 12.87s (rerun 12.52s to capture module line) |
| 14 | Port config | edit scratch `.env`: CLEAN_SERVER_PORT 5301→5601 | 0 | scratch only |
| 15 | Preview up | `npx vite preview --port 5600 --strictPort` (bg) | — | listening `[::1]:5600` (PID 28208) |
| 16 | Server up | `npx tsx server/index.ts` (bg) | — | `[clean-server] listening on http://localhost:5601` (PID 33204); env injected from own `.env` (3 vars) |
| 17 | `/login` | curl :5600 | 0 | **HTTP 200**, SPA shell (`id="root"` + `/assets/index-*` markers = 3) |
| 18 | `/tenders/7483c493-0098-40a9-9e5f-76007bc62cd1` | curl :5600 | 0 | **HTTP 200** SPA shell; route exists: `CleanApp.tsx:103` `/tenders/:id`, `:102` `/tenders/:tenderId/final-pack` |
| 19 | `/workspaces/tenders` | curl :5600 | 0 | **HTTP 200** SPA shell |
| 20 | `/pdf-studio` | curl :5600 | 0 | **HTTP 200** SPA shell |
| 21 | `/healthz` | curl :5601 | 0 | **HTTP 200 JSON** `{"ok":true,"service":"hala-clean-commercial-engine","wave":"SC-01.4",...}` |
| 22 | `/api/documents` no token | curl :5601 | 0 | **HTTP 401** `{"code":"AUTH_REQUIRED"}` — auth-gated, not 500 |
| 23 | PostgREST read | GET `rest/v1/commercial_tickets?select=id&limit=1` w/ scratch anon key | 0 | **HTTP 200**, 1 live row id returned (read-only; no writes) |
| 24 | Kill | `taskkill //F //PID 28208` / `33204` | 0 / 0 | both terminated (their bg tasks report exit 1 = forced kill, expected) |
| 25 | Port clear | netstat post-kill on 5600/5601 | 1 (no hits) | **no listeners remain** |
| 26 | Cleanup | `rm -rf /c/Temp/tcw-scratch` + `ls` | 0 / 2 | **scratch gone**; C:\Temp back to pre-existing contents |

## Scan results (source + dist/ + lockfile, node_modules excluded)

**`hala-commercial-engine` — 0 executable refs; 11 comment-only mentions itemized:**

| Location | Kind |
|---|---|
| `.env.example:3` | env comment ("nothing is inherited from…") |
| `docs/CLAUDE-BOT-KNOWLEDGE-INDEPENDENT-AUDIT-2026-08-19.md:59` | audit doc quoting the scan patterns |
| `package.json:7` | `description` prose ("standalone sibling of… No… dependency") — metadata string, not a dependency/path |
| `server/app.ts:9`, `server/index.ts:11`, `server/index.ts:18`, `server/lib/supabase.ts:7`, `server/routes/documents.ts:23` | block/line comments stating the MUST-NOT-reference boundary |
| `src/lib/commercial-runtime.ts:15`, `:116` | provenance comments citing the old route path as read-only evidence (quote-number parity note) |
| `vite.config.ts:11` | block comment (build never scans old tree) |

- **`localhost:3001`**: 4 hits, none executable — 2 source comments (`src/lib/document-runtime.ts:18`, `src/lib/runtime-config.ts:5`), 1 negative test assertion (`src/pages/Renewals.test.tsx:206` — `expect(markup).not.toContain("localhost:3001")`), 1 docs quote. **dist/: 0 hits.**
- **dist/**: 0 hits for `hala-commercial-engine`, 0 for `localhost:3001`.
- **Lockfile**: 0 `file:`/`link:` dependency specifiers (2 raw substring false positives only: `excludeLinksFromLockfile`, package name `get-caller-file`); bonus check: **0** `../` parent-path references anywhere in `pnpm-lock.yaml`.
- **`hala-clean-auth`**: **present** in the built bundle — `dist/assets/index-CdPV36va.js`.

## Notes

- The scratch never contained the old app; it was materialized solely from `git archive` of the proven HEAD plus the copied `.env`. Install/check/test/build/serve all completed inside it.
- pnpm v10 emitted its standard "ignored build scripts: core-js, esbuild" warning; everything downstream succeeded regardless.
- Only mutation performed anywhere: the scratch `.env` port edit. Integration worktree, clean checkout, and old app untouched (integration was only read: rev-parse / archive / ls-tree / show / cp-from). DB access was a single read-only GET.
- No stream interruption occurred; no re-verification was needed.
