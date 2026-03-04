# Hala Commercial Engine — Complete Testing Guide

**Version:** Sprint 14 (March 2026)
**Login URL:** Open the app and sign in with your Supabase credentials (email: amin@halascs.com)
**Role:** Admin (full access to all features)

> **Note:** The app uses Supabase Auth. You must have a valid account. After login, you are "Amin" — the Commercial Director with admin privileges. All features below are accessible from the left sidebar.

---

## TABLE OF CONTENTS

| # | Section | Sprint | Sidebar Link |
|---|---------|--------|--------------|
| 1 | Dashboard Overview | 1–4, 13 | Dashboard |
| 2 | Customer Management | 1–4 | Customers |
| 3 | Workspace Lifecycle | 1–7 | Workspaces |
| 4 | P&L Calculator | 3–6 | (inside Workspace → Commercial tab) |
| 5 | Document Composer & Editor | 4–5, 10–11 | (inside Workspace → Documents) |
| 6 | AI Block & Document Bots | 10–11 | (inside Document Editor) |
| 7 | Approvals Engine | 3–4 | (inside Workspace → Approvals tab) |
| 8 | SLA Integrity Guard | 6 | (inside Workspace at SLA Drafting stage) |
| 9 | Escalation Engine | 7–8 | Escalations |
| 10 | Tenders | 4 | Tenders |
| 11 | Governance Console | 6–7 | Governance |
| 12 | Admin Panel | 9–12 | Admin |
| 13 | AI Providers & Cost Analytics | 9 | Admin → AI Providers tab |
| 14 | Editor Bot Builder & Knowledgebase | 11 | Admin → Editor Bots / Knowledgebase tabs |
| 15 | CRM Sync Console | 12–13 | Admin → CRM Sync tab |
| 16 | PDF Studio (Standalone) | 14 | PDF Studio |
| 17 | Output Studio (from Document) | 14 | (inside Document Editor → Compile) |
| 18 | Audit Trail | 5–12 | Audit Trail |

---

## 1. DASHBOARD OVERVIEW

**Navigate to:** Click **"Dashboard"** in the left sidebar (first item).

### Step-by-step:

1. **KPI Cards (top row)** — You should see 6 stat cards:
   - Total Pipeline Value (SAR)
   - Active Workspaces count
   - Active Customers count
   - Average GP%
   - Pending Approvals count
   - Open Escalations count (red badge if > 0)

2. **Attention Required section (left 2/3)** — Shows workspaces that need action:
   - Red/Amber RAG status items
   - Click any workspace name → should navigate to that workspace detail

3. **Pipeline by Stage chart (right column)** — Bar chart showing workspace count per stage

4. **Customer Grade Distribution (right column)** — Shows A/B/C/D/F grade breakdown

5. **CRM Sync Widget (right column)** — Shows:
   - Zoho connection status (green "Connected" or red "Disconnected")
   - GHL connection status
   - Last sync timestamp
   - Pending / Failed sync counts
   - Click "View Console" → should navigate to CRM Sync Console

6. **Expiring Contracts (right column)** — Lists contracts expiring within 90 days

7. **Quick Access Cards (bottom)** — 6 cards linking to:
   - Workspaces, Customers, Tenders, Escalations, Governance, Admin
   - Click each → should navigate to the correct page

8. **Quick Links Row (very bottom)** — Badge links to CRM Sync, Renewals, Revenue Exposure, etc.

### What to report:
- [ ] Are all 6 KPI cards showing numbers (not blank or NaN)?
- [ ] Does the Attention Required section list workspaces?
- [ ] Does clicking a workspace name navigate correctly?
- [ ] Is the CRM Sync Widget visible with connection statuses?
- [ ] Do all Quick Access Cards navigate to the right pages?

---

## 2. CUSTOMER MANAGEMENT

**Navigate to:** Click **"Customers"** in the left sidebar.

### Step-by-step:

1. **Customer List** — You should see 12 customers in a table:
   - SABIC, Ma'aden, Almarai, Sadara Chemical, Nestlé KSA, Unilever Arabia, Aramco Services, Siemens KSA, Al-Rajhi Steel, Bayer Middle East, Tasnee, Panda Retail (Terminated)

2. **Customer Grades** — Check the grade column shows A/B/C/D/F with color badges

