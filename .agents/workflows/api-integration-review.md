# Workflow: API Integration Review

## Purpose
Review external API integrations for security, rate limiting, cost, and contract compliance.

## When to Use
- Before connecting to a new external API
- Before modifying an existing integration
- When reviewing API costs or rate limits

## Required Input
- API documentation
- Integration requirements
- Current rate limit configuration

## Steps
1. Review API contracts using `api-specialist`
2. Validate auth and security with `security-specialist`
3. Check rate limits and cost implications with `integration-specialist`
4. Verify error handling and retry patterns
5. Assess data pipeline impact with `data-pipeline-specialist`
6. Produce integration review report

## Required Skills
`api-specialist`, `security-specialist`, `integration-specialist`, `data-pipeline-specialist`

## Output Artifact
API integration review report

## Safety Checks
- Auth validation enforced
- Rate limits configured
- Cost estimate provided
- Error handling comprehensive
- No secrets exposed

## Completion Criteria
- Integration contract is documented
- Security review passed
- Rate limits and costs assessed
- Error handling validated
