# **🧩 DOCUMENT 26 — THE VIBE TESTING DOCTRINE**

## ***AI Rules for Unit Tests, Integration Tests & Automated QA***

### ***A complete testing governance model for AI-built systems***

---

# **SECTION 1 — PURPOSE OF THIS DOCUMENT**

This doctrine ensures:

* Every feature is testable

* Every AI produces test-ready code

* All tests follow identical patterns

* Test failures become easy to diagnose

* Errors are caught early

* Refactors never break production

* Deployments become safe and predictable

This is NOT optional.

---

# **SECTION 2 — THE 4 MANDATORY TEST TYPES**

Your system recognizes **exactly four** categories of tests.

Every AI must classify tests into one of these:

---

## **1\. Unit Tests**

Smallest possible test of a function/component.

Examples:

* format-date()

* calculateInvoiceTotal()

* supabase-client helpers

* pure UI component logic

**Purpose:** Guarantee correctness of atomic units.

**Location:**  
 `/tests/unit/<module>/<filename>.test.js`

---

## **2\. Integration Tests**

Tests how modules interact.

Examples:

* auth-service \+ supabase

* billing page \+ invoice service

* dashboard metrics combining DB \+ UI

**Purpose:** Validate pipelines between modules.

**Location:**  
 `/tests/integration/<flow>/…`

---

## **3\. End-to-End (E2E) Tests**

Simulate user interactions.

Examples:

* login → dashboard

* upgrade plan → checkout → confirmation page

* create project → view results

**Purpose:** Confirm entire system behavior.

**Location:**  
 `/tests/e2e/…`

Tooling: Playwright or Cypress (AI chooses based on project stack)

---

## **4\. Regression Tests**

Mandatory whenever a bug is fixed.

Rule:

“Every bug fixed MUST include a regression test, written immediately after the fix.”

Ensures the bug can never return.

**Location:**  
 `/tests/regression/…`

---

# **SECTION 3 — THE AI TEST CREATION RULES**

Every AI must:

### **Rule 1 — Write tests for every new module**

Whenever a file is created inside:

* services

* utils

* lib

* hooks

* components (non-UI logic)

A unit test is mandatory.

---

### **Rule 2 — Write tests for every critical feature**

Critical features include:

* Auth

* Billing

* Dashboard metrics

* User data flows

* Project creation

* Supabase operations

These require integration tests.

---

### **Rule 3 — Create E2E tests for all primary user journeys**

Primary flows:

* Sign up

* Login / logout

* Reset password

* Dashboard navigation

* Creating records

* Editing records

* Viewing reports

* Billing upgrade

Each MUST have E2E coverage.

---

### **Rule 4 — Whenever a bug is fixed → write a regression test**

No exceptions.

---

### **Rule 5 — Test files must follow strict naming conventions**

Format:

`<file>.test.js`

Example:

* auth-service.test.js

* user-profile.test.js

* report-generator.test.js

Never:

* TestAuthService.js

* authServiceTest.js

---

# **SECTION 4 — THE VIBE TEST STRUCTURE STANDARD**

All tests must follow the 3-part format:

### **✔ Arrange — set up data/environment**

### **✔ Act — run the function or flow**

### **✔ Assert — validate expected behavior**

Example:

`describe("auth-service", () => {`  
  `it("returns user session when logged in", async () => {`  
    `// Arrange`  
    `mockSupabaseSession();`

    `// Act`  
    `const session = await authService.getSession();`

    `// Assert`  
    `expect(session.user.email).toBe("test@example.com");`  
  `});`  
`});`

Clean, simple, predictable.

---

# **SECTION 5 — TESTING COVERAGE REQUIREMENTS**

Your AI system must ensure:

* **80% minimum coverage** for all services

* **60% minimum coverage** for components

* **100% regression test coverage** for all historical bugs

* **Auth & Billing \= 100% coverage mandatory**

This forces production reliability.

---

# **SECTION 6 — SUPABASE TESTING DOCTRINE**

### **1\. All Supabase queries must be tested**

* Successful cases

* Failure cases

* Edge cases

* Unauthorized (RLS) cases

### **2\. RLS rules must have corresponding tests**

AIs must validate:

* authenticated access

* anonymous block

* role-based access

* row-level restrictions

### **3\. Migration Tests**

Every migration MUST have:

* “before” state test

* “after” state test

* rollback verification

---

# **SECTION 7 — UI/COMPONENT TESTING DOCTRINE**

React components must be tested for:

* render success

* props validation

* interactive behavior

* conditional rendering

* error states

Important:

