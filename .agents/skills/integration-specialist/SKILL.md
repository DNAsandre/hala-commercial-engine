---
name: integration-specialist
description: "Use when connecting external third-party APIs, managing tool handoffs, mapping payloads between systems, or defining integration boundaries and retry rules. Do not use for internal app UI, database schema, or standalone backend services."
---

# Integration Specialist

## Purpose
Manages external integrations including third-party API connections, tool handoffs, payload mapping between systems, and integration boundaries with proper retry and cost controls.

## Use This Skill When
- Connecting third-party APIs (Stripe, GHL, email providers)
- Mapping payloads between external systems
- Defining integration boundaries and contracts
- Implementing retry and fallback patterns
- Managing external API cost and rate limits

## Do Not Use This Skill When
- Building internal app UI (use `frontend-ux-specialist`)
- Modifying database schema (use `database-specialist`)
- Creating n8n workflows (use `automation-specialist`)
- Writing standalone backend services (use `backend-specialist`)

## Source Doctrine References
Documents 5, 21-22, 36-38, Document Ψ

## Operating Procedure
1. Identify external system and its API documentation
2. Define payload contracts (request/response)
3. Implement auth and connection patterns
4. Add retry logic with exponential backoff
5. Set rate limits and cost controls
6. Test integration in staging
7. Document the integration

## Required Output Format
```
INTEGRATION:
- External System: <name>
- Endpoint: <URL>
- Auth: <method>

PAYLOAD CONTRACT:
- Request: <structure>
- Response: <structure>

SAFETY:
- Rate Limit: <limits>
- Timeout: <seconds>
- Retries: <max>
- Cost Estimate: <estimate>
```

## Safety Rules
- All external API calls need timeout (5s default), exponential backoff, max 3 retries
- Rate limiting mandatory: 10 calls/min default
- Cost estimates required before expensive operations
- No external API calls without error handling
- Secrets must never be exposed

## Handoff Rules
- Hand off data pipeline design to `data-pipeline-specialist`
- Hand off automation workflows to `automation-specialist`
- Hand off API design to `api-specialist`
- Hand off security review to `security-specialist`

## Completion Criteria
- Integration is documented with contracts
- Retry and fallback patterns implemented
- Rate limits configured
- Tested in staging

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/integration-patterns.md`
