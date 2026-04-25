# Hala AI Assistants & External Integration — What We're Building
### A Plain-Language Guide for Management and Staff

**Date:** April 2026  
**Status:** Under Review — Awaiting Approval  
**Companion to:** AI Bot Technical Addendum v2

---

## What This Document Covers

The Hala Commercial Engine will include intelligent assistants — we call them "bots" — that help your team work faster and smarter. This document explains:

1. What each assistant does
2. What it will never do
3. How the system connects to your CRM, email, and WhatsApp
4. How Arabic and English documents are handled
5. What it will cost
6. What happens when things go wrong

---

## Part 1 — AI Assistants Inside Hala

These are helpers built into the Hala system. They assist your team with writing, reviewing, analysing, and monitoring — but they never make decisions. Every piece of output they produce requires a human to review and approve before it goes anywhere.

---

### The Document Writing Assistant

**What it does:** When you're building a proposal, quote, or SLA in Hala, this assistant can draft professional content for you in both English and Arabic. You tell it which section you need — for example, "Write the executive summary for this warehousing proposal" — and it generates a draft in both languages.

**What it does not do:** It never commits to pricing. It never sends anything to a client. It never changes existing approved documents. Everything it writes is clearly marked as a draft until you approve it.

**Why it matters:** Instead of starting from a blank page, your sales team gets a professional first draft in seconds. They edit it, improve it, and make it their own — but the heavy lifting is done.

---

### The Meeting-to-Document Assistant

**What it does:** After a client meeting, you paste or upload the meeting notes or transcript. The assistant reads through the discussion and extracts the key facts — what services the client needs, what volumes were discussed, what timelines were mentioned, what concerns were raised. It then fills in the relevant sections of your proposal or quote with this information.

**What it does not do:** It never invents information that wasn't discussed. If something is unclear in the transcript, it flags it as "needs clarification" rather than guessing.

**Why it matters:** Meeting notes often sit in someone's notebook for days before they become a document. This assistant turns a 2-hour documentation task into a 15-minute review.

---

### The SLA Clause Assistant

**What it does:** When drafting SLA documents, this assistant generates professional SLA clauses with specific KPIs, measurement methods, penalty structures, and escalation procedures. It follows Saudi commercial law conventions and can produce clauses in both English and Arabic legal style.

**What it does not do:** It never finalises SLA terms without human review. It never generates legally binding commitments on its own.

**Why it matters:** SLA drafting requires specialised knowledge. This assistant ensures every SLA starts with well-structured, legally informed clauses that your team then customises for each client.

---

### The Deal Health Analyst

**What it does:** For any active workspace, this assistant analyses the deal and provides a health report. It looks at the margin, compares the pricing against similar past deals, checks whether the volume assumptions are realistic, and identifies potential risks or opportunities.

**Why it matters:** It's like having a financial analyst review every deal before it moves forward — except it takes seconds instead of hours. The output is advisory only — your team decides what to do with the information.

---

### The Contract Package Reviewer

**What it does:** Before a contract goes to a client, this assistant reviews the complete package — the quote, the proposal, and the SLA — and checks for consistency. Does the pricing in the proposal match the approved quote? Are all required sections present? Are there any missing liability clauses or unrealistic KPIs?

It produces a readiness checklist: green (pass), amber (warning), or red (issue found) for each check.

**Why it matters:** It catches the mistakes that happen when different people work on different parts of a contract package. A pricing mismatch between the quote and the proposal is embarrassing at best and financially damaging at worst.

---

### The Handover Task Generator

**What it does:** When a deal is won and the contract is signed, this assistant reads the approved SLA and proposal, then generates a task list for every department involved in the setup: Operations, Finance, Legal, IT, HR. Each task includes what needs to be done, which department owns it, and an estimated timeline.

**What it does not do:** It doesn't assign tasks to specific people — that's a manager's decision. It creates the starting checklist.

**Why it matters:** The transition from "deal won" to "operations running" is where things often fall through the cracks. This assistant ensures nothing is forgotten.

---

