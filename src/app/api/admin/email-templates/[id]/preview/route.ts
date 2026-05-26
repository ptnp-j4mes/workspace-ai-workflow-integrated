import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { renderTemplate } from '@/lib/services/smtp-service'

function hasIntegrationsPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

// POST /api/admin/email-templates/[id]/preview - Preview email template with variables
export async function POST(
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
    const { variables } = body as { variables?: Record<string, string> }

    const template = await db.emailTemplate.findUnique({ where: { id } })
    if (!template) {
      return NextResponse.json({ error: 'Email template not found' }, { status: 404 })
    }

    // If template has a key, use the renderTemplate service; otherwise manual substitution
    const vars = variables ?? {}

    const replaceVars = (str: string): string => {
      return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        if (vars[varName] !== undefined) {
          return vars[varName]
        }
        return match
      })
    }

    const preview = {
      subject: replaceVars(template.subjectTemplate),
      html: replaceVars(template.bodyHtmlTemplate),
      text: template.bodyTextTemplate ? replaceVars(template.bodyTextTemplate) : null,
      templateKey: template.templateKey,
      name: template.name,
    }

    return NextResponse.json({ data: preview })
  } catch (error) {
    console.error('Preview email template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
