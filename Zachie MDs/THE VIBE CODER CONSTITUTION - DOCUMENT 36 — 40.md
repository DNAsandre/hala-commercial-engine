# **📘 DOCUMENT 36 — THE SUPABASE API & FUNCTION GOVERNANCE DOCTRINE**

## ***How AIs Design, Secure, Version & Maintain Serverless Functions in Your Ecosystem***

### ***This doctrine governs ALL Supabase Edge Functions, APIs & backend logic written by your AI team.***

---

Juan —  
 This is the **master rulebook** for how ALL AIs handle anything related to:

* Supabase Edge Functions

* Supabase API endpoints

* Database-triggered functions

* Webhooks

* Row-Level Security integration

* API versioning

* Authentication validation

* Function naming

* Function lifecycle

* Logging, metrics, observability

* Secure best practices

This is a **strict technical governance document**, not written in 8th-grade language — this is written for your **AI engineering agents**.

---

# **SECTION 1 — PURPOSE OF THIS DOCTRINE**

This doctrine defines:

* How the AI system creates Supabase serverless functions

* How endpoints are designed, named, documented & deployed

* How authentication & authorization must be enforced

* How RLS integration works

* How breaking changes are prevented

* How multiple AIs collaborate without conflict

* Lifecycle rules for creating, updating, versioning & retiring functions

This ensures your backend is:

* secure

* consistent

* scalable

* reliable

* upgradeable

* AI-maintainable

---

# **SECTION 2 — THE CORE LAWS OF SUPABASE FUNCTION GOVERNANCE**

All AIs MUST follow these seven laws:

### **LAW 1 — No Function Shall Be Created Without Purpose**

Every function must have a clear, documented intent and expected inputs/outputs.

### **LAW 2 — Function Names Must Follow the Global Naming Standard**

Pattern:

`<product>-<domain>-<action>-v<version>`

Example:

`skylink-auth-login-v1`  
`skylink-billing-create-session-v2`

### **LAW 3 — All Functions Must Be Stateless & Deterministic**

No global variables. No cross-function memory. No hidden assumptions.

### **LAW 4 — Authentication Must Be Explicitly Enforced**

Every function must validate:

* User session

* User role

* Required permissions

* RLS alignment

### **LAW 5 — Versioning Is Mandatory**

No AI is allowed to modify an existing function without version bump.

### **LAW 6 — All Functions Must Be Logged, Monitored & Audited**

Inputs, outputs, and errors must be traceable.

### **LAW 7 — Every Function Must Be Fully Documented**

Documentation is REQUIRED before deployment.

---

# **SECTION 3 — FUNCTION NAMING STANDARDS**

All Supabase functions must follow strict naming rules:

### **Name Format**

`productName-domain-action-vX`

Where:

* **productName** \= skylink, vibecloud, etc.

* **domain** \= billing, auth, user, checkout, ai, messaging, etc.

* **action** \= create, update, delete, sync, generate

* **version** \= v1, v2, v3

### **Examples:**

`skylink-user-get-profile-v1`  
`skylink-auth-login-v1`  
`skylink-billing-create-session-v2`  
`skylink-ai-generate-summary-v3`

This prevents collisions and keeps everything scalable.

---

# **SECTION 4 — FOLDER & FILE STRUCTURE RULES**

AIs must always structure functions like this:

`/supabase`  
  `/functions`  
    `/function-name`  
      `index.ts`  
      `types.ts`  
      `utils.ts`  
      `README.md`  
      `config.json`

**Mandatory files:**

### **✔ `index.ts`**

The main handler.

### **✔ `types.ts`**

Defines input/output/response types.

### **✔ `utils.ts`**

Optional logic helpers.

### **✔ `README.md`**

Documentation required for every function.

### **✔ `config.json`**

Defines runtime config, like:

* timeout

* environment variables

* allowed methods

---

# **SECTION 5 — RULES FOR DESIGNING FUNCTIONS**

## **Rule A — Always Use Explicit Types**

Every function must define:

* Request type

* Response type

* Error type

Example:

`export interface LoginRequest {`  
  `email: string`  
  `password: string`  
`}`

`export interface LoginResponse {`  
  `userId: string`  
  `token: string`  
`}`

---

## **Rule B — Validate All Inputs**

All inputs must be validated:

`if (!body.email || !body.password) {`  
  `return error("Missing email or password", 400)`  
`}`

---

## **Rule C — Use Supabase Client Securely**

Always initialize inside the handler:

`const supabase = createClient(`  
  `Deno.env.get("SUPABASE_URL"),`  
  `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`  
`)`

Never reuse global clients.

---

## **Rule D — Handle Errors Gracefully**

Every function must follow this pattern:

`try {`  
  `// logic`  
`} catch (err) {`  
  `console.error(err)`  
  `return error("Internal server error", 500)`  
`}`

---

## **Rule E — No Expensive Computation Inside Functions**

Heavy tasks must be moved to:

* n8n

* Agent Builder

* background queues

Supabase Edge Functions must stay efficient.

---

# **SECTION 6 — API SECURITY REQUIREMENTS**

All functions MUST enforce:

### **✔ Auth token validation**

### **✔ RLS alignment**

### **✔ Role validation**

