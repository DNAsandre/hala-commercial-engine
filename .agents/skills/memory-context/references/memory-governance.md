# Memory Governance Reference

## Source Documents Used
Documents 32, 38, Usage Manual

## Key Rules
- 3 Memory Tiers: Immediate (session), Short-Term (project docs), Long-Term (canon folder)
- Memory comes ONLY from documents, not conversation history
- No assumed memory, no hallucinated memory
- User is single source of truth
- Context window is finite — compress and summarize
- 4 types of AI memory: Ephemeral, Project, System, Agent-specific
- Knowledge classification: fact, decision, architecture-principle, user-preference, dependency-rule, workflow-step, error-solution, design-pattern, system-warning

## Forbidden Actions
- Hallucinating memory not in documents
- Storing personal details not in documents
- Inventing or altering rules
- Cross-agent memory leakage
- Storing code in knowledge tables
- Writing speculative assumptions as facts