3. **Search/Filter** — Try typing "SABIC" in the search box → should filter to 1 result

4. **Click a customer (e.g., SABIC)** → Opens Customer Detail page showing:
   - Company info (code D365-001, industry, region, city)
   - Contact info (name, email, phone)
   - Financial data (contract value, DSO, payment status)
   - Pallet data (contracted, occupied, potential)
   - Revenue history (2023, 2024, 2025)
   - Linked workspaces list

5. **Click a linked workspace** → Should navigate to that workspace

### What to report:
- [ ] Are all 12 customers visible in the list?
- [ ] Does search/filter work?
- [ ] Does clicking a customer show the detail page with all data?
- [ ] Are linked workspaces clickable?

---

## 3. WORKSPACE LIFECYCLE

**Navigate to:** Click **"Workspaces"** in the left sidebar.

### Step-by-step:

1. **Workspace List** — You should see 8+ workspaces plus 8 tender workspaces:
   - Regular: SABIC Jubail, Ma'aden Ras Al Khair, Almarai Cold Chain, Sadara Jubail, Nestlé Distribution, Unilever Dammam, AlBaik 3PL, Bayer Pharma
   - Tenders: Ma'aden Jubail Expansion, SABIC National Warehousing, Aramco Dhahran VAS, etc.

2. **RAG Status badges** — Each workspace shows Red/Amber/Green status

3. **Stage badges** — Shows current stage (Qualified, Quoting, Proposal Active, etc.)

4. **CRM Sync Badge** — Each workspace card should show a sync status badge (Synced/Pending/Failed/Not Synced)

5. **Click "SABIC Jubail Warehousing"** → Opens workspace detail with these tabs:

### 3a. Overview Tab
- Header: workspace title, customer name, stage badge, RAG status, owner, region
- Stage selector dropdown — try changing the stage (e.g., from "Quoting" to "Proposal Active")
- KPI cards: Estimated Value, Pallet Volume, GP%, Days in Stage
- Notes section

### 3b. Documents Tab
- Shows document types: Quotes, Proposals, SLAs
- **Click "New Quote"** → Shows template selector:
  - Standard Quotation
  - Bilingual Quotation (EN/AR)
- **Click "Standard Quotation"** → Opens the Document Composer/Editor (see Section 5)
- **Click "New Proposal"** → Shows "Full Commercial Proposal" template
- **Click "New SLA"** → Shows "Service Level Agreement" template

### 3c. Commercial Tab (if visible)
- Shows P&L Calculator embedded in the workspace
- Revenue inputs, Cost inputs, P&L Summary

### 3d. Approvals Tab
- Shows approval chain based on GP% and pallet volume
- Approval matrix: Salesman → Regional Sales Head → Regional Ops Head → Director → CEO/CFO
- Each approver shows Pending/Approved/Rejected status

### 3e. Escalations Tab
- Lists escalation events for this workspace
- Shows severity (Red/Amber), trigger reason, status, SLA countdown timer
- Admin can click "Resolve" on open escalations → requires reason text

### 3f. Audit Trail Tab
- Shows all actions taken on this workspace
- Entries include: stage changes, document edits, approvals, escalations, CRM syncs

### What to report:
- [ ] Are all workspaces visible with correct RAG/stage badges?
- [ ] Can you open a workspace and see all tabs?
- [ ] Does stage change work (dropdown)?
- [ ] Can you create a new Quote/Proposal/SLA from the Documents tab?
- [ ] Are escalations visible with countdown timers?
- [ ] Does the Audit Trail show entries?

---

## 4. P&L CALCULATOR

**Navigate to:** Open any workspace → **Commercial** tab (or go to the standalone P&L page via direct URL `/pnl`)

### Step-by-step:

1. **Revenue Model** — Input fields:
   - Pallet Rate (SAR)
   - Monthly Pallets
   - VAS Revenue
   - Transport Revenue

2. **Cost Model** — Input fields (admin-editable, locked for Sales role):
   - Warehouse Cost
   - Labor Cost
   - Transport Cost
   - Overhead %

3. **P&L Summary** — Auto-calculated:
   - Total Revenue
   - Total Cost
   - Gross Profit
   - GP% (with RAG color: Green ≥25%, Amber 15-25%, Red <15%)

4. **Try changing Pallet Rate** → GP% should recalculate instantly

