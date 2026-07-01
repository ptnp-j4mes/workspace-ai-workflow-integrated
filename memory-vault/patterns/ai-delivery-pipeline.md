---
tags: [pattern, workflow]
related: "[[ADR-0000-ai-delivery-workflow]]"
---

# Pattern: AI Delivery Pipeline

## Intent

Use the same delivery pipeline for feature work, bug fixes, migrations, and UI/theme changes.

## Flow

```text
Request intake
  -> ChatGPT implementation brief
  -> Hermes dependency/release review
  -> Codex implementation report
  -> GitHub PR and audit checklist
  -> Memory Vault update when durable knowledge changes
```

## Required request evidence

- Request ID.
- Acceptance criteria.
- File/API/data impact.
- Test plan.
- Dependency decision.
- Release risk and rollback plan.

## Handoff rule

Each layer must leave enough written evidence for the next layer to continue without guessing.
