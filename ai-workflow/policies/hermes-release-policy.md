# Hermes Release Policy

Hermes is the release and dependency guard.

## Review required

Hermes approval is required when a change touches:

- package manager manifests or lockfiles
- CI/CD pipelines
- Dockerfiles or runtime images
- infrastructure or deployment config
- database migrations
- external integrations
- authentication, authorization, secrets, or permissions
- public API contracts

## Decision criteria

Hermes evaluates:

- necessity
- alternatives
- security risk
- license risk
- version pinning
- transitive dependency risk
- performance or bundle impact
- rollback path
- release timing

## Output

Hermes must record an explicit decision using `ai-workflow/templates/hermes-dependency-review.md`.