5. **Revenue Breakdown** — Shows pie/bar of revenue sources

### What to report:
- [ ] Do revenue/cost inputs accept numbers?
- [ ] Does GP% recalculate when you change inputs?
- [ ] Is the GP% color correct (Green/Amber/Red)?
- [ ] Is the cost section locked if you're not admin?

---

## 5. DOCUMENT COMPOSER & EDITOR

**Navigate to:** Workspaces → SABIC → Documents → Click **"Edit"** on any quote (or create a new one)

### Step-by-step:

1. **Editor Layout** — You should see:
   - Left sidebar: Block list (document sections)
   - Center: Rich text editor (TipTap) for the selected block
   - Top toolbar: Bold, Italic, Lists, AI buttons, Save, Compile, Output Studio

2. **Block Navigation** — Click different blocks in the left sidebar:
   - Cover Page
   - Confidentiality Statement
   - Executive Summary / Introduction
   - Scope of Work
   - Pricing Schedule
   - Terms & Conditions
   - Signature Block

3. **Edit a block** — Click on "Executive Summary" → type some text in the editor → text should appear

4. **Autosave** — After 5 seconds of inactivity, you should see a "Saved" indicator

5. **Save Now button** — Click the save/floppy icon → should show "Saved" toast

6. **Version History** — Click the clock/history icon in the toolbar → shows previous versions with timestamps → click one to restore

7. **Unsaved Changes Guard** — Edit some text, then try clicking a sidebar link (e.g., Dashboard) → should show "You have unsaved changes" warning

### 5a. Compile Button
- Click **"Compile"** in the toolbar → should navigate to the **Output Studio** (full-page PDF view)
- See Section 17 for Output Studio testing

### 5b. Output Studio Button
- Click **"Output Studio"** button → navigates to the Output Studio page
- See Section 17 for Output Studio testing

### What to report:
- [ ] Does the editor load with blocks in the left sidebar?
- [ ] Can you click blocks and see their content in the editor?
- [ ] Can you type and edit text?
- [ ] Does autosave work (check for "Saved" indicator)?
- [ ] Does the unsaved changes guard appear when navigating away?
- [ ] Does Compile navigate to Output Studio?

---

## 6. AI BLOCK & DOCUMENT BOTS

**Navigate to:** Open any document in the editor (Workspaces → SABIC → Documents → Edit a quote)

### 6a. Block AI Panel

1. **Click the sparkle (✨) icon** on any block → Left panel slides in showing:
   - Bot selector dropdown (4 block bots: Scope Writer, Pricing Narrator, Legal Clause, Executive Summary)
   - Provider/Model badge (shows which AI provider)
   - Prompt editor textarea
   - Insert/Replace toggle
   - Context preview (current block text)

2. **Select a bot** (e.g., "Scope Writer")

3. **Click "Generate Draft"** → Should show a loading state, then display an AI-generated draft with amber "AI Draft" badge

4. **Review the draft** → You'll see the generated text in a dashed amber border

5. **Click "Apply to Block"** → The draft replaces the block content, marked as AI-generated

6. **Or click "Discard Draft"** → Draft is removed, original content stays

7. **Upload Transcript** — Click the upload icon → select a .txt or .md file → content appears in the prompt area

### 6b. Document AI Panel

1. **Click the "AI Document" button** in the top toolbar → Right panel slides in showing:
   - Bot selector (4 document bots: Transcript Filler, Legal Reviewer, Spellcheck, Full Rewriter)
   - Transcript input area (paste or upload)
   - Run mode dropdown

2. **Paste some transcript text** (e.g., meeting notes about warehousing services)

3. **Select "Transcript Filler" bot**

4. **Click "Generate"** → Shows multi-block suggestions with before/after for each block

5. **Check/uncheck blocks** you want to apply

6. **Click "Apply Selected Changes"** → Selected blocks are updated

### 6c. AI Run History

1. **Click the history icon** in the right sidebar → Shows list of all AI runs:
   - Bot name, timestamp, status (applied/discarded/draft)
   - Click to expand and see details

### What to report:
- [ ] Does the sparkle icon open the Block AI Panel?
- [ ] Can you select a bot and generate a draft?
- [ ] Does Apply/Discard work correctly?
- [ ] Does the Document AI Panel open from the toolbar?
- [ ] Can you paste transcript text and generate suggestions?
- [ ] Does AI Run History show previous runs?
- [ ] Note: AI generation uses mock/fallback if Edge Functions aren't deployed — this is expected

