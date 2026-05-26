import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

function hasIntegrationsPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

// PATCH /api/admin/email-templates/[id] - Update email template
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

    const existing = await db.emailTemplate.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Email template not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    const allowedFields = ['name', 'subjectTemplate', 'bodyHtmlTemplate', 'bodyTextTemplate', 'variablesJson', 'isActive']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const updated = await db.emailTemplate.update({
      where: { id },
      data: updateData,
    })

    await logAudit({
      userId: authUser.id,
      action: 'UPDATE_EMAIL_TEMPLATE',
      entity: 'EmailTemplate',
      entityId: id,
      oldValue: { name: existing.name, templateKey: existing.templateKey },
      newValue: { name: updated.name, templateKey: updated.templateKey },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Update email template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
