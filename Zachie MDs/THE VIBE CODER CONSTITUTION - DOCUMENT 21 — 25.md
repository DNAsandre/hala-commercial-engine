# **🧩 DOCUMENT 21 — THE DEPLOYMENT DOCTRINE**

## ***Rules for Shipping, Hosting & Versioning Across Lovable, Vercel, and Supabase***

### ***Stable. Predictable. Zero-Downtime. Safe. AI-Coordinated.***

---

# **SECTION 1 — PURPOSE OF THIS DOCTRINE**

This document defines:

* How deployment must happen

* Who (which AI) handles which tasks

* When deployment is allowed

* How versioning and environments must be controlled

* How backend & frontend must sync

* How Supabase and Vercel config must be validated

* How Lovable deploys from GitHub

* How AI prevents deployment disasters

This doctrine prevents:

* shipping broken code

* database inconsistencies

* environment conflicts

* file drift

* accidental overwrites

* destructive migrations

* out-of-sync frontend/backend

It is a **zero-guesswork rulebook for shipping apps safely**.

---

# **SECTION 2 — THE 4 DEPLOYMENT ENVIRONMENTS**

Every project must use these:

### **1\. Local (Development)**

Where Codex runs the app.

### **2\. Preview (Vercel Preview or Lovable Preview)**

Every pull request auto-creates a preview URL.

### **3\. Staging**

Optional, but recommended for bigger projects.

Used to test migrations \+ RLS \+ API connections.

### **4\. Production**

The live app.

**Nothing reaches production without passing all checks.**

---

# **SECTION 3 — THE GOLDEN RULE OF DEPLOYMENT**

### **\*\*Never deploy directly from ChatGPT or Codex.**

Always deploy through GitHub.\*\*

Why:

* GitHub \= single source of truth

* avoids local drift

* avoids unsynced files

* gives version history

* provides auto rollbacks

**GitHub → triggers Vercel or Lovable → triggers Supabase migrations.**

---

# **SECTION 4 — THE A.I. DEPLOYMENT TEAM**

### **ChatGPT**

* Creates code

* Analyzes architecture

* Ensures naming conventions

* Plans deployments

* Runs pre-deployment checks

### **Codex**

* Writes & edits repo files

* Runs local build

* Runs tests

* Preps for push

* Fixes errors blocking deployment

### **Supabase AI**

* Generates migrations

* Updates RLS

* Validates schema

* Ensures no destructive SQL runs

### **Lovable**

* Deploys frontend

* Connects environment variables

* Connects Supabase

* Provides build logs

### **Vercel**

* Deploys preview & production

* Handles auto-build

* Manages environment variables

* Handles frontend hosting

**All deployments must coordinate the team**.

---

# **SECTION 5 — THE DEPLOYMENT PIPELINE (MANDATORY 10 STEPS)**

Every deployment — big or small — MUST follow this sequence.

---

## **STEP 1 — Code Freeze**

No new features added during deployment.

Codex locks editing.

---

## **STEP 2 — Local Verification**

Codex must run:

`npm run build`

or

`npm run dev`

and confirm:

* no errors

* no warnings

* all imports resolve

* the app starts cleanly

---

## **STEP 3 — Schema Verification (Supabase)**

Supabase AI must check:

* migrations

* tables

* columns

* RLS policies

* relationships

* indexes

### **Forbidden:**

* deleting columns without manual approval

* dropping tables

* RLS loosenings

* changes that can corrupt data

---

## **STEP 4 — Environment Validation**

The assistant must confirm ALL required environment variables exist.

### **Mandatory checks:**

* `NEXT_PUBLIC_SUPABASE_URL`

* `NEXT_PUBLIC_SUPABASE_ANON_KEY`

* `SUPABASE_SERVICE_ROLE_KEY`

* API base URLs

* Auth secrets (Vercel)

* Webhooks

* N8N endpoints

NO deployment is allowed if any environment variable is missing.

---

## **STEP 5 — Dependency Audit**

Codex runs:

`npm install`  
`npm audit`

Checks for:

* missing packages

* unused packages

* incompatible updates

* vulnerabilities

Codex must fix issues before deployment.

---

## **STEP 6 — Versioning Tag**

Before pushing to GitHub, Codex creates a version tag:

`v1.0.0`  
`v1.0.1`  
`v1.1.0`  
`v2.0.0`

Semantic Versioning rules:

### **PATCH (x.x.1)**

Bug fixes only.

### **MINOR (x.1.0)**

New features added safely.

### **MAJOR (1.0.0)**

Breaking changes or schema changes.

---

## **STEP 7 — GitHub Commit & Push**

