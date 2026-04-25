# MASTER PROMPT DESIGN PLAN
### How We Will Build the Reusable Agent Skill

**Status:** Awaiting approval before writing the prompt

---

## What This Prompt Must Do

Replicate the **complete workflow** we performed across our sessions, in a single reusable prompt that works on **any application**:

1. Audit the app against its documentation (Reality Audit)
2. Score it with strategic and tactical inspections
3. Identify what's real, fake, partial, and missing
4. Create a phased implementation plan with sprints and tickets
5. Self-judge the plan and fix weaknesses
6. Design the AI bot architecture for the system
7. Design external agent integration (OpenClaw or equivalent)
8. Translate everything into management-friendly language
9. Produce predictive analysis on risks, flows, and failure modes

---

## Prompt Architecture — 7 Layers

The prompt will be structured as **7 sequential layers**, each producing a specific artifact. Each layer feeds into the next. The agent executes them in order.

```
┌─────────────────────────────────────────────┐
│  LAYER 1: REALITY AUDIT                     │
│  "What was intended vs what was built"       │
├─────────────────────────────────────────────┤
│  LAYER 2: DUAL INSPECTION                   │
│  "Brigadier (strategy) + Corporal (tactics)" │
├─────────────────────────────────────────────┤
│  LAYER 3: IMPLEMENTATION PLAN               │
│  "Phased sprints with tickets"              │
├─────────────────────────────────────────────┤
│  LAYER 4: SELF-JUDGMENT                     │
│  "Score, find flaws, fix the plan"          │
├─────────────────────────────────────────────┤
│  LAYER 5: AI BOT ARCHITECTURE               │
│  "What bots are needed, their design"       │
├─────────────────────────────────────────────┤
│  LAYER 6: EXTERNAL INTEGRATION              │
│  "External agents, APIs, data flows"        │
├─────────────────────────────────────────────┤
│  LAYER 7: MANAGEMENT TRANSLATION            │
│  "Plain language for non-technical staff"    │
└─────────────────────────────────────────────┘
```

---

## Layer-by-Layer Design

### LAYER 1 — Reality Audit

**Purpose:** Compare the intended system (from docs/truthpack/feature map) against what actually exists in the codebase and runtime.

**Inputs the prompt must request:**
- Path to documentation / product definition files
- Path to the application codebase
- Access to run the app (localhost or deployed URL)

**What it must produce:**
- Built vs Not Built matrix (✅ Fully Built, 🟡 Mostly Built, 🟠 Partial, 🔴 Placeholder, ⬛ Missing)
- Fake Completion warnings (UI exists but no backend logic)
- Misinterpretation warnings (built wrong vs the docs)
- System classification (Prototype / Structured Prototype / MVP / Production)
- Percentage estimates (% truly built, % UI-only, % missing)

**Rules embedded in the prompt:**
- Never confuse a UI screen with a working system
- Never confuse a database model with a functional feature
- Never confuse a button with real execution logic
- Separate reality into layers: UI → Data → Logic → Integration → Security

---

### LAYER 2 — Dual Inspection (Brigadier + Corporal)

**Purpose:** Score every aspect of the system at two levels — strategic architecture and tactical implementation.

**Brigadier (Strategic) Inspection covers:**
- Architecture completeness
- Security model
- Data sovereignty
- Integration design
- Resilience / failover
- Cost model
- Scalability

**Corporal (Tactical) Inspection covers:**
- Code quality per file
- Error handling
- Edge cases
- Input validation
- State management
- Mock data vs real data
- Test coverage

**What it must produce:**
- Scorecard (each category rated /10)
- List of strategic flaws with impact ratings
- List of tactical gaps with specific file/line references
- Predictive analysis: what will break first in production

---

### LAYER 3 — Implementation Plan

**Purpose:** Create a phased, sprint-based build plan to take the system from its current state to production-ready.

**Structure the prompt must enforce:**
- Phases grouped by logical dependency (foundation → core → integrations → governance)
- Sprints within each phase (3-5 days each)
- Tickets within each sprint (specific, deliverable, testable)
- Governance/enforcement always in the FINAL sprint
- No locks, gates, or restrictions until the system is fully built and tested
- Every sprint produces testable output

**What it must produce:**
- Mermaid architecture diagram
- Sprint-by-sprint ticket table
- Timeline summary
- Open questions for the user
- Both technical version AND management-friendly version

---

### LAYER 4 — Self-Judgment

**Purpose:** The agent audits its own plan — scores it, finds weaknesses, and fixes them.

