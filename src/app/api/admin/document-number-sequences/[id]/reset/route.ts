import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

function hasDocumentNumberPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

// POST /api/admin/document-number-sequences/[id]/reset - Reset sequence running number
export async function POST(
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

    const existing = await db.documentNumberSequence.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Document number sequence not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const newNumber = body.newNumber ?? 0
    const newYear = body.newYear ?? new Date().getFullYear()

    const updated = await db.documentNumberSequence.update({
      where: { id },
      data: {
        currentNumber: newNumber,
        year: newYear,
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'RESET_DOCUMENT_NUMBER_SEQUENCE',
      entity: 'DocumentNumberSequence',
      entityId: id,
      oldValue: { documentType: existing.documentType, currentNumber: existing.currentNumber, year: existing.year },
      newValue: { documentType: updated.documentType, currentNumber: updated.currentNumber, year: updated.year },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Reset document number sequence error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
