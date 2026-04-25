# Hala Commercial Engine — Build Roadmap
### What We're Building, Why, and What You'll See

**Document Version:** Management & Staff Overview  
**Date:** April 2026  
**Status:** Under Review — Awaiting Approval

---

## Where We Are Today

The Hala Commercial Engine currently has a fully designed interface. You can see the screens, navigate the menus, view customer data, browse workspaces, and preview PDF documents. It looks and feels like a complete system.

However, behind that interface, several critical pieces are not yet operational. The system does not yet have its own secure server. It cannot generate real PDF files for clients. It does not connect to our CRM. It cannot send emails or notifications. And the commercial workflow — from creating a quote through to signing a contract — is not yet guided or tracked end to end.

This roadmap explains what we are going to build, in what order, and what you will experience at each stage.

---

## Phase 1 — Laying the Foundation

### What Is Happening

We are building the secure backbone that everything else depends on. Think of it like constructing the engine room of a ship — the passengers don't see it, but without it, nothing moves.

### What Gets Built

**A dedicated server for the Hala Engine.** Right now, the system talks directly to the database from your browser. That's fine for testing, but it means there is no central authority checking that data is correct before it's saved. We are creating a proper server that sits between the user interface and the database. Every action — creating a customer, saving a quote, changing a workspace stage — will pass through this server, which validates the information before storing it.

**Real user accounts and login.** Currently, everyone using the system appears as the same user. After this phase, each team member will have their own login with their name and role displayed. When you log in as Ra'ed, the system knows you are a Regional Sales Head. When Albert logs in, it knows he is a Salesman. This is not about restricting access — it's about knowing who did what.

**Database protection.** The customer and commercial data will be secured so that only authenticated users can access it. This prevents unauthorised access and ensures data integrity.

### What You Will See

- A real login screen that requires your email and password
- Your name and role displayed in the sidebar
- The system behaves exactly the same as before, but now it's running on a secure foundation

---

## Phase 2 — Building the Commercial Workflow

### What Is Happening

This is the heart of the system. We are building the actual step-by-step process that commercial staff follow every day: creating quotes, building proposals, drafting SLAs, and tracking contracts through to signature.

### What Gets Built

**Quote Creation.** Inside each workspace, you will be able to create a new quote with a guided form. You'll select the service type (Warehousing, Transport, Value-Added Services), enter volumes and rates, and immediately see the calculated revenue and margin. The system will show you the gross profit percentage in real time as you build the quote — green if margins are healthy, amber if they're tight, red if they're below target. This is information, not a restriction — you can still proceed regardless.

When you need to revise a quote, the system will automatically create a new version (v2, v3, etc.) and keep the previous versions on record. You'll always be able to see what changed between versions.

**Proposal Creation.** Once a quote is ready, you can generate a proposal from it. The proposal will pull pricing directly from the quote so there's no manual re-entry. You'll add the executive summary, scope description, and any client-specific details. If no SLA has been finalised yet, the system will automatically include the standard disclaimer about service levels being indicative — a requirement from our commercial standards.

Like quotes, proposals will have version tracking. Each revision captures a note about why the change was made, creating a clear negotiation history.

**SLA Drafting.** After commercial terms are agreed, you can create an SLA within the workspace. The system will pre-fill standard KPI metrics (Order Accuracy, On-Time Dispatch, etc.) which you can customise for each client. The SLA links back to the quote and proposal it's based on, so there's always a clear paper trail.

**Contract Tracking.** The workspace will show a simple visual checklist: Is the quote approved? Is the proposal approved? Is the SLA approved? When everything is ready, you mark the contract as sent, and eventually as signed. These are just status updates — the system tracks the timeline for you.

### What You Will See

- A "Create Quote" button inside each workspace with a step-by-step form
- Real-time margin calculations as you enter pricing
- Version history showing all quote and proposal revisions
- Clear document lineage: which quote led to which proposal led to which SLA
- A contract readiness checklist in each workspace
- All status changes recorded with timestamps and who made them

---

## Phase 3 — Professional Document Generation

### What Is Happening

We are upgrading how the system produces documents. Currently, PDF Studio creates an HTML preview that you can print. After this phase, the system will generate proper, professional PDF files and store them securely.

### What Gets Built

**Server-side PDF generation.** When you click "Generate PDF," the system will produce a real PDF document on the server — formatted exactly as you see it in PDF Studio, including the cover page, Arabic translations, pricing tables, SLA matrix, and terms. The output will be a downloadable PDF file, not a browser print.

**Document storage.** Every PDF generated will be stored in a secure cloud vault, organised by customer and workspace. You'll never lose a document. Each version is permanent — once generated, it cannot be altered.

**Document vault.** A central page where you can browse all generated documents across all customers and workspaces. Search by customer, filter by document type (Quote, Proposal, SLA), download any version.

**Version history.** Inside each workspace, you'll see a timeline of every document generated — who created it, when, which version, and you can click to download any previous version.