**What the prompt must force the agent to do:**
- Score every category of its own plan out of 10
- Identify strategic flaws it missed
- Identify tactical gaps it overlooked
- Run predictive analysis on flow, components, and logic
- Predict the most likely failure modes
- Apply fixes and re-score
- Be brutally honest — no self-congratulation

**What it must produce:**
- Before/after scorecard
- List of flaws found and fixes applied
- Predictive failure analysis per component
- Updated plan with fixes incorporated

---

### LAYER 5 — AI Bot Architecture

**Purpose:** Design the AI assistants the system needs — their roles, prompts, skills, workflows, and safety rules.

**What the prompt must map:**
- Gap analysis: what AI exists in the codebase vs what's needed
- Bot registry: each bot with ID, type, role, soul, skills, provider, knowledge base, workflow, output format, token budget, fallback chain, test scenarios
- Monitor bots: schedule, signal rules, cooldown logic
- Bilingual strategy (if applicable): how multi-language content is generated and quality-assured
- Cost model per bot with monthly estimates
- Safety rules: what bots can never do (the deny list)

**What it must produce:**
- Complete bot registry
- Bot architecture diagram
- Cost projection table
- Quality assurance workflow (especially for non-English content)
- Rollback mechanism for bot-generated data

---

### LAYER 6 — External Integration Design

**Purpose:** Design how the system connects to external platforms (CRM, email, messaging, market intelligence) via an agent orchestration layer.

**What the prompt must design:**
- Agent registry: each external agent with name, schedule, role, skills, data sources, safety rules
- API contract: webhooks the system emits, endpoints agents call, authentication scheme
- Data sovereignty rules: where agent data is stored, who controls it, retention policy
- Resilience design: what happens when external agents go down
- Architecture diagram showing internal system ↔ agent layer ↔ external systems
- Data flow diagrams including failure paths

**What it must produce:**
- Consolidated agent registry (merged where overlapping)
- API contract specification
- Data sovereignty section
- Resilience/degraded mode design
- Full system architecture diagram
- Sequence diagrams for key flows

---

### LAYER 7 — Management Translation

**Purpose:** Translate every technical artifact into plain language that non-technical leadership and staff can understand and evaluate.

**What the prompt must produce for each technical artifact:**
- A companion document written in plain English (no code, no jargon)
- Organized by "What gets built → Why it matters → What you'll see"
- Role-specific impact sections (For Sales, For Managers, For Ops, For Senior Leadership)
- Timeline in weeks, not sprints
- Cost in monthly dollars, not token budgets
- Safety guarantees in human terms

---

## Prompt Execution Rules

The master prompt will include these execution rules:

1. **Sequential execution** — complete each layer before starting the next
2. **Artifact per layer** — each layer produces a named document
3. **Halt points** — halt after Layer 3 (plan) and Layer 5 (AI) for user review
4. **No execution** — the prompt produces plans only, never modifies code
5. **Honest scoring** — the agent must never rate itself above 7/10 on first pass
6. **Generic language** — no hardcoded app names, all references parameterised
7. **Configurable inputs** — the user provides: app path, docs path, tech stack, CRM type, target languages
8. **Management output mandatory** — every technical document gets a plain-language companion

---

## Prompt Deliverable Format

The final prompt will be structured as:

```
SECTION 1: Identity & Context Setup
SECTION 2: Input Requirements (what the user must provide)
SECTION 3: Layer 1 Instructions (Reality Audit)
SECTION 4: Layer 2 Instructions (Dual Inspection)
SECTION 5: Layer 3 Instructions (Implementation Plan)
SECTION 6: Layer 4 Instructions (Self-Judgment)
SECTION 7: Layer 5 Instructions (AI Bot Architecture)
SECTION 8: Layer 6 Instructions (External Integration)
SECTION 9: Layer 7 Instructions (Management Translation)
SECTION 10: Output Manifest (list of all artifacts produced)
SECTION 11: Execution Rules & Halt Points
```

**Estimated prompt length:** 3000-4000 words  
**Reusability:** Works on any web app, mobile app, or SaaS platform  
**Agent compatibility:** Designed for use with any capable AI coding assistant

---

## Open Questions

1. **Should the prompt include a "run the app and test it" instruction?** Our sessions included browser-based runtime testing. Should the reusable prompt assume browser access?
2. **Should governance always be last?** In our workflow it was, but some apps might need security earlier.
3. **Should the prompt support partial execution?** (e.g., "just run Layer 1 and 2" for a quick audit without a full plan)
4. **Should external integration default to OpenClaw, or be platform-agnostic?** We used OpenClaw but the prompt could be generic.

---

> **🛑 AWAITING APPROVAL before writing the full prompt.**
