# ADR-0000: BICCORP AI Delivery Workflow

## Status
Accepted

## Context

BICCORP projects use AI agents for planning, implementation, testing, and review. Without a consistent workflow, agents can over-expand scope, add dependencies without review, skip tests, or leave weak audit trails.

## Decision

Adopt a four-layer workflow:

```text
ChatGPT -> Hermes Agent -> Codex -> GitHub
```

- ChatGPT owns request shaping and implementation briefs.
- Hermes owns dependency, release, and rollback decisions.
- Codex owns scoped implementation and validation evidence.
- GitHub owns PR review, CI, audit, and merge enforcement.

## Consequences

- Every project has common templates and governance files.
- AI work becomes reviewable and auditable.
- Dependency/release risk is surfaced earlier.
- Teams must maintain project-specific CODEOWNERS and branch protection.
