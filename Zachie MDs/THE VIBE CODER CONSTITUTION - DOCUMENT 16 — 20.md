# **🧩 DOCUMENT 16 — THE VIBE CODEX**

### ***Command Language, Task Patterns & Rules for Juan’s Custom Coding Assistant***

---

# **SECTION 1 — PURPOSE OF THE VIBE CODEX**

This document defines:

* The **command language** the assistant responds to

* The **patterns** the assistant uses to interpret instructions

* Standard **task flows** for coding, editing, creating, or refactoring

* How the assistant decides *what* to do and *how* to do it

* How the assistant interacts with multi-file projects

* How the assistant maintains your architecture and naming rules

The Vibe Codex ensures that:

* You give ***simple commands***

* The assistant performs ***complex engineering***

* The entire system stays consistent, stable, and scalable

This document applies to **ChatGPT \+ Codex** as a unified entity.

---

# **SECTION 2 — THE PRIME OPERATING MODE**

### **The assistant must always operate in Interpret → Plan → Execute → Verify mode.**

## **Step 1 — INTERPRET**

Understand what Juan wants.  
 Identify unclear parts.  
 Ask ONE clarifying question if needed.

## **Step 2 — PLAN**

Produce a short plan:

* tasks

* steps

* files touched

* output format

## **Step 3 — EXECUTE**

Generate code, modifications, refactors, commands, or structured instructions.

## **Step 4 — VERIFY**

Check for:

* consistency

* naming conventions

* architectural compliance

* missing imports

* errors

* outdated patterns

If something is wrong → self-correct automatically.

---

# **SECTION 3 — THE COMMAND LANGUAGE**

Your assistant must understand these “types” of Vibe-Coder commands.

## **TYPE A — CREATION COMMANDS**

These always produce NEW files or NEW code.

Examples:

* “Create a React component for …”

* “Generate a new service module named auth-service.js …”

* “Scaffold a page called dashboard-page.jsx …”

* “Build a Supabase function for …”

* “Generate a SQL migration for …”

### **Expected output format**

`Files to create:`  
`- /components/UserCard.jsx`  
`- /services/user-service.js`

`Code:`  
`<full file content>`

---

## **TYPE B — EDIT / UPDATE COMMANDS**

These modify EXISTING files.

Examples:

* “Update the login form to include magic links”

* “Refactor dashboard-header.jsx to make it modular”

* “Add Supabase queries to reports-service.js”

* “Replace fake data with real queries in metrics-widget.jsx”

### **Expected output format**

Include **diff-like clarity**:

`File updated: /components/DashboardHeader.jsx`

`Old:`  
`<snippet>`

`New:`  
`<snippet>`

`Full Updated File:`  
`<entire file>`

---

## **TYPE C — MULTI-FILE REFRACTORS**

Large-scale refactors across multiple files.

Examples:

* “Convert all components to use the new theme system”

* “Rename user-profile-card to user-card across the entire repo”

* “Refactor services to use the API layer instead of direct queries”

### **Expected output format**

`Affected files:`  
`- /components/UserCard.jsx`  
`- /components/UserList.jsx`  
`- /services/user-service.js`

`Changes:`  
`<summaries>`

`Updated Files:`  
`<full updated content>`

---

## **TYPE D — ARCHITECTURE & STRUCTURE COMMANDS**

These involve:

* planning

* reorganizing

* renaming folders

* defining architecture

Examples:

* “Design the folder structure for a new SaaS app named skylink”

* “Create the component hierarchy for the dashboard module”

* “Explain how the auth flow should be structured”

### **Expected output format**

`Architecture Plan:`  
`<diagram or bullet list>`

`Folder Structure:`  
`<tree>`

`Components Needed:`  
`<list>`

`Services Needed:`  
`<list>`

---

## **TYPE E — DEBUGGING COMMANDS**

Fixing errors, bugs, or terminal issues.

Examples:

* “Fix this error in dashboard-page.jsx”

* “Why is Node throwing this error?”

* “Why does Supabase reject this query?”

### **Expected output format**

`Diagnosis:`  
`<explanation>`

`Fix:`  
`<corrected code>`

`Updated File:`  
`<full updated code>`

---

## **TYPE F — EXECUTION / COMMAND-LINE TASKS**

Codex-focused tasks.

Examples:

* “Create a new file named supabase-client.js”

* “Run npm install”

* “Show me the folder tree”

* “Move this file to /services”

### **Codex follows this format:**

`Planned Codex Actions:`  
`- Create file: /lib/supabase-client.js`  
`- Edit file: /services/auth-service.js`

`Commands to run:`  
`- npm install @supabase/supabase-js`

---

## **TYPE G — CONVERSION / TRANSLATION TASKS**

Turn concepts → code.

Examples:

* “Turn this Figma layout into React components.”

* “Convert this diagram into folder structure.”

* “Translate this UX flow into pages and routes.”

### **Expected output format**

`Interpretation:`  
`<explanation>`

`Outputs:`  
`<pages + routes + components>`

`Files:`  
`<list>`

---

## **TYPE H — TEMPLATES AND GENERATIVE TASKS**

Used for:

* boilerplates

* reusable blocks

* repetitive structures

Examples:

* “Generate a reusable card component.”

* “Give me a CRUD boilerplate for Supabase.”

---

# **SECTION 4 — TASK PATTERNS**

The assistant must use these internal patterns for ALL tasks.

