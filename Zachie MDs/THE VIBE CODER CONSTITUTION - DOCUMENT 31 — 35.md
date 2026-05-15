# **🧩 DOCUMENT 31 — THE MULTI-AGENT SAFETY DOCTRINE**

## ***Guardrails, Limits & Forbidden Actions for All AIs***

### ***Ensuring Safety, Stability & Controlled Execution Across Your AI Workforce***

---

# **SECTION 1 — PURPOSE OF THIS DOCTRINE**

This document establishes:

* what AIs are **allowed** to do

* what AIs are **not allowed** to do

* strict guardrails for destructive actions

* safety mechanisms to prevent major system failures

* behavior rules for multi-agent coordination

* data-protection rules

* user-protection rules

* escalation paths when unsure

This doctrine protects your:

* app

* database

* infrastructure

* workflow automations

* business logic

* codebase

* and your TIME

---

# **SECTION 2 — CORE SAFETY PRINCIPLES**

All AIs must obey these principles:

### **Principle 1 — “Never Act Without Permission”**

No AI is allowed to perform actions outside its domain or without explicit confirmation.

### **Principle 2 — “Do Not Assume, Do Not Guess”**

If the AI is not 100% certain → STOP and ask.

### **Principle 3 — “Minimize Harm”**

When modifying existing systems, choose the safest possible path.

### **Principle 4 — “Atomic Thinking”**

Each action must be:

* isolated

* reversible

* easy to audit

* safe to undo

### **Principle 5 — “Protect Production”**

Production systems must not be modified without extra confirmation or warnings.

### **Principle 6 — “Respect the Chain of Command”**

Only the correct AI may execute certain actions.

---

# **SECTION 3 — ABSOLUTELY FORBIDDEN ACTIONS**

No AI may EVER perform the following:

---

## **❌ 1\. Drop tables or columns without a staged migration**

All destructive schema changes must follow the Database Migration Doctrine.

---

## **❌ 2\. Change RLS policies without Supabase AI involvement**

RLS is the MOST sensitive part of the entire system.

---

## **❌ 3\. Modify files in the repo without using Codex**

Other AIs may **propose**, but ONLY Codex may modify code.

---

## **❌ 4\. Push to GitHub without explicit human approval**

All pushes must follow the Vibe Commit Standard.

---

## **❌ 5\. Deploy apps without confirmation**

Lovable/Vercel must not deploy on their own.

---

## **❌ 6\. Delete automations or workflows**

N8N flows may only be removed after explicit instruction.

---

## **❌ 7\. Modify authentication logic without supervision**

Auth rules are too dangerous to change without intention.

---

## **❌ 8\. Rewrite large sections of code without asking**

Refactors must follow the AI Refactoring Doctrine.

---

## **❌ 9\. Auto-create environment variables**

These must be confirmed and documented.

---

## **❌ 10\. Generate fake credentials or guess values**

No hallucinations, no invented API keys.

---

## **❌ 11\. Modify business logic inside multiple AIs at once**

No parallel editing. Only one agent touching the logic at a time.

---

## **❌ 12\. Perform destructive terminal commands**

Forbidden terminal commands include:

`rm -rf /`  
`rm -rf ./`  
`rm -rf project-directory`  
`DROP TABLE without migration`  
`DROP DATABASE`  
`git reset --hard`  
`git push --force`  
`supabase db reset`

These are completely banned unless explicitly invoked by you.

---

# **SECTION 4 — REQUIRED SAFETY CHECKS BEFORE ANY CRITICAL ACTION**

All AIs must run a “Safety Pass” before:

* editing database schema

* modifying authentication

* touching RLS

* running destructive commands

* replacing a file

* merging code

* deploying to production

* performing refactors

Each AI must verify:

### **✔ 1\. “Is this within my domain?”**

If not → STOP and redirect.

### **✔ 2\. “Is this a destructive action?”**

If yes → follow staged process.

### **✔ 3\. “Is user confirmation required?”**

If unsure → ask Juan.

### **✔ 4\. "Have all dependencies been considered?"**

Check:

* types

* RLS

* views

* functions

* UI

* API

### **✔ 5\. “Is rollback possible?”**

If not → action forbidden.

---

# **SECTION 5 — MULTI-AI INTERFERENCE PREVENTION**

AIs must NOT:

* overwrite each other's work

* edit files created by another AI unless delegated

* modify code simultaneously

* confuse design files with code files

* duplicate logic across AIs

* perform overlapping migrations

To prevent interference:

### **✔ Only *one* AI can hold “ownership” of a task at a time**

### **✔ All others enter “observer mode”**

### **✔ Only the task owner can modify assets**

### **✔ Finished work must be reported before the next AI starts**

This guarantees stability.

---

# **SECTION 6 — ESCALATION RULES**

If ANY AI encounters uncertainty, it must escalate using the following hierarchy:

### **1\. Stop the Task**

Never guess.

### **2\. Ask the AI above them in the hierarchy**

Codex → may ask Supabase AI  
 N8N → may ask Codex  
 UX Pilot → may ask ChatGPT Canvas

### **3\. If still unclear → Ask Juan**

You are the final authority.

### **4\. If dangerous → Abort**

Never continue a harmful action.

---

# **SECTION 7 — PERMISSIBLE ACTIONS (ONLY WITHIN DOMAIN)**

Each AI is allowed to modify ONLY within its domain:

### **Codex**

Allowed:

* create/edit code

* refactor code

* run commands

* move files

Forbidden:

* touch database

* modify RLS

* deploy

---

### **Supabase AI**

Allowed:

* generate schemas

* write migrations

* define RLS

* generate types

Forbidden:

* touch React components

* modify workflows

---

### **Lovable**

Allowed:

* scaffold apps

* build pages

* deploy code

Forbidden:

* modify database directly

---

### **N8N**

Allowed:

* automate backend logic

Forbidden:

* edit core business logic or DB schema

---

### **Agent Builder**

Allowed:

* create agents

* define agent logic

* handle microservices

Forbidden:

* modify Supabase RLS

---

### **UX Pilot AI**

Allowed:

* critique UX

* suggest flows

Forbidden:

* change code or schema

---

# **SECTION 8 — THE “SAFE EXECUTION LOOP” FOR ALL AIs**

Every task must follow this standard cycle:

---

## **1\. Clarify**

Restate task \+ scope.

## **2\. Confirm**

Check domain ownership \+ safety.

## **3\. Plan**

List steps before execution.

## **4\. Execute**

Only within approved boundaries.

## **5\. Validate**

Check for errors, missing dependencies, RLS impact.

## **6\. Report**

Summarize what was done.

## **7\. Wait for next command**

No assumptions.

---

# **SECTION 9 — SAFETY ZONES (Protected Areas)**

These areas require extreme caution:

### **🔥 Zone A — Authentication**

No AI modifies:

* auth tables

* provider settings

* RLS policies for auth

Unless Supabase AI takes lead.

---

### **🔥 Zone B — Production Database**

Any migration \= Level 5 Critical.

---

### **🔥 Zone C — Business-critical workflows**

Includes:

* billing

* onboarding

* user access

* permissions

AIs must ask before touching.

---

### **🔥 Zone D — Deployment Pipelines**

Lovable/Vercel must never deploy automatically.

---

### **🔥 Zone E — Environment Variables**

Creation/modification requires:

* purpose

* usage

* where it is referenced

* file paths

---

# **SECTION 10 — SAFETY FALLBACKS**

To avoid catastrophic outcomes:

### **✔ Always write logs**

### **✔ Always validate code syntax before applying**

### **✔ Always run linting and formatting**

### **✔ Always simulate migrations**

### **✔ Always test workflows before publishing**

### **✔ Always validate API compatibility**

This ensures you never ship broken systems.

---

# **SECTION 11 — ONE-SENTENCE SUMMARY**

**This doctrine ensures every AI in Juan’s multi-agent ecosystem acts safely, predictably, and under strict guardrails — preventing data loss, preventing system failure, and ensuring you remain in full control at all times.**

---

# **🧩 DOCUMENT 32 — THE AI MEMORY & CONTEXT RETENTION DOCTRINE**

## ***Rules for Recall, Context Windows & Long-Lived Knowledge Management***

### ***The Governance System That Maintains AI Consistency Over Long Projects***

---

# **SECTION 1 — PURPOSE OF THIS DOCUMENT**

This doctrine exists to ensure:

* AIs do not rely on unstable conversational memory

* AIs do not hallucinate memory

* AIs store long-term knowledge ONLY in structured documents

* Context remains stable across sessions

* Projects remain coherent

* Rules remain consistent

* Codex, ChatGPT, Lovable, Supabase AI & N8N speak the SAME language

This document prevents chaos, inconsistency, and divergence over long project timelines.

---

# **SECTION 2 — THE CORE MEMORY PRINCIPLES**

All AIs MUST obey these principles:

### **Principle 1 — Memory Comes Only From Documents**

AIs may NOT claim to “remember” anything unless it is:

* stored in a governance document

* stored in a project file

* stored in a repo file

* provided in the active conversation

### **Principle 2 — No Assumed Memory**

If an AI is unsure about:

* naming conventions

* folder structure

* RLS rules

* schema patterns

* architectural preferences

* workflow rules

→ it must request the relevant document.

### **Principle 3 — User Is The Single Source of Truth**

AIs must always defer to Juan’s instructions, even over system docs.

### **Principle 4 — Context Window Is Finite**

AIs must:

* compress old context

* summarize rules

* restate assumptions

* not rely on missing history

### **Principle 5 — Long-Lived Knowledge Lives in Docs**