---

## 7. APPROVALS ENGINE

**Navigate to:** Workspaces → open any workspace → **Approvals** tab

### Step-by-step:

1. **Approval Chain** — Shows required approvers based on deal size:
   - GP% < 15%: Requires CEO/CFO approval
   - GP% 15-20%: Requires Director approval
   - GP% 20-25%: Requires Regional Ops Head approval
   - GP% ≥ 25%: Salesman + Regional Sales Head only

2. **Approval Status** — Each approver shows:
   - Pending (gray)
   - Approved (green checkmark)
   - Rejected (red X)

3. **Approve/Reject buttons** — As admin, you can approve or reject on behalf of any role

4. **Stage Gating** — Try advancing the workspace stage when approvals are pending → should show a warning/block

### What to report:
- [ ] Does the approval chain show the correct approvers for the GP%?
- [ ] Can you approve/reject as admin?
- [ ] Does stage advancement get blocked without approvals?

---

## 8. SLA INTEGRITY GUARD

**Navigate to:** Open a workspace that's at **"SLA Drafting"** stage (or advance one to that stage)

### Step-by-step:

1. **Pricing Lock** — When workspace is at SLA Drafting or later:
   - Selling rate fields should be **read-only** (grayed out)
   - A lock icon and "Pricing locked at SLA Drafting" message should appear

2. **Admin Override** — As admin:
   - Click "Override Lock" button → Modal appears
   - Enter reason (minimum 10 characters)
   - Click confirm → Fields become editable temporarily
   - Audit log entry created

3. **SLA Verification Checklist** — Should show a checklist of items:
   - All required before advancing to "Contract Ready"
   - Check items off → progress indicator updates

4. **SLA vs P&L Delta Warning** — If SLA terms differ from approved P&L:
   - Amber/Red warning banner appears
   - Shows the delta (e.g., "GP% in SLA is 3% lower than approved P&L")
   - Blocks stage advance unless admin overrides

### What to report:
- [ ] Are pricing fields locked at SLA Drafting stage?
- [ ] Does admin override work with reason modal?
- [ ] Is the SLA verification checklist visible?
- [ ] Does the delta warning appear when SLA differs from P&L?

---

## 9. ESCALATION ENGINE & DASHBOARD

**Navigate to:** Click **"Escalations"** in the left sidebar.

### Step-by-step:

1. **Header Stats (6 cards):**
   - Total Open
   - Red Count
   - Amber Count
   - Resolved (last 30d)
   - Avg Resolution Time
   - SLA Breached count

2. **Escalation Table** — Shows all escalation events:
   - Columns: Severity, Entity, Workspace, Trigger, Assigned To, Status, Created, Days Open, SLA Timer
   - Default sort: Status=open, Severity=red first

3. **Filters** — Try each filter:
   - Severity: Red / Amber / All
   - Status: Open / Acknowledged / Resolved / All
   - Assigned To: dropdown of team members
   - Entity Type: workspace / customer / deal

4. **SLA Countdown Timers** — Each open escalation shows:
   - Red: 24-hour countdown (pulsing if < 4 hours)
   - Amber: 72-hour countdown
   - "SLA BREACHED" badge if overdue (pulsing red)

5. **Aging Indicators:**
   - Red > 3 days open → "CRITICAL" badge
   - Red > 7 days → flashing indicator

6. **Click an escalation row** → Detail drawer opens showing:
   - Full trigger details
   - Assignment info
   - SLA countdown (large format)
   - Resolution history

7. **Resolve an escalation (Admin only):**
   - Click "Resolve" button
   - Enter resolution reason
   - Click confirm → Status changes to "Resolved"

8. **Workspace Escalations** — Go to any workspace → Escalations tab → should show the same escalations filtered to that workspace

### What to report:
- [ ] Are all 6 header stat cards showing numbers?
- [ ] Does the escalation table load with entries?
- [ ] Do filters work (severity, status, assigned)?
- [ ] Are SLA countdown timers visible and counting?
- [ ] Can you click a row to see the detail drawer?
- [ ] Can you resolve an escalation as admin?
- [ ] Do workspace-level escalations show correctly?