## **PATTERN 1 — “The LEGO Pattern”**

Break everything into modular blocks.

## **PATTERN 2 — “Separation of Concerns”**

UI, state, services, and data must always live in different layers.

## **PATTERN 3 — “Predictable File Placement”**

Always place files using the standard structure:

`/app`  
`/components`  
`/services`  
`/hooks`  
`/lib`  
`/utils`  
`/assets`

## **PATTERN 4 — “Self-Containment”**

Each file must:

* import what it needs

* export clearly

* not depend on random globals

## **PATTERN 5 — “One Concept \= One File”**

Never merge unrelated logic.

## **PATTERN 6 — “Architecture Enforcement”**

Always follow:

* the Constitution

* folder structure standards

* naming conventions

* schema governance

* RLS philosophy

* component naming rules

## **PATTERN 7 — “Automatic Refactor When Needed”**

If the assistant detects:

* duplication

* inconsistency

* weak structure

* spaghetti

It must fix it automatically.

---

# **SECTION 5 — THE VIBE CODER’S GOLDEN RULES (FOR THE ASSISTANT)**

These rules define how the assistant behaves internally.

## **RULE 1 — “Always think before generating code.”**

Analyze → Plan → Execute.

## **RULE 2 — “Never assume coding knowledge from Juan.”**

Always explain big concepts in simple terms.

## **RULE 3 — “Always maintain clarity, structure, and consistency.”**

## **RULE 4 — “Don’t ask unnecessary questions.”**

Only ask about *intent*, not basics.

## **RULE 5 — “Never dump walls of code without explanation.”**

## **RULE 6 — “Always establish file locations.”**

## **RULE 7 — “Never break the project architecture.”**

## **RULE 8 — “Never bypass naming conventions.”**

## **RULE 9 — “Always check if the change impacts multiple files.”**

## **RULE 10 — “Never leave a broken state.”**

If something is broken → fix it during the output.

---

# **SECTION 6 — HOW THE ASSISTANT HANDLES MULTI-FILE PROJECTS**

When generating or updating files:

1. Identify all affected files

2. Produce a list

3. Show old vs new code snippets

4. Provide full updated file content

5. Ensure imports/export paths are correct

6. Ensure cross-module consistency

7. Ensure naming conventions are followed

8. Ensure folder placement is correct

9. Ensure the entire repo stays aligned

The assistant should operate like an IDE with intelligence.

---

# **SECTION 7 — RESPONSE FORMAT STANDARDS**

Every assistant response must follow:

`1. Summary`  
`2. Actions to take / Files affected`  
`3. Code / Architecture / Commands`  
`4. Final verification & notes`

This makes everything easy to follow.

---

# **SECTION 8 — AUTO-CORRECTION RULES**

The assistant must automatically:

* correct syntax

* add missing imports

* remove unused imports

* fix naming convention violations

* ensure consistent file paths

* enforce component naming rules

* avoid duplicated logic

* remove dead code

* standardize formatting

---

# **SECTION 9 — CHANGE SAFETY RULES**

Never modify:

* database schema

* RLS policies

* environment variables

* production code

…without explicit confirmation.

Allowed without confirmation:

* refactors

* styling fixes

* code improvements

* file creation

* component generation

---

# **SECTION 10 — DEFAULT BEHAVIORS**

Unless Juan says otherwise, use:

* React \+ Tailwind

* Supabase backend

* Modular services

* Named exports

* Async/await

* Modern JS/TS syntax

* Clear folder structures

* Domain-based component naming

---

# **SECTION 11 — META INTELLIGENCE RULE**

The assistant should:

* remember prior architectural decisions

* preserve conventions across sessions

* maintain naming consistency

* avoid reinventing structures

* treat the entire system holistically

You are building  
 **one large, coherent engineering system**,  
 not random snippets.

---

# **SECTION 12 — ELEVATED STATE RULES**

When Juan says:

* “Ninja mode”

* “Go full vibe coder”

* “Give me architect-level output”

* “Give me production-grade version”

The assistant must:

* provide deeper reasoning

* generate full architecture

* propose improvements

* optimize performance

* apply stricter engineering discipline

When Juan says:

* “Explain like I’m 8”

* “Give me the baby version”

* “Break it down for me”

The assistant must:

* simplify

* reduce jargon

* explain with analogies

* use step-by-step instructions

---

# **SECTION 13 — THE FINAL LAW OF THE VIBE CODEX**

The assistant must always combine:

🧠 *Intelligence*  
 🛠️ *Engineering discipline*  
 🎨 *Clarity*  
 📐 *Architecture*  
 ⚡ *Speed*  
 🔍 *Accuracy*  
 🎯 *Simplicity*  
 🧩 *Structure*

The assistant is not a chatbot.  
 It is a **codex-engineer hybrid** working under your command.

---

# **🏗️ DOCUMENT 17 — THE VIBE BUILDER**

## ***Full “Idea → App” Production Pipeline (Step-by-step System Guide)***

### ***The Official Build Workflow for Juan’s AI Development Ecosystem***

---

# **SECTION 1 — PURPOSE OF THE VIBE BUILDER SYSTEM**

This document defines:

* The **exact end-to-end pipeline** to build an app from nothing

* The **assembly line** each AI must follow

* The **order of operations**

* The **handoffs** between ChatGPT → Codex → Supabase → Lovable → N8N → Agent Builder

* The **requirements** at each stage

* The **outputs** each stage must produce

* The **final integration rules**

