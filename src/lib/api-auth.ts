import { verifyToken, type AccessTokenPayload } from './auth'

// ============================================================
// Auth Middleware Helper - Extract and verify user from request
// ============================================================

export async function getAuthUser(
  request: Request
): Promise<AccessTokenPayload | null> {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    const payload = await verifyToken<AccessTokenPayload>(token)

    if (!payload || payload.type !== 'access') {
      return null
    }

    return payload
  } catch {
    // Token is invalid, expired, or malformed
    return null
  }
}
