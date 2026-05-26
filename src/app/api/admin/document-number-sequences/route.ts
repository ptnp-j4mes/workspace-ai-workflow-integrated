import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

function hasDocumentNumberPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

// GET /api/admin/document-number-sequences - List document number sequences
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasDocumentNumberPermission(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: admin:document_number permission required' }, { status: 403 })
    }

    const sequences = await db.documentNumberSequence.findMany({
      orderBy: { documentType: 'asc' },
    })

    return NextResponse.json({ data: sequences })
  } catch (error) {
    console.error('List document number sequences error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/document-number-sequences - Create new sequence
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasDocumentNumberPermission(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: admin:document_number permission required' }, { status: 403 })
    }

    const body = await request.json()
    const { documentType, prefix, year, paddingLength, formatTemplate, resetPolicy, isActive } = body

    if (!documentType || !prefix) {
      return NextResponse.json(
        { error: 'documentType and prefix are required' },
        { status: 400 }
      )
    }

    // Check for duplicate documentType
    const existing = await db.documentNumberSequence.findUnique({ where: { documentType } })
    if (existing) {
      return NextResponse.json({ error: 'Sequence for this document type already exists' }, { status: 400 })
    }

    const sequence = await db.documentNumberSequence.create({
      data: {
        documentType,
        prefix,
        year: year ?? new Date().getFullYear(),
        currentNumber: 0,
        paddingLength: paddingLength ?? 6,
        formatTemplate: formatTemplate ?? 'AIT-{PREFIX}-{YEAR}-{NUMBER}',
        resetPolicy: resetPolicy ?? 'YEARLY',
        isActive: isActive ?? true,
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'CREATE_DOCUMENT_NUMBER_SEQUENCE',
      entity: 'DocumentNumberSequence',
      entityId: sequence.id,
      newValue: { documentType, prefix, year: sequence.year },
    })

    return NextResponse.json({ data: sequence }, { status: 201 })
  } catch (error) {
    console.error('Create document number sequence error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