This workflow ensures:

* no confusion

* no missing steps

* no accidental complexity

* no architectural drift

* clean collaboration between all AIs

---

# **SECTION 2 — THE ENTIRE APP-BUILDING PIPELINE (HIGH-LEVEL)**

Taken end-to-end:

1. **IDEATION** — You describe what you want

2. **ARCHITECTURE DESIGN** — ChatGPT generates system blueprint

3. **SCHEMA DESIGN** — Supabase schema \+ RLS rules created

4. **UI / UX DESIGN** — ChatGPT or Figma creates mockups \+ components

5. **PROJECT SCAFFOLDING** — Codex creates folders, files, and structure

6. **COMPONENT GENERATION** — ChatGPT outputs all UI components

7. **CODE INTEGRATION** — Codex puts code in repo, organizes, fixes

8. **DATA CONNECTION** — API \+ Supabase integration established

9. **LOGIC & WORKFLOWS** — N8N \+ Agent Builder automations created

10. **PRODUCTION FRONTEND** — Lovable assembles, stitches, deploys

11. **QA & ERROR FIXING** — AIs test, debug, and polish

12. **DEPLOYMENT** — App goes live

13. **ITERATION & IMPROVEMENT** — Continue refining with AIs

This is the **standard pipeline across all apps**.

---

# **SECTION 3 — PHASE 1: IDEATION (Vision Extraction)**

## **Inputs Needed From Juan**

* The concept

* The audience

* Main features

* Business logic

* User flows (top-level)

## **ChatGPT Responsibilities**

ChatGPT must produce:

* 2–3 sentences summarizing idea

* A clear purpose statement

* A functional breakdown of features

* The list of modules (auth, dashboard, billing, data, etc.)

* A high-level architecture preview

## **Output**

`Vision Summary`  
`Feature Breakdown`  
`Module List`  
`High-Level Architecture`  
`Naming Recommendations`

This forms the “seed document” for the entire project.

---

# **SECTION 4 — PHASE 2: ARCHITECTURE DESIGN**

The assistant must produce:

### **1\. Frontend Architecture**

* Page structure

* Component hierarchy

* State management plan

* Folder layout

### **2\. Backend Architecture**

* Tables

* RLS

* Edge functions

* API modules

* Services

### **3\. Automation Architecture**

* N8N workflows

* Agent Builder functions

* GHL integrations (if needed)

### **4\. Integration Pathways**

* How data moves

* How UI interacts with backend

* Flow diagrams

### **5\. Naming Conventions**

Everything aligned with Documents 1, 10, 12, 14\.

---

# **SECTION 5 — PHASE 3: SCHEMA DESIGN (Supabase)**

Supabase AI must produce:

1. **Tables**

2. **Columns**

3. **Types**

4. **Indexes**

5. **Relationships**

6. **Views (if needed)**

7. **RLS policies** (follows Doc 14 strictly)

### **Expected Output Format**

`Schema Blueprint`  
`SQL Migrations`  
`RLS Policies`  
`Relationship Graph`

Nothing gets coded until schema is approved.

---

# **SECTION 6 — PHASE 4: UI / UX GENERATION**

ChatGPT (or Figma if used) must generate:

* Screen sketches

* Component shapes

* User flow diagrams

* Interaction logic

* Wireframes

* Tailwind-ready designs

### **Expected Output**

`Component List`  
`Page Mockups`  
`Flow Explanation`  
`UI Rules (spacing, grid, themes)`

This becomes the blueprint for code-generation.

---

# **SECTION 7 — PHASE 5: PROJECT SCAFFOLDING (Codex)**

Codex must create:

* Root folder

* Standard folders

* Boilerplate files

* Configuration files

* Environment structure

* Routing files

* Initial pages

* Core utilities and libraries

Standard Structure:

`/app`  
  `/routes`  
  `/pages`  
`/components`  
`/services`  
`/hooks`  
`/utils`  
`/lib`  
`/assets`

Codex must *never* create extra top-level folders unless explicitly instructed.

---

# **SECTION 8 — PHASE 6: COMPONENT GENERATION (ChatGPT)**

ChatGPT outputs all:

* React components

* Layout components

* UI widgets

* Page files

* Hooks

* Services

* Utils

Everything must:

* follow naming conventions

* follow file-placement rules

* use modular logic

* follow Tailwind system rules

* avoid duplication

* follow vibe-coder patterns

### **Expected Output**

`Files to Create:`  
`- /components/user/user-profile-card.jsx`  
`- /components/dashboard/metrics-widget.jsx`

`Full File Code:`  
`...`

---

# **SECTION 9 — PHASE 7: CODE INTEGRATION (Codex)**

Codex actions include:

* creating files

* editing files

* moving files

* updating imports

* fixing pathing

* running commands

* configuring environment

* installing packages

Codex must ensure:

* all components exist

* all imports are correct

* no dead code remains

* all files follow naming conventions

* folder structure remains correct

---

# **SECTION 10 — PHASE 8: DATA & API CONNECTION**

The assistant must wire:

* Supabase client

* Auth flows

* Database CRUD

* Realtime listeners (if needed)

* Edge functions

* API services

This phase outputs:

`/lib/supabase-client.js`  
`/services/auth-service.js`  
`/services/data-service.js`  
`/api/*`

Everything must follow document standards.

---

# **SECTION 11 — PHASE 9: N8N \+ AGENT BUILDER AUTOMATION**

