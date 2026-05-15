# Orchestration Rules Reference

## Source Documents Used
Documents 21, 22, 31, 46-50, Document Ω, Document Ψ

## Key Rules
- AI hierarchy: ChatGPT (Architect) → Codex (Executor) → Supabase AI (Database) → Lovable (Frontend Deploy) → n8n (Automation) → Agent Builder → UX Pilot
- 4 Iron Laws: No cross-domain modification, defer to architect for naming, only Codex modifies repo, all changes reported
- No simultaneous execution — one agent at a time on a resource
- Max 5 handoffs, 3 retries, 1 escalation cycle per task
- Override chain: Safety → Environment → Architecture → User → Constitution → META → Agent Role

## Forbidden Actions
- Allowing overlapping ownership
- Permitting simultaneous agent execution on same resource
- Ignoring loop detection triggers
- Bypassing the safety hierarchy
- Allowing agents to act outside their domains
