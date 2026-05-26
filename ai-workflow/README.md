# AI Delivery Workflow

This workspace uses a four-stage delivery workflow:

```text
ChatGPT -> Hermes Agent -> Codex -> GitHub
```

The goal is to keep planning, dependency governance, implementation, testing, and audit evidence separated while still moving quickly.

## Layer responsibilities

| Layer | Owns | Main artifacts |
| --- | --- | --- |
| ChatGPT | Request analysis, architecture, unit test plan, UI/theme direction | `ai-workflow/brief-template.md`, request brief |
| Hermes Agent | Dependency review, release risk, version policy, rollback plan | `ai-workflow/hermes-dependency-review.md` |
| Codex | Code implementation, unit tests, validation, memory-vault updates | `ai-workflow/codex-implementation-report.md` |
| GitHub | PR review, CI checks, CODEOWNERS, audit trail, merge control | `.github/pull_request_template.md`, `.github/workflows/ai-delivery-check.yml` |

## Request ID convention

Use a single request ID across every artifact:

```text
REQ-YYYY-MM-DD-001
```

Recommended mapping:

```text
ai-workflow/requests/REQ-YYYY-MM-DD-001.md
memory-vault/decisions/ADR-REQ-YYYY-MM-DD-001.md
branch: feat/REQ-YYYY-MM-DD-001-short-name
PR title: [REQ-YYYY-MM-DD-001] Short feature title
```

## Required gates

### Gate 1: Ready for Codex

A request is ready for implementation only when it has:

- Clear goal and scope.
- Acceptance criteria.
- Architecture/file impact plan.
- Unit test plan.
- UI/theme rules if the change touches screens.
- Hermes dependency decision if dependencies may change.
- Rollback notes for medium/high-risk changes.

### Gate 2: Ready for PR

A Codex implementation is ready for GitHub only when it has:

- Code completed within approved scope.
- Unit tests added or updated where practical.
- Validation evidence recorded.
- No unapproved dependency changes.
- Memory Vault update if architecture, API contracts, or reusable patterns changed.

### Gate 3: Ready to merge

A PR is ready to merge only when it has:

- Passing CI or documented local validation.
- Reviewer approval.
- No unresolved review comments.
- Dependency approval if package files changed.
- Migration and rollback notes if database or release behavior changed.

## Theme and workspace rules

- Preserve the current Next.js App Router shell and dynamic page loading model.
- Keep shell navigation, auth restoration, i18n, notification toaster, and page components loosely coupled.
- Prefer existing shadcn-style primitives in `src/components/ui`.
- Keep Thai and English labels aligned in `src/i18n/translations`.
- For frontend changes, update screenshots or evidence in the PR when practical.

## Validation

Run:

```bash
npm run workflow:validate
npm run lint
```

If dependencies are unavailable, run `npm run workflow:validate` and document that full framework validation was not executed.
