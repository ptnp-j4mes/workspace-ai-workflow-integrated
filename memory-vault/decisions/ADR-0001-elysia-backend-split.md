---
tags: [decision, architecture, backend]
status: Accepted
created: 2026-07-01
related: "[[nextjs-to-elysia-route-porting]]"
---

# ADR-0001: Split Backend into Standalone Elysia Service

## Status

Accepted

## Context

The app was a single Next.js codebase serving both UI (`src/app/**`) and API (`src/app/api/**`, 159 route files across 24 domains) from one process/origin. Growth needs made a case for separating frontend and backend into independently deployable services, and for a Bun-native backend framework (Elysia) instead of piggybacking on Next.js API routes.

## Decision

Restructure into a bun-workspaces monorepo:

- `apps/web` — Next.js app, UI only.
- `apps/api` — Elysia (latest) service, owns all API routes, the Prisma schema/client, JWT auth, and backend services (approval, notification, github sync, smtp, ai-service, etc).

Auth stayed Bearer-token JWT (already cross-origin-safe, no cookies) — see [[nextjs-to-elysia-route-porting]] for the mechanical route conversion applied to all 159 handlers.

Google OAuth redirect handling required splitting what was one `NEXT_PUBLIC_APP_URL` into two envs:

- `API_PUBLIC_URL` — this API's own base URL, used for the OAuth `redirect_uri` Google calls back to.
- `FRONTEND_URL` — the SPA's base URL, used for user-facing redirects (`/?error=...`, post-login success).

Conflating these after the origin split silently breaks Google login (the redirect lands on the wrong service).

## Consequences

- Frontend `api-client.ts` / `app-store.ts` now prefix requests with `NEXT_PUBLIC_API_URL` (empty string = same-origin, used when a reverse proxy like Caddy unifies both origins in prod).
- CORS is required between `apps/web` and `apps/api` in any deployment where they are not proxied to a single origin.
- `docker-compose.yml` gained a third service (`api`); Caddy gained a `/api/*` path-based route.
- Any new route now lives at `apps/api/src/routes/<domain>.ts` and must be mounted in `apps/api/src/index.ts` — there is no more `src/app/api`.
- `next-auth` dependency was dropped (present in the old `package.json` but unused — real auth was always custom JWT).