### The Automated Monitors

These assistants run quietly in the background, watching your data and raising alerts when something needs attention. They are the system's early warning radar.

**Margin Monitor:** Watches every active deal's gross profit percentage. If a margin drops below the target threshold, it raises an amber alert. If it drops to a critical level, it raises a red alert that escalates to senior management.

**Renewal Scanner:** Watches contract expiry dates. At 90 days before expiry, it raises an information signal. At 60 days, an amber warning. At 30 days, a red escalation. It cross-references with the customer's health score — a Grade A customer approaching expiry gets higher priority.

**Pipeline & Payment Monitor:** Watches for two things: (1) deals that have been sitting in the same stage too long without progress, and (2) customers whose payment behaviour is deteriorating — invoices taking longer to get paid, DSO rising above acceptable levels.

**What they do not do:** They never change any data. They never move deals between stages. They never contact clients. They only raise signals for humans to review.

---

## Part 2 — Connecting to the Outside World (OpenClaw)

The assistants described above all work inside Hala. But your business also needs to talk to external systems — your CRM, your email, WhatsApp. That's where OpenClaw comes in.

### What Is OpenClaw?

Think of OpenClaw as Hala's messenger service. Hala is the brain — it makes the commercial decisions, stores the data, generates the documents. OpenClaw is the hands — it carries information between Hala and your other business tools.

OpenClaw runs on a server that Hala controls. Your data stays on your infrastructure. Nothing is sent to a third-party cloud service.

---

### The CRM Connection

**What it does:** OpenClaw keeps your CRM (GoHighLevel or Zoho) and Hala synchronised automatically.

- When a new qualified deal appears in your CRM, a workspace automatically appears in Hala
- When you change a deal's stage in Hala, the CRM updates to match
- When you generate a proposal PDF, it can be attached to the CRM deal automatically
- When a new client is added to the CRM, their company information is enriched using publicly available business data

**What it does not do:** It never creates deals in your CRM from Hala — the CRM remains the starting point for new leads. It never deletes anything. It never overwrites data you've already entered.

**What happens if it goes down:** Hala shows a banner saying "CRM sync is offline — manual entry mode." Everything in Hala still works. When the connection is restored, any missed updates are automatically synced.

---

### The Communication Service

**What it does:** When certain events happen in Hala, OpenClaw can draft follow-up communications:

- A proposal was sent three days ago with no response → drafts a professional follow-up email
- A quote is about to expire → drafts a reminder message
- A contract is approaching its renewal date → drafts an outreach email
- A red signal has been raised → dispatches an alert to the responsible manager via email or WhatsApp

**The most important rule:** Communication messages are NEVER sent automatically. Every email and WhatsApp message is queued inside Hala for a human to review, edit if needed, and approve before it goes out. The only exception is alert dispatching for red signals, which uses pre-approved standard message templates.

**WhatsApp messages** use pre-approved templates (required by WhatsApp Business rules). The assistant selects the right template and fills in the details — it does not compose freeform messages.

---

### The Intelligence Service

**What it does:** Once per week, OpenClaw gathers market intelligence relevant to the logistics industry in Saudi Arabia:

- News about the logistics sector
- Government tender announcements
- Competitor activity and announcements

It also generates scheduled reports:
- **Daily:** Pipeline summary — what moved, what's stalled
- **Weekly:** Margin and performance report
- **Monthly:** Portfolio health overview

Reports are emailed to configured recipients and posted to the Hala dashboard.

**What it does not do:** It does not scrape private websites or access restricted information. It only uses public news feeds, official government portals, and licensed news services.

---

## Part 3 — Arabic and English Documents

### How It Works Today

The system currently uses a dictionary of 282 Arabic commercial terms to translate section headers and key phrases. This is accurate but limited — body text is English only.

### How It Will Work After the Build

Every document the system produces will be available in both English and Arabic. The important distinction is that the Arabic content will not be a translation of the English — it will be written natively in Arabic commercial style. This matters because Arabic commercial and legal writing has its own conventions that are different from English.

### Quality Control for Arabic