**UI styling tests are optional — only logic is mandatory.**

---

# **SECTION 8 — TEST FAILURE CLASSIFICATION**

When a test fails, AIs MUST classify it using the Error Lexicon (Doc 24):

* syntax-error

* runtime-error

* data-error

* api-error

* ui-error

* infra-error

Example output:

`Test Failure Classification:`  
`Category: data-error`  
`Subtype: invalid-query`  
`Severity: 3`  
`Root Domain: database`  
`Cause: wrong column name in supabase query`

Predictability is everything.

---

# **SECTION 9 — AUTOMATED QA PIPELINE STANDARDS**

Every AI must ensure:

### **1\. Tests run on every commit**

Mandatory via:

* Lovable CI

* GitHub Actions

* Vercel (optional)

### **2\. Tests run before deployment**

Deployments MUST be blocked if:

* any test fails

* coverage requirement not met

* regression test missing

### **3\. Nightly test automation**

Automated system MUST run:

* all unit tests

* all integration tests

* weekly full E2E suite

---

# **SECTION 10 — HOW AIs RESPOND TO TEST FAILURES**

When a test fails, AIs MUST respond in this structure:

`Test Status: FAILED`

`Error Classification:`  
`Category:`  
`Subtype:`  
`Severity:`  
`Root Domain:`

`Summary:`  
`- What failed`  
`- Why it failed`  
`- Where it failed`  
`- Suspected root cause`

`Required Fix:`  
`- Exact action to resolve`

No vague explanations allowed.

---

# **SECTION 11 — AI SELF-CHECK BEFORE WRITING TESTS**

Before generating tests, the AI must answer YES to:

* ✔ Does this module contain logic?

* ✔ Does this feature affect data?

* ✔ Does this function have edge cases?

* ✔ Could a user break this flow?

* ✔ Could this fail in production?

If any answer is “YES,” tests must be written.

---

# **SECTION 12 — ONE-SENTENCE SUMMARY**

**The Vibe Testing Doctrine ensures every AI builds, tests, validates, and protects your system through unified test standards that guarantee stability, reliability, and production readiness.**

---

# **🧩 DOCUMENT 27 — THE DATABASE MIGRATION DOCTRINE**

## ***AI Rules for Safe, Reversible, Forward-Compatible Supabase Migrations***

### ***The Official Governance Standard for Schema Evolution, Data Safety & Zero-Downtime Changes***

---

# **SECTION 1 — PURPOSE OF THIS DOCUMENT**

This doctrine ensures that:

* Migrations NEVER break production

* Migrations are ALWAYS reversible

* AIs follow strict safety rules

* Data integrity is guaranteed

* Schema evolution is predictable

* All changes are logged and auditable

* Indexing is done intentionally

* RLS remains valid after every revision

This protects your entire system from data disasters.

---

# **SECTION 2 — MIGRATION SAFETY PRINCIPLES**

Your AI must follow all 7 principles:

### **1\. Every migration MUST be reversible**

If it cannot be reversed, it cannot be deployed.

### **2\. No destructive change without a backup**

Tables, columns, or data must never be dropped blindly.

### **3\. Schema evolution must be forward-compatible**

New versions must run side-by-side with old ones temporarily.

### **4\. All migrations must include a “pre-check”**

AIs must verify the migration will not break existing data.

### **5\. Migrations must run in stages**

Never deploy multiple destructive steps in a single migration.

### **6\. RLS and permissions must be part of the migration review**

RLS errors can destroy an entire system.

### **7\. Migrations must be documented**

Every migration must have:

* Summary

* Ups (forward changes)

* Downs (rollback path)

* Risk level

* Test cases

---

# **SECTION 3 — REQUIRED MIGRATION STRUCTURE**

Every migration MUST follow this format:

`-- 1. Summary`  
`-- 2. Preconditions`  
`-- 3. Up Migration (Forward Changes)`  
`-- 4. Down Migration (Rollback)`  
`-- 5. Risk Analysis`  
`-- 6. Test Cases (SQL + automated)`  
`-- 7. RLS Impact Review`

No migration without this.

---

# **SECTION 4 — ALLOWED & FORBIDDEN MIGRATION TYPES**

### **✔ ALLOWED**

* Adding columns

* Adding tables

* Adding indexes

* Adding foreign keys

* Adding enums

* Adding constraints

* Altering nullability (with staged rollout)

* Renaming columns

* Creating views

* Adding RLS

### **❌ FORBIDDEN (unless staged with rollback)**

* Dropping tables

* Dropping columns

* Dropping constraints

* Overwriting large data

