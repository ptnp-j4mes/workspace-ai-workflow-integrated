# Memory Vault

The Memory Vault stores durable project knowledge that should survive beyond a single chat, branch, or PR.

## What belongs here

- Architecture decisions.
- Reusable implementation patterns.
- Module boundaries and ownership notes.
- API, RBAC, i18n, and UI conventions.
- Release lessons learned.

## What does not belong here

- Raw logs that are already in CI or GitHub.
- Temporary todos.
- Personal notes.
- Duplicate Git history.
- Secrets or environment values.

## Structure

```text
memory-vault/
  decisions/   Architecture decision records
  patterns/    Reusable coding, testing, UI, and release patterns
  modules/     Long-lived notes per module/screen/service
  releases/    Release-specific lessons and rollback notes
```

## Update rule

Update the Memory Vault when a change introduces or changes:

- A cross-cutting architecture pattern.
- A dependency or integration decision.
- A public API contract.
- A Prisma model or migration convention.
- A reusable UI/theme pattern.
- A release or rollback lesson.
