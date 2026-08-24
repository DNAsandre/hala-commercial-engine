# AI Bot Configuration Architecture Rule

**Status:** Binding architect decision  
**Recorded:** 2026-08-24

## Rule

All Hala bots must be created, configured, instructed, versioned, and governed through the standalone application's AI Admin and Bot Builder system.

No Tender, Proposal, PDF Studio, workspace, stage component, hook, server route, or utility may hard-code:

- a Tender bot or Proposal bot definition;
- system or task instructions;
- a knowledge base or customer content;
- provider or model names;
- connector assignments;
- bot chains;
- bot-specific permissions, limits, or execution rules.

## Integration Boundary

Tender and Proposal code may expose canonical field destinations, source context, and a request to execute a configured bot by stable bot/version ID or declared capability. The selected bot's instructions, knowledge, model, tools, versions, and runtime policy must be resolved from the AI Admin system at execution time.

Tender-specialized and Proposal-specialized bots must remain separately configurable records. Their behavior must not be compiled into the process trackers.

## Governance Rule

Bot governance belongs centrally to AI Admin, not inside process stages. No Tender or Proposal stage, tab, or workflow component may carry its own bot permissions, approval logic, or execution policy.

## Knowledge Rule

Knowledge belongs to the configured bot/version through Bot Builder. There is no global hard-coded legal, compliance, Tender, or Proposal knowledge base embedded in product code.

## Current Wave Boundary

The pre-AI destination-readiness wave may build field contracts, safe persistence, provenance, idempotency, and PDF source mappings. It must not create hard-coded bots, activate AI execution, or simulate bot behavior. Bot runtime activation remains a separate architect-authorized program.

---
*Amended 2026-08-24: Governance Rule section and the no-simulation clause added verbatim from the architect's in-session restatement of this decision. No prior text removed.*
