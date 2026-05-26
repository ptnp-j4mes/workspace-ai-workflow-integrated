import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

function hasIntegrationsPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

// PATCH /api/admin/smtp/[id] - Update SMTP setting
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasIntegrationsPermission(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: admin:integrations permission required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const existing = await db.smtpSetting.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'SMTP setting not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    const allowedFields = ['name', 'host', 'port', 'secure', 'username', 'passwordEncrypted', 'fromEmail', 'fromName', 'isDefault', 'isActive']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const updated = await db.smtpSetting.update({
      where: { id },
      data: updateData,
    })

    await logAudit({
      userId: authUser.id,
      action: 'UPDATE_SMTP_SETTING',
      entity: 'SmtpSetting',
      entityId: id,
      oldValue: { ...existing, passwordEncrypted: '***' },
      newValue: { ...updated, passwordEncrypted: '***' },
    })

    return NextResponse.json({ data: { ...updated, passwordEncrypted: '***' } })
  } catch (error) {
    console.error('Update SMTP setting error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