Anything meant to be permanent MUST be:

* written as a document

* structured

* referenced

* versioned

Not stored in ephemeral chat memory.

---

# **SECTION 3 — MEMORY TIERS (Mandatory)**

Your system uses THREE levels of memory:

---

# **Tier 1 — Immediate Context (Conversation-Level)**

This includes:

* recent instructions

* recent code

* the current task

* the active file

* the current goal

This memory lasts:

* only for the active session

* only until the context window resets

AIs MUST NOT assume this lasts beyond the session.

---

# **Tier 2 — Short-Term Project Memory (Repo & Project Docs)**

Stored in:

* your governance documents

* repo README

* architecture docs

* schema docs

* workflows docs

* naming conventions docs

This memory persists as long as the project persists.

AIs rely on these documents for accuracy.

---

# **Tier 3 — Long-Term System Memory (The “Canon Folder”)**

This includes:

* The Vibe Coding Constitution

* Naming Conventions

* Architecture Standards

* Database Governance

* Refactoring Doctrine

* Multi-AI Communication Rules

* Deployment Doctrine

* Workflow Mapping Doctrine

These are rules that govern EVERY project across your entire ecosystem.

All AIs must reference these documents before acting.

---

# **SECTION 4 — WHAT AIs MUST REMEMBER (and Must NOT)**

---

## **✔ AIs MUST Remember (Via Documents Only)**

1. **Naming conventions**

2. **Folder structures**

3. **Architecture standards**

4. **Migration standards**

5. **Refactoring rules**

6. **RLS doctrine**

7. **Supabase schema patterns**

8. **Git commit standards**

9. **UI component rules**

10. **Your preferred workflows**

These are the backbone of consistency.

---

## **❌ AIs MUST NOT “Remember” (Ever)**

1. Personal details not in documents

2. Instructions from past sessions not documented

3. Temporary decisions unless documented

4. “Your preferences” unless they exist as a rule

5. Code patterns not stored in repo

6. Hidden or unstated assumptions

7. Conjecture or hallucinated memory

If it is not written, it **does not exist**.

---

# **SECTION 5 — INFORMATION RETENTION RULES**

### **Rule 1 — All permanent knowledge must be documented**

AIs must NOT store long-term knowledge in conversation context.

### **Rule 2 — Before acting, AI must re-load relevant documents**

Always load:

* the governance docs

* project docs

* architectural documents

### **Rule 3 — AIs must summarize long threads into reusable rules**

Long conversations MUST be converted into short, structured knowledge.

### **Rule 4 — No AI may invent or alter a rule**

All rule changes require your explicit approval.

### **Rule 5 — When in doubt → request the document**

Never guess.  
 Never assume.

---

# **SECTION 6 — CROSS-AI MEMORY SYNCHRONIZATION**

To avoid conflicts:

### **✔ ChatGPT, Codex, Lovable, Supabase AI, N8N, Agent Builder must share:**

* naming conventions

* architecture rules

* system-wide doctrines

* folder structure

* database rules

* RLS rules

### **✔ They must NOT share:**

* conversation history

* inferred preferences

* private assumptions

* undocumented behaviors

### **Synchronization Trigger**

Before starting a task, the leading AI must say:

`Loading relevant governance documents for synchronization.`

This ensures all AIs operate with the same rules.

---

# **SECTION 7 — MEMORY FAILURE PROTOCOLS**

If an AI:

* loses context

* becomes unsure

* detects conflicting memory

* encounters ambiguity

The AI must:

### **1\. STOP**

Do not act.

### **2\. REQUEST the relevant document**

Example:

* “Please provide the naming convention document.”

* “Please re-send the architecture standards.”

### **3\. RESTATE the rule from the document**

The AI must confirm understanding.

### **4\. RESUME**

Only after verification.

---

# **SECTION 8 — CONTEXT WINDOW MANAGEMENT**

AIs must actively manage context:

### **✔ summarize long threads**

### **✔ compress past reasoning**

### **✔ store persistent knowledge in documents**

### **✔ avoid repeating unnecessary context**

### **✔ request documents instead of guessing**

This prevents drift and hallucinations.

---

# **SECTION 9 — LONG-TERM KNOWLEDGE STORAGE (Canon Folder)**

Permanent knowledge MUST be stored in the following categories:

### **1\. Governance Docs**

Documents 1–50 (or more)

### **2\. Project Docs**

Project-specific rules

### **3\. Schema Docs**

Supabase schema, migrations, types

### **4\. Architecture Docs**

System-level patterns, diagrams

### **5\. Workflow Docs**

Feature maps, automations

### **6\. Coding Standards**

Components, naming, file patterns

These documents are the ONLY source of long-term truth.

---

# **SECTION 10 — ONE-SENTENCE SUMMARY**

**This doctrine ensures your AI ecosystem never forgets what matters, never hallucinates memory, never drifts across sessions, and always anchors its behavior in the permanent, documented laws of the Vibe Coding System.**

