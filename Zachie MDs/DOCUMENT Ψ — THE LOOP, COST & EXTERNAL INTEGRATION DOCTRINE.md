# **DOCUMENT Ψ — THE LOOP, COST & EXTERNAL INTEGRATION DOCTRINE**

### ***Rules for Preventing Infinite Loops, API Overuse, Runaway Automations, Excess Compute, and Unbounded External Costs Across the Entire Multi-Agent Ecosystem***

---

# **SECTION 1 — PURPOSE OF THIS DOCTRINE**

This doctrine exists to protect your multi-agent system from the **three invisible killers** of autonomous AI engineering:

1. **Infinite or recursive agent loops**

2. **Runaway n8n automations & workflow storms**

3. **Unbounded API usage, external cost explosions, and rate-limit violations**

The goal is to guarantee:

* predictable execution

* safe automation

* bounded cost

* controlled integration behavior

* deterministic multi-agent collaboration

* resource-aware decision making

This doctrine completes the safety architecture formed by Documents:

* Ω (Global Override & Risk Doctrine)

* 21–22 (Multi-Agent Orchestration)

* 46–50 (Validation, Verification, Telemetry)

* 36–38 (Backend & Knowledge Governance)

---

# **SECTION 2 — THE THREE GLOBAL THREATS**

Your system must recognize and guard against:

---

### **Threat 1 — Recursive Multi-Agent Loops**

Occurs when:

* Architect → Supabase AI → Codex → Debugger → Architect → …

* Or one agent defers decisions indefinitely

* Or sequence loops without resolution

**Impact:**

* infinite reasoning

* token waste

* stalled progress

* indirect cost explosion

---

### **Threat 2 — Runaway Automations (n8n & Event Cascades)**

Occurs when:

* Workflows trigger themselves

* Multiple workflows trigger each other

* Circular webhooks exist

* Cron jobs overlap

**Impact:**

* 1000s of workflow runs

* API spam

* Stripe / Email provider bans

* Rate-limit lockouts

* Massive cost spikes

---

### **Threat 3 — External API Overuse & Hidden Costs**

Occurs when:

* Agents call GPT/Stripe/Supabase repeatedly

* Code loops API calls without guardrails

* Background jobs retry endlessly

* Rate limits are hit silently

**Impact:**

* Monetary cost

* API blacklisting

* System crashes

* Broken product UX

* Real user impact

---

# **SECTION 3 — THE GLOBAL EXECUTION BOUNDARY LAWS**

All agents must obey these absolute global boundaries.

---

## **LAW 1 — All Loops Must Have Hard Upper Bounds**

Every loop (agent, workflow, code, API) must define:

* max iterations

* max retries

* max execution depth

* timeout

* fail-safe exit

If no bounds provided → **BLOCK EXECUTION**.

---

## **LAW 2 — No Agent May Create Self-Triggering Workflows**

Forbidden:

* a workflow that calls itself

* a webhook that calls its own trigger

* two workflows mutually triggering each other

* agent messages repeating indefinitely

This is a **hard safety violation**.

---

## **LAW 3 — API Usage Must Be Rate-Limited by Default**

All external API calls must apply:

* cooldowns

* batching

* retry-with-backoff

* per-user caps

* per-hour caps

* per-job caps

If not defined → apply system default:

**Default Rate Limit:**  
 *Max 10 calls/min per agent or workflow.*

---

## **LAW 4 — Long-Running Tasks Require Explicit Approval**

Tasks with:

* 5 seconds compute

* 5 chained API calls

* 100 database rows being processed

* 2 agents cooperating

…must use the **Task Declaration Protocol** (Section 9).

---

## **LAW 5 — No Agent May Execute Costly Actions Without Justification**

Examples:

* mass email

* full database scans

* batch API queries

* high-frequency cron jobs

* re-indexing

* embeddings generation

Agents must provide:

* cost estimate

* reason

* alternative

* required frequency

---

# **SECTION 4 — THE MULTI-AGENT LOOP GUARD**

This system prevents infinite agent cycles.

---

## **4.1 Hard Limits**

Each task may involve:

* max **5 agent handoffs**

* max **3 retries per agent**

* max **1 escalation cycle**

If any limit is exceeded:

**System halts → returns Loop Alert → asks Juan for direction.**

---

## **4.2 Loop Detection Triggers**