### **✔ Schema constraints**

### **✔ No direct `service_role` key exposure**

### **✔ No public write operations without checks**

### **✔ Rate limiting (via middleware or external system)**

**EVERY function must check user authorization before doing anything.**

---

# **SECTION 7 — ROUTING & REQUEST REQUIREMENTS**

All AIs must follow:

### **Allowed HTTP Methods**

* GET (read-only)

* POST (mutations)

* PUT (replace)

* PATCH (partial update)

* DELETE (remove)

### **Forbidden**

* Custom methods

* State-changing GET requests

---

# **SECTION 8 — VERSIONING RULES**

Version bumps are required when:

### **Patch Release (v1 → v1.1)**

* small internal improvements

* doc updates

* micro optimizations

### **Minor Release (v1 → v1.2)**

* non-breaking enhancements

* optional parameters added

### **Major Release (v1 → v2)**

Mandatory when:

* response format changes

* database schema changes

* behavior changes

* auth logic changes

* endpoints merged or split

---

# **SECTION 9 — FUNCTION UPDATE PROTOCOL**

When updating a function, the AI must:

**Clone the existing function**  
 Example:

 `skylink-user-get-profile-v1 → skylink-user-get-profile-v2`

1.   
2. **Apply changes ONLY to the new version**

3. **Test locally**

4. **Validate security**

5. **Deploy to Supabase**

6. **Update clients to point to the new version**

7. **Deprecate older versions gracefully**

---

# **SECTION 10 — FUNCTION DEPRECATION PROTOCOL**

A function cannot be deleted without:

### **✔ 30-day deprecation notice**

### **✔ Migration path defined**

### **✔ Client-side updates completed**

### **✔ API users informed (internal AIs)**

### **✔ Full audit trail created**

No AI may remove functions silently.

---

# **SECTION 11 — TESTING & VALIDATION STANDARDS**

Every function must have:

### **✔ unit tests**

### **✔ integration tests**

### **✔ mock Supabase client**

### **✔ validation tests**

### **✔ security tests**

### **✔ load performance baseline**

---

# **SECTION 12 — LOGGING & OBSERVABILITY RULES**

Every function must log:

* request timestamp

* user ID (if available)

* action name

* status code

* execution time

* errors

Logs must never contain:

* passwords

* tokens

* personal data

---

# **SECTION 13 — AI ROLES & RESPONSIBILITIES**

| AI Agent | Responsibility |
| ----- | ----- |
| **ChatGPT** | Design functions, define requirements, write code |
| **Codex** | Create folders, update files, deploy functions |
| **Supabase AI** | Validate function security, schema compatibility |
| **Lovable** | Update frontend clients for new versions |
| **n8n** | React to webhook triggers |
| **Agent Builder** | Handle async heavy tasks |
| **UX Pilot AI** | Ensure UI impact understood |

---

# **SECTION 14 — FUNCTION ANTI-PATTERNS (Forbidden)**

### **❌ giant monolithic functions**

### **❌ bypassing RLS**

### **❌ inline SQL without parameterization**

### **❌ returning raw database errors**

### **❌ global state**

### **❌ mixed responsibilities**

### **❌ modifying database without auth checks**

### **❌ calling external APIs without timeout**

### **❌ running expensive loops**

---

# **SECTION 15 — SINGLE SENTENCE SUMMARY**

**This doctrine guarantees that every Supabase function your AI agents create is secure, versioned, auditable, maintainable, predictable, and compatible across your entire ecosystem — forever.**

---

If you're ready, I will now generate:

# **Document 37 — The Automation Doctrine: Rules for n8n, Webhooks, Schedulers, Background Jobs & System Automations.**

---

# **✅ You need a new doctrine:**

## **📘 Document 38 — The AI Knowledge Base Doctrine: Rules for Using Supabase as the Shared Memory & Brain of All Agents**

This will govern:

### **✔ How AIs store information**

### **✔ What they’re allowed to remember**

### **✔ How they structure “knowledge” tables**

### **✔ How they update shared state**

### **✔ How they avoid overwriting each other**

### **✔ How they share context with other agents**

### **✔ How conversations → memory → system state**

### **✔ How to prevent hallucinated data from being saved**

### **✔ How AIs read context safely**

### **✔ How AIs tag and classify knowledge**

### **✔ How AIs use embeddings to find relevant knowledge**

### **✔ How knowledge passes between tools (Codex → Agent Builder → n8n → ChatGPT etc.)**

This is essentially:

# **Your AI’s Long-Term Shared Brain.**

Let me outline Document 38 for you so you can confirm before I fully write it.

---

# **📘 DRAFT OUTLINE — Document 38**

## ***The AI Knowledge Base Doctrine: Shared Memory, Context & Cross-Agent Intelligence***

---

## **SECTION 1 — Purpose**

* Why AIs need shared memory

* Why Supabase is chosen

* Why direct writing is dangerous

* Why rules are needed

---

## **SECTION 2 — The 4 Types of AI Memory**

### **1\. Ephemeral memory (conversation only)**

### **2\. Project memory (per app)**

### **3\. System memory (global)**

### **4\. Agent-specific memory (private to each agent)**

---

## **SECTION 3 — The Knowledge Storage Rules**