* Replacing entire schemas

* Changing column types WITHOUT staging

Destructive changes must ALWAYS be staged.

---

# **SECTION 5 — THE 3-STAGE MIGRATION MODEL**

All AIs must use the **safe evolution pattern**:

---

## **Stage 1 — Add New Structure**

Example:

* Add column `full_name_new`

* Add index on new column

* Add minimal RLS for new column

NO removal of old columns yet.

---

## **Stage 2 — Backfill Data**

Example:

`UPDATE users SET full_name_new = full_name;`

Check:

* count matches

* no NULLs

* no data mismatches

---

## **Stage 3 — Swap Code → Then Remove Legacy Structure**

Only after UI \+ API use the new column.

Then:

* drop old column

* update RLS

* update indexes

* add final constraints

This is the ONLY safe method.

---

# **SECTION 6 — RLS MIGRATION RULES**

RLS must NEVER be altered without strict review.

Required rules:

### **✔ RLS must be duplicated to new tables/columns BEFORE code uses them**

### **✔ New columns must be added to SELECT/INSERT/UPDATE policies**

### **✔ RLS changes must have regression tests**

### **✔ Breaking RLS changes must be migrated in two passes**

### **✔ RLS changes are always Level 5 Critical**

You already know:  
 **RLS breaks \= production outage.**

---

# **SECTION 7 — AI CHECKLIST BEFORE GENERATING MIGRATIONS**

Every AI must ensure:

### **✔ Does the change break existing queries?**

### **✔ Does the change break existing types?**

### **✔ Does the change break indexes?**

### **✔ Does the change break foreign keys?**

### **✔ Are there dependent views or functions?**

### **✔ Will Supabase API types regenerate?**

### **✔ Do RLS policies need updating?**

### **✔ Can the change be reversed safely?**

If ANY answer is uncertain → migration blocked.

---

# **SECTION 8 — NAMING CONVENTION FOR MIGRATIONS**

All migrations must follow:

`YYYYMMDDHHMM_<action>_<table>_<description>`

Examples:

* `202502141230_add_column_users_full_name_new`

* `202502141245_backfill_users_full_name_new`

* `202502141300_drop_column_users_full_name`

This ensures perfect chronological order.

---

# **SECTION 9 — MIGRATION RISK CLASSIFICATION**

Borrowing the Error Lexicon severity system:

### **Level 1 — Cosmetic**

Comments, formatting.

### **Level 2 — Non-impactful**

Indexes, constraints with defaults.

### **Level 3 — Structural (Safe)**

Non-destructive table/column additions.

### **Level 4 — Structural (Risky)**

Changes touching FK, unique constraints, renames.

### **Level 5 — Critical**

Anything touching:

* RLS

* primary keys

* auth tables

* removing columns

* changing types

* large data operations

High-level AIs must warn:  
 “Migration Level 5 — human review recommended.”

---

# **SECTION 10 — MIGRATION REVIEW TEMPLATE**

Every migration must include:

`Migration Review Summary:`  
`- Purpose:`  
`- Type:`  
`- Risk Level:`  
`- RLS Impact:`  
`- Affected Tables:`  
`- Breaking Change? (yes/no)`

`Verification Checklist:`  
`- Data backed up`  
`- New columns include default/null strategy`  
`- RLS updated`  
`- Views updated`  
`- Functions updated`  
`- Client code updated`  
`- Types regenerated`

`Approval:`  
`- AI review passed`  
`- Human oversight required for L5 changes`

---

# **SECTION 11 — ZERO-DOWNTIME MIGRATION RULES**

Mandatory rules:

### **✔ Never drop columns in the same migration where new ones are added**

### **✔ Never rename columns directly (use shadow columns)**

### **✔ Never change types directly (create new typed column)**

### **✔ Never rewrite large tables in a single command**

### **✔ Always index large foreign keys before use**

These rules prevent outages.

---

# **SECTION 12 — SUPABASE TYPE-REGENERATION RULES**

After migrations complete:

### **✔ regenerate types:**

`supabase gen types typescript --project-id <id>`

### **✔ update client**

`supabase-client.ts` must be updated

### **✔ verify code compiles after regeneration**

This ensures type safety across the entire stack.

---

# **SECTION 13 — ONE-SENTENCE SUMMARY**

**This doctrine ensures your database evolves safely, reversibly, predictably, and without downtime — establishing the official rules every AI must obey to prevent schema corruption or production disaster.**

---

# **🧩 DOCUMENT 28 — THE UX CONSISTENCY DOCTRINE**

