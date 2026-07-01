---
tags: [pattern, workflow]
related: "[[ai-delivery-pipeline]]"
---

# Pattern: Codex Control

Use this pattern to keep AI implementation small, testable, and auditable.

## Flow

1. Read implementation brief.
2. Identify tests first.
3. Confirm dependency constraints.
4. Make the smallest safe change.
5. Run validation.
6. Write implementation report.
7. Update memory vault if durable knowledge changed.

## Review prompts

- Does the change satisfy the request without unrelated edits?
- Are tests sufficient for the changed behavior?
- Is the dependency surface unchanged or approved?
- Is rollback clear?
- Is the memory vault update necessary and accurate?
