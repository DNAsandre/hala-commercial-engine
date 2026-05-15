# Data Flow Rules Reference

## Source Documents Used
Documents 22, 36-38, Document Ψ

## Key Rules
- Data flows between: Supabase ↔ n8n ↔ Agent Builder ↔ APIs ↔ Edge Functions
- Max 3 downstream workflow triggers
- Max 1 re-trigger per cycle, max 20 events/hour unless approved
- No circular webhook or workflow dependencies
- Cost estimates required for bulk operations
- All flows need rate-limit nodes, log nodes, error boundaries, fail-safe exits

## Forbidden Actions
- Creating circular data flow dependencies
- Running unlimited API calls without rate limiting
- Ignoring cost implications of bulk operations
- Creating self-triggering workflows
