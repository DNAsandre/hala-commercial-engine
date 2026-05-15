---
name: data-pipeline-specialist
description: "Use when designing data movement between Supabase, n8n, APIs, Edge Functions, and agents. Handles payload mapping, data transformation, loop prevention, and cost control for data flows. Do not use for UI work, isolated database schema, or deployment."
---

# Data Pipeline Specialist

## Purpose
Designs and manages data movement between Supabase, n8n, APIs, Edge Functions, and agents. Ensures safe, efficient, and cost-controlled data flows with proper payload mapping and loop prevention.

## Use This Skill When
- Designing data flows between Supabase and n8n
- Mapping data between n8n and Agent Builder
- Creating API payload transformations
- Preventing data flow loops and cascades
- Controlling costs in data movement pipelines

## Do Not Use This Skill When
- Building UI (use `frontend-ux-specialist`)
- Modifying database schema only (use `database-specialist`)
- Creating standalone automations (use `automation-specialist`)
- Building API endpoints only (use `api-specialist`)

## Source Doctrine References
Documents 22, 36-38, Document Ψ

## Operating Procedure
1. Map data sources and destinations
2. Define payload contracts between systems
3. Identify transformation requirements
4. Add loop prevention guards
5. Estimate costs and apply rate limits
6. Test data flow in staging

## Required Output Format
```
DATA FLOW:
- Source: <system> → Destination: <system>

PAYLOAD CONTRACT:
- Input: <structure>
- Output: <structure>

GUARDS:
- Loop prevention: <method>
- Rate limits: <limits>
- Cost estimate: <estimate>
```

## Safety Rules
- All data flows must have loop prevention
- Max 3 downstream workflow triggers per flow
- Max 20 events/hour unless approved
- Cost estimates required for expensive operations
- No circular dependencies between workflows

## Handoff Rules
- Hand off database schema to `database-specialist`
- Hand off API design to `api-specialist`
- Hand off automation workflows to `automation-specialist`
- Hand off integration work to `integration-specialist`

## Completion Criteria
- Data flows are mapped and documented
- Payload contracts are defined
- Loop prevention is in place
- Costs are estimated and within bounds

## Anti-Overlap Rule
If this task belongs more clearly to another skill, stop and route to that skill. Do not perform work outside this skill's domain. If the task needs multiple skills, produce a handoff plan instead of silently doing everything.

## Reference Files
- `references/data-flow-rules.md`