---

## 10. TENDERS

**Navigate to:** Click **"Tenders"** in the left sidebar.

### Step-by-step:

1. **Tender List** — You should see 8 tender workspaces:
   - Various stages: Draft, In Preparation, Submitted, Under Evaluation, Won, Lost

2. **Tender stages** — Different from regular workspace stages:
   - Draft → In Preparation → Submitted → Under Evaluation → Won/Lost/Withdrawn

3. **Click a tender** (e.g., "Ma'aden Jubail Expansion") → Opens workspace detail with tender-specific info:
   - Submission deadline
   - Probability %
   - Linked tender ID

4. **Won/Lost tenders** — Check that "Almarai Dammam" shows as "Won" and "Unilever Riyadh" shows as "Lost" with reason

### What to report:
- [ ] Are all 8 tenders visible?
- [ ] Do tender stages show correctly?
- [ ] Can you click and view tender details?
- [ ] Do Won/Lost tenders show the correct status?

---

## 11. GOVERNANCE CONSOLE

**Navigate to:** Click **"Governance"** in the left sidebar.

### Step-by-step — 9 tabs to check:

1. **Compliance Tab** — Overview of compliance status, policy adherence metrics

2. **Policy Gates Tab** — Shows configurable gates:
   - Each gate: Enforce / Warn / Off toggle
   - Gate types: margin threshold, approval chain, SLA verification, etc.

3. **AI Restrictions Tab** — Shows what AI bots can/cannot do:
   - Hard-coded restrictions: AI cannot approve, override gates, modify pricing, change stage
   - Global bot kill switch
   - Per-module bot access toggles

4. **Overrides Tab** — Log of all "break glass" overrides:
   - Who overrode, when, why, which rule

5. **Versioning Tab** — Document version immutability rules:
   - Approved quotes/proposals/SLAs cannot be edited

6. **Approval Matrix Tab** — Visual matrix showing:
   - GP% thresholds → required approver roles
   - Pallet volume thresholds

7. **Roles Tab** — Role definitions and permissions:
   - Admin, Director, Regional Sales Head, Salesman, Regional Ops Head, CEO/CFO

8. **Environment Tab** — Production environment guards

9. **Audit Stream Tab** — Real-time audit log stream

### What to report:
- [ ] Do all 9 tabs load without errors?
- [ ] Can you see policy gates with Enforce/Warn/Off toggles?
- [ ] Does the AI Restrictions tab show the restriction list?
- [ ] Does the Approval Matrix display correctly?
- [ ] Does the Audit Stream show recent entries?

---

## 12. ADMIN PANEL

**Navigate to:** Click **"Admin"** in the left sidebar.

### Step-by-step — Multiple tabs:

1. **Document System Tab** (first tab when navigationV1 is ON):
   - Quick links to: Templates, Variables, Block Library, Block Builder, Branding
   - Click each link → should navigate to the correct page

2. **Automation Tab:**
   - Quick links to: Bot Governance, Signal Engine, Bot Audit

3. **ECR Tab:**
   - Quick links to: ECR Dashboard, ECR Config

4. **Users Tab** — Shows 7 team members:
   - Amin (Admin), Ra'ed (Regional Sales Head), Albert (Salesman), Hano (Salesman), Yazan (Regional Ops Head), Mohammed (Director), Tariq (CEO/CFO)

5. **System Modules Tab** — Toggle modules on/off

6. **Integrations Tab** — External integration status

7. **Settings Tab** — System settings

8. **AI Providers Tab** — See Section 13

9. **Editor Bots Tab** — See Section 14

10. **Knowledgebase Tab** — See Section 14

11. **CRM Sync Tab** — See Section 15

### What to report:
- [ ] Do all tabs load?
- [ ] Does the Users tab show all 7 team members?
- [ ] Do Document System quick links navigate correctly?

---

## 13. AI PROVIDERS & COST ANALYTICS

**Navigate to:** Admin → **"AI Providers"** tab

### Step-by-step:

1. **Provider Cards** — You should see 2 providers:
   - **OpenAI** — Toggle on/off, default model (gpt-4o), Test Connection button
   - **Google AI** — Toggle on/off, default model (gemini-pro), Test Connection button

2. **Toggle a provider off** → Should show "Disabled" state

