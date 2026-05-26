# GitHub PR Audit Checklist

## Request ID

## Required evidence
- [ ] Implementation brief exists
- [ ] Hermes decision exists, or no dependency/release-sensitive change
- [ ] Codex implementation report exists
- [ ] Tests are listed with results
- [ ] Rollback plan exists for medium/high risk changes
- [ ] Memory vault update is present when needed

## Review quality
- [ ] Reviewer checked actual behavior, not only diff appearance
- [ ] Reviewer verified acceptance criteria
- [ ] Reviewer checked edge cases
- [ ] Reviewer checked failure/error states
- [ ] Reviewer checked migration/deployment risk if applicable

## Merge readiness
- [ ] CI passing
- [ ] Required approvals present
- [ ] No unresolved comments
- [ ] No unauthorized dependency change
- [ ] No secrets or local artifacts committed

## Verdict
- [ ] Merge
- [ ] Request changes
- [ ] Blocked

## Notes
