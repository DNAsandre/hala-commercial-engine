Legacy Commercial Prototype Migrations
=====================================

Files in this folder are quarantined because they create or mutate obsolete
commercial prototype child tables that are no longer the Commercial OS source
of truth.

Do not run these migrations against Supabase.

Current doctrine:
- commercial_tickets is the unified intake and lineage parent.
- Child proposal, tender, renewal, SLA, pricing, approval, and document records
  must be rebuilt from verified lineage.
- Local scripts must not execute schema changes or inject operational records.
