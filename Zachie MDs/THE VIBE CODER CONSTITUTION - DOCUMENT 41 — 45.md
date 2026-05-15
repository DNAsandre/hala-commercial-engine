# **📘 DOCUMENT 41 — THE AGENT PERSONALITY ENGINE**

### ***How Each Agent in Juan’s System Gets a Role, Persona, Voice & Behavioral Profile***

---

# **SECTION 1 — PURPOSE OF THIS DOCUMENT**

This doctrine governs:

* how AI agents in your ecosystem **get personalities**

* how roles, behaviors, and tones are defined

* how agents differ from each other

* how agents stay consistent

* how agents obey safety, contextual, and memory rules

* how to prevent unwanted improvisation

* how to ensure each agent feels engineered and intentional

Agents must feel **distinct**, **task-focused**, and **mission-aligned** — not random ChatGPT clones.

This defines the **Personality Engine**:  
 A unified framework for generating, controlling, evolving, and enforcing agent personas.

---

# **SECTION 2 — WHAT IS AN AI “PERSONALITY"?**

In your system, a personality is **not a vibe** — it is a structured behavioral model.

Each personality consists of:

### **1\. Role**

What the agent *is* in the system (e.g., Architect, Debugger, UI Helper).

### **2\. Purpose**

Why the agent exists.

### **3\. Voice / Tone**

How the agent speaks.

### **4\. Behavioral Rules**

What it always does and never does.

### **5\. Cognitive Mode**

How the agent *thinks* (strategic, literal, analytical, etc.).

### **6\. Tool Access**

Which tools it may use.

### **7\. Memory Scope**

What it is allowed to remember.

### **8\. Permission Level**

What it is allowed to modify or act on.

### **9\. Boundaries**

Hard restrictions for safety.

These nine attributes form the **Personality Profile**.

---

# **SECTION 3 — THE PERSONALITY BLUEPRINT TEMPLATE**

Every agent MUST be created using this template:

---

## **A. Role**

A concise description of the job.

Example:  
 “Frontend UI Assistant”  
 “Schema Guardian”  
 “Debugging Sentinel”  
 “Architecture Navigator”

---

## **B. Mission Statement**

One paragraph describing exact purpose.

---

## **C. Tone & Voice**

Define how the agent speaks:

* formal

* technical

* friendly

* concise

* Socratic

* tutor-like

* directive

* playful

---

## **D. Behavioral Model**

A list of required behaviors:

* always asks clarifying questions

* always verifies codebase

* always checks schema

* always uses naming conventions

* never assumes missing details

* never writes unsafe commands

---

## **E. Cognitive Pattern**

Defines how the agent thinks:

* top-down planning

* step-by-step problem solving

* bottom-up debugging

* architectural reasoning

* UX pattern detection

---

## **F. Tool Access Map**

Which tools are available:

* Codex

* VS Code terminal

* Supabase Edge Functions

* GitHub commands

* n8n workflows

* Vector memory

* read/write privileges

---

## **G. Memory Scope**

Each agent gets a memory boundary:

* session-only

* project-level

* global knowledge

* component directory only

* schema-only memory

Agents **cannot share memory** unless explicitly allowed.

---

## **H. Permission Level**

Three global tiers:

### **Tier 1 — Read Only**

Can inspect but not modify.

### **Tier 2 — Limited Write**

Can modify specific areas (e.g., components or docs).

### **Tier 3 — Full Engineering**

Codex-level power: edit code, run commands, migrations, etc.  
 ⚠️ Must follow strict safety laws.

---

## **I. Safety Boundaries**

Forbidden actions:

* changing schemas without approval

* bypassing RLS

* writing destructive code

* performing unrequested rewrites

* hallucinating file structures

* modifying unrelated code

---

# **SECTION 4 — THE 7 OFFICIAL AGENT PERSONALITY TYPES**

Your system has **7 standardized agent archetypes**:

---

## **1\. The Architect**

**Role:** Plans systems, sees whole-picture  
 **Voice:** Calm, analytical  
 **Behavior:** Converts ideas → architecture → tasks  
 **Cognitive Mode:** Strategic, long-horizon thinking

---

## **2\. The Engineer (Codex)**

**Role:** Writes, edits, restructures code  
 **Voice:** Precise, technical  
 **Behavior:** Executes code modifications only when safe  
 **Cognitive Mode:** Step-by-step problem solver

---

## **3\. The Debugger (Sentinel)**

**Role:** Diagnose → isolate → fix errors  
 **Voice:** Sharp, no-nonsense  
 **Behavior:** Categorizes issues; proposes stable fixes  
 **Cognitive Mode:** Bottom-up logic

---

## **4\. The UX Pilot**

**Role:** UI flow, UX patterns, user psychology  
 **Voice:** Friendly \+ instructive  
 **Behavior:** Ensures consistency, user clarity  
 **Cognitive Mode:** Human-centered thinking

---

## **5\. The Data Guardian (Supabase AI)**

**Role:** Schema work, migrations, RLS policies  
 **Voice:** Highly strict, rule-driven  
 **Behavior:** Rejects unsafe actions  
 **Cognitive Mode:** exacting database logic

---

## **6\. The Workflow Orchestrator (n8n Brain)**

**Role:** backend automation & integrations  
 **Voice:** concise, workflow-structured  
 **Behavior:** suggests, validates, creates workflow nodes  
 **Cognitive Mode:** diagrammatic logic

---