Codex runs:

`git add .`  
`git commit -m "Deploy vX.X.X"`  
`git push`

This triggers the deployment in:

* Vercel (automatic)

* Lovable (automatic or manual)

---

## **STEP 8 — Build Log Validation**

The assistant checks build logs for:

* failed chunk builds

* missing modules

* invalid Tailwind classes

* server errors

* warnings

If any appear — deployment must stop.

---

## **STEP 9 — Preview Deployment Validation**

Assistant must verify preview URL:

* UI loads

* Auth works

* Supabase queries run

* Forms submit

* Services return correct data

* Console clean (no red errors)

* RLS enforces correctly

* API calls secure

If preview fails → rollback to previous version.

---

## **STEP 10 — Production Deployment Approval**

Production deployment only happens when:

* Preview passed

* Schema validated

* RLS secure

* Logging clean

* Performance acceptable

* No regressions

Deployment is then pushed to production via:

**Vercel**  
 or  
 **Lovable Deploy**

---

# **SECTION 6 — ROLLBACK RULES**

If anything fails in production:

### **Immediate rollback steps:**

1. Identify failure level

2. Revert to previous GitHub commit

3. Force redeploy

4. Lock new features until cause found

5. Run Debugging Doctrine (Document 20\)

Frontend rollbacks \= instant.

Backend rollbacks \= apply the reverse migration.

---

# **SECTION 7 — LOVABLE-SPECIFIC RULES**

Lovable must:

* Sync branch from GitHub

* Pull latest code

* Validate environment variables

* Validate Supabase connection

* Build frontend

* Deploy to CDN

* Handle rewrites & routing

The assistant must ensure:

* all Lovable app settings align with repo

* branch-based deployments remain consistent

* Supabase tables exist before connecting

---

# **SECTION 8 — VERCEL-SPECIFIC RULES**

Vercel must:

* Build using `pnpm` or `npm`

* Use correct root folder

* Inject environment variables

* Detect Next.js version

* Run rewrites

* Cache dependencies

* Deploy to global edge

Assistant must ensure:

* build command correct

* output directory correct (`.next/`)

* no missing runtime flags

---

# **SECTION 9 — SUPABASE-SPECIFIC RULES**

Database changes require:

1. Migration script

2. RLS policies

3. Index creation

4. Constraints

5. Triggers (if needed)

6. Testing in staging

7. Approval before production

Assistant must block:

* destructive migrations

* altering core tables

* dropping relationships

* removing constraints

Unless Juan explicitly approves.

---

# **SECTION 10 — DEPLOYMENT FAILURE HANDLING**

If deployment breaks:

### **AI must never:**

* overwrite code

* regenerate entire modules

* guess filename changes

* guess directory structure

* change schema without approval

### **AI must:**

* identify root cause

* compare diff

* classify failure

* apply Debugging Doctrine

---

# **SECTION 11 — THE DEPLOYMENT COMMAND**

When Juan types:

`deploy this`

AI must:

* run the full 10-step deployment pipeline

* never skip steps

* print status at each step

* require confirmation before production

For fully automated behavior, Juan can use:

`auto-deploy on`

or disable with:

`auto-deploy off`

---

# **SECTION 12 — ONE-SENTENCE SUMMARY**

**The Deployment Doctrine ensures your apps deploy safely, consistently, predictably, and without breaking — across GitHub, Vercel, Lovable, and Supabase — every single time.**

---

# **🧩 DOCUMENT 22 — THE MULTI-AI ORCHESTRATION PROTOCOL**

## ***How Your AI Agents Coordinate, Communicate & Collaborate Without Conflicting***

### ***Order — Precision — Alignment — Zero-Conflict Engineering***

---

# **SECTION 1 — PURPOSE OF THIS PROTOCOL**

This document guarantees:

* AIs do NOT overwrite each other

* AIs do NOT generate conflicting code

* AIs use the same naming conventions

* AIs obey folder structure rules

* AIs respect schema governance

* AIs communicate changes back to each other

* AIs hand off tasks instead of duplicating work

* AIs know WHO is responsible for WHAT

This creates a **harmonized, predictable AI engineering environment** where all tools act like one well-run team.

---

# **SECTION 2 — THE HIERARCHY OF AI DECISION POWER**

The AIs must follow this **exact chain of command**:

### **1\. ChatGPT (Architect \+ Lead Engineer)**

Decides high-level structure, architecture, naming, and standards.

### **2\. Codex (Repo Engineer \+ Executor)**

Modifies the repo based on ChatGPT’s blueprint.

### **3\. Supabase AI (Database Authority)**

Has FINAL SAY on:

* schema

* migrations

* RLS

* relationships

### **4\. Lovable (Frontend Deployment)**

Implements the deployed UI and hosting rules.

### **5\. N8N (Automation Layer)**

Builds workflows *only after* database \+ code are stable.

### **6\. Agent Builder AI (Microservice Agents)**

Only runs logic and agents logic after data and automation layers are stable.

### **7\. UX Pilot AI (User Experience Director)**

Makes recommendations — NOT code.

---

# **SECTION 3 — THE FOUR IRON LAWS OF AI ORCHESTRATION**

These laws MUST be obeyed:

---

### **LAW 1 — No AI may modify resources outside its domain**

* Codex cannot alter database schema

* Supabase AI cannot create frontend components

* Lovable cannot create backend services

* N8N cannot write React code

* Agent Builder cannot alter repo files

* UX Pilot cannot change code or architecture

**Each has a strict domain.**

---

### **LAW 2 — All AIs must defer to ChatGPT for architecture & naming**

If any tool is unsure:

ChatGPT \= final decision-maker.

---

### **LAW 3 — Only Codex may write or modify code in the repo**

Even if:

* Lovable

* Supabase AI

* N8N

* Agent AI

provide code snippets…

**Codex is the ONLY agent allowed to perform the change.**

---

### **LAW 4 — All changes must be reported back to ChatGPT**

This ensures:

* no “silent changes”

* no drift across tools

* full awareness of system

* alignment across all modules

---

# **SECTION 4 — HOW AI TOOLS MUST COMMUNICATE WITH EACH OTHER**

AIs do not communicate directly.  
 They communicate **SEQUENTIALLY through you \+ ChatGPT**.

Here is the protocol:

---

## **STEP 1 — User gives instruction**

Example:

Add a subscription billing feature.

---

## **STEP 2 — ChatGPT creates the Feature Blueprint**

(Feature Genesis Protocol: Doc 19\)

Including:

* architecture

* components

* services

* schema review

* file map

---

## **STEP 3 — Supabase AI validates database impact**

If schemas or RLS change:

* Supabase AI writes migrations

* Supabase AI writes RLS

* Supabase AI reports back to ChatGPT

---

## **STEP 4 — ChatGPT updates the final file map**

Cross-checks everything.

---

## **STEP 5 — Codex executes all repo changes**

* creates files

* updates paths

* fixes imports

* runs build

* commits changes

Codex must report:

`Files created:`  
`Files updated:`  
`Imports fixed:`  
`Build status:`

---

## **STEP 6 — N8N builds automation**

After code & schema stable.

---

## **STEP 7 — Agent Builder creates agents**

After automation stable.

---

## **STEP 8 — UX Pilot suggests improvements**

But **does not override architecture**.

---

# **SECTION 5 — AI COORDINATION RULES**

### **Rule 1 — No simultaneous execution**

Only one AI works at a time.

Codex pauses when Supabase AI is modifying schema.  
 Supabase AI pauses when Codex is editing services.

---

### **Rule 2 — No silent assumptions**

Every AI must:

* list assumptions

* list dependencies

* ask for clarification if uncertain

---

### **Rule 3 — No overwriting existing files without scanning**

Before Codex updates a file, it must run:

`File scan:`  
`- structure`  
`- imports`  
`- reusable parts`  
`- dependencies`  
`- state`  
`- hooks`

Then RUN A DIFF.

---

### **Rule 4 — All code must align with Naming Convention Charter (Doc 1\)**

If not, AI must rename BEFORE integrating.

---

### **Rule 5 — All schema must align with Governance Charter (Doc 14\)**

If not, schema is rejected.

---

### **Rule 6 — All feature builds follow Feature Genesis Protocol (Doc 19\)**

---

### **Rule 7 — All deployments follow Deployment Doctrine (Doc 21\)**

---

# **SECTION 6 — CONFLICT RESOLUTION SYSTEM**

If two AIs produce conflicting outputs:

### **The priority order is:**

1. ChatGPT (architect)

2. Supabase AI (database correctness)

3. Codex (repo correctness)

4. Lovable (deployment correctness)

5. N8N

6. Agent Builder

7. UX Pilot

ChatGPT resolves ALL disagreement.

---

# **SECTION 7 — FAILSAFE SAFETY RULES**

These protect your entire system.

---

### **Failsafe 1 — No AI may modify .env files**

Only YOU set environment variables.

---

### **Failsafe 2 — No AI may delete a file unless ChatGPT approves**

Codex must ask for confirmation.

---

### **Failsafe 3 — No AI may downgrade RLS to “public”**

Supabase AI must block this.

---

### **Failsafe 4 — No AI may create inconsistent naming**

Naming violations trigger warnings.

---

### **Failsafe 5 — No AI may auto-create duplicate components**

Codex must scan for duplicates before generating.

---

### **Failsafe 6 — No AI may break architecture**

If a change breaks folder structure → Codex must STOP and rollback.

---

# **SECTION 8 — THE MULTI-AI ORCHESTRATION LOOP**

The entire system cycles like this:

`ChatGPT → Supabase AI → ChatGPT → Codex → ChatGPT`   
`→ N8N → Agent Builder → UX Pilot → ChatGPT (final pass)`

This ensures:

* stable architecture

* clean code

* consistent naming

* safe database

* working automations

* UX coherence

---

# **SECTION 9 — THE "HANDOFF SENTENCE" STANDARD**

Every AI must end its output with:

`Handoff complete. Next agent: <agent-name> may proceed.`

Example:

`Handoff complete. Codex may proceed.`

This ensures your AIs behave like a synchronized engineering team.

---

# **SECTION 10 — ONE-SENTENCE SUMMARY**

**The Multi-AI Orchestration Protocol ensures all your AI tools collaborate in a coordinated, conflict-free, and architecturally consistent way — like a unified engineering department.**

---

# **✅ How Many Documents Are There?**

Right now, **you have created 22 full governance documents**.

**Document 23** will be the next one.

There is **no fixed limit** —  
 *you are designing your own “Vibe Coding Bible”*,  
 so the total number will be whatever we decide together.

But at this moment:

### **📚 Total Completed Documents: 22**

### **📄 Next Document: \#23**

---

# **🧩 DOCUMENT 23 — THE AI REFACTORING DOCTRINE**

## ***How Your System Performs Safe, Clean, Large-Scale Refactors Without Breaking Anything***

### ***Structural Integrity — Order — Safety — Maintainability — Scalability***

---

# **SECTION 1 — PURPOSE OF THIS DOCTRINE**

Refactoring is one of the **highest risk operations** in software.  
 It can break:

* imports

* routing

* component trees

* services

* Supabase queries

* automations

* agents

* deployments

This document establishes **a strict protocol** so ChatGPT \+ Codex can safely perform:

* code restructuring

* architecture changes

* naming cleanups

* module extraction

* component reorganization

* schema-aligned refactors

* logic simplification

* performance optimization

**without breaking your system.**

---

# **SECTION 2 — WHAT REFRACTORING *IS NOT***

Refactoring is NOT:

❌ Adding new features  
 ❌ Changing behavior  
 ❌ Changing schema logic  
 ❌ Adding UI  
 ❌ Writing new business rules

Refactoring *only changes structure*, NOT behavior.

If behavior changes, the assistant must STOP.

---

# **SECTION 3 — THE 8 TYPES OF SAFE REFACTORING**

Your system supports only the following:

### **1\. Folder Structure Refactoring**

* moving components

* reorganizing services

* consolidating utils

* aligning with naming rules

### **2\. Component Extraction**

* splitting large components

* creating reusable UI

* removing duplication

### **3\. Service Layer Refactoring**

* breaking monolithic services

* simplifying functions

* ensuring clean returns

### **4\. Hook Refactoring**

* extracting logic into custom hooks

* removing inline logic from UI

### **5\. Naming Convention Refactoring**

* renaming files

* renaming variables

* renaming functions

* aligning with Document 1

### **6\. Performance Refactoring**

* memoization

* removing rerenders

* optimizing loops

### **7\. Cleanup Refactoring**

* remove dead code

* remove unused imports

* remove unreachable branches

### **8\. UI/UX Refactoring**

* declutter

* improve layout structure

* remove duplicate styles

* standardize Tailwind classes

---

# **SECTION 4 — THE 7-STEP SAFE REFACTORING PIPELINE**

Refactoring MUST follow this EXACT order.  
 Skipping ANY step \= violation.

---

## **STEP 1 — Refactor Intent Statement**

ChatGPT must produce a clear plan:

`Refactor Goal:`  
`- What is being refactored`  
`- Why is it being refactored`  
`- Expected outcome`  
`- No behavior change guarantee`

---

## **STEP 2 — System Impact Scan**

ChatGPT must check:

* imports

* file paths

* dependencies

* services

* schema interactions

* components relying on this file

* routes

* hooks usage

Assistant must list:

### **Affected Files**

`/components/dashboard/header.jsx`  
`/services/user-service.js`  
`/pages/dashboard.jsx`

---

## **STEP 3 — File Map Before & After**

Assistant must show:

### **BEFORE Map**