3. **Click "Test Connection"** → Should show success/failure feedback

4. **Usage Stats (6 cards):**
   - Total Calls
   - Total Input Tokens
   - Total Output Tokens
   - Estimated Cost (USD)
   - Avg Cost/Call
   - Active Providers

5. **Usage Logs Table** — Shows AI usage history:
   - Provider, Model, Input Tokens, Output Tokens, Est. Cost, Timestamp

6. **Cost Analytics View** — Click "Cost Analytics" toggle:
   - Per-provider cost cards
   - Cost bars by model
   - Model breakdown
   - Pricing reference table (shows $/1M tokens for each model)

### What to report:
- [ ] Are both provider cards visible?
- [ ] Does toggle on/off work?
- [ ] Do usage stat cards show numbers?
- [ ] Is the usage log table populated?
- [ ] Does Cost Analytics view render?

---

## 14. EDITOR BOT BUILDER & KNOWLEDGEBASE

### 14a. Editor Bot Builder

**Navigate to:** Admin → **"Editor Bots"** tab

1. **Bot List** — 8 bots total:
   - 4 Block bots: Scope Writer, Pricing Narrator, Legal Clause, Executive Summary
   - 4 Document bots: Transcript Filler, Legal Reviewer, Spellcheck, Full Rewriter

2. **Click a bot** → Shows bot configuration:
   - Name, type (block/document), provider, model
   - System prompt
   - Allowed document types
   - KB attachments (linked knowledge collections)

3. **Test Bot Panel** — Click "Test" on any bot:
   - Enter test prompt
   - Shows KB retrieval results (chunks, relevance scores)
   - Shows generated output

### 14b. Knowledgebase Manager

**Navigate to:** Admin → **"Knowledgebase"** tab (or direct URL `/knowledgebase`)

1. **Collections Grid** — 4 collections:
   - Hala Policies, Legal Templates, Industry Standards, Customer Profiles

2. **Click a collection** → Shows:
   - Documents list (8 total across all collections)
   - Chunk viewer (64 chunks total)
   - Each chunk shows text preview and metadata

3. **Create Collection** — Click "New Collection" → Enter name → Should create

4. **Upload Document** — Click "Upload" in a collection → Paste text or upload file → Should chunk automatically

### What to report:
- [ ] Are all 8 bots visible in the Editor Bots tab?
- [ ] Can you click a bot and see its configuration?
- [ ] Does the Test Bot Panel work?
- [ ] Are all 4 KB collections visible?
- [ ] Can you view documents and chunks?

---

## 15. CRM SYNC CONSOLE

**Navigate to:** Admin → **"CRM Sync"** tab (or click **"CRM Console"** in sidebar if visible)

### Step-by-step:

1. **Connection Cards** — 2 CRM connections:
   - **Zoho CRM** — Status: Connected (green), Last sync timestamp
   - **GoHighLevel** — Status: Configuring (amber), Migration mode

2. **Connection Actions:**
   - Toggle enable/disable
   - "Test Connection" button
   - "Resync" button
   - "Disable" button

3. **Sync Health Stats (6 cards):**
   - Total Events, Pending, Success, Failed, Retrying, Avg Latency

4. **Sync Event Table** — 10 seed events showing:
   - Connection, Direction (inbound/outbound), Status, Entity Type, Timestamp

5. **Filters** — Try each:
   - Connection: Zoho / GHL / All
   - Direction: Inbound / Outbound / All
   - Status: Success / Failed / Pending / Retrying / All
   - Entity Type: workspace / customer / deal / All

6. **Manual Retry** — Click retry icon on a failed event → Should change to "retrying"

7. **Field Mapping Viewer** — Shows field mappings:
   - Zoho: 10 mappings (workspace_name → Deal_Name, etc.)
   - GHL: 7 mappings
   - Direction badges (inbound/outbound)

8. **Conflict Resolution Log** — Shows resolved conflicts with timestamps

### What to report:
- [ ] Are both connection cards visible?
- [ ] Do toggle/test/resync buttons work?
- [ ] Are sync health stats showing numbers?
- [ ] Does the event table load with entries?
- [ ] Do filters work?
- [ ] Is the field mapping viewer populated?

---

## 16. PDF STUDIO (STANDALONE)

**Navigate to:** Click **"PDF Studio"** in the left sidebar.