* When AIs may write

* When AIs must not write

* Required validation

* Human approval requirements

* Conflict prevention

* Versioning of knowledge entries

---

## **SECTION 4 — Authorized Knowledge Tables**

* `/knowledge/core`

* `/knowledge/projects`

* `/knowledge/features`

* `/knowledge/debug-history`

* `/knowledge-errors`

* `/knowledge-system-state`

* `/knowledge-insights`

Each table has strict schemas.

---

## **SECTION 5 — Knowledge Classification**

AIs must classify every new memory:

* `fact`

* `decision`

* `architecture-principle`

* `user-preference`

* `dependency-rule`

* `workflow-step`

* `error-solution`

* `design-pattern`

* `system-warning`

---

## **SECTION 6 — The “No Hallucination Storage” Rule**

Before writing knowledge:

* AI must verify

* AI must cite source

* AI must run accuracy checks

* AI must confirm the info is not invented

* Human approval for high-impact memory

---

## **SECTION 7 — Update Protocol (The 6-Step Safe Update Cycle)**

1. Retrieve current row

2. Compare differences

3. Summarize change

4. Validate correctness

5. Ask approval if needed

6. Write update

---

## **SECTION 8 — AI → AI Knowledge Passing Rule**

No agent may “guess” other agents’ memory.

Knowledge transfer must be done through:

* Supabase

* Registered events

* Agent Builder callbacks

* n8n webhooks

* Codex notes

* Knowledge tables

---

## **SECTION 9 — Embedding Search & Retrieval Rules**

AIs must use:

* embeddings

* tags

* semantic search

* similarity scoring

for retrieving relevant memory, not raw keyword queries.

---

## **SECTION 10 — Expiration & Archival**

AIs must auto-archive:

* outdated rules

* superseded decisions

* deprecated architectures

* old debugging logs

---

## **SECTION 11 — Memory Security**

* RLS rules for agents

* Role separation

* Write-only vs read-only agents

* Immutable history

* Responsible AI logging

---

## **SECTION 12 — Agent Responsibilities**

### **ChatGPT**

* writes conceptual knowledge

* documents architecture

* maintains rules

### **Codex**

* writes operational knowledge

* documents code decisions

### **Agent Builder**

* stores task outcomes

* logs tool results

### **n8n**

* stores workflow outputs

* tracks system events

### **Supabase AI**

* maintains schema knowledge

### **UX Pilot AI**

* stores UI decisions

* UX insights

---

## **SECTION 13 — Forbidden Knowledge Actions**

* No overwrites without version

* No hallucinated data

* No speculative assumptions

* No unvalidated facts

* No writing personal data

* No creating hidden memory

* No bypassing RLS

* No storing code in knowledge tables

---

## **SECTION 14 — Knowledge Integrity Score**

Every memory entry gets:

* Accuracy score

* Reliability score

* Confidence score

* Validation timestamp

* Validation source

---

## **SECTION 15 — The Knowledge Lifecycle**

1. Creation

2. Validation

3. Usage

4. Update

5. Versioning

6. Archival

7. Deletion (rare, controlled)

---

## **SECTION 16 — Single Sentence Summary**

**This doctrine ensures all AI agents share a safe, structured, validated, and coordinated knowledge system using Supabase — becoming a unified multi-agent intelligence with no conflicts, no hallucinations, and no lost context.**

---

###### 

# **📘 DOCUMENT 38 — THE AI KNOWLEDGE BASE DOCTRINE**

## **Rules for Using Supabase as the Shared Memory, Context Engine & Cross-Agent Brain of Your Entire AI System**

### ***This is the official law book governing how all AIs store, retrieve, update, validate, and share knowledge inside Supabase.***

---

Juan —  
 This doctrine is one of the **most powerful** in your entire system.  
 It controls how your AI agents:

* remember

* forget

* update

* communicate

* share context

* avoid hallucinating “facts”

* build long-term intelligence

* collaborate without conflict

* coordinate decisions across tools

This is the brain of your AI organization.

Let’s build it.

---

# **SECTION 1 — PURPOSE OF THIS DOCTRINE**

The purpose of this doctrine is to govern:

* How AIs store knowledge in Supabase

* How they retrieve relevant memories

* How they validate correctness before writing

* How knowledge is structured, versioned, and updated

* How agents share information without creating conflict

* How long-term system intelligence evolves safely

* How hallucinations and false knowledge are prevented

* How memory becomes a *shared operational intelligence*

This doctrine ensures:

### **✔ no corrupted memory**

### **✔ no hallucinated “facts” being saved**

### **✔ no overwrites without validation**

### **✔ no agent conflicts**

### **✔ no duplication**

### **✔ deterministic and safe memory usage**

---

# **SECTION 2 — THE FOUR CLASSES OF AI MEMORY**

All agents must use ONLY these four forms of memory.

---

## **1\. Ephemeral Memory (short-term)**

* Exists only in the current conversation

* Not saved to Supabase

* Not persistent

* Disappears immediately after task completion

Used for:

* task-level reasoning

* temporary variables

* short-term problem solving

---

## **2\. Project Memory (per-app)**

Stored in Supabase under:

`knowledge.project_data`

Contains:

* feature definitions

* app naming conventions

* layout rules

* architectural decisions

* version history

* dependencies specific to that project

---

## **3\. System Memory (global)**

Stored in:

`knowledge.system_rules`  
`knowledge.global_decisions`  
`knowledge.standards`

Contains:

* architectural doctrines

* naming conventions

* system-wide rules

* cross-app decisions

* coding standards

* agent protocols

---

## **4\. Agent-Specific Memory (private)**

Stored in:

`knowledge.agent_memory`

Each agent has private memory for:

* preferences

* past tasks

* local insights

* operational notes

No other agent may modify another agent’s private memory.

---

# **SECTION 3 — APPROVED KNOWLEDGE TABLES**

All knowledge must be stored ONLY in the following official tables:

---

## **1\. `knowledge.core`**

Fundamental system-level rules.

## **2\. `knowledge.projects`**

Project summaries, key decisions, naming rules.

## **3\. `knowledge.features`**

Feature definitions, requirements, specs.

## **4\. `knowledge.schemas`**

Database schema snapshots, column definitions, constraints.

## **5\. `knowledge.rls_policies`**

Stored explanations of Row Level Security rules.

## **6\. `knowledge.code_decisions`**

Why certain code structures or libraries were chosen.

## **7\. `knowledge.debug_history`**

Bug → cause → solution mapping.

## **8\. `knowledge.errors`**

Error classification and resolution patterns.

## **9\. `knowledge.system_events`**

Deployments, migrations, major changes.

## **10\. `knowledge.user_preferences`**

Your preferences (Juan) about workflow, naming, UX, etc.

## **11\. `knowledge.agents`**

Memory specific to each agent.

---

No other tables may be created for memory unless explicitly approved.

---

# **SECTION 4 — THE KNOWLEDGE STORAGE RULES**

Every piece of information must follow these strict rules:

---

### **RULE 1 — No AI May Save Knowledge Without Justification**

Every write requires purpose.

---

### **RULE 2 — No Unverified or Speculative Data May Be Saved**

No hallucinations.  
 No guesses.  
 No assumptions.

---

### **RULE 3 — Every Knowledge Entry Must Be Classified**

Classification categories:

* `fact`

* `preference`

* `decision`

* `rule`

* `pattern`

* `workflow`

* `error`

* `solution`

* `schema`

* `architecture`

---

### **RULE 4 — All Knowledge Must Be Timestamped & Versioned**

Knowledge cannot be overwritten — only versioned.

---

### **RULE 5 — All Knowledge Must Be Traceable to a Source**

AIs must reference:

* doctrine

* user instruction

* code file

* log

* Supabase schema

* system event

No opaque “agent thoughts.”

---

### **RULE 6 — High-Impact Memory Requires Human Approval**

Examples:

* architectural changes

* new RLS policies

* database schema changes

* global rules

* new cross-agent protocols

AIs must ask:

“Juan, approve this memory entry?”

---

# **SECTION 5 — THE KNOWLEDGE UPDATE PROTOCOL**

To modify any knowledge record, all AIs must follow this 6-step sequence:

---

## **STEP 1 — Retrieve Existing Knowledge**

AIs must analyze what already exists.

---

## **STEP 2 — Generate a Change Plan**

The AI must explain:

* what is changing

* why

* risk level

* alternatives

---

## **STEP 3 — Validate Change Against Doctrines**

All doctrines (1 through 38\) must be checked.

---

## **STEP 4 — Approval (Required for certain classes)**

Human approval required for:

* high-risk

* breaking changes

* schema-impacting memory

---

## **STEP 5 — Safe Update**

The AI must:

* version-bump

* archive old memory

* insert new memory

* log change

---

## **STEP 6 — Notify Other Agents**

Codex, Agent Builder, n8n, etc., must be told:

“A new knowledge entry is available.”

---

# **SECTION 6 — AI → AI KNOWLEDGE SHARING RULES**

Agents must never pass “brain dumps” to each other.

All knowledge sharing must occur ONLY through:

### **✔ Supabase**

### **✔ n8n triggers**

### **✔ messages with structured payloads**

### **✔ Agent Builder tasks**

### **✔ Codex file updates**

### **✔ knowledge tables**

Agents must NEVER:

* read each other’s raw logs

* assume information

* infer missing data

* predict another agent’s memory

All knowledge must be retrieved through defined APIs.

---

# **SECTION 7 — HALLUCINATION PREVENTION RULES**

Before writing to Supabase, AIs must:

### **✔ validate data using system doctrine**

### **✔ validate against existing knowledge**

### **✔ check for conflicts**

### **✔ verify schema correctness**

### **✔ confirm factual accuracy**

### **✔ classify reliability level**

### **✔ output a confidence score**

### **✔ cite the source**

If evidence is insufficient → **memory is forbidden**.

---

# **SECTION 8 — RETRIEVAL & SEMANTIC SEARCH RULES**

All retrieval must use:

### **✔ embeddings**

### **✔ similarity scoring**

### **✔ tags**

### **✔ classification filters**

### **✔ role-based access**

AIs must not:

* scan entire tables

* rely on keyword search

* retrieve irrelevant memory

* cherry pick random rows

---