## ***Rules for UI Components, Design Tokens & Interaction Patterns Across All Apps***

### ***Your official system for predictable, clean, and consistent user experience***

---

# **SECTION 1 — PURPOSE OF THIS DOCUMENT**

This doctrine ensures that:

* All AIs produce identical UI patterns

* All components feel like they belong to the same brand

* Every app uses the same spacing, colors, typography, and interaction logic

* UX flows remain predictable

* Component naming stays aligned

* Figma ↔ Canvas ↔ Codex ↔ Lovable all match

* Users get a seamless experience across all your products

This is the **UX constitution** of your ecosystem.

---

# **SECTION 2 — THE 5 UX PRINCIPLES (MANDATORY)**

Every AI must follow these principles:

### **1\. Consistency \> Creativity**

Consistency is king — every screen follows the same patterns.

### **2\. Predictable Interactions**

Buttons act the same everywhere; inputs behave identically; error states match.

### **3\. Minimal Cognitive Load**

Keep screens clean, simple, and with clear hierarchy.

### **4\. Modular UI Components**

Always reuse, never rewrite.

### **5\. Mobile-first Responsiveness**

All components must scale smoothly from mobile → desktop.

If an AI tries to break these, another AI must correct it.

---

# **SECTION 3 — DESIGN TOKEN GOVERNANCE**

All styling must be derived from reusable **design tokens**.

Mandatory token sets:

---

## **1\. Color Tokens**

`--color-primary`  
`--color-primary-muted`  
`--color-secondary`  
`--color-accent`  
`--color-bg`  
`--color-surface`  
`--color-border`  
`--color-success`  
`--color-warning`  
`--color-error`  
`--color-text`  
`--color-text-muted`

Every color used must come from this set.  
 Never hardcode hex values unless adding new tokens.

---

## **2\. Spacing Tokens**

`--space-xxs (2px)`  
`--space-xs  (4px)`  
`--space-sm  (8px)`  
`--space-md  (16px)`  
`--space-lg  (24px)`  
`--space-xl  (32px)`  
`--space-xxl (48px)`

No custom margins/padding except via tokens.

---

## **3\. Radius Tokens**

`--radius-sm`  
`--radius-md`  
`--radius-lg`  
`--radius-full`

Buttons, cards, inputs, and modals use the same radii.

---

## **4\. Typography Tokens**

`--font-family`  
`--font-size-xs`  
`--font-size-sm`  
`--font-size-base`  
`--font-size-lg`  
`--font-size-xl`  
`--font-weight-normal`  
`--font-weight-medium`  
`--font-weight-semibold`  
`--font-weight-bold`

No one-off font sizes.  
 Every AI must use these tokens.

---

## **5\. Shadow Tokens**

`--shadow-sm`  
`--shadow-md`  
`--shadow-lg`  
`--shadow-xl`

Shadows must match across all components.

---

# **SECTION 4 — APPROVED UI COMPONENT SET**

Every AI must use the official **approved component list**.

### **Base Components**

* Button

* Input

* Select

* Textarea

* Checkbox

* Toggle

* Badge

* Avatar

* Card

* Modal

* Tooltip

* Spinner

* Alert

### **Layout Components**

* PageHeader

* Sidebar

* Topbar

* Container

* Section

* Grid

### **Data Components**

* Table

* DataCard

* MetricCard

* ChartContainer

* SearchInput

* FilterBar

### **Form Components**

* FormRow

* FormSection

* FormCard

* SubmitButton

* ErrorMessage

### **Navigation Components**

* NavItem

* NavGroup

* Breadcrumbs

* Tabs

### **Dialog Components**

* ConfirmDialog

* FormDialog

* InfoDialog

Every component must follow naming rules from your other documents.

---

# **SECTION 5 — TYPE SYSTEM FOR COMPONENT NAMES**

Component names must follow:

### **Pattern 1: React Components**

`PascalCase`

Example:

* DashboardCard

* AuthLoginForm

* MetricWidget

### **Pattern 2: Component Files**

`lowercase-kebab-case.js`

Example:

* dashboard-card.jsx

* auth-login-form.jsx

### **Pattern 3: Component Folders**

`lowercase-kebab-case`

Example:

* /components/dashboard

* /components/forms

This alignment ensures Codex always finds components correctly.

---

# **SECTION 6 — INTERACTION PATTERN STANDARDS**

This is where UX consistency becomes critical.

### **1\. Buttons**

* Primary \= solid

* Secondary \= outline

* Tertiary \= text-only

* Destructive actions \= red

* Loading states must use spinner inside button

---

### **2\. Form Validation**