### Step-by-step:

1. **Left Panel — Controls:**
   - Template dropdown: Standard Quote, 3PL Proposal, MSA Contract, Service Order, Financial Proposal
   - Branding dropdown: Hala Corporate — Navy, Hala Modern — Minimal, Hala Premium — Gold Accent
   - Cover Style: Wave Professional, Minimal Corporate
   - Watermark: Draft, Confidential, Final, None

2. **Language Toggle (top right of preview):**
   - **EN** — English only
   - **EN/AR** — Dual language (English + Arabic side by side)
   - **عربي** — Arabic only

3. **Preview Area (right panel):**
   - Shows the rendered PDF document
   - Page navigation bar at top: Cover, P2, P3... buttons
   - Page counter: "Page X of Y"
   - Zoom controls: 50% to 150%

4. **Test the preview:**
   - Click different page buttons (Cover, P2, P3, etc.) → Preview should scroll to that page
   - Change zoom level → Document should resize
   - Switch language to EN/AR → Should show dual-language content

5. **Tabs below controls:**
   - **Preview** — Live document preview
   - **Pricing Table** — Editable pricing rows (add/remove/modify line items)
   - **SLA Matrix** — SLA terms editor
   - **Terms** — Terms & Conditions editor

6. **Arabic Translation Bot (bottom of left panel):**
   - Type an English phrase (e.g., "warehouse management system")
   - Click translate arrow → Shows Arabic translation
   - Shows confidence level and translation method

7. **Download Button** — Click "Download" → Downloads an HTML file
   - Open the downloaded file in your browser → Should show the full professional document

8. **Print Button** — Click "Print" → Opens browser print dialog (use "Save as PDF" for actual PDF)

### What to report:
- [ ] Does the preview show a professional document with cover page?
- [ ] Do page navigation buttons work?
- [ ] Does language toggle switch between EN / EN-AR / Arabic?
- [ ] Does the Arabic Translation Bot translate correctly?
- [ ] Does Download produce a non-empty HTML file?
- [ ] Can you edit pricing rows in the Pricing Table tab?

---

## 17. OUTPUT STUDIO (FROM DOCUMENT EDITOR)

**Navigate to:** Workspaces → SABIC → Documents → Edit a quote → Click **"Compile"** or **"Output Studio"**

### Step-by-step:

1. **Full-Page Document Viewer** — Should show:
   - Professional A4-sized pages
   - Cover page with navy gradient, document title, customer name
   - Hala branding header on every page
   - Footer with "COMPLETED BY: Hala SCS | DATE | REF" on every page
   - Page numbers

2. **Left Sidebar — Styling Controls:**
   - Branding selector
   - Cover style selector
   - Watermark toggle (Draft/Confidential/Final/None)
   - Token Health indicator (shows resolved vs missing tokens)

3. **Language Toggle (header):**
   - EN → English only
   - EN/AR → Dual language with Arabic translations
   - عربي → Arabic only (RTL)

4. **Test Dual Language:**
   - Click "EN/AR" → Each section should show:
     - English heading + Arabic heading (e.g., "Confidentiality Statement" + "بيان السرية")
     - English body text + Arabic translation

5. **Document Pages (scroll through all):**
   - Page 1: Cover Page (navy gradient, wave design, title, customer, date)
   - Page 2: Confidentiality Statement
   - Page 3: Introduction / Executive Summary
   - Page 4: HSCS Customers & Certificates
   - Page 5: Scope of Work (bullet list of services)
   - Page 6: Commercial Proposal / Pricing Table (3-option table with SAR formatting)
   - Page 7: Terms & Conditions
   - Page 8: Signature Block (dual-party: Hala + Customer, with stamp areas)

6. **Download HTML** — Click download icon → Downloads the full document as HTML
   - Open in browser → Should render all pages with proper formatting

7. **Print** — Click print icon → Browser print dialog
   - Set to A4, no margins → Should produce clean PDF pages

8. **Back to Editor** — Click "← Back to Editor" → Should return to the document editor

### What to report:
- [ ] Does the Output Studio show a full-page document (not a popup)?
- [ ] Is the cover page rendered with navy gradient and wave design?
- [ ] Do all 8 pages render with headers/footers?
- [ ] Does the pricing table show proper SAR formatting with 3 options?
- [ ] Does the signature block show dual-party (Hala + Customer)?
- [ ] Does EN/AR mode show Arabic translations on every page?
- [ ] Does Download produce a complete HTML file?
- [ ] Does "Back to Editor" navigate correctly?