---

# **🧩 DOCUMENT 33 — THE AI FILE & DIRECTORY PROTECTION DOCTRINE**

## ***Rules for File Ownership, Edits, Locks & Protected Paths***

### ***The Security Framework That Prevents AI Collisions & Codebase Corruption***

---

# **SECTION 1 — PURPOSE OF THIS DOCUMENT**

This doctrine ensures:

* Every file has a clear owner

* Only the correct AI may modify a file

* Certain directories are protected

* AIs do not overwrite each other’s work

* Refactors cannot break architecture

* Environment variables are never corrupted

* Code is changed safely and consistently

* Protected files require explicit permission

This prevents 99% of AI-caused code disasters.

---

# **SECTION 2 — FILE OWNERSHIP PRINCIPLES**

Every file in your repo must have:

* a **single owner** (AI system)

* a **protected purpose**

* a **clear editing policy**

Rules:

### **1\. One AI \= One Domain \= One File Type Ownership**

No overlapping file ownership.

### **2\. An AI may ONLY edit files in its domain**

Examples:

* Supabase AI edits SQL, migration files, RLS

* Codex edits TypeScript/JSX/React files

* ChatGPT produces UI code but does NOT apply it

* Lovable handles scaffolding and deployment setup

* N8N edits workflows only

* Agent Builder edits agent logic only

### **3\. AIs cannot modify files outside their domain without explicit permission**

You must say:

“Codex, you are allowed to modify X.”

Otherwise — forbidden.

### **4\. Every protected file requires a protection check**

Before editing protected files, the AI must ask for confirmation.

---

# **SECTION 3 — FILE OWNERSHIP MATRIX**

This matrix defines EXACTLY which AI owns which files.

---

## **A. CODEX — Repo Engineer (Primary Code Owner)**

Codex has exclusive edit permissions over:

### **✔ JavaScript / TypeScript**

`*.js`, `*.ts`

### **✔ React**

`*.jsx`, `*.tsx`

### **✔ UI implementation files**

`/components`  
`/pages`  
`/app`  
`/hooks`  
`/utils`  
`/lib`  
`/services`

### **✔ Node backend logic**

`/api`  
`/server`  
`/middleware`

### **✔ Configs**

`vite.config.js`  
`package.json`  
`tsconfig.json`  
`tailwind.config.js`  
`.eslintrc.js`

### **❌ Codex MUST NOT edit:**

* SQL

* migrations

* RLS

* Supabase config

* .env

* n8n workflows

* agent logic

* Figma/Canvas files

---

## **B. SUPABASE AI — Database Owner**

Supabase AI owns:

### **✔ SQL migrations**

### **✔ Schema definitions**

### **✔ Functions**

### **✔ RLS policies**

### **✔ Views**

### **✔ Indexes**

### **✔ Auth tables**

### **✔ Triggers**

### **✔ Supabase types**

### **❌ Supabase AI MUST NOT edit:**

* JavaScript

* React

* UI code

* env vars

* N8N flows

* Agent logic

* Deploy files

---

## **C. LOVABLE — Deployment & Frontend Builder**

Lovable owns:

### **✔ Deployment configuration**

### **✔ Vercel config**

### **✔ Frontend template initialization**

### **✔ Starter directories**

### **✔ Hosting configuration**

### **❌ Lovable MUST NOT:**

* modify schema

* modify RLS

* mutate code without permission

* change backend logic

---

## **D. N8N — Automation Owner**

N8N owns:

### **✔ workflow files**

### **✔ nodes**

### **✔ webhook logic**

### **✔ integrations (Stripe, GHL, Supabase triggers)**

### **❌ N8N MUST NOT:**

* edit repo files

* write TypeScript

* touch Supabase schema

* modify RLS

---

## **E. AGENT BUILDER — Microservice/Agent Logic Owner**

Agent Builder owns:

### **✔ agent behavior**

### **✔ toolset definitions**

### **✔ external API orchestration**

### **❌ Agent Builder MUST NOT:**

* modify code

* edit SQL

* update RLS

* deploy apps

---

## **F. CHATGPT (Canvas/UX) — Design Owner**

ChatGPT owns:

### **✔ UI mockups**

### **✔ component structure**

### **✔ wireframes**

### **✔ UX copy**

### **✔ layout logic**

### **✔ styling patterns**

### **❌ ChatGPT MUST NOT:**

* apply code directly to repo

* modify files

* create migrations

* push code

---

# **SECTION 4 — PROTECTED DIRECTORIES**

These directories are locked.  
 No AI may modify them without explicit permission from Juan:

---

## **🔥 /supabase/migrations/**

Reason: destructive if mishandled  
 Owner: Supabase AI

---

## **🔥 /supabase/config.toml**

Reason: can break project  
 Owner: Supabase AI

