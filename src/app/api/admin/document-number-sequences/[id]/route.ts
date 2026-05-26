import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

function hasDocumentNumberPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

// PATCH /api/admin/document-number-sequences/[id] - Update sequence
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasDocumentNumberPermission(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: admin:document_number permission required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const existing = await db.documentNumberSequence.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Document number sequence not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    const allowedFields = ['prefix', 'year', 'paddingLength', 'formatTemplate', 'resetPolicy', 'isActive']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const updated = await db.documentNumberSequence.update({
      where: { id },
      data: updateData,
    })

    await logAudit({
      userId: authUser.id,
      action: 'UPDATE_DOCUMENT_NUMBER_SEQUENCE',
      entity: 'DocumentNumberSequence',
      entityId: id,
      oldValue: { documentType: existing.documentType, prefix: existing.prefix, year: existing.year },
      newValue: { documentType: updated.documentType, prefix: updated.prefix, year: updated.year },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Update document number sequence error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
