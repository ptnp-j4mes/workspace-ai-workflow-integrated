# BICCORP Global Agent Instructions

These instructions apply to AI coding agents working in this repository.

## Prime directive

Deliver the smallest safe change that satisfies the approved request. Preserve existing behavior unless the implementation brief explicitly says otherwise.

## Required workflow

1. Read `BICCORP-AI-WORKFLOW.md`.
2. Locate the current request brief under `ai-workflow/briefs/` or ask for one if absent.
3. Check whether Hermes approval is required before touching dependency, deployment, migration, or security-sensitive files.
4. Implement only the approved scope.
5. Add or update tests with the change.
6. Run available validation commands.
7. Update memory vault when architectural decisions, reusable patterns, or root-cause learnings change.
8. Produce a Codex implementation report before opening a PR.

## Hard rules

- Do not add dependencies without a Hermes decision.
- Do not remove tests to make CI pass.
- Do not broaden scope without documenting the reason and getting approval.
- Do not rewrite unrelated code for style preference.
- Do not invent product requirements.
- Do not mark work complete until validation evidence is recorded.

## Bug-fix discipline

For bugs, use this order:

```text
reproduce -> trace failing path -> falsify hypotheses -> patch -> validate -> post-mortem if needed
```

Never patch a production bug before a reliable repro or a clear failure path exists, unless it is an emergency mitigation documented as such.

## UI/web quality discipline

For UI or web changes, check:

- accessibility
- keyboard navigation
- loading and error states
- responsive behavior
- Core Web Vitals risk
- SEO/meta impact for public pages
- console cleanliness
- bundle/performance impact

## PR discipline

Every PR must contain:

- implementation summary
- request id
- acceptance criteria evidence
- tests run
- dependency decision
- risk and rollback plan
- screenshots or traces when useful
- memory-vault update note
