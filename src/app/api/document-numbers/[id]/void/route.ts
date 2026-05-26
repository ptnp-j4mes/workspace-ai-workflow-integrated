import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { voidDocumentNo } from '@/lib/services/document-number-service'

// POST /api/document-numbers/[id]/void - Void a document number
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = authUser.roles.includes('ADMIN')
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can void document numbers' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { reason } = body

    if (!reason) {
      return NextResponse.json(
        { error: 'reason is required' },
        { status: 400 }
      )
    }

    // Find the document number by ID
    const docNumber = await db.documentNumber.findUnique({ where: { id } })
    if (!docNumber) {
      return NextResponse.json({ error: 'Document number not found' }, { status: 404 })
    }

    await voidDocumentNo(docNumber.documentNo, reason, authUser.id)

    return NextResponse.json({ data: { message: 'Document number voided successfully' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Void document number error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