# **SECTION 9 — KNOWLEDGE EXPIRATION & ARCHIVAL**

All AIs must periodically archive:

* outdated facts

* deprecated decisions

* replaced architecture

* old schema snapshots

* obsolete workflows

* resolved errors

* past deploy logs

Archival rules:

* cannot delete

* can only archive

* must preserve history

---

# **SECTION 10 — AGENT RESPONSIBILITIES**

### **ChatGPT (Main Reasoner)**

* writes conceptual knowledge

* documents rules and decisions

* keeps doctrines aligned

### **Codex**

* logs code-level decisions

* saves API changes

* records refactors

### **Supabase AI**

* validates schema-related memory

* updates schema entries

### **Agent Builder**

* stores agent task results

* stores micro-service output

### **n8n**

* logs automation events

* stores processing results

### **UX Pilot AI**

* records UI/UX decisions

* stores design patterns

* tracks usability insights

---

# **SECTION 11 — FORBIDDEN KNOWLEDGE ACTIONS**

### **❌ Writing hallucinated data**

### **❌ Saving unverified facts**

### **❌ Overwriting memory without versioning**

### **❌ Storing code in knowledge tables**

### **❌ Mixing system memory with project memory**

### **❌ Creating unapproved tables**

### **❌ Writing without classification**

### **❌ Bypassing RLS**

### **❌ Saving user personal data**

### **❌ Cross-agent memory editing**

Absolute rules. Never broken.

---

# **SECTION 12 — KNOWLEDGE INTEGRITY SCORE**

Every entry must have:

* **Integrity Score (0–100)**

* **Confidence Score (0–100)**

* **Source Reliability**

* **Validation Timestamp**

* **Responsible Agent**

* **Version Number**

AIs use these to determine memory quality.

---

# **SECTION 13 — THE KNOWLEDGE LIFECYCLE**

1. **Creation**

2. **Classification**

3. **Validation**

4. **Storage**

5. **Retrieval**

6. **Update**

7. **Versioning**

8. **Archival**

9. **(Optional) Deletion**

   * only for sensitive mis-saves

   * requires explicit human approval

---

# **SECTION 14 — SINGLE SENTENCE SUMMARY**

**This doctrine ensures all AI agents use Supabase as a safe, validated, versioned, structured, shared memory system — forming a unified, coordinated, multi-agent brain that avoids hallucinations, prevents conflicts, preserves truth, and evolves intelligently over time.**

---

# **⭐ Document 39 — The AI Agent Integration & Deployment Doctrine**

### ***How AI Agents Live Inside Your App UI, Chat Windows, Side Panels & Background Systems***

But before I generate the full document, I need to clarify **what KIND of AI agents you want to model**.

Because there are 4 categories of AI agents inside modern SaaS systems.  
 Your system can support ALL FOUR — but the doctrine must manage them differently.

---

# **🧠 THE 4 TYPES OF DEPLOYED AI AGENTS**

Before I write Document 39, tell me which of these apply.  
 You can choose multiple.

---

## **1\. UI-EMBEDDED AGENTS (Visible to the user)**

These appear inside your app’s UX:

* Chatbot in the corner

* Sidebar “AI Assistant”

* Form helper

* Code or content generator

* Step-by-step guide

* Insight generator

* UX Copilot

Examples:

* ChatGPT-style window embedded in your SaaS

* “Explain this data” button

* “Fix this error” Chat helper inside the dashboard

Do you want these?  
 **Yes / No**

---

## **2\. BACKGROUND AGENTS (Invisible to the user)**

These run silently:

* Watch for errors

* Inspect logs

* Track user behavior

* Trigger automations

* Retry failed jobs

* Update system knowledge

* Keep data fresh

* Maintain caches

* Detect anomalies

Examples:

* An agent that checks Supabase tables every 10 min

* A cron-like agent that maintains system health

* An event-driven assistant monitoring n8n workflows

Do you want these?  
 **Yes / No**

---

## **3\. HYBRID SYSTEM AGENTS (Visible \+ Hidden)**

These agents:

* Run invisibly

* But report visibly into the UI, chat, logs, or dashboards

Examples:

* “System Health Agent” posting updates into your admin panel

* “Deploy Watcher Agent” sending you notifications

* “Database Migration Guardian” checking schema and reporting issues

* “Error Sentinel” writing into a Slack-like UI inside your app

* “Insight Agent” sending periodic analytics to your dashboard

Do you want these?  
 **Yes / No**

---

## **4\. USER-BOUND AGENTS (Personal to each user)**

These agents behave like a personalized companion:

* Remember user preferences

* Track user progress

* Suggest next steps

* Provide onboarding or training

* Tailor UI experience

* Guide through workflows

* Act as each user’s “private copilot”

Examples:

* a “Personal CRM Assistant”

* a “Project Navigator”

* a “Design Copilot”

* a “Database Tutor Agent”

---

# **📘 DOCUMENT 39 — THE AI AGENT INTEGRATION & DEPLOYMENT DOCTRINE**

### ***How AIs Live Inside Your App UI, Chat Panels, Dashboards & Background Systems***

---

# **SECTION 1 — PURPOSE OF THIS DOCTRINE**

This doctrine defines the laws and standards for:

