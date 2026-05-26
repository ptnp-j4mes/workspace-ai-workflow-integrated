# Implementation Brief

## Request ID

`REQ-YYYY-MM-DD-001`

## Request type

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Migration
- [ ] UI/theme change
- [ ] Release/support task

## Goal

Describe the outcome in business/user terms.

## Background

Explain the current behavior, related screens, services, models, or previous decisions.

## Scope

### In scope

- ...

### Out of scope

- ...

## Acceptance criteria

- [ ] ...
- [ ] ...

## Architecture plan

### Files expected to change

- `src/...`

### API impact

- New routes:
- Modified routes:
- Auth/RBAC requirements:

### Data impact

- Prisma schema changes:
- Migration/data backfill:
- Seed updates:

### UI/theme rules

- Use existing workspace shell patterns.
- Use existing shadcn-style UI components where possible.
- Keep Thai/English translation keys synchronized.
- Add loading, empty, error, and permission-denied states where applicable.

## Unit test plan

### Required cases

- [ ] Happy path
- [ ] Validation error
- [ ] Permission/RBAC case
- [ ] Empty state
- [ ] Failure state

### Mock data

Describe fixtures, mock users, permissions, request IDs, and API responses.

## Dependency policy

- [ ] No dependency changes expected.
- [ ] Dependency change required; Hermes review attached.

## Release risk

- [ ] Low
- [ ] Medium
- [ ] High

## Rollback plan

Describe how to revert code, config, data, or dependency changes.

## Handoff

- ChatGPT owner:
- Hermes reviewer:
- Codex implementer:
- GitHub reviewer:
