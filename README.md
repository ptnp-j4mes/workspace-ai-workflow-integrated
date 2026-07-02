# AIT Platform Workspace

Enterprise AI workflow workspace: a bun-workspaces monorepo with `apps/web` (Next.js App Router, React, Tailwind CSS, shadcn-style UI primitives) and `apps/api` (Elysia/Bun backend, Prisma), plus AI-assisted delivery tooling.

## Run with Docker

The recommended setup runs Postgres, the API, and the web app as three containers:

```bash
docker compose up --build
```

Then open `http://localhost:3004`. The API is reachable directly on `http://localhost:3011`.

The api container seeds the database on startup, so the default admin account is ready immediately:

- `admin@enterprise.com`
- `admin123`

## Run locally (without Docker)

1. Copy the env templates and fill in `DATABASE_URL` (point it at a running PostgreSQL instance):
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```
2. Install dependencies (bun workspaces):
   ```bash
   bun install
   ```
3. Push the schema and seed the database:
   ```bash
   bun run --cwd apps/api db:push
   bun run --cwd apps/api db:seed
   ```
4. Start both apps:
   ```bash
   npm run dev
   ```

This starts the Elysia API on `http://localhost:3011` and Next.js on `http://localhost:3002`. Without `apps/web/.env` set, `NEXT_PUBLIC_API_URL` is empty and every frontend API call 404s — the `.env` file in step 1 is required, not optional, for this path.

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

Run from `apps/api` (or prefix with `bun run --cwd apps/api`):

```bash
bun run db:generate
bun run db:push
bun run db:migrate
bun run db:seed
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