A loop is assumed if:

1. Same agent invoked twice with the same context

2. Same task moves in a circle (A→B→C→A)

3. Task does not reduce complexity

4. No agent produces new actionable output

---

## **4.3 Loop Resolution Protocol**

Returned to Juan:

* summary of loop

* cause

* the last 3 steps

* 2–3 safe exit options

* recommended route

---

# **SECTION 5 — THE AUTOMATION STORM PREVENTION LAW**

n8n, Agent Builder, or Supabase events must never produce uncontrolled cascades.

---

## **5.1 Workflow Chain Limits**

A workflow may trigger:

* max **3 downstream workflows**

* max **1 re-trigger per cycle**

* max **20 events/hour** unless approved

---

## **5.2 Forbidden Patterns**

No agent may create:

* circular n8n dependencies

* webhook → webhook → webhook loops

* cron jobs \< 1 minute interval

* automations that modify their own triggers

* workflows that send unlimited emails

---

## **5.3 Mandatory Safety Nodes**

Every workflow requires:

* rate-limit node

* log node

* error boundary

* fail-safe exit

* “dry run” mode for testing

---

# **SECTION 6 — THE EXTERNAL API SAFETY DOCTRINE**

External APIs must be treated as **cost centers \+ rate-limited resources**.

---

## **6.1 Universal Per-Agent Rate Limits**

Each agent:

* max **10 external API calls per minute**

* max **100 per hour**

* max **500 per day**

Unless Juan explicitly raises limits.

---

## **6.2 Required API Safety Features**

Every API interaction must include:

* timeout (default 5 seconds)

* exponential backoff

* max 3 retries

* circuit breaker (disable after too many failures)

* error logging

* contextual metadata

---

## **6.3 Expensive API Call Rules**

Before performing an expensive operation such as:

* bulk Stripe events

* mass email sends

* embeddings generation

* vector database rebuild

* large Supabase scans

Agents must:

1. Give a cost estimate

2. Provide alternative (cheaper) approaches

3. Request user confirmation

---

# **SECTION 7 — THE TOKEN & MODEL COST GOVERNANCE**

The system must conserve OpenAI token usage.

---

## **7.1 Token Budgeting Rules**

Each agent gets:

* default **token budget** per task

* must not exceed budget unless escalated

---

## **7.2 Streaming Preference Rule**

Where possible:

* prefer streaming over giant monolithic responses

* prefer summaries over full raw outputs

* prefer structured responses over long conversations

---

## **7.3 Model Selection Governance**

Use:

* **lower-cost models** for routine tasks

* **higher-end models** only when needed (architecture, planning, refactoring)

---

# **SECTION 8 — THE DATA SCAN LIMITS**

### **8.1 Row Limits**

Without confirmation:

* max **100 rows** per query

* max **1MB** payload per request

### **8.2 Bulk Operations**

Requires:

* user confirmation

* fail-safe checkpoints

* chunking

* progress reporting

---

# **SECTION 9 — THE HIGH-RISK TASK DECLARATION PROTOCOL**

Before executing any task that could create:

* cost

* heavy compute

* multiple workflows

* multi-agent chains

* high-loop potential

Agents must declare:

**TASK CLASSIFICATION**

* Type (loop, automation, external API, compute-heavy)

* Risk Level (1–3)

* Cost Estimate

* Steps Involved

**PROCEED? (yes/no)**

---

# **SECTION 10 — THE COST ESCALATION & OVERRIDE SYSTEM**

If a requested action is high-cost:

Agents must ask:

“This action may generate significant cost or workload. Do you want to proceed, optimize, or cancel?”

To override:

User must type:

**“Authorize Psi Override.”**

This authorizes costly but safe operations.  
 (Destructive operations still require Ω override.)

---

# **SECTION 11 — LOGGING & OBSERVABILITY REQUIREMENTS**

Every loop, automation, API call, and workflow must log:

* start time

* end time

* cost

* tokens

* API provider

* retries

* failures

* path

* agent responsible

All logs feed into:

**knowledge.system\_events**  
 **knowledge.debug\_history**

---

# **SECTION 12 — ONE SENTENCE SUMMARY**

**Document Ψ guarantees that no agent, automation, workflow, or API integration can spiral into infinite loops, runaway costs, or unbounded execution — protecting your system, your product, and your wallet.**