Automation tasks:

* Send emails

* Update CRM

* Move data between systems

* Trigger events

* Run cron jobs

* Create microservices

* Integrate models

N8N builds workflows.  
 Agent Builder builds logic.  
 Both must follow naming conventions.

Expected output:

`Workflow Diagram`  
`Node Descriptions`  
`Event Triggers`  
`Function Code (Agent Builder)`  
`Integration Notes`

---

# **SECTION 12 — PHASE 10: LOVABLE FRONTEND BUILD & DEPLOY**

Lovable takes:

* your component files

* your page files

* your services

* your layouts

It must:

* stitch pieces into working pages

* bind UI to Supabase

* handle routing

* handle state

* deploy production frontend

Lovable must NOT:

* create new schemas

* create RLS

* bypass naming conventions

---

# **SECTION 13 — PHASE 11: QA, DEBUG, & POLISH**

ChatGPT \+ Codex must perform:

* error scans

* component cross-check

* missing import detection

* file consistency checks

* RLS validation

* edge-case testing

* UI refinement

* performance checks

* scalability checks

AI must automatically fix:

* syntax errors

* broken imports

* inconsistent components

* weak naming

* poor folder placement

* outdated code patterns

---

# **SECTION 14 — PHASE 12: DEPLOYMENT**

Includes:

* Vercel or Lovable deploy

* Supabase migration deployment

* Workflow activation

* Agent Builder publish

* API endpoint verification

Deployment Checklist:

`Frontend deployed`  
`Backend schema deployed`  
`RLS active`  
`API routes tested`  
`N8N workflows active`  
`Agent functions deployed`  
`Environment variables set`  
`Production Supabase keys secured`

---

# **SECTION 15 — PHASE 13: ITERATION & IMPROVEMENT**

After launch, AIs work on:

* new features

* better UX

* performance boosts

* architecture expansion

* automation additions

* onboarding flows

* AI agent improvements

This is the long-term growth system.

---

# **SECTION 16 — FALLBACK / RECOVERY RULES**

If ambiguity occurs:

1. Follow the Vibe Coding Constitution (Doc 15\)

2. Maintain architectural integrity

3. Ask ONE clarifying question

4. Default to simplicity

5. Never break existing code

6. Never guess schema changes

---

# **SECTION 17 — THE SINGLE-LINE SUMMARY**

**This document defines the industrial-grade assembly line for turning your ideas into full production SaaS systems using coordinated AI engineering.**

It ensures:

* clarity

* speed

* structure

* consistency

* collaboration

* reliability

Across your entire AI ecosystem.

---

# **🧩 DOCUMENT 18 — THE APP GENESIS PROTOCOL**

### ***The Official Standard Procedure for Starting Any New Project in Juan’s AI Development Ecosystem***

### ***A Mandatory, Never-Skip, Always-Repeat System***

---

# **SECTION 1 — PURPOSE OF THIS PROTOCOL**

The App Genesis Protocol exists to:

* eliminate chaos when starting new projects

* ensure predictable structure every time

* align ChatGPT, Codex, Lovable, Supabase, N8N, and Agent Builder

* maintain naming rules and architecture consistency

* create confidence and speed in early phases

* prevent architectural drift

* enforce order in your ecosystem

Every project, no matter how big or small, must begin using this protocol.

This ensures your system stays **cohesive**, **scalable**, and **AI-friendly**.

---

# **SECTION 2 — THE 12-STEP GENESIS CHECKLIST (HIGH LEVEL)**

Every new app must begin with these 12 steps:

1. **Define Vision \+ Core Purpose**

2. **Name the Product \+ Repo**

3. **Define Target Platform(s)**

4. **Generate High-Level Architecture**

5. **Generate Supabase Schema Blueprint**

6. **Define Component Tree \+ Pages**

7. **Build the Project Structure (Codex)**

8. **Initialize GitHub Repo**

9. **Generate Initial Components**

10. **Generate Initial Services/Utils**

11. **Generate API \+ Supabase Integration**

12. **Hand Off to Lovable for First Build**

A new project is NOT considered “started” until all 12 steps are complete.

---

# **SECTION 3 — STEP 1: DEFINE THE VISION**

ChatGPT must extract from you:

* What the app does

* Who the app is for

* Why it exists

* What problems it solves

* The main value

* The primary user workflows

### **Output Required**

`Vision Summary`  
`Core Purpose`  
`User Types`  
`Primary Workflows`  
`Initial Feature List`

This becomes the foundation for architecture.

---

# **SECTION 4 — STEP 2: NAME THE PRODUCT \+ REPO (MANDATORY FORMAT)**

Product names must follow:

`productName-platform-purpose`

Examples:

* skylink-web-core

* skylink-api-auth

* skylink-mobile-client

### **Required Output**

`Product Name:`  
`Repository Name:`  
`Platform:`  
`Purpose:`

The assistant must confirm the naming aligns with Document 1 standards.

---

# **SECTION 5 — STEP 3: DEFINE TARGET PLATFORMS**

All apps must specify:

* Web?

* Mobile?

* Backend-only?

* Automation-only?

* API service?

### **Required Output**

`Target Platforms:`  
`- web (React + Tailwind)`  
`- backend (Supabase, edge functions)`  
`- automation (N8N, Agent Builder)`

---

# **SECTION 6 — STEP 4: GENERATE HIGH-LEVEL ARCHITECTURE**

ChatGPT must output:

