---
tags: [pattern, backend, migration]
created: 2026-07-01
related: "[[ADR-0001-elysia-backend-split]]"
---

# Pattern: Next.js API Route → Elysia Route Port

Mechanical conversion used to port all 159 Next.js `route.ts` handlers to Elysia without changing behavior (see [[ADR-0001-elysia-backend-split]]). Reuse this whenever porting more Next.js API code, or writing new Elysia routes that need to match the existing house style.

## Grouping

One Elysia route module per top-level API domain (e.g. `work-items.ts`, `admin.ts`), not one file per handler. Each exports `new Elysia({ prefix: '/api/<domain>' })` chained with `.get/.post/.patch/.put/.delete(path, handler)`.

## Path mapping

- Strip the domain dir and trailing `/route.ts`.
- Next.js `[id]` folder segments → Elysia `:id`.
- Root `route.ts` → path `'/'`.
- Example: `work-items/[id]/accept/route.ts` → `.post('/:id/accept', handler)`.

## Request/response, before → after

| Next.js | Elysia |
|---|---|
| `NextRequest`/`NextResponse` import | not needed — Elysia's `request` context field is a real Fetch `Request` |
| `getAuthUser(request)` | unchanged, verbatim — takes a raw `Request` |
| `await request.json()` | unchanged, verbatim |
| `new URL(request.url).searchParams` | unchanged, verbatim |
| `{ params }: { params: Promise<{id}> }` + `await params` | `params` is sync: `const { id } = params` |
| `NextResponse.json(data)` | `return data` |
| `NextResponse.json(data, { status: N })` | `set.status = N; return data` |
| `NextResponse.redirect(url)` | `Response.redirect(url, 307)` — raw `Response` returns work directly |

## Gotcha: redirect base URLs after an origin split

Any `new URL(path, req.url)` or `${NEXT_PUBLIC_APP_URL}/...` used to build a redirect assumed frontend and backend shared an origin. After splitting, classify every redirect:

- Redirect meant to land the user back in the browser SPA → use the frontend's own base URL env var.
- Redirect that must point back at this API itself (e.g. an OAuth `redirect_uri`) → use this API's own public base URL env var.

See [[ADR-0001-elysia-backend-split]] for the concrete `API_PUBLIC_URL` / `FRONTEND_URL` split.

## Verification

Boot the Elysia app standalone and hit `/api/health`, then a handful of representative endpoints unauthenticated (expect `401 {"error":"Unauthorized"}` from `getAuthUser`, not a crash) before wiring the frontend.