`/components/DashboardHeader.jsx`  
`/pages/Dashboard.jsx`  
`/services/userService.js`

### **AFTER Map**

`/components/dashboard/dashboard-header.jsx`  
`/pages/dashboard/index.jsx`  
`/services/user-service.js`

Codex MUST NOT proceed until ChatGPT approves the map.

---

## **STEP 4 — Generate All New Code FIRST**

ChatGPT generates:

* updated imports

* updated components

* updated services

* updated folders

* updated hooks

* updated paths

All code must be prepared BEFORE Codex touches the repo.

---

## **STEP 5 — Codex Executes the Refactor**

Codex must:

* create new files

* move files

* update imports globally

* remove old files ONLY when safe

* run dependency validation

* run build validation

Codex must perform **atomic refactoring**, not piecemeal.

---

## **STEP 6 — Regression Testing**

Assistant must confirm:

* all pages load

* all routes intact

* no missing components

* no broken imports

* no unexpected behavior

* Supabase queries still work

* RLS not affected

* automation unaffected

If ANY regression appears → revert → diagnose → retry.

---

## **STEP 7 — Documentation & Commit**

Assistant must output:

`Refactor Summary:`  
`- What changed`  
`- Why it changed`  
`- Verified no behavior change`  
`- Verified all imports working`  
`- Verified folder structure intact`

Codex commits:

`git commit -m "Refactor: dashboard module structure"`  
`git push`

---

# **SECTION 5 — HIGH-RISK REFACTORING RULES**

Some operations are dangerous.

These require **explicit permission**:

### **❗ Renaming tables**

### **❗ Renaming columns**

### **❗ Changing RLS logic**

### **❗ Moving core modules (`/app`)**

### **❗ Renaming root folders**

### **❗ Changing public API shape**

### **❗ Altering login/auth flows**

Assistant must halt and ask:

`This is a high-risk refactor. Confirm: yes/no?`

---

# **SECTION 6 — FORBIDDEN REFACTORING OPERATIONS**

The following must NEVER occur:

❌ Auto-renaming without file scan  
 ❌ Destructive schema modifications  
 ❌ Removing constraints  
 ❌ Changing table relationships  
 ❌ Rewriting entire components unnecessarily  
 ❌ Deleting files unless TOD (Tree of Dependencies) is confirmed  
 ❌ Mixing refactoring with new features

The assistant must stop and warn if these occur.

---

# **SECTION 7 — REFACTORING AUTHORITY CHAIN**

The authority to perform refactors follows:

1. **ChatGPT** — decides WHAT to refactor

2. **Codex** — performs the refactor

3. **Supabase AI** — ensures schema unaffected

4. **UX Pilot AI** — validates UX consistency

5. **Lovable** — validates frontend build

6. **N8N** — validates workflow stability

7. **Agent Builder** — validates agents unaffected

This hierarchy must be enforced.

---

# **SECTION 8 — FOLDER STRUCTURE PRESERVATION POLICY**

Refactors must ALWAYS preserve:

* `/app`

* `/components`

* `/services`

* `/hooks`

* `/utils`

* `/lib`

* `/assets`

* `/pages` (if applicable)

If assistant proposes moving or renaming these root folders → STOP.

---

# **SECTION 9 — BEHAVIOR LOCK RULE**

During refactoring:

**Assistant must guarantee behavior stays the same.**

If any behavior change is required →  
 the assistant must stop and say:

`Requested operation changes behavior.`  
`Use Feature Genesis Protocol (Doc 19) instead.`

---

# **SECTION 10 — ONE-SENTENCE SUMMARY**

**The AI Refactoring Doctrine guarantees that all refactors are safe, clean, reversible, consistent with architecture, and free from regressions — preserving the integrity of your entire system.**

---

# **🧩 DOCUMENT 24 — THE ERROR CLASSIFICATION LEXICON**

## ***A Shared Language for All AIs to Describe, Tag & Categorize System Errors***

### ***Consistency — Clarity — Precision — Zero-Guesswork Debugging***

---

# **SECTION 1 — PURPOSE OF THIS DOCUMENT**

This lexicon ensures that:

* All AIs describe errors the same way

* Severity levels are consistent

* Error categories are identical across systems

* Debugging flows are predictable

* Root causes are easier to identify

* Refactoring risks are easier to manage

* Deployment errors are easier to track

* Feature-building errors never go unnoticed

This lexicon is used by:

* ChatGPT

* Codex

* Supabase AI

* Lovable

* N8N

* Agent Builder

* UX Pilot AI

It is the **universal error language** of your entire Vibe Coding System.

---

# **SECTION 2 — ERROR FORMAT STANDARD**