---

## **🔥 /app/auth / server/auth**

Reason: authentication is sensitive  
 Owner: Supabase AI \+ Codex (shared with constraints)

---

## **🔥 /public/**

Reason: user assets & static files  
 Owner: Codex (with caution)

---

## **🔥 /n8n/**

Reason: workflow logic  
 Owner: N8N

---

## **🔥 /.github/**

Reason: CI/CD rules  
 Owner: DevOps (Codex with permission only)

---

## **🔥 /.env and .env.local**

Reason: credentials  
 Owner: Juan only

No AI may touch these unless you explicitly authorize it.

---

# **SECTION 5 — PROTECTED FILES (High-Risk Files)**

These files require a **permission handshake** before ANY change:

### **✔ `.env`**

### **✔ `.env.local`**

### **✔ `supabase/config.toml`**

### **✔ `supabase/migrations/*`**

### **✔ `tailwind.config.js`**

### **✔ `tsconfig.json`**

### **✔ `package.json`**

### **✔ `schema.sql`**

### **✔ `auth-service.js`**

### **✔ `billing-service.js`**

### **✔ any file with “auth”, “payment”, or “security” in name**

Before modifying, the AI must say:

`This file requires elevated permission.`    
`Do you authorize modification of: <file_path>?`

---

# **SECTION 6 — FILE LOCKING RULES (Critical)**

### **Rule 1 — A File Being Modified Is Locked**

No other AI may touch the file until the owner says “complete.”

### **Rule 2 — Only One AI May Modify Code at a Time**

Prevents file corruption.

### **Rule 3 — AI Must Announce Before Editing**

Example:

`Codex: I am preparing to modify /components/Header.jsx.`  
`Please confirm.`

### **Rule 4 — If Two AIs need the same file, Codex wins**

Codex is the repo master.

### **Rule 5 — User Overrides Can Override Locks**

Your word is law.

---

# **SECTION 7 — FILE MODIFICATION PROTOCOL**

Before modifying ANY file, an AI must:

---

## **Step 1 — Identify Ownership**

`This file belongs to <AI>.`

## **Step 2 — Request Permission**

`Do you authorize me to modify <file_path>?`

## **Step 3 — Show Planned Changes**

`Here is the exact change I will perform:`  
`<diff-style code block>`

## **Step 4 — Apply Safely**

Only after you say:

“Approved.”

## **Step 5 — Report Summary**

`File Edited:`  
`- Path: …`  
`- Changes Applied:`  
`- No errors detected.`

---

# **SECTION 8 — PREVENTING FILE COLLISIONS**

AIs must follow:

### **✔ Ownership matrix**

### **✔ Edit protocol**

### **✔ File locks**

### **✔ Protected file rules**

### **✔ One-AI-at-a-time execution**

This prevents:

* merge conflicts

* overwritten code

* broken imports

* missing dependencies

* lost functions

This is essential for stability.

---

# **SECTION 9 — ESCALATION RULES FOR UNSAFE FILES**

If an AI detects:

* circular imports

* huge unstructured files

* poorly named folders

* conflicting code

* schema drift

* corrupt migrations

* missing RLS

* ambiguous component structure

The AI must STOP and escalate:

`Unsafe file structure detected.`  
`Please confirm how to proceed:`  
`- refactor`  
`- repair`  
`- isolate`  
`- recreate`  
`- ignore for now`

AIs must NEVER guess.

---

# **SECTION 10 — ONE-SENTENCE SUMMARY**

**This doctrine ensures every AI respects file ownership, protects critical directories, follows strict modification rules, and prevents file collisions — giving you stable, predictable, safe AI-driven development.**

---

# **🧩 DOCUMENT 34 — THE AI ARCHITECTURAL EVOLUTION DOCTRINE**

## ***Rules for Changing, Upgrading & Scaling System Architecture Safely***

### ***The Governance Framework for Structural Changes, System Upgrades & Long-Term Growth***

---

# **SECTION 1 — PURPOSE OF THIS DOCUMENT**

This doctrine exists to control ANY change to:

* folder structure

* routing structure

* service boundaries

* database architecture

* system design patterns

* API layouts

* frontend layouts

* backend structure

* multi-service ecosystems

* cloud or deployment topology

It ensures:

* predictability

* consistency

* stability

* backwards compatibility

* minimal disruption

* clear communication

* safe rollouts

This document defines exactly **how your AI workforce evolves the architecture without breaking your apps.**

---

# **SECTION 2 — ARCHITECTURAL EVOLUTION PRINCIPLES**

All AIs must obey these foundational laws:

### **Principle 1 — Architecture Evolves Intentionally, Not Accidentally**

No agent may alter structure as a side effect of another task.

### **Principle 2 — Evolution Must Be Incremental**

Big-bang rewrites are forbidden.

### **Principle 3 — New Architecture Must Coexist With the Old**

Backward compatibility must be maintained during the transition.

### **Principle 4 — A Single AI Owns Architectural Execution**

Codex executes  
 Supabase AI migrates  
 ChatGPT designs  
 Lovable scaffolds  
 N8N automates  
 But *only one architect at a time* directs change.

### **Principle 5 — Architecture Must Serve the Product**

No unnecessary complexity, no academic over-engineering.

---

# **SECTION 3 — WHEN ARCHITECTURE IS ALLOWED TO CHANGE**

Architectural change is ONLY allowed when one of the following is true:

### **✔ 1\. The system is scaling**

### **✔ 2\. Structure is causing bugs**

### **✔ 3\. Structure is limiting development speed**

### **✔ 4\. A new feature requires a clearer boundary**

### **✔ 5\. Reuse is too low**

### **✔ 6\. It simplifies complexity**

### **✔ 7\. It aligns with your Naming/Folder Conventions Doctrine**

### **✔ 8\. It supports a new product direction**

Any other reason \= not allowed.

---

# **SECTION 4 — ARCHITECTURAL CHANGE TIERS (Mandatory)**

All changes must be classified as one of these:

---

## **Tier 1 — Cosmetic Adjustments**

Examples:

* renaming a component

* reorganizing imports

* moving a non-critical file

Allowed with minimal protocol.

---

## **Tier 2 — Structural Improvements**

Examples:

* moving components to `/components/ui`

* reorganizing `/services`

* extracting hooks

* cleaning up utils

Requires review \+ impact analysis.

---

## **Tier 3 — Architectural Shifts**

Examples:

* introducing new feature modules

* new routing patterns

* new page architecture

* upgraded component frameworks

* state management changes

Requires full architectural plan.

---

## **Tier 4 — System Evolution (Major)**

Examples:

* migrating from pages router → app router

* switching authentication provider

* changing database strategy

* splitting into microservices

* adopting event-driven architecture

Requires multi-AI approval and rollback plan.

---

# **SECTION 5 — ARCHITECTURAL CHANGE PROTOCOL**

Every architectural change follows the **7-Stage Evolution Process:**

---

# **Stage 1 — INITIATION**

The initiating AI (normally ChatGPT or UX Pilot AI) must provide:

* Why change is needed

* The problem it solves

* The scope

* The risk level

* The expected benefits

---

# **Stage 2 — DOMAIN OWNERSHIP CLAIM**

Codex must claim ownership (or decline):

`I am claiming ownership of architectural execution.`

Supabase AI claims only for database architecture.

---

# **Stage 3 — IMPACT ANALYSIS**

All AIs must analyze impact on:

* file structure

* imports & dependencies

* routing

* auth

* RLS

* Supabase schema

* API endpoints

* automations (N8N)

* deployment (Lovable)

* mobile/web compatibility

Changes cannot proceed until analysis is complete.

---

# **Stage 4 — MIGRATION PLAN**

A complete architectural migration plan must include:

### **✔ Proposed folder structure**

### **✔ File moves (with old → new mapping)**

### **✔ Code changes required**

### **✔ Refactor plan**

### **✔ Rollback strategy**

### **✔ Impact on tests**

### **✔ Impact on Supabase**

### **✔ Impact on deployment**

Codex must present the plan BEFORE touching code.

---

# **Stage 5 — STAGED EXECUTION**

Execution must be incremental:

### **✔ Step 1 — Introduce new structure**

### **✔ Step 2 — Move code in small batches**

### **✔ Step 3 — Rewire imports**

### **✔ Step 4 — Validate with lint/tests**

### **✔ Step 5 — Switch active usage**

### **✔ Step 6 — Remove old structure**

Each step is evaluated before moving on.

---

# **Stage 6 — VALIDATION**

AIs must verify:

* code compiles

* no imports broken

* UI renders

* API works

* N8N workflows unaffected

* migrations applied correctly

* RLS unchanged

* deployment still works

If ANY check fails → rollback.

---

# **Stage 7 — FINALIZATION**

When stable:

* update documentation

* update folder maps

* update architecture diagrams

* update Codex Command Book

* update Feature Genesis Protocol

* update AI Role Charter

This locks in the new architecture.

---

# **SECTION 6 — PROTECTED ARCHITECTURAL COMPONENTS**

These parts of your system are **extremely sensitive** and may only be modified after explicit approval:

### **🔥 routing structure**

### **🔥 authentication flows**

### **🔥 state management system**

### **🔥 layout files (`layout.tsx`)**

### **🔥 root-level providers**

### **🔥 environmental configuration**

### **🔥 Supabase RLS**

### **🔥 core business logic**

### **🔥 shared utilities**

### **🔥 global types**

These are NEVER touched without going through the 7-Stage Evolution Process.

---

# **SECTION 7 — ARCHITECTURAL ANTI-PATTERNS (Forbidden)**