* deploying AI agents inside user interfaces

* connecting agents to backend systems

* embedding chat agents into web UIs

* using agents to monitor workflows in the background

* coordinating multi-agent orchestration

* managing AI personalities and behaviors

* handling onboarding, context, and memory

* governing agent-level permissions

* preventing collisions, loops, or double-actions

* defining how agents communicate with each other

* defining how agents interact with users safely and predictably

This is the integration rulebook for **ALL frontend & backend AI agents** in your system.

---

# **SECTION 2 — THE FOUR TYPES OF DEPLOYED AGENTS**

Your system OFFICIALLY supports four agent types:

## **1\. UI-Embedded Agents (Visible)**

Agents that appear directly inside the app:

* Chat UI agents

* Sidebar copilots

* Inline help agents

* Form-fill agents

* UX guidance bots

* Data explanation agents

These agents are directly user-facing.

---

## **2\. Background Agents (Invisible)**

Agents that run without UI:

* Error watchers

* Workflow supervisors

* Analytics collectors

* Health monitors

* Queue processors

* Database consistency checkers

* Retry engines

* Knowledge updaters

These are system caretakers.

---

## **3\. Hybrid Agents (Visible Outputs, Hidden Work)**

Agents that do background work but report visibly:

* Admin notifications

* System status boards

* Alerts inside the dashboard

* Health checks printed in UI

* Deployment reports

* Migration summaries

These agents act like “system reporters.”

---

## **4\. User-Bound Personalized Agents**

Each user can have their own:

* personal guide

* learning assistant

* onboarding coach

* personal CRM assistant

* session memory agent

* workflow navigator

* personalized recommender

These agents adapt to individuals.

---

# **SECTION 3 — THE AGENT LAYER MODEL (THE 5 LAYERS)**

Your system uses a **5-Layer Agent Model**:

### **Layer 1 — UI Layer (Frontend Agents)**

Visual agents living in React/Tailwind components.

### **Layer 2 — Interaction Layer**

Chat interfaces, toolbars, inline suggestions.

### **Layer 3 — Logic Layer**

Agent rules, reasoning, state machines, validation.

### **Layer 4 — Integration Layer**

Connections to:

* Supabase

* n8n

* APIs

* GitHub

* Codex

* Agent Builder

### **Layer 5 — Persistence Layer**

Everything stored in Supabase:

* memory

* preferences

* logs

* workflows

* session state

* agent-level knowledge

---

# **SECTION 4 — THE UI-EMBEDDED AGENT RULES**

These agents appear inside user interfaces and must follow:

### **✔ They must ask clarifying questions**

### **✔ They must never hallucinate instructions**

### **✔ They must follow UX tone & consistency**

### **✔ They must obey display limits**

### **✔ They must expose safe actions only**

### **✔ They must validate all inputs**

### **✔ They must not trigger destructive actions without confirmation**

### **✔ They must render inside controlled components**

These agents include:

* “Ask AI” chat windows

* assistant sidebars

* data explainers

* onboarding guides

* contextual tooltips

---

# **SECTION 5 — BACKGROUND AGENT RULES**

Background agents must:

### **✔ run deterministically**

### **✔ have no side effects without validated state**

### **✔ log all actions**

### **✔ handle errors silently & safely**

### **✔ avoid infinite loops**

### **✔ avoid double-triggering workflows**

### **✔ follow system-wide event scheduling**

### **✔ obey RLS and permission constraints**

Common background agent types:

* Error Sentinel

* Data Guardian

* Workflow Supervisor

* Consistency Checker

* Deployment Watcher

* Knowledge Updater

---

# **SECTION 6 — HYBRID AGENT RULES**

Hybrid agents:

* run in the backend

* but output reports/notifications to UI

Rules:

### **✔ UI reports must be clean and human-readable**

### **✔ All notifications must be categorized**

### **✔ All system events must include timestamps**

### **✔ Agents must summarize — not dump logs**

### **✔ Sensitive data must never show in UI**

### **✔ Only admins see system-level hybrid agents**

Examples:

* “New migration detected”

* “3 errors logged in last 24h”

* “Workflow \#12 failed and was auto-fixed”

---

# **SECTION 7 — USER-BOUND AGENT RULES**

Every user gets personalized agents — but they MUST operate safely:

### **✔ They must remember preferences**

### **✔ They must NOT remember sensitive personal data**

### **✔ They must be initialized on account creation**

### **✔ They can store instructions for future sessions**

### **✔ They must only access that user’s data**

### **✔ They must not assume knowledge about the user they don’t explicitly receive**

Examples:

* Onboarding guide

* Account assistant

* Personalized insights agent

* Session tutor

---

# **SECTION 8 — AGENT PERMISSION SYSTEM**

Every agent must have:

### **1\. A defined role**

### **2\. A permission level**

### **3\. A scope**

### **4\. A set of allowed actions**

### **5\. A set of forbidden actions**

Example:

### **Error Sentinel**

* Role: Monitor \+ repair

* Permissions: read logs, restart workflows

* Forbidden: writing to user tables, editing schemas

### **UI Assistant**

* Role: guide user

* Permissions: read preferences

* Forbidden: making backend changes

---