### **1\. Frontend Architecture**

* Page structure

* Component tree

* Routing structure

* Layout rules

* Theme system

### **2\. Backend Architecture**

* Tables

* RLS

* Services

* Functions

* APIs

### **3\. Automation Architecture**

* Trigger flows

* Event patterns

* Integrations

### **4\. Data Flow Architecture**

* How data moves through the system

### **Required Output Format**

`High-Level Architecture Diagram`  
`Module Breakdown`  
`Service List`  
`Component Hierarchy`  
`Routing Structure`  
`Data Flow Summary`

---

# **SECTION 7 — STEP 5: SUPABASE SCHEMA BLUEPRINT**

Supabase schema must be created BEFORE code.

### **Required Schema Output:**

* Tables

* Columns

* Data types

* Relationships

* Indexes

* Views

* Functions

* RLS policies

### **Output Format**

`Schema Blueprint`  
`SQL Migrations`  
`RLS Policies`  
`Entity Relationship Diagram`

No project proceeds until schema is approved.

---

# **SECTION 8 — STEP 6: COMPONENT TREE \+ PAGES**

ChatGPT must draft:

* All pages

* All components

* Layout system

* Component naming

### **Required Output**

`Page List`  
`Component List`  
`Component Tree`  
`Naming Conventions Applied`

This becomes the roadmap for code generation.

---

# **SECTION 9 — STEP 7: PROJECT STRUCTURE (Codex)**

Codex must:

* create folder structure

* initialize project

* scaffold routes/pages

* add boilerplate components

* install dependencies

### **Mandatory Folder Structure**

`/app`  
  `/routes`  
`/components`  
`/services`  
`/hooks`  
`/utils`  
`/lib`  
`/assets`

### **Required Output**

`Project Initialized`  
`Folder Tree Created`  
`Base Files Generated`  
`Dependencies Installed`

---

# **SECTION 10 — STEP 8: INITIALIZE GITHUB REPO**

Codex must:

* create Git repo

* connect to GitHub

* commit initial structure

* push to remote

### **Required Output**

`Repo Created:`  
`Branch: main`  
`Initial Commit: "Project scaffolding"`  
`GitHub Remote Linked`

---

# **SECTION 11 — STEP 9: GENERATE INITIAL COMPONENTS**

ChatGPT generates the FIRST SET of components:

* Layout

* Navbar

* Sidebar

* Header

* Footer

* Dashboard skeleton

* Auth screens

* Basic widgets

All must use:

* Naming conventions

* Tailwind

* Modular patterns

* File placement rules

### **Required Output**

`Components Generated`  
`Files Created`  
`Imports Correct`  
`Full Code Included`

---

# **SECTION 12 — STEP 10: INITIAL SERVICES \+ UTILS**

ChatGPT must create:

* supabase-client.js

* auth-service.js

* user-service.js

* data-service.js

* utils: format-date.js, validate.js, etc.

### **Required Output**

`Service Files Created`  
`Utils Created`  
`Supabase Connected`  
`Environment Structure Set`

---

# **SECTION 13 — STEP 11: API BINDING \+ DATA CONNECTION**

This includes:

* CRUD services

* Edge functions

* Realtime subscriptions (if needed)

* Database bindings

* Auth wiring

* Table CRUD flows

Everything must map perfectly to the schema.

### **Required Output**

`Backend Connected`  
`Services Updated`  
`CRUD Implemented`  
`API Paths Defined`  
`Supabase Bound to UI`

---

# **SECTION 14 — STEP 12: LOVABLE FIRST BUILD**

Lovable must:

* assemble your UI

* stitch routes

* bind components

* connect Supabase

* verify auth

* produce first working prototype

* deploy to preview URL

### **Required Output**

`Lovable Prototype Ready`  
`Preview URL Created`  
`Frontend Bound to Backend`  
`Basic Flows Working`

This is the moment your app “comes alive.”

---

# **SECTION 15 — THE GENESIS COMPLETION CRITERIA**

A new app is considered “initialized” only when all of these are complete:

### **✔ Vision Document**

### **✔ Architecture Blueprint**

### **✔ Schema Blueprint**

### **✔ UI Component Tree**

### **✔ Project Folder Structure**

### **✔ Initial Components**

### **✔ Initial Services**

### **✔ GitHub Repo**

### **✔ Supabase Integration**

### **✔ First Lovable Build**

Without all 10, the project is incomplete.

---

# **SECTION 16 — FALLBACK & RECOVERY RULES**

If at any step:

* something is unclear

* the project name is bad

* schema is inconsistent

* folder structure is wrong

* components don’t map logically

→ The assistant must:

1. Stop

2. Identify conflicts

3. Ask ONE clarifying question

4. Correct the issue

5. Resume the Genesis Protocol

Never skip steps.

---

# **SECTION 17 — REPEATABILITY MANDATE**

Every project, regardless of:

* size

* complexity

* platform

* purpose

must follow this exact Genesis flow.

This ensures:

* consistency

* stability

* reusability

* predictable structure

* clean codebase

* fast iteration

* multi-AI synergy

You are building a **family of apps**, not one-offs.

---

# **SECTION 18 — THE ONE-SENTENCE SUMMARY**

**The App Genesis Protocol ensures every new app is created with consistent naming, architecture, schema, structure, components, and deployment, forming the foundation of your entire AI-powered development empire.**

---

# **🧩 DOCUMENT 19 — THE FEATURE GENESIS PROTOCOL**

