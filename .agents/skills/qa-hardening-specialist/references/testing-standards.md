# Testing Standards Reference

## Source Documents Used
Documents 26, 31, 46-50

## Key Rules
- 4 test types: Unit, Integration, E2E, Regression
- Arrange → Act → Assert pattern for all tests
- Coverage: 80% services, 60% components, 100% auth/billing, 100% regression
- Test naming: <file>.test.js
- Test locations: /tests/unit/, /tests/integration/, /tests/e2e/, /tests/regression/
- Every bug fix must include regression test
- Tests run on every commit, blocked before deployment

## Forbidden Actions
- Deploying without passing tests
- Fixing bugs without regression tests
- Ignoring coverage requirements
- Using non-standard test naming
