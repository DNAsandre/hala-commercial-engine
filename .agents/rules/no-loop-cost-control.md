# No-Loop & Cost Control Rules

These rules prevent infinite loops, runaway costs, and unbounded execution.

## Recursive Agent Loop Prevention

- **Max 5 agent handoffs** per task
- **Max 3 retries** per agent per task
- **Max 1 escalation cycle** per task
- If any limit exceeded → system halts, returns loop alert, asks user for direction
- A loop is assumed if: same agent invoked twice with same context, task moves in a circle, task does not reduce complexity, or no agent produces new actionable output

## Automation Storm Prevention

- A workflow may trigger max **3 downstream workflows**
- Max **1 re-trigger per cycle**
- Max **20 events/hour** unless explicitly approved
- No circular n8n dependencies
- No webhook → webhook → webhook loops
- No cron jobs with less than 1 minute interval
- No automations that modify their own triggers
- No workflows that send unlimited emails

## Mandatory Safety Nodes for Workflows

Every n8n workflow requires: rate-limit node, log node, error boundary, fail-safe exit, and "dry run" mode for testing.

## API Rate Limits

- Default: **max 10 external API calls per minute** per agent
- Max **100 per hour**, max **500 per day** unless user explicitly raises limits
- Every API interaction must include: timeout (default 5s), exponential backoff, max 3 retries, circuit breaker, error logging

## Expensive Operations

Before performing bulk Stripe events, mass email sends, embeddings generation, vector database rebuild, or large Supabase scans, agents must:

1. Provide a cost estimate
2. Offer alternative (cheaper) approaches
3. Request user confirmation

## Token & Model Cost Governance

- Each agent gets a default token budget per task
- Prefer streaming over monolithic responses
- Prefer summaries over full raw outputs
- Use lower-cost models for routine tasks; higher-end models only when needed

## Data Scan Limits

- Max **100 rows** per query without confirmation
- Max **1MB** payload per request
- Bulk operations require: user confirmation, fail-safe checkpoints, chunking, progress reporting

## Runaway Cron Prevention

- No cron jobs with intervals under 1 minute
- All cron jobs must have a documented purpose and expected frequency
- Orphaned cron jobs must be identified and deactivated during reviews