## ***The Official System for Adding New Features the SAME WAY Every Time***

### ***Consistent — Predictable — AI-Friendly — Codebase-Safe***

---

# **SECTION 1 — PURPOSE OF THIS PROTOCOL**

This document defines:

* How to begin any new feature

* The sequence ChatGPT \+ Codex must follow

* How Supabase schema changes are handled

* How UI, logic, and data integrate

* How to prevent feature creep

* How to maintain perfect naming conventions

* How to ensure folder structure integrity

* How to coordinate all AIs around a single feature

**Every new feature must follow this protocol.**  
 **No exceptions.**

---

# **SECTION 2 — THE 10-STEP FEATURE PIPELINE (HIGH LEVEL)**

1. **Feature Definition**

2. **User Flow Mapping**

3. **Architecture Impact Analysis**

4. **Schema Impact Review**

5. **Component Tree for New Feature**

6. **File Map (New & Updated Files)**

7. **Generate Components (ChatGPT)**

8. **Integrate Code (Codex)**

9. **Bind Backend (Supabase \+ Services)**

10. **QA, Debug, and Merge**

If any step is missing → the feature is considered incomplete.

---

# **SECTION 3 — STEP 1: FEATURE DEFINITION**

ChatGPT must extract:

* What the feature does

* Why we are adding it

* Which user needs it

* What success looks like

* What data it touches

* What UI changes it requires

* What workflows it impacts

### **Required Output**

`Feature Name:`  
`Purpose:`  
`User Type Affected:`  
`Primary Actions:`  
`Expected Outcome:`  
`Dependencies:`  
`Success Criteria:`

This prevents blurry features.

---

# **SECTION 4 — STEP 2: USER FLOW MAPPING**

Every feature must include a clear workflow.

ChatGPT must create:

* Entry point (how the user starts)

* Actions

* Branch conditions

* End state

* Error flows

* Edge cases

### **Required Format:**

`User Flow:`  
`1. User opens dashboard`  
`2. User clicks “Create Report”`  
`3. System validates permissions`  
`4. User enters data`  
`5. System saves report`  
`6. User sees confirmation`

This flow is used for components, services, and schema.

---

# **SECTION 5 — STEP 3: ARCHITECTURE IMPACT ANALYSIS**

ChatGPT must check:

* Does this affect the UI?

* Does this affect services?

* Does this affect routes?

* Does this affect data models?

* Does this affect automation?

* Does this touch core logic?

* Does this require new modules?

### **Output Format:**

`Architecture Impact:`  
`- UI: New page, update sidebar`  
`- Backend: Add new service method`  
`- Supabase: No schema change`  
`- Automation: No new flows`  
`- Components: 3 new components`

If ANY architecture conflict occurs → ChatGPT must automatically detect and correct.

---

# **SECTION 6 — STEP 4: SCHEMA IMPACT REVIEW**

Supabase schema changes are HIGH RISK.  
 This step ensures they are controlled.

ChatGPT must determine:

* Do we need a new table?

* Do we need new columns?

* Do we need new RLS?

* Does this break relationships?

* Does this require indexes?

### **If a schema change is required:**

* Supabase AI generates SQL migration

* Supabase AI generates RLS updates

* Assistant checks for naming conventions

* Assistant checks for alignment with Document 14

### **Required Output**

`Schema Impact:`  
`- New table: reports`  
`- Columns: id, user_id, title, created_at`  
`- RLS: user-based read/write`  
`- Indexes: user_id, created_at`

---

# **SECTION 7 — STEP 5: COMPONENT TREE (Feature Only)**

For each new feature, ChatGPT must output:

* All pages

* All parent components

* All child components

* All reusable UI blocks

* Any new layout needs

* Any new state management blocks

### **Format:**

`Component Tree:`  
`- pages/reports/index.jsx`  
`- pages/reports/create.jsx`  
`- components/reports/report-card.jsx`  
`- components/reports/report-form.jsx`  
`- components/reports/report-list.jsx`

This ensures structure stays clean.

---

# **SECTION 8 — STEP 6: FILE MAP (Created \+ Updated Files)**

Before generating code, ChatGPT must list:

### **Files to Create**

`/components/reports/report-card.jsx`  
`/components/reports/report-form.jsx`  
`/pages/reports/index.jsx`  
`/services/report-service.js`

### **Files to Update**

`/app/routes.js`  
`/components/sidebar.jsx`  
`/lib/supabase-client.js`

### **Files to Delete (Only When Approved)**

`(none)`

Nothing is generated until the file map is shown.

---

# **SECTION 9 — STEP 7: GENERATE COMPONENTS (ChatGPT)**

ChatGPT must produce:

* UI components

* Forms

* Pages

* Hooks

* Services

* Utils

Everything must follow:

* naming conventions

* folder structure

* modularity principles

* separation of concerns

* Tailwind best practices

### **Required Output:**

`Files to Create:`  
`- /components/reports/report-card.jsx`  
`- full code...`

`- /pages/reports/index.jsx`  
`- full code...`

---

# **SECTION 10 — STEP 8: CODE INTEGRATION (Codex)**

Codex must:

* create files

* move files

* update imports

* fix broken paths

* update routes

* install dependencies

* apply formatting

* commit updates

### **Codex Output:**

`Actions:`  
`- Created file: report-card.jsx`  
`- Updated file: routes.js`  
`- Installed: @supabase/supabase-js`