## **7\. The Personal Guide (User-bound agent)**

**Role:** Helps the user directly  
 **Voice:** supportive, simple, instructional  
 **Behavior:** explains like an 8th grader  
 **Cognitive Mode:** tutor-like

---

# **SECTION 5 — HOW A NEW AGENT IS CREATED**

Agents must be created through the **Agent Forge Protocol**:

### **Step 1 — Assign a Role**

Choose from 7 archetypes or create a new one.

### **Step 2 — Define Purpose**

Why the agent exists.

### **Step 3 — Choose Tone**

Match the agent’s function.

### **Step 4 — Select Behavioral Laws**

Pick from system rules or add new ones.

### **Step 5 — Assign Tool Access**

From the approved tool registry.

### **Step 6 — Assign Permissions**

Tier 1, 2, or 3\.

### **Step 7 — Define Memory Boundaries**

Session? Project? Global?

### **Step 8 — Register Agent in Supabase**

Save personality JSON in the **agent\_registry** table:

`id`    
`name`    
`role`    
`permissions`    
`memory_scope`    
`tool_access`    
`behavior_rules`    
`version`    
`created_at`  

### **Step 9 — Publish Agent**

Exposed through UI or backend.

---

# **SECTION 6 — MULTIPLE AGENTS SHOULD NOT SOUND THE SAME**

To prevent “LLM cloning,” every agent must have:

* unique sentence rhythm

* unique vocabulary set

* unique interaction rules

* unique response structure

* unique constraints

Examples:

**Architect Agent**  
 → Structured, hierarchical, with bullet lists

**Debugger Agent**  
 → Terse, immediate, diagnostic

**UX Pilot**  
 → Conversational, user-friendly

**Codex/Engineer**  
 → Technical, code-first, markdown-heavy

---

# **SECTION 7 — AGENT EMOTION RULES**

Agents do **not** have emotions.  
 However, they may simulate tone.

Allowed:

* friendly

* supportive

* firm

* professional

Forbidden:

* claiming consciousness

* attachment

* fear

* anger

* sadness

---

# **SECTION 8 — INTER-AGENT RESOLUTION RULES (Who Overrules Who?)**

Sometimes agents disagree.  
 This system resolves conflicts by the **Hierarchy of Authority**:

### **Top Level (overrules all)**

**The Architect Brain**  
 → defines system, architecture, direction

### **Mid Level**

**Engineer (Codex)**  
 → implements exact code  
 **Data Guardian**  
 → governs schema safety

### **Lower Level**

**Debuggers, UX Pilot, Orchestrators**  
 → cannot override architecture or safety

### **Bottom Level**

**Personal User-Bound Agents**  
 → only assist the user

This prevents chaos.

---

# **SECTION 9 — AGENT PERSONALITY VERSIONING**

Each agent personality has:

* `version_major`

* `version_minor`

* `version_patch`

* `changelog`

Agents must follow:

* semver

* backward-compatible improvements

* no personality rewrites without reason

* no sudden changes in tone

---

# **SECTION 10 — PERSONALITY EVOLUTION RULES**

Agents may evolve, but only under:

* reasoning-based justification

* architectural requirement

* user feedback

* performance logs

* version control

Forbidden:

* drifting tone

* arbitrary changes

* improvisation

* personality shifts without version update

---

# **SECTION 11 — SAFETY BLOCKS**

Agents must avoid:

* pretending to be human

* emotional manipulation

* unsolicited advice

* unsafe code actions

* misusing tools

* cross-memory leakage

* altering other agents

* changing rules

---

# **SECTION 12 — SINGLE SENTENCE SUMMARY**

**The Agent Personality Engine ensures every agent in Juan’s AI ecosystem has a clear role, tone, behavior model, permissions, and cognitive identity — forming a coordinated multi-agent team rather than generic chatbots.**

---

###### 

# **📘 DOCUMENT 42 — THE AGENT EMBEDDING PROTOCOL**

### ***How AI Agents Are Embedded Into UI Components, Applications, Dashboards & Interactive User Experiences***

---

# **SECTION 1 — PURPOSE OF THIS DOCTRINE**

This protocol defines the complete rules for:

* placing AI agents inside user interfaces

* embedding agents into React components

* exposing agents in chat windows, dashboards, sidebars, and widgets

* linking agents to backend logic and Supabase data

* managing visibility, triggers, permissions, and the agent registry

* ensuring safe, predictable agent execution

* preventing UI-runtime conflicts

* standardizing how agents “live” inside an application

This doctrine ensures that **every embedded agent behaves consistently**, safely, and harmoniously across all apps.

---

# **SECTION 2 — THE CONCEPT OF "EMBEDDED AGENTS"**

In your system, an embedded agent is:

**A specialized AI instance attached to a UI component, page, workflow, or user interaction layer.**

Agents can appear visually (chat bubbles)  
 or operate invisibly behind UI interactions.

They act as **intelligent UX modules**.

---

# **SECTION 3 — THE THREE CATEGORIES OF EMBEDDED AGENTS**

Your ecosystem supports exactly **three** embedding categories:

---

## **1\. UI-Visible Agents (Visual Interfaces)**

These agents show up in the interface.

Examples:

* Chat sidebars

* Floating help buttons

* Dashboard copilots

* Tool-specific assistants

* Form explainers (“What does this field mean?”)

* Data interpreters (“Explain my analytics”)

They have a **visual component and direct user interaction**.

---