* Inline error under field

* Error icon only on severe cases

* Submit button disabled during loading

* Required fields ALWAYS marked

---

### **3\. Modal Behavior**

* Close on X

* Close on outside click

* ESC closes

* Destructive actions require confirmation modal

---

### **4\. Navigation**

* Sidebar scrollable

* Active item highlighted

* Breadcrumbs on all multi-step workflows

* Header includes primary action on right side

---

### **5\. Empty States**

All empty states must include:

* Title

* Description

* Icon/illustration

* Primary action

Example:  
 “ No projects yet ”  
 “Create your first project to get started.”  
 \[Create Project\]

---

### **6\. Loading States**

Components must never flash blank.

Use:

* skeleton loaders

* shimmer effects

* spinners only for isolated actions

---

### **7\. Error Handling**

Use consistent error UI:

* red alert bar

* error description

* optional retry button

No random error UIs.

---

# **SECTION 7 — PAGE LAYOUT FRAMEWORK**

All apps must follow the same structure:

`<Page>`  
  `<PageHeader />`  
  `<Container>`  
    `<Grid or Sections>`  
      `<Components>`  
  `</Container>`  
`</Page>`

This ensures consistent layouts across all modules.

---

# **SECTION 8 — FIGMA ↔ CODEX ↔ CANVAS ALIGNMENT RULES**

### **RULES FOR FIGMA**

* Use auto-layout everywhere

* Apply spacing tokens only

* Use component variants

* Document all states

### **RULES FOR CANVAS (ChatGPT UI)**

* Generate only tokens

* Use pre-approved components

* No custom spacing beyond tokens

### **RULES FOR CODEX**

* Must match Figma exactly

* Must use official components

* Must match design tokens

* Must autogenerate missing components if needed

---

# **SECTION 9 — RESPONSIVENESS DOCTRINE**

Every component MUST include:

* mobile layout

* tablet layout

* desktop layout

Rules:

* Sidebar collapses on mobile

* Metrics become 1-col

* Forms use stacked layout

* Buttons become full-width on mobile

---

# **SECTION 10 — ACCESSIBILITY REQUIREMENTS**

AIs must enforce:

* aria-labels

* semantic HTML

* focus states for all interactive elements

* keyboard navigation

* color contrast AA

Accessibility is non-optional.

---

# **SECTION 11 — UI VERSIONING SYSTEM**

Every UI component must have:

* Component version (v1, v2, v3)

* Change log

* Deprecation policy

* Migration instructions

Codex must never update UI components without version bump.

---

# **SECTION 12 — ONE-SENTENCE SUMMARY**

**This doctrine forces every AI in your system to build perfectly consistent, predictable, brand-aligned user experiences using unified tokens, components, layouts, and interaction standards across all your apps.**

---

# **🧩 DOCUMENT 29 — THE WORKFLOW MAPPING DOCTRINE**

## ***Standardized Flowcharts & Logic Maps for Every Feature & Automation***

### ***Unified Modeling Rules for All AI Systems in Juan’s Ecosystem***

---

# **SECTION 1 — PURPOSE OF THIS DOCUMENT**

This doctrine ensures that:

* Every AI describes workflows the same way

* Every automation follows predictable logic

* Every feature request becomes a clear diagram

* There is no ambiguity in how a system operates

* Workflows always use the same symbols, naming, and structure

* AIs can modify, extend, or optimize workflows without confusion

* You get clean, readable system maps for every feature and automation

This eliminates chaos and makes your whole system **architecturally intelligent**.

---

# **SECTION 2 — THE 4 TYPES OF WORKFLOW MAPS**

All workflows must fall into one of these categories:

### **1\. User Flow Maps**

How users move through the UI or app.

Examples:

* Signup → Confirmation → Dashboard

* Create project → Save → View results

---

### **2\. System Logic Maps**

How backend logic or services operate.

Examples:

* Auth state logic

* Report generation flow

* Billing charge cycle

---

### **3\. Automation Flow Maps**

For tools like N8N, Zapier, or your agent workflows.

Examples:

* Webhook → Process → Update Supabase

* Event listener → Decision → Email user

---

### **4\. Data Flow Maps**

How data moves across the system.

Examples:

* Frontend → Supabase → Processing → Storage

* AI agent → API → Database → Client

---

# **SECTION 3 — STANDARDIZED WORKFLOW SYMBOL SET (MANDATORY)**

Your entire AI system must use the same symbols for every flow.

---

## **1\. Start / End**

🟢 **Start**  
 🔴 **End**

---

## **2\. Actions**

