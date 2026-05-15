# Integration Patterns Reference

## Source Documents Used
Documents 5, 21-22, 36-38, Document Ψ

## Key Rules
- External API safety: timeout (5s), backoff, max 3 retries, circuit breaker
- Rate limits: 10/min, 100/hour, 500/day per agent
- All integrations must have documented contracts
- Handoff patterns must be explicit between tools
- Cost estimates required for expensive external operations

## Forbidden Actions
- Calling external APIs without timeout or error handling
- Exposing API keys or secrets
- Creating unbounded retry loops
- Ignoring rate limits