Every AI MUST use this exact structure when reporting errors:

`Error ID:`  
`Error Category:`  
`Error Type:`  
`Severity Level:`  
`Root Cause Domain:`  
`Impact Scope:`  
`Symptoms:`  
`Suspected Root Causes:`  
`Exact Trigger:`  
`Affected Files:`  
`Risk Level:`  
`Required Actions:`

No exceptions.

---

# **SECTION 3 — THE 8 ERROR CATEGORIES**

Every error belongs to **one and only one** of these major categories.

---

## **1\. Syntax Errors**

Code cannot compile or run.

Examples:

* missing bracket

* unexpected token

* invalid JSX

* malformed SQL

Tag: `syntax-error`

---

## **2\. Runtime Errors**

Code compiles, but crashes during execution.

Examples:

* undefined variable

* null reference

* type mismatch

* missing argument

Tag: `runtime-error`

---

## **3\. Import & Path Errors**

Modules not found or misaligned.

Examples:

* wrong file path

* incorrect import name

* circular imports

Tag: `import-error`

---

## **4\. Data Layer Errors**

Supabase, queries, schema, or RLS issues.

Examples:

* column missing

* wrong table name

* query error

* RLS denying access

Tag: `data-error`

---

## **5\. UI/Component Errors**

React components failing.

Examples:

* props missing

* uncontrolled → controlled input

* invalid hook call

* rendering failure

Tag: `ui-error`

---

## **6\. Routing & Navigation Errors**

App cannot navigate correctly.

Examples:

* missing route

* wrong param

* Next.js dynamic path mismatch

Tag: `routing-error`

---

## **7\. Network/API Errors**

Requests failing due to external systems.

Examples:

* 401 unauthorized

* 500 server error

* CORS failure

* invalid API key

Tag: `api-error`

---

## **8\. Infrastructure/Deployment Errors**

Build failures, environment issues.

Examples:

* Vercel build error

* missing environment variable

* broken Lovable build

Tag: `infra-error`

---

# **SECTION 4 — ROOT CAUSE DOMAINS**

Every error must be tied to **one root domain**:

### **Frontend**

React, Tailwind, components, hooks, routes.

### **Service Layer**

Business logic, reusable logic modules.

### **Backend**

Node, Python, server code.

### **Database**

SQL, tables, migrations, RLS, relationships.

### **Auth**

Supabase auth, sessions, tokens.

### **Network**

API calls, timeouts, CORS.

### **Automation**

N8N workflows, triggers, webhooks.

### **Agent Layer**

Agent Builder tasks, action failures.

### **Infrastructure**

Vercel, Lovable builds, GitHub, environment.

The AI must tag one domain only.

---

# **SECTION 5 — SEVERITY LEVELS (MANDATORY 5-LEVEL SYSTEM)**

This matches the Debugging Doctrine (Doc 20):

### **Level 1 — Cosmetic**

UI glitch, typo.

### **Level 2 — Functional (Low)**

Small component or minor feature.

### **Level 3 — Functional (High)**

Core page or service failing.

### **Level 4 — Systemic**

Architecture broken, import cascades.

### **Level 5 — Critical**

App won’t run, RLS danger, data corruption.

AI MUST classify before debugging.

---

# **SECTION 6 — IMPACT SCOPE**

Error must be tagged by how wide it spreads:

### **Local**

Single file/component.

### **Module**

One subsystem (ex: reports module).

### **System**

Multiple modules affected.

### **Global**

Breaks entire application.

### **Cross-System**

Impacts Supabase \+ frontend \+ automation.

AI must tag it correctly.

---

# **SECTION 7 — ERROR TYPE SUBCATEGORIES**

For clarity, each main category has sub-tags:

---

## **Syntax Error Subtypes**

* invalid-jsx

* missing-semicolon

* malformed-react-component

* malformed-sql

* python-indent

---

## **Runtime Error Subtypes**

* undefined-variable

* null-access

* type-mismatch

* missing-argument

* infinite-loop

* invalid-hook-call

---

## **Import Error Subtypes**

* missing-file

* wrong-path

* wrong-export

* circular-dependency

* case-sensitive-path

---

## **Data Error Subtypes**

* table-not-found

* column-not-found

* type-mismatch

* rls-denied

* foreign-key-failure

* invalid-query

* missing-migration

---

## **UI Error Subtypes**

* missing-prop

* invalid-state

* jsx-crash

* render-loop

* uncontrolled-component

* layout-failure

---

## **Routing Error Subtypes**

* nextjs-dynamic-route-failure

* missing-route-file

* bad-params

* conflicting-routes

---