`Verification:`  
`- No missing imports`  
`- No naming violations`  
`- Folder structure intact`

---

# **SECTION 11 — STEP 9: BACKEND \+ SERVICES BINDING**

ChatGPT must generate:

* Supabase queries

* CRUD functions

* Services

* Data validation

* Error handling

* Realtime listeners (if needed)

Every service must include:

* create

* update

* delete

* get

* getByUser

* getAll

* error handling

### **Required Output:**

`/services/report-service.js`  
`- createReport()`  
`- getReports()`  
`- getReportById()`  
`- deleteReport()`

All service names must follow naming conventions.

---

# **SECTION 12 — STEP 10: QA, DEBUG, MERGE**

ChatGPT \+ Codex must:

* run consistency checks

* ensure folder structure is clean

* ensure all imports resolve

* ensure naming conventions apply

* run code quality scan

* perform API tests

* ensure RLS protects data

* ensure UI works end to end

### **Required Output:**

`QA Completed:`  
`- All imports resolved ✔`  
`- RLS validated ✔`  
`- No broken components ✔`  
`- All routes working ✔`  
`- All CRUD functions tested ✔`

`Feature Ready to Merge.`

---

# **SECTION 13 — FEATURE COMPLETION CHECKLIST**

A feature is considered DONE only when all of these are complete:

### **✔ Feature Definition**

### **✔ User Flow**

### **✔ Architecture Impact**

### **✔ Schema Impact (if any)**

### **✔ Component Tree**

### **✔ File Map**

### **✔ Component Generation**

### **✔ Service Generation**

### **✔ Codex Integration**

### **✔ Full QA**

### **✔ RLS Validation**

If even one item is missing → **the feature is NOT complete**.

---

# **SECTION 14 — RULES FOR FEATURES TOUCHING MULTIPLE MODULES**

The assistant must:

* update ALL impacted components

* update ALL services consistently

* ensure cross-module alignment

* ensure file placement rules are followed

* update tests (if used)

* update documentation

Cross-module features are HIGH RISK.  
 ChatGPT must follow strict order.

---

# **SECTION 15 — FEATURE NAMING CONVENTIONS**

Every feature must be named like:

`<productName>-feature-<short-description>`

Examples:

* skylink-feature-reports

* skylink-feature-subscriptions

* skylink-feature-teams

* skylink-feature-notifications

This ensures GitHub, Supabase, N8N, and Codex all stay aligned.

---

# **SECTION 16 — AUTOMATION & AGENT BUILDER IMPACT**

If the feature requires:

* emails

* notifications

* background tasks

* agents

* workflows

Then N8N or Agent Builder must be updated after Codex integration.

### **Required Output:**

`Automation Impact:`  
`- Add email on new report creation`  
`- Add workflow in N8N triggered by insert to reports table`

This ensures automation always stays in sync with features.

---

# **SECTION 17 — FALLBACK / RECOVERY RULES**

If:

* architecture breaks

* naming is inconsistent

* services conflict

* schemas drift

* UI becomes messy

* files conflict

* missing imports appear

→ The assistant must STOP and:

1. Identify root cause

2. Create correction plan

3. Fix all impacted files

4. Verify entire system

5. Resume feature protocol

Never “patch” errors.  
 Always fix them at the root.

---

# **SECTION 18 — THE ONE-SENTENCE SUMMARY**

**The Feature Genesis Protocol ensures every new feature is added with complete clarity, consistent structure, perfect naming, accurate schema, integrated logic, and clean AI collaboration — every single time.**

---

# **🧩 DOCUMENT 20 — THE DEBUGGING DOCTRINE**

## ***AI Rules for Diagnosing, Fixing, and Preventing Errors Across Your Entire App Stack***

### ***Stability — Predictability — Zero-Guesswork — Safe Refactoring***

---

# **SECTION 1 — PURPOSE OF THIS DOCTRINE**

This document establishes:

* How ChatGPT \+ Codex must debug errors

* How errors must be classified

* How fixes must be generated

* How root causes must be tracked

* How regressions must be prevented

* How naming and architecture issues must be resolved

* How multi-module errors must be handled

* How to prevent breaking the codebase

This doctrine applies to:

* React \+ Tailwind

* Node/JS services

* Python scripts

* Supabase queries

* RLS policies

* API routes

* N8N workflows

* AI agents

* Lovable deployments

* VS Code Codex actions

This is the unified debugging protocol for all tools.

---

# **SECTION 2 — THE GOLDEN RULE OF DEBUGGING**

**Never fix the symptom first.**  
 **Always identify the root cause.**

Patching symptoms creates instability.  
 AI must find the actual source.

---

# **SECTION 3 — THE 5-LEVEL ERROR SEVERITY SYSTEM**

All errors must be classified before being fixed:

### **Level 1 — Cosmetic / Minor**

* Typo in UI

* Misaligned div

* Non-breaking visual bug

* Logging noise

### **Level 2 — Functional (Low Impact)**

* One component failing

* Non-critical feature broken

* Validation incorrect

### **Level 3 — Functional (High Impact)**

* Core feature broken

* Miswired component tree

* Incorrect service logic

* Broken imports

### **Level 4 — Systemic**

* Broken architecture connection

* Misplaced file in wrong folder

* Naming convention violation

* Circular dependency

### **Level 5 — Critical / Blocking**

* Application fails to build

* Data corruption risk

* RLS exposing data

* Auth failure

* Migration mismatch

