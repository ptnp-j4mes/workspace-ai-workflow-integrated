import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// Helper: check if user has admin:integrations permission
function hasIntegrationsPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

// GET /api/admin/smtp - List SMTP settings (mask passwords)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasIntegrationsPermission(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: admin:integrations permission required' }, { status: 403 })
    }

    const settings = await db.smtpSetting.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    // Mask passwords
    const masked = settings.map((s) => ({
      ...s,
      passwordEncrypted: '***',
    }))

    return NextResponse.json({ data: masked })
  } catch (error) {
    console.error('List SMTP settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/smtp - Create SMTP setting
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasIntegrationsPermission(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: admin:integrations permission required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, host, port, secure, username, passwordEncrypted, fromEmail, fromName, isDefault, isActive } = body

    if (!name || !host || !username || !fromEmail) {
      return NextResponse.json(
        { error: 'Name, host, username, and fromEmail are required' },
        { status: 400 }
      )
    }

    const smtpSetting = await db.smtpSetting.create({
      data: {
        name,
        host,
        port: port ?? 587,
        secure: secure ?? false,
        username,
        passwordEncrypted: passwordEncrypted ?? null,
        fromEmail,
        fromName: fromName ?? null,
        isDefault: isDefault ?? false,
        isActive: isActive ?? true,
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'CREATE_SMTP_SETTING',
      entity: 'SmtpSetting',
      entityId: smtpSetting.id,
      newValue: { name, host, port, fromEmail, passwordEncrypted: '***' },
    })

    return NextResponse.json(
      { data: { ...smtpSetting, passwordEncrypted: '***' } },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create SMTP setting error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