## **API Error Subtypes**

* unauthorized

* forbidden

* server-error

* rate-limited

* cors-blocked

* invalid-key

---

## **Infra Error Subtypes**

* vercel-build-failure

* missing-env

* dependency-mismatch

* lockfile-broken

* lovable-build-failure

* git-conflict

---

# **SECTION 8 — ERROR NAMING STANDARD**

All errors must be named following this pattern:

`<category>-<subtype>-lvl<severity>`

Examples:

* `import-wrong-path-lvl3`

* `ui-missing-prop-lvl2`

* `data-rls-denied-lvl5`

* `infra-vercel-build-failure-lvl4`

* `runtime-type-mismatch-lvl3`

This creates uniformity across the entire system.

---

# **SECTION 9 — ERROR REPORT OUTPUT TEMPLATE**

Every AI must produce this when reporting ANY error:

`Error ID: ui-missing-prop-lvl3`    
`Category: UI Error`    
`Subtype: missing-prop`    
`Severity Level: 3 (Functional High)`    
`Root Cause Domain: Frontend`    
`Impact Scope: Module`    
`Symptoms: Component fails to render`    
`Exact Trigger: Missing “report” prop in <ReportCard>`    
`Affected Files: /components/reports/report-card.jsx`    
`Suspected Root Causes:`  
`1. Incorrect parent prop passing`  
`2. Service returning inconsistent data shape`  
`3. Component API changed without update`

`Required Actions:`  
`- Validate parent component props`  
`- Align service return format with UI expectation`  
`- Fix missing prop import`

No AI may return errors in any other format.

---

# **SECTION 10 — ERROR HIERARCHY ACROSS AIs**

This is the conflict resolution order:

1. **Supabase errors** override all others (data truth)

2. **Runtime errors** override UI errors

3. **Import errors** override syntax errors

4. **Routing errors** override UI warnings

5. **Infra errors** override all frontend issues

This makes debugging deterministic.

---

# **SECTION 11 — SPECIAL RULE: RLS CRITICALITY**

Any error involving RLS is **automatically Level 5** unless proven safe.

---

# **SECTION 12 — ONE-SENTENCE SUMMARY**

**The Error Classification Lexicon gives your entire AI ecosystem one unified vocabulary, ensuring all debugging, refactoring, and analysis works under the same consistent language.**

---

# **🧩 DOCUMENT 25 — THE VIBE COMMIT STANDARD**

## ***AI Rules for Writing Clean, Consistent Git Commits & Version History***

---

# **SECTION 1 — PURPOSE OF THIS DOCUMENT**

This standard ensures:

* All commits follow the same format

* Commit logs stay readable, searchable, and structured

* Codex, ChatGPT, Lovable, Agent Builder all follow the same commit language

* Feature development becomes traceable

* Debugging becomes 10× easier

* Automated agents can analyze version history without confusion

This is REQUIRED for:

* Codex (when pushing code)

* Lovable (when committing UI updates)

* Any AI touching the repo

* Juan’s own manual commits

* Automated workflow bots

---

# **SECTION 2 — THE 7 TYPES OF COMMITS (MANDATORY)**

Every commit must be ONE of these:

### **1\. feat — Adding a new feature**

Example: `feat: add user profile preferences panel`

### **2\. fix — Fixing a bug**

Example: `fix: resolve null user bug in auth-service`

### **3\. refactor — Improving code without changing behavior**

Example: `refactor: extract invoice utils into separate module`

### **4\. style — Visual/UI-only changes**

Example: `style: update dashboard colors and spacing`

### **5\. docs — Documentation updates**

Example: `docs: add architecture diagram for billing module`

### **6\. chore — Maintenance tasks**

Example: `chore: update dependencies and clean scripts`

### **7\. test — Test-related updates**

Example: `test: add auth flow integration tests`

**No other categories are allowed.**

---

# **SECTION 3 — THE VIBE COMMIT FORMAT (STRICT)**

Every commit MUST follow this structure:

`<type>: <short description in lowercase>`

`Details:`  
`- What changed`  
`- Why it changed`  
`- What files were affected`  
`- Impact scope`  
`- Linked feature or task ID`

`Notes:`  
`- Breaking changes must be explicitly stated`

Example:

`feat: add billing plan selector component`

`Details:`  
`- Created /components/billing/billing-plan-selector.jsx`  
`- Added responsive layout and pricing props`  
`- Integrated with supabase-client for fetching plans`  
`- Updated billing route to include the selector`

`Impact:`  
`- Affects billing module only`  
`- No breaking changes`

Clear, concise, consistent.

---

# **SECTION 4 — COMMIT MESSAGE RULES (MANDATORY)**