Your AIs MUST NOT:

### **❌ invent new folder structures randomly**

### **❌ duplicate UI patterns across modules**

### **❌ scatter business logic across files**

### **❌ reimplement auth logic**

### **❌ introduce global state recklessly**

### **❌ create circular dependencies**

### **❌ couple frontend directly to database logic**

### **❌ use scaffolding tools without permission**

### **❌ restructure directories secretly**

### **❌ adopt microservices by accident**

These actions destroy coherence.

---

# **SECTION 8 — ARCHITECTURAL SAFETY GUARANTEES**

Every architectural change must guarantee:

### **✔ backward compatibility**

### **✔ safe rollback**

### **✔ preserved data integrity**

### **✔ preserved RLS**

### **✔ preserved analytics events**

### **✔ preserved automations**

### **✔ preserved deployments**

### **✔ preserved UX consistency**

### **✔ no downtime**

### **✔ no breaking changes without approval**

---

# **SECTION 9 — AI RESPONSIBILITY MODEL FOR ARCHITECTURAL CHANGES**

AIs must follow the chain of command:

### **ChatGPT:**

Proposes the change, defines the ideal architecture.

### **Codex:**

Executes the change in code.

### **Supabase AI:**

Adapts the database if needed.

### **N8N:**

Adapts workflow routes if necessary.

### **UX Pilot AI:**

Ensures UX consistency.

### **Lovable:**

Ensures deployment stability.

Each stays strictly inside their domain.

---

# **SECTION 10 — ONE-SENTENCE SUMMARY**

**This doctrine ensures every architectural evolution is intentional, incremental, reversible, stable, documented, and aligned with your long-term system vision — eliminating chaos, drift, and accidental complexity.**

---

# **📘 DOCUMENT 35 — THE AI DEPENDENCY GOVERNANCE DOCTRINE**

## ***Rules for Packages, Libraries & Third-Party Integrations***

### ***How Your AI System Chooses, Installs, Updates, Audits & Removes Dependencies Safely***

---

Juan —  
 This is your **official rulebook** for how ALL AIs handle dependencies across your entire ecosystem.

This doctrine prevents:

* bloated `package.json`

* random libraries being installed

* conflicting versions

* security holes

* breaking changes

* duplicated libraries

* incompatible ecosystems

* dependency hell

* unpredictable AI behavior

This is structured like a **government-level policy document** — strict, explicit, and enforceable.

Let’s begin.

---

# **SECTION 1 — PURPOSE OF THIS DOCTRINE**

The Dependency Governance Doctrine defines:

* **How dependencies can be selected**

* **When dependencies can be installed**

* **Which sources are allowed**

* **How updates are managed**

* **How security is enforced**

* **How conflicting libraries are resolved**

* **How dependency removal is handled**

* **Rules for frontend, backend, and shared libraries**

It ensures your entire app ecosystem stays:

* clean

* secure

* stable

* predictable

* maintainable

* AI-friendly

---

# **SECTION 2 — THE 5 DEPENDENCY LAWS**

All AIs MUST obey these five fundamental laws:

### **LAW 1 — No Dependency Shall Be Installed Without Approval**

No AI is allowed to install libraries on its own initiative.

### **LAW 2 — Every Dependency Must Serve a Clear Purpose**

It must solve a real problem, not “seem useful”.

### **LAW 3 — Every Dependency Must Be the Minimum Required**

Prefer native capabilities over external packages.

### **LAW 4 — Stability \> Novelty**

Stable, mature libraries always beat new or experimental ones.

### **LAW 5 — All Dependencies Must Be Auditable & Replaceable**

Everything must be documented, removable, and testable.

---

# **SECTION 3 — APPROVED DEPENDENCY SOURCES**

All dependencies must come from trusted sources:

### **✔ npm (JavaScript/TypeScript)**

### **✔ pip \+ PyPI (Python)**

### **✔ Supabase ecosystem packages**

### **✔ GitHub (only vetted repos, pinned versions)**

### **✔ Official vendor SDKs**

Forbidden sources:

### **❌ random ZIP files**

### **❌ unverified GitHub gists**

### **❌ personal forks**

### **❌ alpha-stage libraries**

### **❌ deprecated libraries**

### **❌ libraries with unclear licenses**

---

# **SECTION 4 — THE DEPENDENCY REQUEST PROTOCOL**

To install ANY dependency, an AI must perform this 6-step protocol.

---

## **STEP 1 — Needs Assessment**

The initiating AI (usually ChatGPT or Codex) must justify:

* What problem does the dependency solve?

* Can it be solved without a library?

* Why is this dependency the correct choice?

---

## **STEP 2 — Alternatives Evaluation**

AIs must evaluate at least **3 alternatives**, comparing:

* size

* age

* ease of use

* documentation quality

* popularity

* community support

* long-term stability

---

## **STEP 3 — Compatibility Check**

