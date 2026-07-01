import { describe, test, expect } from 'bun:test'
import { app } from '../src/app'

// Targeted regression test for the riskiest hand-edited part of the
// migration: before the split, OAuth redirects resolved against req.url
// (same-origin trick) or NEXT_PUBLIC_APP_URL. After splitting into
// apps/web + apps/api, those had to be reclassified into two separate env
// vars — get either one wrong and Google login silently breaks:
//   - API_PUBLIC_URL: this API's own base URL, used only for the OAuth
//     redirect_uri Google calls back to.
//   - FRONTEND_URL: the SPA's base URL, used for every user-facing redirect
//     (`/?error=...`, post-login success).
// See memory-vault/decisions/ADR-0001-elysia-backend-split.md.

const API_PUBLIC_URL = process.env.API_PUBLIC_URL ?? 'http://localhost:3011'
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3002'

describe('migration: google oauth redirect classification', () => {
  test('GET /api/auth/google/login redirects to this API (demo mode, no Google creds)', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/auth/google/login', { method: 'GET' })
    )
    expect([301, 302, 307, 308]).toContain(res.status)
    const location = res.headers.get('location') ?? ''
    expect(location.startsWith(API_PUBLIC_URL)).toBe(true)
    expect(location.startsWith(FRONTEND_URL)).toBe(false)
  })

  test('GET /api/auth/google/callback-login without a code redirects to the frontend error page', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/auth/google/callback-login', {
        method: 'GET',
      })
    )
    expect([301, 302, 307, 308]).toContain(res.status)
    const location = res.headers.get('location') ?? ''
    expect(location.startsWith(FRONTEND_URL)).toBe(true)
    expect(location).toContain('error=')
  })

  test('GET /api/auth/google/callback without params redirects to the frontend error page', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/auth/google/callback', { method: 'GET' })
    )
    expect([301, 302, 307, 308]).toContain(res.status)
    const location = res.headers.get('location') ?? ''
    expect(location.startsWith(FRONTEND_URL)).toBe(true)
  })
})
