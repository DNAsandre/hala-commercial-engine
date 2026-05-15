# API Governance Reference

## Source Documents Used
Documents 14, 36, 46-50, Document Ψ

## Key Rules
- API naming: /api/<domain>/<action>, functions: <product>-<domain>-<action>-v<version>
- All functions must define Request, Response, and Error types
- Auth validation mandatory on every endpoint
- Rate limiting: default 10 calls/min per agent, 100/hour, 500/day
- API interactions require: timeout (5s default), exponential backoff, max 3 retries, circuit breaker
- Versioning: patch (x.x.1), minor (x.1.0), major (1.0.0)
- No state-changing GET requests

## Forbidden Actions
- Bypassing auth validation
- Exposing service_role keys
- Returning raw database errors
- Creating unversioned endpoints
- Calling external APIs without timeout