### What You Will See

- A "Generate PDF" button that produces a real downloadable PDF file
- Documents automatically stored and organised in the vault
- A document history timeline in each workspace
- The ability to compare two versions of a document side by side

---

## Phase 4 — Connecting to the Outside World

### What Is Happening

Until now, the Hala Engine has been a self-contained system. In this phase, we connect it to your CRM, set up email notifications, and turn on the intelligent monitoring features.

### What Gets Built

**CRM Integration.** The system will connect to your CRM (GoHighLevel or Zoho). When a new qualified deal appears in the CRM, it will automatically create a workspace in Hala. When you change a workspace stage in Hala, the CRM deal stage updates to match. When you generate a proposal PDF, it can be attached to the CRM deal automatically.

This means your sales team enters data once, not twice. The CRM remains the external communication tool. Hala remains the internal commercial intelligence and document engine. They stay synchronised.

**Email Notifications.** The system will send real emails for important events:
- When a quote is submitted and needs review, the relevant manager receives an email
- When a workspace stage changes, the team is notified
- When a contract is expiring within 90, 60, or 30 days, the account owner gets a warning email

There will also be an in-app notification bell so you can see recent activity without checking email.

**Automated Business Signals.** The system will start watching your data and raising alerts automatically:
- If a deal's margin drops below target, a warning signal appears
- If a customer's payment behaviour is deteriorating (high DSO), a risk signal appears
- If a workspace has been sitting in the same stage too long, a stagnation alert appears

These signals show up on the dashboard and inside the relevant workspace. They are informational — they help you spot issues early.

**Escalation Tracking.** If a red signal has been active for more than 48 hours with no action taken, the system creates an escalation and assigns it to the next level of management. This ensures nothing falls through the cracks.

**Real Dashboard.** The main dashboard will show live numbers from real data: total pipeline value, average margins, stage distribution, revenue at risk from expiring contracts, and a live activity feed of recent actions across the system.

### What You Will See

- Customer and deal data flowing in from the CRM automatically
- Email notifications when things need your attention
- Coloured signal badges (green/amber/red) on workspaces and customers
- A dashboard with real, live numbers — not sample data
- An activity feed showing who did what, when

---

## Phase 5 — Commercial Governance

### When This Happens

**This is the final phase.** It only begins after everything above is built, tested, and running with real data. We will not implement governance rules until the team has had time to use the system in open mode and confirm everything works correctly.

### What Gets Built

**Configurable business rules.** The system will be able to enforce your commercial standards — for example, flagging when a quote has a margin below the minimum threshold and identifying which level of management needs to review it. But here is the important part: every rule will have three modes that the administrator controls:

- **Off** — The rule does nothing. The system behaves exactly as it does today.
- **Warn** — The rule shows an advisory message but does not prevent any action. The user sees the warning and decides what to do.
- **Enforce** — The rule requires acknowledgment before proceeding. Even in enforce mode, an authorised manager can override it with a documented reason.

**All rules will start in "Off" mode.** The administrator decides when to turn each rule on, and at what level. This is not an automatic lockdown. This is a controlled, gradual tightening that management activates when they are confident the system is ready.

### What You Will See

- An admin panel where each business rule can be toggled between Off, Warn, and Enforce
- Advisory banners when a rule is in Warn mode (e.g., "This margin is below the 22% threshold — Director review is recommended")
- Every rule evaluation logged in the audit trail for complete transparency

---

## Timeline at a Glance

| Phase | What It Delivers | Estimated Duration |
|-------|-----------------|-------------------|
| **Phase 1** — Foundation | Secure server, real login, protected data | 1 week |
| **Phase 2** — Commercial Workflow | Quote, Proposal, SLA, and Contract creation | 2 weeks |
| **Phase 3** — Document Engine | Professional PDFs, storage, versioning | 1 week |
| **Phase 4** — Integrations | CRM sync, email, signals, live dashboard | 2-3 weeks |
| **Phase 5** — Governance | Configurable business rules (off by default) | 1 week |
| **Total** | Complete production-ready system | **7-8 weeks** |

---

## What This Means for Your Team

**For Sales Staff:** You will get guided forms to create quotes and proposals instead of building everything manually. Margins are calculated automatically. Documents are generated professionally. Your CRM stays in sync.

**For Regional Managers:** You will see real-time pipeline data, margin tracking, and automated alerts when deals need attention. Escalations route to you when action is needed.

**For Operations:** SLAs will have clear KPIs, measurement methods, and penalty structures. The handover process will be tracked step by step.

**For Senior Management:** The dashboard will show the true state of the commercial pipeline with real numbers. Every quote, every approval, every negotiation change is logged and traceable.

**For Everyone:** The system stays open and testable throughout the build. No features will be locked or restricted until the final phase, and even then, management controls what gets turned on.

---

*This document is a companion to the detailed technical sprint plan. Both documents describe the same work — this one explains the "what and why" while the technical plan covers the "how."*
