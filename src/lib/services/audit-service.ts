// ============================================================
// Audit Service - Centralized Audit Logging
// ============================================================

import { db } from '@/lib/db'

// Fields that should be masked in audit logs
const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /apiKey/i,
  /api_key/i,
  /apiKeyEnc/i,
  /tokenEncrypted/i,
  /passwordEncrypted/i,
  /authorization/i,
  /bearer/i,
  /cookie/i,
]

interface AuditLogData {
  userId?: string
  action: string
  entity: string
  entityId?: string
  aitNo?: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  entityType?: string
  userAgent?: string
  ip?: string
}

/**
 * Mask sensitive values in an object before logging.
 * Replaces values of sensitive fields with '***'.
 */
function maskSensitiveValues(obj: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_FIELD_PATTERNS.some(pattern => pattern.test(key))
    if (isSensitive) {
      masked[key] = '***'
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      masked[key] = maskSensitiveValues(value as Record<string, unknown>)
    } else {
      masked[key] = value
    }
  }
  return masked
}

/**
 * Log an audit entry. Masks sensitive data (passwords, tokens, secrets) automatically.
 */
export async function logAudit(data: AuditLogData): Promise<void> {
  try {
    const oldValueStr = data.oldValue
      ? JSON.stringify(maskSensitiveValues(data.oldValue))
      : null

    const newValueStr = data.newValue
      ? JSON.stringify(maskSensitiveValues(data.newValue))
      : null

    await db.auditLog.create({
      data: {
        userId: data.userId ?? null,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId ?? null,
        aitNo: data.aitNo ?? null,
        oldValue: oldValueStr,
        newValue: newValueStr,
        entityType: data.entityType ?? null,
        userAgent: data.userAgent ?? null,
        ip: data.ip ?? null,
      },
    })
  } catch (error) {
    // Audit logging should never throw or break the calling function
    console.error('[AuditService] Failed to log audit entry:', error)
  }
}
