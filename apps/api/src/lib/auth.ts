import { SignJWT, jwtVerify } from 'jose'

// ============================================================
// JWT & Password Auth Library
// ============================================================

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'enterprise-ai-workflow-secret-key-2024'
)

const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY = '7d'

// ============================================================
// Password Hashing (Web Crypto API - SHA-256 + salt)
// ============================================================

function generateSalt(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function hashWithSalt(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt()
  const hash = await hashWithSalt(password, salt)
  return `${salt}:${hash}`
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false
  const computedHash = await hashWithSalt(password, salt)
  return computedHash === hash
}

// ============================================================
// JWT Token Types
// ============================================================

export interface AccessTokenPayload {
  id: string
  email: string
  roles: string[]
  type: 'access'
}

export interface RefreshTokenPayload {
  id: string
  email: string
  type: 'refresh'
}

// ============================================================
// JWT Token Generation & Verification
// ============================================================

export async function generateAccessToken(
  payload: Omit<AccessTokenPayload, 'type'>
): Promise<string> {
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuer('enterprise-ai-workflow')
    .setSubject(payload.id)
    .sign(JWT_SECRET)
}

export async function generateRefreshToken(
  payload: Omit<RefreshTokenPayload, 'type'>
): Promise<string> {
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setIssuer('enterprise-ai-workflow')
    .setSubject(payload.id)
    .sign(JWT_SECRET)
}

export async function verifyToken<T = AccessTokenPayload | RefreshTokenPayload>(
  token: string
): Promise<T> {
  const { payload } = await jwtVerify(token, JWT_SECRET, {
    issuer: 'enterprise-ai-workflow',
  })
  return payload as unknown as T
}