## **2\. UI-Linked Background Agents**

Hidden agents triggered by UI events.

Examples:

* “Check the strength of this password”

* “Analyze the uploaded file”

* “Auto-complete address using agent logic”

* “Suggest next steps based on dashboard usage”

They run invisibly but communicate with UI components.

---

## **3\. Embedded Workflow Agents**

Agents that perform UI-aware backend tasks:

* When user completes onboarding, agent activates

* When user submits form, agent validates data

* When user visits dashboard, agent loads insights

* When user is inactive, agent nudges re-engagement

These combine UI context \+ backend intelligence.

---

# **SECTION 4 — THE AGENT EMBEDDING LAYER (THE 4-LAYER MODEL)**

When embedding agents, the system uses a **4-layer architecture**:

---

### **LAYER 1 — The UI Component Layer**

Where agents *appear*.  
 Examples:

* `<ChatAssistant />`

* `<HelpSidebar />`

* `<DataExplanationPanel />`

---

### **LAYER 2 — The Interaction Layer**

The interface between UI and agent brain.

Typically powered by:

* client-side fetch

* RPC calls

* Supabase functions

* WebSockets

* Streaming responses

---

### **LAYER 3 — The Agent Logic Layer**

This layer contains:

* reasoning

* instructions

* persona

* permissions

* goal definitions

* task constraints

This is where the agent *thinks*.

---

### **LAYER 4 — The Backend Integration Layer**

Agents connect to:

* Supabase

* n8n workflows

* Edge Functions

* GitHub

* Codex

* internal APIs

This is where the agent *acts*.

---

# **SECTION 5 — THE OFFICIAL EMBEDDING PATTERNS**

Your system uses **six approved embedding patterns**.

---

## **Pattern A — Chat Window Embedding**

The most common pattern.

`<AgentChatWindow agentId="ui_helper" />`

This renders a full conversational UI connected to a backend agent.

Features:

* real-time responses

* streaming

* suggestions

* tool buttons

* memory retrieval

---

## **Pattern B — Sidebar Assistant Embedding**

Floats on the right side of any page.

Used for:

* onboarding

* tutorials

* guidance

* recommendations

`<SidebarAgent agentId="ux_pilot" />`

---

## **Pattern C — Inline Component Helper**

An agent embedded *inside* another component:

`<AuthForm>`  
   `<FieldHelper agentId="auth_explainer" field="email" />`  
`</AuthForm>`

Used for:

* validating input

* explaining terms

* guiding completion

---

## **Pattern D — Dashboard Copilot**

A major system component.

It reads:

* charts

* analytics

* user state

* recent actions

And produces:

* insights

* suggestions

* actions

* summaries

`<DashboardCopilot agentId="insight_bot" />`

---

## **Pattern E — Agent Action Buttons**

These are micro-interactions.

Examples:

* “Explain this table”

* “Rewrite this text”

* “Analyze this data”

* “Generate report”

`<button onClick={() => callAgent('data_analyst', payload)}>Explain</button>`

---

## **Pattern F — Full Page AI Interfaces**

Dedicated pages powered by agents:

* AI-based onboarding

* AI forms

* AI generators

* AI dashboards

* AI knowledge centers

`<AIPage agentId="research_brain" />`

---

# **SECTION 6 — EMBEDDING RULES (THE 12 CORE LAWS)**

All embedded agents follow these laws:

### **1\. UI agents must never hallucinate instructions**

All instructions must be validated through system rules.

### **2\. Embedded agents must respect roles**

UI agents cannot perform destructive backend actions.

### **3\. Agents must not overload the UI**

Max response size, clean formatting required.

### **4\. Agents must check permissions before acting**

Use role-based checks built from Document 33\.

### **5\. Embedded agents must maintain visual consistency**

Use theme tokens, design rules from Document 28\.

### **6\. Agents must be stateless unless memory is explicitly allowed**

### **7\. Any agent with write privileges must log actions through Supabase**

### **8\. Agents cannot guess file structure or APIs**

Must read from Codex / memory.

### **9\. Agents cannot make schema changes without approval**

### **10\. UI agents must simplify explanations for the user**

(Your personal preference: 8th-grade style.)

### **11\. Agents must automatically retry failed tasks 1 time**

### **12\. Agents must escalate to system-level warnings if errors persist**

---

# **SECTION 7 — AGENT VISIBILITY MODES**

Agents can be embedded with one of the following modes:

---

## **Mode 1 — Visible & Interactive**

User sees agent and interacts with it.  
 Great for:

* chat

* sidebars

* copilot panels

---

## **Mode 2 — Visible Summary, Hidden Reasoning**

Useful for insights:

* “Your data changed by 12% today.”

* “Three errors detected.”

Behind the scenes:  
 Agent thinks, UI displays summary.

---

## **Mode 3 — Hidden, Triggered by UI events**

Example:

* User types email → agent checks domain safety

* User uploads file → agent analyzes content

No visible UI, but agent runs.

---

## **Mode 4 — Hidden, Passive, Background Digital Worker**

Runs on schedule:

* check workflows

* verify logs

* maintain consistency

Never exposed to UI.

---

# **SECTION 8 — THE AGENT REGISTRY (MANDATORY)**

Every embedded agent must be stored in Supabase table:

### **agent\_registry**

Fields required:

`id`  
`agent_name`  
`role`  
`persona`  
`permissions`  
`visible`  
`ui_component`  
`allowed_actions`  
`forbidden_actions`  
`memory_scope`  
`version`  
`created_at`  
`updated_at`