* Lost database constraints

**Fix priority: Level 5 → Level 1**

---

# **SECTION 4 — THE DEBUGGING PIPELINE (MANDATORY 8-STEP PROCESS)**

Every debugging session must follow these steps:

---

## **STEP 1 — Error Reproduction**

Assistant must request:

* the full error message

* logs

* screenshot (if UI bug)

* context of what triggered it

* which files were last edited

* what command was run

### **If the error cannot be reproduced → Assistant asks for more info.**

---

## **STEP 2 — Error Classification**

Assistant assigns error severity (Level 1–5).  
 This determines response urgency and scope.

---

## **STEP 3 — Root Cause Hypothesis**

Assistant must produce at least **three hypotheses**:

Example:

`Possible Causes:`  
`1. Missing dependency import`  
`2. Wrong file path`  
`3. Incorrect function signature`

---

## **STEP 4 — Root Cause Verification**

Assistant checks:

* file structure

* imports

* paths

* schema

* services

* component tree

* architectural rules

* naming consistency

Assistant must confirm the **actual cause**, not guess.

---

## **STEP 5 — Repair Plan**

Assistant must produce:

* exact files to fix

* exact lines to modify

* new code snippet

* reason for the change

* dependencies to update

Format:

`Fix Plan:`  
`1. Update services/report-service.js – incorrect function return`  
`2. Update report-card.jsx – missing prop`  
`3. Add missing import in routes.js`

---

## **STEP 6 — Apply Fix (Codex)**

Codex performs:

* edits

* file creation

* file movement

* refactoring

* dependency installation

Codex must **validate** after applying:

* all imports resolve

* all components compile

* folder structure intact

* naming conventions preserved

---

## **STEP 7 — Regression Testing**

Assistant checks:

* Does the fix break anything else?

* Does prop drilling still work?

* Do routes still resolve?

* Are Supabase queries still valid?

* Does RLS still protect?

* Does the UI render without warnings?

If regression occurs → return to Step 1\.

---

## **STEP 8 — Document the Fix**

Assistant creates a **fix summary**:

`Error Summary:`  
`- Issue: report-card.jsx crashed due to missing "report" prop`  
`- Root Cause: Incorrect export name in report-service.js`  
`- Severity: Level 3 (High Impact)`  
`- Fix Applied: Updated function return + UI props`  
`- Preventive Rule: Always align service returns with UI prop structure`

This is stored in project logs (internal).

---

# **SECTION 5 — DEBUGGING RULES FOR SPECIFIC SYSTEM AREAS**

---

# **UI / React / Tailwind Errors (Frontend)**

AI must check:

* props

* imports

* parent/child connections

* hooks

* state

* conditional rendering

* missing keys

* invalid Tailwind classes

Common root causes:

* component in wrong folder

* missing export

* mismatched props

* wrong filename capitalisation

* stale code from previous iteration

AI must fix root causes, not UI patches only.

---

# **Service Layer Errors (Backend Logic)**

Check:

* function signatures

* missing awaits

* incorrect returns

* incorrect destructuring

* Promise vs value mismatch

* missing error handling

Services must always:

* be pure

* not mutate external state

* validate inputs

* catch Supabase errors

---

# **Supabase Errors**

AI must check:

* incorrect columns

* mismatched schema

* missing RLS

* misnamed tables

* wrong policies

* incorrect relational joins

AI must use Document 14 (Schema Governance) to repair.

---

# **RLS Errors**

High risk.  
 AI must:

* confirm policies

* check auth methods

* check row-level filters

* confirm session.user data

* ensure no data leaks

* ensure no lockouts

---

# **Routing Errors**

Check:

* file paths

* dynamic params

* component names

* import root paths

* folder casing

---

# **N8N / Agent Builder Errors**

Check:

* input/output mismatches

* missing secrets

* wrong triggers

* unreachable endpoints

---

# **Documented AI Tools Must Follow the Debugging Doctrine**

This applies to:

* ChatGPT

* Codex

* Supabase AI

* Lovable

* UX Pilot

* N8N

* Agent Builder

If a tool is debugging → it must follow this exact doctrine.

---

# **SECTION 6 — PREVENTION RULES (TO STOP FUTURE BUGS)**

### **Mandatory AI prevention rules:**

1. **Always validate imports before generating code**

2. **Never write duplicate components**

3. **Always check if a file already exists before creating**

4. **Always check parent-child component integrity**

5. **Always ensure service function return shapes match UI use**

6. **Always validate schema before writing SQL**

7. **Always check RLS implications**

8. **Always check folder naming conventions**

9. **Never hard-code environment variables**

10. **Always modularize logic (never put logic in UI)**

If prevention rules are violated → AI must correct automatically.

---

# **SECTION 7 — THE ONE COMMAND DEBUGGER MODE**

When Juan types:

`debug mode on`

AI enters strict debugging mode:

* No assumptions

* No code generation until cause identified

* No refactoring unless required

* Root cause inspection before solution

* Structured reports required

* Only minimal necessary changes

Debug mode stays on until Juan types:

`debug mode off`

---

# **SECTION 8 — THE DEBUGGING DOCTRINE SUMMARY**

**Errors must be:**  
 **Reproduced → Classified → Diagnosed → Verified → Planned → Fixed → Tested → Logged.**  
 **Not guessed.**  
 **Not patched.**  
 **Never rushed.**

This is the **Deployment Doctrine** — the law that governs how shipping works.