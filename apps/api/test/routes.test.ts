import { describe, test, expect } from 'bun:test'
import { app } from '../src/app'

// Migration smoke test: every ported Next.js route.ts handler must still exist
// at the same path/method after the Elysia port, and must still hit the
// getAuthUser() guard before any other logic (matching the pre-migration
// behavior). This does NOT re-test business logic (copied verbatim from
// Next.js) — it only catches porting mistakes: wrong path, wrong method,
// missing route, or auth check dropped/reordered.

// Routes that intentionally skip the getAuthUser() guard (OAuth entrypoints —
// they redirect instead of returning JSON, by design, both before and after
// the migration).
const REDIRECT_ROUTES = new Set([
  'GET /api/auth/google/login',
  'GET /api/auth/google/callback',
  'GET /api/auth/google/callback-login',
])

// Routes that intentionally skip the getAuthUser() guard because they ARE
// the auth entrypoints — they parse a JSON body first (email/password or a
// refresh token), not an Authorization header. Sending no body makes
// request.json() throw, which their own try/catch turns into a 500 — this
// is pre-existing behavior (identical in the original Next.js handlers),
// not a porting bug, so these get their own parity check below instead of
// the generic 401 sweep.
const BODY_FIRST_ROUTES = new Set([
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'POST /api/auth/refresh',
])

function fillParams(path: string): string {
  return path.replace(/:([a-zA-Z0-9_]+)/g, 'test-id')
}

const candidates = app.routes.filter(
  (r) =>
    r.method !== 'OPTIONS' &&
    r.path !== '/api/health' &&
    !BODY_FIRST_ROUTES.has(`${r.method} ${r.path}`)
)

describe('migration: route completeness + auth guard', () => {
  test('at least 200 non-health routes are registered', () => {
    expect(candidates.length).toBeGreaterThanOrEqual(200)
  })

  for (const route of candidates) {
    const key = `${route.method} ${route.path}`
    test(key, async () => {
      const url = 'http://localhost' + fillParams(route.path)
      const res = await app.handle(new Request(url, { method: route.method }))

      // A 404 here means the path was mis-mapped during the port
      // (e.g. wrong :param name, missing segment, wrong prefix).
      expect(res.status).not.toBe(404)
      // A 500 here (with no auth header, no body) means something threw
      // before the auth guard could run — almost always a porting bug
      // (e.g. destructuring params before checking auth, or a syntax slip).
      expect(res.status).not.toBe(500)

      if (REDIRECT_ROUTES.has(key)) {
        expect([301, 302, 307, 308]).toContain(res.status)
      } else {
        expect(res.status).toBe(401)
        const body = await res.json()
        expect(body).toEqual({ error: 'Unauthorized' })
      }
    })
  }
})

describe('migration: body-first auth endpoints (no getAuthUser guard, by design)', () => {
  for (const key of BODY_FIRST_ROUTES) {
    const [method, path] = key.split(' ')

    test(`${key} with no body returns a graceful 500 (pre-existing behavior, not a guard regression)`, async () => {
      const res = await app.handle(new Request('http://localhost' + path, { method }))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body).toEqual({ error: 'Internal server error' })
    })

    test(`${key} with a JSON body does not 404/500`, async () => {
      const res = await app.handle(
        new Request('http://localhost' + path, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'nobody@example.com', password: 'x', refreshToken: 'x' }),
        })
      )
      expect(res.status).not.toBe(404)
      expect(res.status).not.toBe(500)
    })
  }
})