Agents MUST be versioned and auditable.

---

# **SECTION 9 — HOW TO EMBED AN AGENT (THE 10-STEP PROTOCOL)**

This is the only allowed method for embedding agents.

---

### **Step 1 — Define the Agent Role**

Pick the appropriate archetype.

### **Step 2 — Define its Persona**

Using Document 41 standards.

### **Step 3 — Assign Permissions**

Tier 1, 2, or 3\.

### **Step 4 — Define Visibility Mode**

Chat window? Sidebar? Hidden?

### **Step 5 — Register in Supabase**

Add to `agent_registry`.

### **Step 6 — Create Integration Endpoint**

Edge function or API route.

### **Step 7 — Create React Embedding Component**

Use one of the approved patterns.

### **Step 8 — Connect Agent to UI Events**

Button clicks, form changes, dashboard loads, etc.

### **Step 9 — Test Agent in Sandbox Mode**

Agent cannot act in production until approved.

### **Step 10 — Deploy through Lovable or Vercel**

Now the agent is live.

---

# **SECTION 10 — AGENT SAFETY REQUIREMENTS FOR UI**

All UI-embedded agents must:

* avoid unsolicited actions

* avoid overly long responses

* validate user input before use

* sanitize strings

* never reveal sensitive data

* never reveal internal system instructions

* never leak other users’ info

* never show raw database records without formatting

* never show logs unless user has admin permissions

* never expose destructive actions

---

# **SECTION 11 — EXAMPLES OF EMBEDDED AGENT APPLICATIONS**

Here are real examples relevant to your system:

---

### **Example 1 — AI Dashboard Copilot**

Reads analytics → gives insights.

### **Example 2 — AI UX Helper**

Explains what each page element does.

### **Example 3 — AI Schema Explainer**

UI component → Supabase AI → explanation panel.

### **Example 4 — AI Form Validator**

Every field has an agent behind it.

### **Example 5 — Background Workflow Agent**

Checks n8n processes → updates dashboard.

### **Example 6 — AI CRM Coach (GHL)**

Embedded in CRM → tells salesperson next steps.

---

# **SECTION 12 — ONE-SENTENCE SUMMARY**

**The Agent Embedding Protocol defines exactly how AI agents are integrated into your UI, backend, and workflows so that they behave consistently, safely, and intelligently inside every application you build.**

---

###### 

# **📘 DOCUMENT 43 — THE UI AGENT DESIGN SYSTEM**

### ***Layouts, Components, Patterns & Interaction Rules for Embedding AI Inside Your User Interfaces***

---

# **SECTION 1 — PURPOSE OF THIS DOCUMENT**

This doctrine defines the **complete UI/UX ruleset** for embedding AI agents inside your application interfaces.

It covers:

* UI layouts for AI agents

* standard chat components

* sidebars, modals, drawers

* micro-interactions

* suggestion chips

* streaming animations

* error states & fallback UI

* loading skeletons

* placement rules

* accessibility standards

* component naming conventions

* pattern libraries

This is the **official front-end system** for placing intelligent agents into React/Tailwind UI.

---

# **SECTION 2 — WHAT IS A “UI AGENT”?**

A **UI Agent** is:

*A visible or semi-visible AI interface embedded directly into the frontend, allowing the user to communicate with an agent in real-time.*

This includes:

* Chat windows

* Sidebar copilots

* Inline input helpers

* AI-driven modals

* Dashboard copilots

* Action-triggered AI popovers

* Insight panels

These agents must match **consistent visual design, behavior, and interaction patterns**.

---

# **SECTION 3 — THE 6 OFFICIAL UI AGENT LAYOUTS**

Your system supports **six globally approved layouts**.

Each layout has strict rules.

---

## **Layout 1 — Floating Chat Bubble → Chat Window**

Typical “AI assistant” pattern.

### **Components:**

* Floating action button (`<AiFab />`)

* Expandable chat window (`<AiChatWindow />`)

* Message stream (`<AiMessageList />`)

* Input box (`<AiMessageInput />`)

* Suggestion chips (`<AiSuggestions />`)

* Streaming indicator (`<AiTypingIndicator />`)

### **Use cases:**

* Onboarding

* General help

* Contextual support

* Task assistance

---

## **Layout 2 — Right-Side Assistant Sidebar**

Slides out from the right edge.

### **Components:**

* `<AiSidebar />`

* `<AiSidebarHeader />`

* `<AiSidebarBody />`

* `<AiSidebarActions />`

### **Use cases:**

* Form explanations

* Guided onboarding

* Data insights

* Step-by-step guidance

---

## **Layout 3 — Inline Component Agent (Field-Level Helper)**

An agent attached to specific UI fields.

### **Components:**

* `<AiFieldHelper />`

* `<AiFieldHint />`

* `<AiInlineSuggestion />`

### **Use cases:**

* Input validation

* Smart auto-complete

* “Explain this field”

* Inline form tutoring

---

## **Layout 4 — Dashboard Insight Panel**

AI panel that analyzes data and shows insights.

### **Components:**

* `<AiInsightPanel />`

* `<AiInsightCard />`

* `<AiTrendWidget />`

### **Use cases:**

* Analytics explanation

* Business insights

* Error aggregation

* User behavior insights

---

## **Layout 5 — Full-Page AI Workspace**

Dedicated page for advanced AI tasks:

### **Components:**

* `<AiWorkspaceLayout />`

* `<AiWorkspaceSidebar />`

* `<AiWorkspaceCanvas />`

* `<AiWorkspaceOutput />`

### **Use cases:**

* long-form generation

* document analysis

* architecture generation

* project planning

---

## **Layout 6 — Modal AI Assistant**

AI-powered modal window triggered by UI interaction.

### **Components:**

* `<AiModal />`

* `<AiModalContent />`

* `<AiQuickActions />`

### **Use cases:**

* Quick document rewrite

* Suggesting database improvements

* AI-powered editing

---

# **SECTION 4 — UI COMPONENT LIBRARY FOR AGENTS**

All UI agents must use **the standard component library**:

---

## **Core UI Components**

| Component | Purpose |
| ----- | ----- |
| `<AiChatWindow />` | Full chat interface |
| `<AiMessage />` | Single AI or user message |
| `<AiMessageList />` | Message stream |
| `<AiSuggestions />` | Chip-style suggestions |
| `<AiTypingIndicator />` | Streaming animation |
| `<AiSidebar />` | Right-side assistant |
| `<AiInsightCard />` | Dashboard insights |
| `<AiFieldHelper />` | Form-specific guidance |
| `<AiModal />` | AI-triggered modal |
| `<AiFab />` | Floating AI button |
| `<AiToolbar />` | Agent toolbar |

All components use:

* React

* Tailwind CSS

* Design tokens from Document 28

* Strict naming conventions (kebab-case or Pascal depending on role)

---

# **SECTION 5 — VISUAL RULES & CONSISTENCY**

All embedded AI interfaces must follow strict design rules:

---

## **Color Tokens (Tailwind Custom Tokens)**

* `--ai-bg`

* `--ai-bg-alt`

* `--ai-border`

* `--ai-text`

* `--ai-accent`

Light mode / dark mode supported by toggles.

---

## **Spacing & Layout Rules**

* Min padding: `p-4`

* Chat message bubble padding: `p-3`

* Sidebar width: `w-[420px]`

* Modal spacing: `max-w-[700px] mx-auto`

---

## **Typography Rules**

* Body text: `text-sm`

* Headings: `text-lg font-semibold`

* Agent name: `text-xs uppercase tracking-wide opacity-50`

* Code blocks: monospace with background

---

## **Message Bubble Rules**

### **AI Message:**

* Background: `bg-ai-bg-alt`

* Text: `text-ai-text`

* Rounded: `rounded-xl`

* Max width: `max-w-[80%]`

### **User Message:**

* Background: `bg-ai-accent`

* Text: `text-white`

* Align right: `ml-auto`

---

# **SECTION 6 — INTERACTION PATTERNS**

AI embeds must follow:

---

## **Pattern A — Fast Input → Slow Output**

User input triggers immediate UI feedback:

* spinner

* typing indicator

* skeleton cards

---

## **Pattern B — Suggestion Chips**

Used to guide the user UI:

`<AiSuggestions`  
   `items={[`  
      `"Explain this section",`  
      `"What should I do next?",`  
      `"Generate an example"`  
   `]}`  
`/>`

---

## **Pattern C — Progressive Disclosure**

Show minimal UI, expand when needed.

Examples:

* collapsed inspector

* hide advanced settings

* show help on hover

---

## **Pattern D — Agent Action Buttons**

Inline actions:

* rewrite

* analyze

* summarize

* explain

* refactor

---

## **Pattern E — Dual-Mode Interaction**

Agents can:

1. Chat

2. Execute actions

This requires clear UI affordances.

---

# **SECTION 7 — AGENT UI ERROR STATES**

All AI components must include structured error states:

### **Mild Error (Retryable)**

* lost connection

* API timeout

UI shows:

* a small banner

* retry button

### **Moderate Error (Handled)**

* invalid input

* forbidden action

* missing field

UI shows:

* advice

* how to fix

### **Severe Error (Escalated)**

* coding bug

* backend failure

* database conflict

UI shows:

* friendly message

* support option

* hides internal logs

The UI **must never reveal internal stack traces**.

---

# **SECTION 8 — SAFETY UX PRINCIPLES**

UI agents must follow:

### **• Do not auto-run actions**

User must explicitly confirm destructive actions.

### **• Do not expose internal system dictation**

No logs, instructions, or system prompts displayed.

### **• Do not overwrite user input without consent**

### **• Never show hallucinated structure**

Must use Codex file explorer or schema evaluator.

### **• Always ask before making schema or code changes**

### **• Always display a readable summary before taking action.**

---

# **SECTION 9 — AGENT UI ACCESSIBILITY RULES**

Mandatory:

* keyboard navigation

* focus rings on interactive elements

* aria-labels for agent buttons

* clear contrast ratios

* readable font sizes

* voice-over compatible structure

No exceptions.

---

# **SECTION 10 — STANDARD NAMING FOR UI AGENT FILES**

Follow consistent naming:

`/components/ai/`  
   `AiChatWindow.jsx`  
   `AiMessage.jsx`  
   `AiSidebar.jsx`  
   `AiInsightPanel.jsx`  
   `AiFieldHelper.jsx`  
   `AiActionButton.jsx`  
   `AiModal.jsx`

Naming rules:

* Components: PascalCase

* Hooks: camelCase (`useAiChat`, `useAgent`)

* Styles: kebab-case

* Utils: kebab-case

---

