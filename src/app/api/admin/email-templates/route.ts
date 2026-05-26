import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

function hasIntegrationsPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

// GET /api/admin/email-templates - List email templates
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')
    const category = searchParams.get('category') || undefined

    const where: Record<string, unknown> = {}
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }
    if (category) {
      where.templateKey = { contains: category }
    }

    const templates = await db.emailTemplate.findMany({
      where,
      orderBy: { templateKey: 'asc' },
    })

    return NextResponse.json({ data: templates })
  } catch (error) {
    console.error('List email templates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/email-templates - Create email template
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
    const { templateKey, name, subjectTemplate, bodyHtmlTemplate, bodyTextTemplate, variablesJson, isActive } = body

    if (!templateKey || !name || !subjectTemplate || !bodyHtmlTemplate) {
      return NextResponse.json(
        { error: 'templateKey, name, subjectTemplate, and bodyHtmlTemplate are required' },
        { status: 400 }
      )
    }

    // Check for duplicate key
    const existing = await db.emailTemplate.findUnique({ where: { templateKey } })
    if (existing) {
      return NextResponse.json({ error: 'Template key already exists' }, { status: 400 })
    }

    const template = await db.emailTemplate.create({
      data: {
        templateKey,
        name,
        subjectTemplate,
        bodyHtmlTemplate,
        bodyTextTemplate: bodyTextTemplate ?? null,
        variablesJson: variablesJson ?? null,
        isActive: isActive ?? true,
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'CREATE_EMAIL_TEMPLATE',
      entity: 'EmailTemplate',
      entityId: template.id,
      newValue: { templateKey, name },
    })

    return NextResponse.json({ data: template }, { status: 201 })
  } catch (error) {
    console.error('Create email template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