🟦 **Action Block**  
 Represents steps like:

* “Create record”

* “Validate input”

* “Render page”

* “Call Supabase”

---

## **3\. Decisions**

⬜ **Decision Diamond**  
 Used for yes/no or branching logic.

Examples:

* “Is user authenticated?”

* “Is subscription active?”

---

## **4\. Data / API operations**

🟨 **Database/API Block**

Examples:

* “Fetch user session”

* “Insert project row”

* “Query invoices”

---

## **5\. UI Interaction**

🟪 **UI Step Block**

Examples:

* “User clicks button”

* “User enters input”

---

## **6\. Automations / Agents**

🟧 **Automation Block**

Examples:

* N8N workflow

* Agent Builder task

---

## **7\. Parallel Processes**

⧉ **Parallel Block**

Used for concurrent operations.

Examples:

* “Load user \+ load notifications”

* “Render layout \+ render data”

---

# **SECTION 4 — WORKFLOW NAMING CONVENTIONS**

All workflows MUST be named using this pattern:

`product-purpose-flow`

Examples:

* skylink-auth-login-flow

* skylink-dashboard-load-flow

* skylink-billing-upgrade-flow

* skylink-automation-new-user-onboarding

Every diagram name MUST follow this.

---

# **SECTION 5 — WORKFLOW LAYOUT RULES**

All AIs must follow this structure:

---

## **Top Section: Metadata**

Every workflow must start with:

`Flow Name:`  
`Flow Type:`  
`Actor(s):`  
`Description:`  
`Trigger:`  
`Success Outcome:`  
`Failure Outcome:`

No exceptions.

---

## **Left-to-right Direction**

All workflows must:

* Start on the left

* End on the right

* Follow a linear reading direction

Vertical stacking is allowed only for branches.

---

## **Numbered Paths**

Branches MUST be numbered:

`Branch 1 — Success`  
`Branch 2 — Failure`  
`Branch 3 — Alternate Path`

---

# **SECTION 6 — USER FLOW RULES**

User flows must ALWAYS include:

### **✔ UI screen**

### **✔ User action**

### **✔ System reaction**

### **✔ Next UI state**

Example snippet:

`1. User clicks "Create Project"`  
`2. Show modal`  
`3. User enters details`  
`4. Validate data`  
`5. Create record`  
`6. Redirect to project page`

Predictable. Structured. Clean.

---

# **SECTION 7 — SYSTEM LOGIC FLOW RULES**

System logic maps must include:

* data validation

* condition checks

* API calls

* database writes

* branching

* error handling

Every step must include **data inputs → outputs**.

Example format:

`Action: Calculate invoice total`  
`Inputs: line_items[]`  
`Outputs: invoice_total`

---

# **SECTION 8 — AUTOMATION FLOW RULES (N8N & AGENTS)**

Rules:

### **✔ All triggers must be labeled**

Example: “Supabase webhook: new project created”

### **✔ All branches must be explicit**

No hidden logic.

### **✔ All automations must include fallback paths**

### **✔ All error states must map to Notifications → Logging**

### **✔ All agents must include retry logic**

Default \= 3 retries.

---

# **SECTION 9 — DATA FLOW RULES**

Every data flow diagram MUST include:

### **✔ Source**

### **✔ Data transformation**

### **✔ Destination**

### **✔ Data shape before & after**

### **✔ Authentication context**

### **✔ RLS implications**

Example:

`Frontend → Supabase (insert)`  
`Payload:`  
`{`  
  `user_id,`  
  `project_name,`  
  `created_at`  
`}`

`RLS:`  
`user_id = auth.uid()`

Clean. Precise. Auditable.

---

# **SECTION 10 — WORKFLOW VALIDATION CHECKLIST (AI MUST SELF-CHECK)**

Before generating a workflow, every AI must ask:

* ✔ Does this include all required blocks?

* ✔ Is the flow readable left-to-right?

* ✔ Are all decisions explicit?

* ✔ Are all data operations labeled?

* ✔ Are branching paths numbered?

* ✔ Is the naming convention correct?

* ✔ Is the failure path documented?

* ✔ Does it follow the symbol set?

If any answer is “no,” the workflow must be regenerated.

---

# **SECTION 11 — WORKFLOW EXAMPLE (FULL FORMAT)**

`Flow Name: skylink-auth-login-flow`  
`Flow Type: User Flow`  
`Actors: User, Supabase`  
`Trigger: User submits login form`  
`Success Outcome: User is redirected to dashboard`  
`Failure Outcome: Error shown in form`