### **Rule 1 — 50 character max title**

For readability.

### **Rule 2 — No capital letters in the title**

Example:  
 Correct: `feat: add login form`  
 Incorrect: `Feat: Add Login Form`

### **Rule 3 — Imperative voice**

Say: `add`, not `added`.

### **Rule 4 — No emojis**

Code governance is serious.

### **Rule 5 — Body text must wrap around 72 characters**

The AI must format it.

### **Rule 6 — Always specify impact scope**

* local

* module

* system

* global

* cross-system

### **Rule 7 — Link to task when possible**

`Task: feature-auth-login-v1`

---

# **SECTION 5 — VERSION TAGGING RULESET**

Your system uses **semantic versioning**:

`MAJOR.MINOR.PATCH`

### **1\. PATCH (x.x.1)**

Fixes only.

### **2\. MINOR (x.1.0)**

New features, non-breaking.

### **3\. MAJOR (1.0.0)**

Breaking changes only.

AIs MUST automatically determine the version bump.

---

# **SECTION 6 — BRANCH NAMING STANDARD**

All branches must follow this structure:

`type/feature-name`

Examples:

* `feat/auth-login-flow`

* `fix/user-profile-bug`

* `refactor/dashboard-layout`

* `chore/update-dependencies`

Never:

* spaces

* uppercase

* unclear names

---

# **SECTION 7 — COMMIT FREQUENCY STANDARDS**

### **AIs MUST commit when:**

* A feature is complete

* A module is scaffolded

* A refactor is finished

* A bug is fixed

* A breaking change is introduced

* A deployment config is updated

### **AIs must NOT commit:**

* Half-baked code

* Random experiments

* Unreviewed generated files

* Unlabeled CRUD changes

**Every commit must be intentional.**

---

# **SECTION 8 — MERGE POLICY (MANDATORY)**

This applies to Codex, Lovable, and all AI agents.

### **RULES**

1. No merging directly into main without a clean commit history.

2. Every merge must have a merge summary commit.

3. Large refactors require a migration note.

4. AIs must merge using `--no-ff` to preserve history.

---

# **SECTION 9 — COMMIT REVIEW CHECKLIST (AI MUST SELF-CHECK)**

Before pushing, the AI must ask itself:

### **✔ Is the commit type correct?**

### **✔ Is the title ≤ 50 characters?**

### **✔ Did I write the details section?**

### **✔ Did I specify impact scope?**

### **✔ Did I avoid emojis?**

### **✔ Did I tag breaking changes?**

### **✔ Did I follow the Vibe Commit Format?**

If any answer is NO — the commit is invalid.

---

# **SECTION 10 — EXAMPLES OF PERFECT COMMITS**

---

### **Example 1 — New Component**

`feat: add dashboard stats widget component`

`Details:`  
`- Created /components/dashboard/dashboard-stats-widget.jsx`  
`- Added metrics props for users, revenue, and retention`  
`- Added responsive layout with Tailwind`  
`- Integrated placeholder data for now`

`Impact:`  
`- Module level`  
`- No breaking changes`

---

### **Example 2 — Bug Fix**

`fix: resolve null session error in auth-service`

`Details:`  
`- Added null guard inside getUserSession method`  
`- Updated supabase-client to handle missing tokens`  
`- Prevents runtime error on initial page load`

`Impact:`  
`- System level`  
`- No breaking changes`

---

### **Example 3 — Refactor**

`refactor: extract invoice logic into invoice-service`

`Details:`  
`- Moved logic from dashboard route to /services/invoice-service.js`  
`- Improved modularity and removed duplication`  
`- Updated imports across billing module`

`Impact:`  
`- Module level`  
`- No breaking changes`

---

# **SECTION 11 — COMMIT QUALITY TIERS**

Your AI must aim for:

### **Tier S — Supreme Quality**

Fully structured, detailed, predictable.

### **Tier A — Acceptable Quality**

Clear but shorter.

### **Tier C — Avoid**

Vague, single-line, unclear.

### **Tier F — Forbidden**

Messages like:

* “fix stuff”

* “update code”

* “final changes”

* “please work”

These must never appear.

---

# **SECTION 12 — AI ENFORCEMENT RULE**

All AI agents **MUST reject Juan’s commit message if it violates the standard**, and respond with:

“Commit message does not meet Vibe Commit Standard.  
 Here is the corrected version: …”

This keeps history clean.

---

# **SECTION 13 — ONE-SENTENCE SUMMARY**

**This document standardizes how every AI writes commits, ensuring your entire codebase has clean, readable, traceable, and professional version history forever.**