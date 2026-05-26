# ADR-0000: Adopt AI Delivery Workflow

## Status

Accepted

## Context

The workspace already includes AI intake, request, GitHub, admin, and memory-vault concepts. To make AI-assisted delivery safer and more repeatable, planning, dependency control, implementation, and audit should be separated into clear layers.

## Decision

Adopt this delivery chain:

```text
ChatGPT -> Hermes Agent -> Codex -> GitHub
```

- ChatGPT owns request analysis, architecture, test planning, and theme direction.
- Hermes Agent owns dependency approval, release risk, versioning, and rollback strategy.
- Codex owns implementation, unit tests, validation, and Memory Vault updates.
- GitHub owns PR review, CI checks, CODEOWNERS, and audit evidence.

## Consequences

- PRs must include traceability to a request ID.
- Dependency changes require explicit Hermes review.
- Architecture or reusable pattern changes require Memory Vault updates.
- Reviewers can audit why a change exists, what was tested, and how to roll it back.