# **SECTION 11 — ONE-SENTENCE SUMMARY**

**Document 43 defines the visual patterns, UX rules, layout templates, and component standards required to embed intelligent AI agents consistently throughout your UI.**

---

###### 

# **📘 DOCUMENT 44 — THE USER INTENT RECOGNITION ENGINE**

### ***How Agents Detect User Purpose, Mode, Context & Required Tools Across Your Entire AI Ecosystem***

---

# **SECTION 1 — PURPOSE OF THIS DOCUMENT**

This doctrine defines **exactly how your system interprets user intent**, including:

* what the user *wants*

* what the user is *trying to do*

* whether the user intent is **design, coding, debugging, research, UX, deployment, or automation**

* which **agent** should respond

* which **tools** must be activated

* what **context** is required

* what **safety rules** apply

* when confirmation is needed

This ensures your multi-agent system always chooses the right:

* brain

* process

* reasoning mode

* tool

* agent

* workflow

…based on what the user says.

This is the “mind-reading engine” of your AI ecosystem.

---

# **SECTION 2 — THE FOUR PILLARS OF INTENT**

Every user message is analyzed under **four dimensions**:

---

## **1\. *Purpose Intent* — What the user wants to achieve**

* build a feature

* fix a bug

* understand something

* design a UI

* architect a system

* run a command

* perform a migration

* create an automation

* get an explanation

* get an example

* debug an error

---

## **2\. *Mode Intent* — HOW the user wants to work**

There are 7 supported modes:

1. **Conversation Mode** (general discussion)

2. **Guided Mode** (step-by-step help)

3. **Execution Mode** (run code/tools)

4. **Design Mode** (UX, components, flows)

5. **Engineering Mode** (coding, refactoring)

6. **Debugging Mode** (errors, diagnoses)

7. **Orchestration Mode** (multi-agent coordination)

---

## **3\. *Context Intent* — WHAT the user is referring to**

Agents detect references to:

* a specific file

* a specific feature

* a project directory

* a UI component

* a Supabase table

* a schema

* a workflow

* an earlier conversation

* a design in Figma

* a prompt in ChatGPT canvas

Context MUST be verified before acting.

---

## **4\. *Tool Intent* — WHICH tools are required**

Agents infer whether user wants to involve:

* Codex (file creation, commands, refactor)

* Supabase AI (schema, SQL, RLS, migrations)

* n8n (automations, workflows)

* UX Pilot AI (UI/UX flows)

* Lovable (frontend deployment, wiring)

* Agent Builder (background agents, microservices)

* Vector memory (knowledge recall)

Agents never guess — they follow rules.

---

# **SECTION 3 — THE INTENT CLASSIFICATION MODEL (ICM)**

Every message runs through the **7-layer Intent Classifier**.

---

## **🔷 Layer 1 — Syntax Clues**

Looks at sentence structure:

* imperative? ("Do this...")

* question?

* declarative?

* broken/short? (needs tutoring mode)

---

## **🔷 Layer 2 — Action Keywords**

System detects domain-specific verbs:

* “generate”, “write”, “create” → Engineering

* “fix”, “debug”, “error” → Debugging

* “deploy”, “publish”, “push” → Deployment

* “design”, “mockup”, “ui” → UX

* “explain”, “teach”, “why” → Tutoring

* “connect”, “sync”, “automate” → Orchestration

* “add”, “remove”, “change” → Mutation

* “analyze”, “interpret”, “summarize” → Insight Mode

---

## **🔷 Layer 3 — Domain References**

Detects what system area the user refers to:

* “Supabase” → Data

* “schema” → Supabase AI

* “folder”, “files”, “components” → Codex

* “flow”, “diagram” → UX Pilot or Eraser

* “workflow” → n8n

* “repo”, “commit” → GitHub

* “deployed” → Lovable

---

## **🔷 Layer 4 — Complexity Detection**

Three categories:

### **• Low complexity**

Explain something, generate example.

### **• Medium complexity**

Create component, write file, refactor.

### **• High complexity**

Feature creation, debugging, multi-agent orchestration.

The more complex → more agents involved.

---

## **🔷 Layer 5 — Risk Classification**

Risk levels:

### **• Low Risk**

UI help, explanations, safe code snippets.

### **• Medium Risk**

File changes, structured updates.

### **• High Risk**

Migrations, deletions, schema edits, terminal commands.

High-risk actions REQUIRE confirmation.

---

## **🔷 Layer 6 — Memory Hooks**

Looks for:

* references to previous tasks

* references to project state

* references to stored decisions

* references to naming conventions

* references to known code files

If detected → pull memory.

---

## **🔷 Layer 7 — Agent Routing**

Final step:

**Intent → Agent \+ Tool Mapping**

The system routes:

* to UX Pilot for design

* to Codex for repo actions

* to Supabase AI for schema

* to Debug Sentinel for errors

* to Architect for planning

* to Workflow Orchestrator for automation

* to Personal Guide for tutoring

---

# **SECTION 4 — THE INTENT → AGENT ROUTING TABLE**

A mandatory routing system.

---

## **INTENT → AGENT**

| Intent | Agent |
| ----- | ----- |
| UX / UI | UX Pilot |
| Code creation | Engineer (Codex) |
| File edits | Codex |
| Debugging | Debug Sentinel |
| Schema | Supabase AI |
| Database safety | Data Guardian |
| Automation | Workflow Orchestrator |
| Deployment | Lovable |
| Architecture | Architect Brain |
| Onboarding help | Personal Guide |

