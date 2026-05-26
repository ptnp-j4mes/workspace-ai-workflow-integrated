# Codex Control Policy

## Before coding

Codex must read the implementation brief and identify:

- acceptance criteria
- files likely to change
- tests to add/update
- dependency restrictions
- release risk
- UI/theme rules if relevant

## During coding

Codex must:

- prefer small, reviewable changes
- avoid unrelated rewrites
- add or update tests with behavior changes
- document assumptions in the implementation report
- stop and request Hermes review before dependency changes

## Before PR

Codex must run available checks and complete:

- implementation report
- test evidence
- memory vault update if relevant
- web quality review for UI/web work
- post-mortem for significant bug fixes

## Red flags

A change should be blocked or escalated if it:

- changes auth/security behavior without review
- changes database schema without migration/rollback plan
- adds dependency without approval
- removes tests or weakens validation
- introduces local/generated artifacts
- broadens scope beyond the brief
