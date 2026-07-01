# AIT Platform Workspace

Enterprise AI workflow workspace built with Next.js App Router, React, Tailwind CSS, shadcn-style UI primitives, Prisma, and AI-assisted delivery tooling.

## Run with Docker

The recommended setup now uses PostgreSQL in Docker and runs the web app in a container:

```bash
docker compose up --build
```

Then open `http://localhost:3004`.

The web container seeds the database on startup, so the default admin account is ready immediately:

- `admin@enterprise.com`
- `admin123`

If you want to run without Docker, make sure `DATABASE_URL` points to a PostgreSQL instance first.

## Run locally

Install dependencies with the package manager used by your environment, then run:

```bash
npm run dev
```

The default dev script starts Next.js on port `3002` and binds to `0.0.0.0` for container compatibility.

## Validate

For AI delivery governance artifacts:

```bash
npm run workflow:validate
```

For application linting:

```bash
npm run lint
```

For production build validation:

```bash
npm run build
```

## Database commands

```bash
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:seed
```

## AI delivery workflow

The repository now includes a four-stage delivery workflow:

```text
ChatGPT -> Hermes Agent -> Codex -> GitHub
```

See `ai-workflow/README.md` for the full operating model, templates, gates, and PR audit flow.

## Project memory

Durable architecture decisions and reusable implementation patterns live in `memory-vault/`.

Use it for:

- Architecture decisions.
- Dependency/integration decisions.
- Module rules.
- API/RBAC/i18n patterns.
- Release lessons and rollback notes.

## Hygiene and packaging

Local/generated artifacts should not be committed or packaged:

- `.next/`
- `node_modules/`
- `.DS_Store`
- `__MACOSX/`
- `.env`
- `*.log`
- `*.pid`

Run:

```bash
npm run clean:local
```

before packaging a workspace snapshot.

## BICCORP Global AI Workflow

This workspace now includes the global BICCORP delivery governance overlay for use across projects.

Core files:

- `AGENTS.md` - repo-level instructions for AI agents and Codex.
- `BICCORP-AI-WORKFLOW.md` - global operating model for ChatGPT, Hermes, Codex, and GitHub.
- `ai-workflow/templates/` - reusable brief, Hermes review, Codex report, audit, post-mortem, and release-note templates.
- `ai-workflow/policies/` - Codex control, Hermes release, web-quality, and memory-vault policies.
- `.codex-plugin/plugin.json` - optional Codex plugin skeleton.
- `skills/biccorp-codex-control/SKILL.md` - skill instructions for consistent Codex control.

Run both workflow checks before opening a PR:

```bash
npm run workflow:validate
npm run biccorp:validate
```

For UI/web changes, attach accessibility, responsive behavior, and performance/Core Web Vitals review evidence to the PR.
