# BICCORP AI Delivery Workflow

## Operating model

```text
User / Product request
  -> ChatGPT: define the work
  -> Hermes: approve dependencies and release risk
  -> Codex: implement with tests
  -> GitHub: enforce review and audit trail
  -> Feedback loop to ChatGPT if CI/review fails
```

## Gate 1: Request intake

Before implementation starts, the request must have:

- request id
- goal
- scope and non-scope
- acceptance criteria
- architecture plan
- test plan
- dependency policy
- release risk
- rollback idea

Use `ai-workflow/templates/implementation-brief.md`.

## Gate 2: Dependency and release review

Hermes must review any change that touches:

- package manager files
- container images
- database migrations
- build system
- deployment configuration
- authentication or authorization
- external APIs
- high-risk runtime behavior

Use `ai-workflow/templates/hermes-dependency-review.md`.

## Gate 3: Implementation

Codex must:

- stay inside the approved scope
- not add dependencies without Hermes approval
- add or update tests with the code change
- run available validation commands
- document limitations honestly
- update memory vault when reusable knowledge changes

Use `ai-workflow/templates/codex-implementation-report.md`.

## Gate 4: PR audit

GitHub must require:

- PR template completed
- CI green
- relevant owner review
- no unresolved review comments
- dependency evidence if dependency files changed
- migration evidence if migrations changed
- rollback plan for medium/high risk changes

Use `ai-workflow/templates/github-audit-checklist.md`.

## Enforcement principle

Skills and prompts are guidance. GitHub checks and branch protection are enforcement. A production repo should use both.
