---
tags: [pattern, testing, release]
related: "[[ai-delivery-pipeline]]"
---

# Pattern: Testing and Release Gates

## Minimum validation by change type

### Feature
- Unit tests for new behavior
- Integration or component tests when boundary behavior changes
- Typecheck/lint/build when available

### Bug fix
- Reproduction test or documented repro
- Regression test when feasible
- Validation evidence after fix

### Refactor
- Existing tests pass
- No behavior change unless stated
- Risk notes for touched boundaries

### Migration
- Forward migration
- Rollback or mitigation plan
- Data safety notes

### UI/web
- Accessibility review
- Responsive review
- Screenshot or recording
- Performance/Core Web Vitals risk notes