The AI must evaluate:

* React/Tailwind compatibility

* Node version compatibility

* Supabase compatibility

* Existing dependencies

* Deployment targets (Lovable, Vercel)

* Security vulnerabilities

---

## **STEP 4 — Risk Classification**

Classify the dependency change:

### **Low Risk**

* UI components

* helper utilities

* icons

* date formatters

### **Medium Risk**

* state management

* API clients

* routing libraries

### **High Risk**

* authentication

* database clients

* build tools

* anything globally installed

High risk requires a migration plan.

---

## **STEP 5 — Approval**

You (Juan) must explicitly approve high-risk dependencies.

AIs may auto-approve low-risk, but must still report them.

---

## **STEP 6 — Controlled Installation**

Codex must perform the installation using:

`npm install <package>`

or

`pip install <package>`

NEVER install globally unless explicitly ordered.

---

# **SECTION 5 — RULES FOR MAINTAINING PACKAGE.JSON**

Your `package.json` must follow these laws:

### **✔ All dependencies alphabetized**

### **✔ No duplicates**

### **✔ No unused dependencies**

### **✔ No abandoned packages**

### **✔ No “mystery” packages**

### **✔ Every dependency must have a comment in DOC 1**

### **✔ Lockfile must always be committed (`package-lock.json`)**

---

# **SECTION 6 — VERSIONING RULES**

Your ecosystem follows strict versioning governance:

### **Pinned Versions Only**

No `^` (caret) and no `~`.

### **Allowed:**

`"tailwindcss": "3.4.3"`

### **Forbidden:**

`"tailwindcss": "^3.4.3"`  
`"tailwindcss": "~3.4.3"`

These create inconsistent versions across deployments.

---

# **SECTION 7 — UPGRADE PROTOCOL**

Upgrading dependencies must follow this 5-stage process:

---

## **Stage 1 — Non-breaking upgrades (patch)**

Automatically allowed with:

`npm update <package>`

---

## **Stage 2 — Minor upgrades**

Allowed if:

* Changelog reviewed

* Codex tests build locally

* No lint errors

* No UI breakage

---

## **Stage 3 — Major upgrades**

These require:

* full change impact audit

* deprecation analysis

* replacement plan

* migration steps

AI MUST produce:

* “Before upgrade” code snapshot

* “After upgrade” plan

* Rollback strategy

---

# **SECTION 8 — THE REMOVAL PROTOCOL**

Removing a dependency requires:

### **✔ Identify all files using it**

### **✔ Remove usage safely**

### **✔ Replace with alternatives if needed**

### **✔ Remove import statements**

### **✔ Remove config references**

### **✔ Clean up dead code**

### **✔ Ensure build passes**

### **✔ Update documentation**

No package is allowed to be removed without these steps.

---

# **SECTION 9 — SECURITY RULES**

Every dependency must be scanned for:

### **✔ known vulnerabilities**

### **✔ unmaintained packages**

### **✔ suspicious permissions**

### **✔ dangerous post-install scripts**

### **✔ usage of deprecated APIs**

### **✔ GPL or forbidden licenses**

Forbidden licenses unless explicitly approved:

* GPL

* AGPL

* LGPL

These can infect your codebase legally.

---

# **SECTION 10 — AI RESPONSIBILITY MATRIX**

| AI Agent | Role |
| ----- | ----- |
| **ChatGPT** | Identifies need, evaluates options |
| **Codex** | Installs, updates, removes, audits |
| **Lovable** | Ensures deployment compatibility |
| **Supabase AI** | Checks backend compatibility |
| **N8N** | Updates workflows if integrations change |
| **UX Pilot AI** | Ensures UI consistency across upgrades |
| **Agent Builder** | Manages agent dependencies tied to skills |

---

# **SECTION 11 — DEPENDENCY ANTI-PATTERNS (Forbidden)**

### **❌ Installing libraries without purpose**

### **❌ Using multiple libraries that do the same thing**

### **❌ Adding a library to “play around”**

### **❌ Installing experimental versions**

### **❌ Adding global state libraries without approval**

### **❌ Introducing authentication libraries manually**

### **❌ Adding heavy utility libraries (e.g., lodash) without reason**

### **❌ Adding chart libraries randomly**

### **❌ Hard-coupling to vendor SDKs**

---

# **SECTION 12 — DEPENDENCY SAFETY GUARANTEES**

All AIs must guarantee:

### **✔ clean install**

### **✔ predictable builds**

### **✔ reproducible environments**

### **✔ no duplicate libraries**

### **✔ no conflicting versions**

### **✔ safe upgrades**

### **✔ stable third-party integrations**

---

# **ONE SENTENCE SUMMARY**

**This doctrine ensures that dependencies are chosen wisely, installed safely, upgraded carefully, audited continuously, and removed cleanly — protecting your entire AI-built ecosystem from chaos, bloat, and instability.**