---

## 18. AUDIT TRAIL

**Navigate to:** Click **"Audit Trail"** in the left sidebar.

### Step-by-step:

1. **Audit Log Table** — Shows all system actions:
   - Timestamp, User, Action Type, Entity, Details

2. **Action Types** you should see:
   - stage_change, document_edit, document_save, approval_granted, approval_rejected
   - escalation_created, escalation_resolved
   - ai_draft_created, ai_draft_applied, ai_draft_discarded
   - crm_push_success, crm_push_failed, crm_conflict_resolved
   - pricing_override, sla_checklist_updated

3. **Filters** — Try filtering by:
   - Action type
   - User
   - Date range

4. **Click an entry** → Should show full details

### What to report:
- [ ] Does the audit trail load with entries?
- [ ] Are different action types visible?
- [ ] Do filters work?

---

## KNOWN LIMITATIONS

1. **AI Generation** — Uses mock/fallback responses if Supabase Edge Functions are not deployed. You'll see a "CloudOff" banner in the editor if AI services are unavailable. This is expected behavior.

2. **CRM Sync** — Uses simulated sync events. Real Zoho/GHL integration requires Edge Function deployment with API keys.

3. **PDF Download** — Downloads as HTML (not native PDF). To get a PDF: open the HTML file in Chrome → Print → Save as PDF (set to A4, no margins).

4. **Data Persistence** — All data is stored in Supabase. If the database isn't connected, the app uses in-memory mock data that resets on page refresh.

5. **Role Switching** — Currently logged in as Amin (Admin). To test role-based restrictions (e.g., Sales cannot edit costs), you would need to log in as a different user (e.g., albert@halascs.com).

---

## FEEDBACK TEMPLATE

Please copy this template and fill in your findings:

```
## Dashboard
- KPI cards: [OK / BROKEN / describe issue]
- CRM Widget: [OK / BROKEN / describe issue]
- Quick Access Cards: [OK / BROKEN / describe issue]

## Customers
- Customer list: [OK / BROKEN / describe issue]
- Customer detail: [OK / BROKEN / describe issue]
- Search/filter: [OK / BROKEN / describe issue]

## Workspaces
- Workspace list: [OK / BROKEN / describe issue]
- Workspace detail tabs: [OK / BROKEN / describe issue]
- Stage change: [OK / BROKEN / describe issue]
- New Quote/Proposal/SLA: [OK / BROKEN / describe issue]

## Document Editor
- Block navigation: [OK / BROKEN / describe issue]
- Text editing: [OK / BROKEN / describe issue]
- Autosave: [OK / BROKEN / describe issue]
- Compile button: [OK / BROKEN / describe issue]

## AI Bots
- Block AI Panel: [OK / BROKEN / describe issue]
- Document AI Panel: [OK / BROKEN / describe issue]
- AI Run History: [OK / BROKEN / describe issue]

## Escalations
- Escalation table: [OK / BROKEN / describe issue]
- SLA Timers: [OK / BROKEN / describe issue]
- Resolve flow: [OK / BROKEN / describe issue]

## PDF Studio
- Preview rendering: [OK / BROKEN / describe issue]
- Language toggle: [OK / BROKEN / describe issue]
- Download: [OK / BROKEN / describe issue]
- Arabic translation: [OK / BROKEN / describe issue]

## Output Studio
- Full-page view: [OK / BROKEN / describe issue]
- Cover page: [OK / BROKEN / describe issue]
- Pricing table: [OK / BROKEN / describe issue]
- Dual language: [OK / BROKEN / describe issue]
- Download: [OK / BROKEN / describe issue]

## Governance
- All 9 tabs: [OK / BROKEN / describe issue]

## Admin Panel
- All tabs: [OK / BROKEN / describe issue]
- AI Providers: [OK / BROKEN / describe issue]
- CRM Sync: [OK / BROKEN / describe issue]

## Audit Trail
- Log entries: [OK / BROKEN / describe issue]
- Filters: [OK / BROKEN / describe issue]

## Other Issues:
[Describe any other issues found]
```