Because AI-generated Arabic needs to be verified, we are implementing a quality control chain:

1. The AI assistant generates Arabic content
2. The system runs a basic grammar and terminology check
3. The content is queued for review by a native Arabic speaker on your team
4. Once approved, the verified phrase is stored so the system learns from it
5. Future documents can reuse approved Arabic phrases instead of generating new ones each time

Your existing dictionary of 282 verified terms remains the guaranteed-correct foundation. The AI builds on top of it — it never replaces it.

---

## Part 4 — Cost

### Monthly AI Cost Estimate

The AI assistants use external AI services (like OpenAI and Google) which charge based on usage. Here is what to expect:

| Usage Level | Monthly Cost |
|-------------|-------------|
| Light usage (small team, few proposals) | $70-90 |
| Normal usage (active commercial team) | $90-130 |
| Heavy usage (large team, many proposals) | $130-170 |

### Cost Controls Built Into the System

- **Monthly cap:** A maximum monthly budget is set in the admin panel (default: $200). When costs reach 80% of the cap, the system alerts the administrator.
- **Per-assistant daily caps:** Each assistant has its own daily spending limit to prevent runaway costs.
- **Smart model selection:** Simple tasks (monitoring, grammar checks) use low-cost AI models. Complex tasks (contract review, bilingual writing) use more capable models. This keeps costs down without sacrificing quality.

---

## Part 5 — Safety Guarantees

These rules apply to every AI assistant in the system, without exception:

1. **AI never sends anything to a client.** All outputs are drafts that require human approval.
2. **AI never changes pricing.** Pricing is always set and approved by humans.
3. **AI never moves deals between stages.** Stage transitions are human decisions.
4. **AI never approves anything.** Approvals require a named human with the right authority.
5. **AI never accesses data it doesn't need.** Each assistant only sees the data relevant to its task.
6. **Everything AI does is logged.** Every generation, every suggestion, every action is recorded in the audit trail with the assistant's name, what it did, and when.
7. **Any AI output can be reversed.** If an assistant generates incorrect information, an administrator can undo an entire batch of its output with one action.
8. **If AI services go down, Hala keeps working.** AI is an enhancement, not a dependency. Every task that an assistant helps with can also be done manually.

---

## Part 6 — What This Means for Your Team

**For Salespeople:** You'll have an assistant that drafts proposals, analyses deals, and fills documents from meeting notes. You still make every decision — but you spend less time on paperwork and more time with clients.

**For Regional Managers:** You'll receive automated alerts when deals need attention — margins dropping, stages stalling, contracts approaching expiry. You'll get daily and weekly reports delivered to your inbox with real numbers.

**For Operations:** When a deal is won, you'll receive a structured handover checklist generated from the actual contract terms — not a generic template. Every SLA commitment becomes a specific task.

**For Senior Management:** The dashboard will show real-time commercial intelligence. Market reports arrive weekly. Contract readiness is verified by AI before documents go to clients. Every AI action is auditable.

**For Everyone:** The system stays open for testing. AI assistants are helpers, not gatekeepers. They suggest, they draft, they alert — but they never block, lock, or restrict. That's the rule.

---

## Timeline

These AI capabilities are built alongside the main system, not after it:

| Phase | What Gets Built | When |
|-------|----------------|------|
| Phase 1 | Document writing assistants go live | After document engine is built |
| Phase 2 | New assistants (deal analyser, contract reviewer, handover generator) | 4 days after Phase 1 |
| Phase 3 | Monitor bots connected to real data | After signals and dashboard are built |
| Phase 4 | CRM connection via OpenClaw | After CRM integration sprint |
| Phase 5 | Email and WhatsApp communication | After notifications sprint |
| Phase 6 | Market intelligence and reporting | After dashboard sprint |

**Total additional time for AI capabilities: approximately 20 working days, running in parallel with the main build.**

---

*This document explains the same AI plan as the technical addendum, written for management and staff review. Both documents describe identical capabilities — this one explains the "what and why" while the technical version covers the "how."*