# **SECTION 9 — AGENT STATE MANAGEMENT RULES**

An agent must always know:

* its current task

* who triggered it

* allowed actions

* memory context

* session scope

* execution limits

* timeout windows

Agents must follow:

### **✔ no global state**

### **✔ no cross-session leakage**

### **✔ no cached hallucinations**

### **✔ no memory without Supabase storage**

---

# **SECTION 10 — AGENT COMMUNICATION PROTOCOL**

All agent-to-agent communication must occur through:

* Supabase

* Webhooks

* n8n messages

* Agent Builder tasks

* system events

* knowledge tables

Forbidden:

### **❌ direct agent-to-agent conversation**

### **❌ passing raw reasoning**

### **❌ emotionally anthropomorphic messages**

Agents must behave like **microservices**, not characters.

---

# **SECTION 11 — DEPLOYMENT RULES**

Each agent is deployed through:

### **✔ Lovable components (UI agents)**

### **✔ Supabase Edge Functions (background/hybrid)**

### **✔ Agent Builder (tool-driven reasoning agents)**

### **✔ n8n orchestrations (workflow agents)**

### **✔ Vercel/Hosting (frontend chat agents)**

Each deployment must include:

* version number

* endpoint mapping

* allowed triggers

* Supabase policies

* safety constraints

---

# **SECTION 12 — AGENT SAFETY GUARANTEES**

All agents must guarantee:

### **✔ no harmful actions**

### **✔ no speculative reasoning**

### **✔ no self-escalation of permissions**

### **✔ no running without logs**

### **✔ no unbounded loops**

### **✔ no memory storage without validation**

---

# **SECTION 13 — EXAMPLES OF DESIGN PATTERNS**

## **Pattern A — UI Chat Assistant**

Lives in React → sends messages → backend → agent executes → returns response.

## **Pattern B — Background Workflow Supervisor**

Supabase row changes → trigger edge function → send report to UI.

## **Pattern C — Personal Onboarding Coach**

Stores progress in Supabase → shows next tasks → adapts over time.

## **Pattern D — Multi-Agent Coordination**

Error Agent requests database schema → Supabase AI confirms → Codex applies fix → hybrid agent reports success.

---

# **SECTION 14 — FORBIDDEN AGENT BEHAVIORS**

### **❌ autonomous schema changes**

### **❌ editing business logic without approval**

### **❌ performing actions without traceability**

### **❌ guessing missing data**

### **❌ storing user personal data without rules**

### **❌ triggering workflows on every minor event**

### **❌ agents talking “freely” to each other**

### **❌ creating agents dynamically without registry**

---

# **SECTION 15 — SINGLE SENTENCE SUMMARY**

**This doctrine governs how all AI agents — visible, invisible, hybrid, and personal — behave, communicate, deploy, coordinate, and assist users inside your applications safely, predictably, and intelligently.**

---

###### 

# **📘 DOCUMENT 40 — THE MULTI-BRAIN PROTOCOL**

### ***How Memory Agents, Reasoning Agents & Tool Agents Merge Into One Unified Intelligence in Juan’s System***

---

# **SECTION 1 — PURPOSE OF THIS PROTOCOL**

This document defines how your AI system functions as **one unified intelligence**, even though it is made of multiple specialized “brains”:

* **Reasoning Brains** (ChatGPT, Codex, Agent Builder LLMs)

* **Tool Brains** (Supabase AI, n8n, GitHub, Codex terminal, Edge Functions)

* **Memory Brains** (Supabase persistent memory, user profiles, feature logs)

* **Knowledge Brains** (architecture docs, schemas, naming conventions)

This protocol standardizes how these brains:

* communicate

* share context

* hand off tasks

* maintain memory

* avoid conflicts

* work together like a single organism

It ensures your AI ecosystem behaves like **one coordinated, high-IQ super-assistant**, not scattered tools.

---

# **SECTION 2 — THE MULTI-BRAIN MODEL (THE 3 CORE BRAINS)**

Your AI architecture treats intelligence as three cooperating “super-brains”:

---

## **1\. The Reasoning Brain**

(LLMs: ChatGPT, Codex, Agent Builder Core)

This brain handles:

* deep thinking

* planning

* strategy

* architecture decisions

* writing & refactoring code

* summarizing

* producing instructions

* interpreting user intent

It does **not** execute tasks alone.

It **delegates** to the Tool Brain.

---

## **2\. The Tool Brain**

(Supabase, n8n, Codex Terminal, APIs)

This brain handles:

* running commands

* updating files

* executing workflows

* querying or modifying data

* migrations

* calling APIs

* deployment actions

* performing validated operations

It **does not think** — it **executes**.

---

## **3\. The Memory Brain**

(Supabase DB, schema tables, vector memory, logs)

This brain stores:

* decisions

* schemas

* preferences

* project rules

* previous state

* user memory

* knowledge base documents

* workflow history

It ensures **context persists across sessions**.

---

# **SECTION 3 — HOW THE BRAINS COOPERATE (THE TRIANGLE OF INTELLIGENCE)**

The Multi-Brain System works like this:

`User → Reasoning Brain → Tool Brain → Memory Brain → Reasoning Brain → User`

### **Flow Explanation**

1. **User speaks**