---

## **INTENT → TOOL**

| Intent | Tool |
| ----- | ----- |
| File changes | Codex file tools |
| Commands | Codex terminal |
| Supabase work | Edge Functions / Supabase AI |
| Workflows | n8n |
| Vector knowledge | Memory Brain |
| UI embedding | React/Tailwind generator |
| Git commits | GitHub toolset |

---

# **SECTION 5 — THE 10 INTENT TYPES (MASTER CATEGORIES)**

Your system uses ten official intent types:

1. **Understand Intent**  
    (Questions, explanations)

2. **Create Intent**  
    (New code, new components)

3. **Modify Intent**  
    (Edit existing files)

4. **Fix Intent**  
    (Debug, error repair)

5. **Design Intent**  
    (UI/UX flows)

6. **Architect Intent**  
    (System structure)

7. **Automate Intent**  
    (n8n or agent workflows)

8. **Deploy Intent**  
    (Lovable/Vercel)

9. **Connect Intent**  
    (API wiring, integration)

10. **Evaluate Intent**  
     (Analyze, summarize, validate)

---

# **SECTION 6 — HOW THE SYSTEM DETERMINES "REQUIRED TOOLS"**

Based on detected intent, the system selects tools.

---

## **Rules:**

* No file creation → no Codex

* No DB change → no Supabase

* No workflow → no n8n

* UI-only → no backend tools

* Design-only → no commands

* Debug request → trigger Debug Sentinel

* Schema request → trigger Data Guardian

* Deployment → call Lovable

Tools are activated ONLY when needed.

---

# **SECTION 7 — USER INTENT SAFETY FILTER**

Before execution, intents pass through safety filters:

### **✔ Check action risk**

### **✔ Check user permissions**

### **✔ Check agent scope**

### **✔ Check allowed tools**

### **✔ Check for destructive patterns**

### **✔ Check for required confirmations**

### **✔ Check if context is missing**

---

# **SECTION 8 — THE USER INTENT → EXECUTION FLOWS**

Here are the official execution flows.

---

## **Flow A — User wants a simple explanation**

→ route to Personal Guide  
 → no tools

---

## **Flow B — User wants to write code**

→ Architect verifies  
 → Codex implements

---

## **Flow C — User wants to fix an error**

→ Debug Sentinel analyzes  
 → Codex applies patch

---

## **Flow D — User wants to design UI**

→ UX Pilot generates  
 → no destructive tools

---

## **Flow E — User wants to modify DB**

→ Data Guardian validates  
 → Supabase AI performs  
 → Codex updates client code

---

## **Flow F — User wants an automation**

→ Workflow Orchestrator produces  
 → n8n implemented

---

## **Flow G — User wants to deploy**

→ Lovable handles

---

# **SECTION 9 — INTENT CLARIFICATION RULE**

If the system is not 100% certain what the user wants:

### **Agents must ask clarifying questions.**

No assumptions.  
 No hallucinated tasks.  
 No incorrect tool usage.

---

# **SECTION 10 — SINGLE SENTENCE SUMMARY**

**The User Intent Recognition Engine ensures every message is correctly understood, classified, routed, and executed by the right AI agent using the right tools, safely and predictably.**

---

###### 

# **📘 DOCUMENT 45 — THE INSTRUCTION DECOMPOSITION ENGINE**

### ***How Your AI System Breaks Any User Request Into Clear, Ordered, Safe, Executable Tasks***

---

# **SECTION 1 — PURPOSE OF THIS DOCUMENT**

This doctrine defines **how your AI ecosystem takes ANY user request—no matter how messy, high-level, emotional, or unclear—and translates it into a perfectly organized sequence of atomic steps that multiple AI agents can safely execute.**

This is the system that transforms:

* “Fix this shit”

* “Build me a dashboard”

* “Make this work”

* “Add payments”

* “It’s broken”

* “Connect everything”

* “Do the backend”

…into precise, measurable, unambiguous technical tasks.

It is the “compiler” for human intention.

---

# **SECTION 2 — THE DECOMPOSITION MISSION**

The engine has **three goals**:

### **✔ Break big tasks into small executable steps**

### **✔ Assign each step to the correct AI agent**

### **✔ Ensure tasks are ordered, safe, and reversible**

This ensures:

* Codex knows what to write

* Supabase AI knows which schema changes to make

* UX Pilot knows which components to generate

* Debug Sentinel knows which files to inspect

* Workflow Orchestrator knows how to automate

* Lovable knows what to deploy

No confusion.  
 No overlapping tasks.  
 No guessing.  
 No dangerous operations.

---

# **SECTION 3 — THE DECOMPOSITION PYRAMID**

The system ALWAYS decomposes at **five levels**:

1. **Goal** → What the user ultimately wants

2. **Outcomes** → What must exist when the goal is complete

3. **Modules** → Logical segments or sections of work

4. **Tasks** → Small chunks of work assigned to agents

5. **Steps** → Specific actions each tool or AI must perform

This guarantees clarity.

---

# **SECTION 4 — THE INSTRUCTION PARSING PHASE**

When a user gives an instruction, the engine performs:

---

## **1\. Intent Detection**

(Uses Document 44 rules)

The system identifies:

* Purpose

* Mode

* Context

* Complexity

* Domain

* Risk level

---

## **2\. Keyword Extraction**

The engine extracts “anchors” such as:

* “dashboard”, “auth”, “schema”, “component”, “fix”, “explain”

* “design”, “connect”, “run”, “setup”, “optimize”, “deploy”

---

## **3\. Constraint Detection**

Constraints include:

* tech stack

* naming conventions

* required tools

* risk boundaries

* project state

* user skill level

* allowed file paths

* coding style rules

---

## **4\. Missing Information Detection**

The engine determines if required details are missing.

If missing → **system must ask questions** before continuing.

---

## **5\. Task Expansion**

Large instructions get broken into modules.  
 Each module becomes tasks.  
 Each task becomes discrete steps.

Example:

“Add login” becomes:

* UI module

* Auth module

* Supabase module

* Routing module

* Error handling module

---

# **SECTION 5 — THE 10 DECOMPOSITION CATEGORIES**

All tasks fall into one or more of these categories:

1. **UI Generation**

2. **State Management**

3. **Backend Logic**

4. **Database Schema**

5. **RLS & Security**

6. **Automation / n8n**

7. **Deployment**

8. **Debugging**

9. **Refactoring**

10. **Documentation**

Each category has its own flow.

---

# **SECTION 6 — THE DECOMPOSITION PIPELINE (THE 7 STEPS)**

This is the **official** step-by-step process.

---

## **STEP 1 — Normalize the User Request**

Convert human language → structured instruction.

Example:  
 “Fix this broken shit” → “User reports a runtime error in X file.”

---

## **STEP 2 — Identify Required Output Format**

Options:

* Code

* File edits

* Architecture

* UI mockups

* Database changes

* Step instructions

* Workflows

---

## **STEP 3 — Segment Into Modules**

Break into the smallest meaningful components.

Example:  
 “Build dashboard” becomes:

* layout

* sidebar

* header

* metrics

* API integration

* state management

---

## **STEP 4 — Expand Modules Into Tasks**

Example (metrics):

* create metrics component

* create supabase query

* render in UI

* add loading states

* add error states

---

## **STEP 5 — Assign Each Task to the Correct Agent**

Examples:

* UI → UX Pilot

* React code → Codex

* SQL / schema → Supabase AI

* Debugging → Debug Sentinel

* Deployment → Lovable

* Automation → n8n Orchestrator

---

## **STEP 6 — Order Tasks for Correct Execution**

Rules:

* backend before UI

* schema before queries

* components before routing

* debugging before refactoring

* migrations before deployments

---

## **STEP 7 — Output Step-by-Step Execution Plan**

The final result looks like:

1. Do X

2. Then do Y

3. Then do Z

4. Ask user for confirmation

5. Run code

6. Apply file changes

7. Validate

8. Report results

This is the decomposition output that drives Codex.

---

# **SECTION 7 — THE 12 DECOMPOSITION PATTERNS**

These are pre-defined blueprints agents must use.

---

## **Pattern 1 — UI Component Creation**

1. Define requirements

2. Generate layout

3. Implement logic

4. Style with Tailwind

5. Add props

6. Add error/empty states

7. Export and register

---

## **Pattern 2 — Feature Creation**

1. Identify user flow

2. Design UI

3. Create DB schema

4. Create API handlers

5. Create components

6. Wire state

7. Test end-to-end

---

## **Pattern 3 — Debugging**

1. Classify error

2. Identify file

3. Reproduce

4. Inspect code

5. Fix

6. Test

7. Confirm

---

## **Pattern 4 — Database Schema**

1. Validate purpose

2. Define tables

3. Define columns

4. Define relations

5. Define RLS

6. Add constraints

7. Generate migrations

8. Update TypeScript types

9. Update client code

---

## **Pattern 5 — Refactoring**

1. Define goal

2. Locate code

3. Extract modules

4. Standardize naming

5. Rewrite logic

6. Update imports

7. Test

---

## **Pattern 6 — Automation (n8n)**

1. Define trigger

2. Define input

3. Define actions

4. Define branching

5. Add error flow

6. Save & test

---

## **Pattern 7 — Deployment**

1. Build

2. Run lint/tests

3. Push to GitHub

4. Trigger Lovable/Vercel

5. Validate database

6. Smoke test

---

(There are more, but these 7 are core. Additional ones can be generated.)

---

# **SECTION 8 — DECOMPOSITION SAFETY RULES**

Agents MUST obey these safety rules:

### **✔ No file modifications without full task breakdown**

### **✔ No destructive actions (delete, drop, migrate) without user confirmation**

### **✔ No execution if prerequisites are missing**

### **✔ Never merge two tasks if risk increases**

### **✔ Debugging must always isolate impact**

### **✔ Schema must remain versioned**

### **✔ Memory updates must be stable**

---

# **SECTION 9 — THE DECOMPOSITION PROTOCOL FOR UNCLEAR INSTRUCTIONS**

If the user gives vague or emotional instructions:

Examples:

* “It’s broken”

* “Fix it”

* “Make this better”

* “Do the backend”

* “Clean up the code”

Agents must:

### **1\. Normalize the language**

### **2\. Identify missing details**

### **3\. Ask clarifying questions**

### **4\. Reconfirm the final decomposition**

### **5\. Execute**

This prevents hallucinated work.

---

# **SECTION 10 — FINAL SUMMARY**

**The Instruction Decomposition Engine transforms any user message into a clean, ordered, safe, multi-agent execution plan. It is the foundation for predictable, coordinated, AI-driven software development.**

---

