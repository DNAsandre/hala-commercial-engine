# Security Checklist Reference

## Source Documents Used
Documents 14, 27, 31, 36, 46-50, Document Ω

## Key Rules
- RLS is the most sensitive part — always Level 5 Critical
- Auth tables and provider settings require Supabase AI lead
- No direct service_role key exposure
- All functions must check user authorization before acting
- Production is absolute protection zone
- Environment variables require purpose, usage, and file path documentation
- Forbidden: DROP TABLE, git push --force, supabase db reset without explicit authorization

## Required Behavior
- Audit RLS policies for all tables
- Verify auth token validation on all endpoints
- Check for secret exposure in code and logs
- Review production environment locks
- Block destructive actions proactively

## Forbidden Actions
- Approving unsafe RLS policies
- Ignoring exposed secrets
- Allowing destructive commands without explicit authorization
- Weakening production protections