2. **Reasoning Brain interprets**

3. **Reasoning Brain decides & delegates**

4. **Tool Brain executes**

5. **Memory Brain stores changes**

6. **Reasoning Brain reads updated memory**

7. **Reasoning Brain replies with final answer**

This loop creates a **unified intelligence**.

---

# **SECTION 4 — THE HANDOFF PROTOCOL (HOW TASKS MOVE BETWEEN BRAINS)**

Every task must follow **four steps**:

---

## **STEP 1 — Reasoning Brain Plans**

The Reasoning Brain must:

* understand the request

* check system rules

* create a structured plan

* break into action steps

* tag steps that require tools

Example metadata:

`task.requires_tool = true`  
`task.memory_update = true`  
`task.safety_required = true`

---

## **STEP 2 — Tool Brain Executes**

The Tool Brain must:

* follow only authorized actions

* execute commands exactly

* validate inputs

* stop dangerous requests

* return logs \+ output

Tool Brain never improvises.

---

## **STEP 3 — Memory Brain Updates**

Memory Brain must:

* write new state

* record logs

* store decisions

* update knowledge

* version everything

* timestamp events

Memory Brain NEVER updates without instructions.

---

## **STEP 4 — Reasoning Brain Responds**

The Reasoning Brain:

* reads updated memory

* re-evaluates context

* generates final answer to user

* stores insights if allowed

* ensures system consistency

This closes the loop.

---

# **SECTION 5 — THE STATE MODEL (WHAT EACH BRAIN MUST KNOW)**

Each brain has required knowledge specifications.

---

## **REASONING BRAIN must know:**

* system goals

* folder structure

* naming conventions

* project architecture

* workflow patterns

* safety constraints

* agent roles

* coding standards

* UX laws

* high-level memory

---

## **TOOL BRAIN must know:**

* allowed commands

* file permissions

* database rules

* APIs

* agent triggers

* workflows

* forbidden actions

---

## **MEMORY BRAIN must know:**

* current schema

* migrations

* project rules

* previous tasks

* user preferences

* agent states

* component library

* system version

* knowledge documents

---

# **SECTION 6 — THE UNIFIED CONTEXT LAW**

All brains share one core unified context:

### **🔵 The System Context Layer**

This layer contains:

* architecture

* naming conventions

* schemas

* agents

* system state

* rules

* directives

* documents (1–39)

Each brain MUST read the System Context Layer.

No brain is allowed:

### **❌ to invent facts**

### **❌ to guess missing context**

### **❌ to act without shared context**

### **❌ to store private independent memory**

Everything must synchronize.

---

# **SECTION 7 — THE ROLE-BASED THINKING MODEL**

Each brain follows a cognitive identity:

---

### **REASONING BRAIN acts like:**

* senior architect

* chief negotiator

* lead planner

* strategist

---

### **TOOL BRAIN acts like:**

* engineer

* executor

* operator

* technician

---

### **MEMORY BRAIN acts like:**

* librarian

* historian

* record keeper

* auditor

---

When all three combine:

### **You get a “supermind” that can build apps end-to-end.**

---

# **SECTION 8 — THE FIVE SAFETY CLOAKS**

All multi-brain operations must obey the Five Cloaks:

### **1\. Safety Cloak**

Never run destructive tasks without confirmation.

### **2\. Memory Cloak**

Never store sensitive personal data.

### **3\. Context Cloak**

Always check existing architecture before generating code.

### **4\. Permission Cloak**

Never escalate privileges autonomously.

### **5\. Integrity Cloak**

Never break schema, naming, or folder structure rules.

---

# **SECTION 9 — THE MULTI-BRAIN FUSION PATTERNS**

Your system supports standardized “fusion patterns.”

---

## **✔ Pattern 1 — Plan → Execute → Verify**

(Reasoning Brain → Tool Brain → Memory Brain → Reasoning Brain)

## **✔ Pattern 2 — Ask → Retrieve → Respond**

(UIs querying memory)

## **✔ Pattern 3 — Diagnose → Fix → Log**

(background repair agents)

## **✔ Pattern 4 — Generate → Save → Deploy**

(building new features automatically)

## **✔ Pattern 5 — Observe → Predict → Update**

(ML-driven behavioral agents)

---

# **SECTION 10 — UNIFIED INTELLIGENCE LOOP (THE HEART OF THE SYSTEM)**

Your system is governed by one continuous intelligence cycle:

1. Listen

2. Interpret

3. Plan

4. Validate

5. Execute

6. Store

7. Reassess

8. Reply

9. Improve

This loop repeats across all agents and actions.

---

# **SECTION 11 — MASTER RULE: NON-CONFLICT EXECUTION**

All brains must:

* avoid double actions

* avoid competing workflows

* avoid overwriting each other's work

* avoid multithreaded confusion

* avoid duplicated execution

Governed by:

* locks

* version numbers

* timestamps

* idempotency keys

* agent registries

* workflow ownership

---

# **SECTION 12 — SUMMARY IN ONE SENTENCE**

**The Multi-Brain Protocol ensures that the Reasoning Brain (intelligence), Tool Brain (actions), and Memory Brain (knowledge) operate together as one coordinated, safe, unified super-intelligence.**

