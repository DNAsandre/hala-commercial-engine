# Migration Safety Reference

## Source Documents Used
Documents 14, 26, 27, 36-38, Document Ω

## Key Rules
- 7 migration safety principles: reversible, no blind destruction, forward-compatible, pre-check required, staged, RLS reviewed, documented
- 3-Stage Migration Model: Add New Structure → Backfill Data → Swap Code + Remove Legacy
- Migration risk levels: L1 Cosmetic, L2 Non-impactful, L3 Structural Safe, L4 Structural Risky, L5 Critical
- Zero-downtime rules: never drop+add in same migration, use shadow columns, create new typed columns
- RLS changes are always Level 5 Critical
- After migrations: regenerate types with `supabase gen types typescript`

## Forbidden Actions
- Dropping tables without staged migration
- Changing RLS without explicit approval
- Irreversible migrations
- Direct column renames (use shadow columns)
- Multiple destructive steps in single migration
- Deploying migrations without testing in staging
