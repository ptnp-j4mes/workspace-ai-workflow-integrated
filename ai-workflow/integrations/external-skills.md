# External Skill Integrations

This workflow is designed to be used with external skill repositories without vendoring them into every project.

## Web quality skills

Recommended source: `addyosmani/web-quality-skills`

Use for:

- web quality audit
- performance review
- Core Web Vitals review
- accessibility review
- SEO review
- best-practices/security review

Recommended invocation examples:

```text
@web-quality-audit review this PR for web quality risks
@performance check bundle/runtime risks
@accessibility review keyboard and screen-reader behavior
@core-web-vitals check LCP/INP/CLS risk
@seo review public page metadata and crawlability
@best-practices check security and browser API risks
```

## Engineering discipline skills

Recommended source: `thananon/9arm-skills`

Use for:

- debug-mantra style bug fixing
- scrutinize style PR/plan review
- post-mortem records after validated fixes

Recommended invocation examples:

```text
Apply debug-mantra before proposing a fix.
Scrutinize this PR end-to-end before merge.
Write a post-mortem only after repro, cause, fix, and validation are known.
```

## BICCORP rule

External skills provide reasoning discipline. BICCORP workflow files provide project governance. GitHub checks provide enforcement.