`START`  
`↓`  
`🟪 UI Step: User enters email/password`  
`↓`  
`🟦 Action: Validate form data`  
`↓`  
`⬜ Decision: Is validation successful?`  
  `- Yes → Continue`  
  `- No → Show validation error (END)`  
`↓`  
`🟨 Data/API: Supabase auth.signInWithPassword()`  
`↓`  
`⬜ Decision: Does Supabase return session?`  
  `- Yes → Continue`  
  `- No → Show "Invalid credentials" (END)`  
`↓`  
`🟦 Action: Store session in client`  
`↓`  
`🟪 UI Step: Redirect to dashboard`  
`↓`  
`END`

This is the standard for ALL workflows.

---

# **SECTION 12 — AI INTEROPERABILITY RULES**

These rules ensure all your tools understand each other.

### **ChatGPT Canvas must:**

Generate visual workflow diagrams.

### **Codex must:**

Implement workflows into real code.

### **Eraser.ai must:**

Render flowcharts using the symbol set.

### **UX Pilot AI must:**

Map workflows to user experiences.

### **N8N must:**

Take automation workflows and execute them.

### **Agent Builder must:**

Follow system logic flows exactly.

Every AI must speak the same workflow language.

---

# **SECTION 13 — ONE-SENTENCE SUMMARY**

**This doctrine ensures every AI in your ecosystem creates perfect, standardized, predictable workflows and logic maps, making your entire system transparent, scalable, and future-proof.**

---

# **🧩 DOCUMENT 30 — THE AI COLLABORATION PROTOCOL**

## ***How Multiple AIs Work Together, Negotiate Tasks & Avoid Overlaps***

### ***Unified Rules for Coordination, Ownership & Execution Across Your AI Workforce***

---

# **SECTION 1 — PURPOSE OF THIS DOCUMENT**

This document defines:

* How each AI agent communicates

* How they hand off tasks

* How they escalate errors

* Who owns WHAT and WHEN

* How they avoid duplication or conflict

* How they operate like a well-run engineering team

* How you stay in control as the director

It establishes a **collaboration constitution** for ChatGPT, Codex, Supabase AI, Lovable, N8N, Agent Builder, UX Pilot AI, and any future tools.

This prevents chaos and ensures your system operates with military precision.

---

# **SECTION 2 — CORE PRINCIPLES OF MULTI-AI COLLABORATION**

All AIs must follow these principles:

### **1\. Clear Ownership**

Only ONE AI owns a task at any time.

### **2\. Explicit Handoffs**

Every handoff must include:

* task summary

* required inputs

* expected output

* success criteria

* file paths (if code-related)

### **3\. No Silent Assumptions**

If context is missing, the AI must ask.

### **4\. No Unauthorized Actions**

No AI may modify files, schemas, or workflows outside its domain.

### **5\. Default to Safety**

If unsure → STOP and request clarification.

### **6\. Predictable Behavior**

Every AI must be consistent in how it:

* receives tasks

* executes tasks

* reports results

* asks questions

---

# **SECTION 3 — AI ROLES (Clear Responsibility Zones)**

This table defines **exact ownership** so AIs do not overlap.

| AI | Domain | What It Does | What It Never Does |
| ----- | ----- | ----- | ----- |
| **ChatGPT (Canvas / General)** | UX, mockups, UI layouts, ideas | Generate components, write instructions | Modify repo files |
| **Codex** | Real code manipulation | Create/edit files, run commands, refactor, test | Create UI mockups |
| **Lovable** | Frontend scaffolding, deployment | Build production-ready apps from repo | Write backend logic |
| **Supabase AI** | DB & auth & RLS | Define schema, migrations, policies | Edit React code |
| **N8N** | Automations | Build backend workflows, pipelines, integrations | Change app UI |
| **Agent Builder** | Microservices & agent logic | Task automation, monitoring, decision flows | Modify database schema |
| **UX Pilot AI** | User flow & UX optimization | Flow analysis, improvement recommendations | Execute backend automation |

These roles MUST be respected at all times.

---

# **SECTION 4 — THE COLLABORATION LIFECYCLE (MANDATORY)**

Every multi-AI task follows the same 6 stages:

---

## **1\. Initiation**

You give a command or an idea.

The AI receiving the command must:

* classify the task

* determine if it owns the task

* accept or redirect

---

## **2\. Domain Claiming**

The correct AI claims ownership, saying:

`I am claiming this task because it falls within my domain of {X}.`

If it does NOT belong to them, they say:

`This is not my domain. Redirecting to {Correct_AI}.`

---

## **3\. Requirement Clarification**

