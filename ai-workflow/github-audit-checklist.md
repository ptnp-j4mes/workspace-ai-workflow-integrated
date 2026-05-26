# GitHub Audit Checklist

Use this checklist during PR review.

## Request traceability

- [ ] PR title includes request ID.
- [ ] Implementation brief is linked or copied into the PR.
- [ ] Codex implementation report is linked or copied into the PR.
- [ ] Hermes review is attached if dependencies changed.

## Code review

- [ ] Change matches approved scope.
- [ ] No unrelated refactors.
- [ ] API/auth/RBAC changes are reviewed.
- [ ] UI states cover loading, empty, error, and permission cases.
- [ ] Thai and English copy stay synchronized.

## Test and validation

- [ ] Unit tests or equivalent validation evidence exist.
- [ ] Lint/type/build results are recorded.
- [ ] Manual QA evidence is attached for UI changes.

## Release safety

- [ ] Migration/data impact reviewed.
- [ ] Rollback plan is practical.
- [ ] New dependencies have Hermes approval.
- [ ] Secrets and environment variables are not committed.

## Audit result

- [ ] Approved to merge
- [ ] Changes requested
- [ ] Blocked
