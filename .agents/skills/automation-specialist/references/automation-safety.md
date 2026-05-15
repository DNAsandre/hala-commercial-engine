# Automation Safety Reference

## Source Documents Used
Documents 22, 37, Document Ψ, Documents 46-50

## Key Rules
- Every workflow needs: rate-limit node, log node, error boundary, fail-safe exit, dry-run mode
- No self-triggering workflows, no circular webhooks
- Cron jobs minimum 1 minute interval
- Max 3 downstream workflows, max 1 re-trigger/cycle, max 20 events/hour
- n8n builds workflows only after database + code are stable

## Forbidden Actions
- Creating circular n8n dependencies
- Webhooks triggering themselves
- Cron jobs under 1 minute interval
- Automations modifying their own triggers
- Unlimited email sends
- Workflows without safety nodes