Before work begins, the AI must:

* restate the goal

* list assumptions

* list missing info

* request needed details

If clarity is insufficient → STOP.

---

## **4\. Execution**

The AI performs ONLY its part of the job.

For example:

* ChatGPT → UI mockup

* Codex → integrates mockup into repo

* Supabase AI → builds schema

* N8N → builds automation

* UX Pilot AI → reviews quality

Each AI operates inside its “fenced domain.”

---

## **5\. Verification**

Every AI must self-check:

* Are file paths correct?

* Are naming conventions respected?

* Does the work match the request?

* Are there breaking changes?

If errors are detected → FIX before handoff.

---

## **6\. Handoff**

When done, the AI must deliver:

`Task Completed:`  
`- Summary of what was done`  
`- Files touched`  
`- Resulting outputs`  
`- Dependencies created`  
`- Next step recommended`

And then wait for the next instruction.

---

# **SECTION 5 — NEGOTIATION RULES (When Tasks Overlap)**

If a task touches multiple domains (example: “Add login page with Supabase auth”), AIs must negotiate based on the following hierarchy.

---

## **Ownership Hierarchy**

When overlap occurs:

### **1\. Codex owns all code changes**

Regardless of who designed it.

### **2\. Supabase AI owns all database logic**

Regardless of who requested it.

### **3\. ChatGPT owns UI/UX**

Codex only implements what ChatGPT designed.

### **4\. Lovable owns deployment**

Codex only prepares code.

### **5\. N8N owns backend automation**

Supabase AI owns the data → N8N owns the workflow.

### **6\. Agent Builder owns agent logic**

N8N triggers → Agent Builder executes → Supabase stores.

### **7\. UX Pilot AI always has advisory power**

Not execution power.

---

AI MUST defer to the AI directly above it in the hierarchy when unsure.

---

# **SECTION 6 — COMMUNICATION PROTOCOL BETWEEN AIs**

AIs must ALWAYS structure communication like this:

---

## **A. Task Transfer Statement**

`Transferring task to {AI_Name}`  
`Reason: {Domain Ownership Explanation}`  
`Required Output: {Describe Output}`  
`Deadline: Immediate`

---

## **B. Packet of Context**

Every transfer MUST include:

* exact user request

* file paths

* relevant code blocks

* naming conventions to follow

* data shapes

* assumptions

* constraints

* known bugs or risks

Missing any of these \= invalid handoff.

---

## **C. Confirmation Response**

Receiving AI must respond with:

`Confirmed. I understand the task:`  
`- Inputs:`  
`- Outputs:`  
`- Scope:`  
`- Risks:`  
`- Dependencies:`  
`Execution starting now.`

---

## **D. Completion Report**

When done:

`Task Completed:`  
`- Summary:`  
`- Files Modified:`  
`- Failures or Risks:`  
`- Suggested Next Steps:`  
`Awaiting further instruction.`

---

# **SECTION 7 — ERROR ESCALATION RULES**

When something goes wrong, AIs must use the following escalation ladder:

### **Level 1 — Self-correct**

Try to fix it automatically.

### **Level 2 — Ask the peer AI**

Example: Codex asks Supabase AI about schema issues.

### **Level 3 — Ask Juan for direction**

If the issue depends on product intent.

### **Level 4 — Stop execution**

If further action may damage the system.

---

# **SECTION 8 — CONFLICT PREVENTION RULES**

No AI may:

* modify code it did not create

* rename files without approval

* update schema without Supabase AI’s involvement

* edit workflows without N8N or Agent Builder’s involvement

* override UI components without ChatGPT Canvas involvement

* touch authentication logic without Supabase AI approval

These areas are **protected zones**.

---

# **SECTION 9 — COLLABORATION EXAMPLE (END-TO-END)**

User says:

“Add Google OAuth login to my app.”

### **ChatGPT Canvas**

Designs UI → login page \+ button.

### **Codex**

Implements UI in repo \+ wiring.

### **Supabase AI**

Configures Google provider \+ RLS \+ tables.

### **Codex**

Integrates Supabase auth into the app.

### **UX Pilot AI**

Reviews the flow.

### **Lovable**

Deploys updated frontend.

### **N8N**

(Optional) Creates “new user onboarding” automation.

Each agent stayed inside their domain.  
 Zero conflict.  
 Zero assumptions.

---

# **SECTION 10 — ONE-SENTENCE SUMMARY**

**This protocol ensures every AI in Juan’s ecosystem works as a perfectly coordinated engineering team: no overlap, no conflict, no confusion — only precision, clarity, and controlled execution.**