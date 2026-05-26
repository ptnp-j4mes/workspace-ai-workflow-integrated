import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { getDocumentByNo } from '@/lib/services/document-number-service'

// GET /api/document-numbers/[id] - Get document number details
// The [id] param can be either a document number string or a CUID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Try to find by documentNo first
    let docNumber = await getDocumentByNo(id)

    // If not found by documentNo, try by ID (CUID)
    if (!docNumber) {
      docNumber = await db.documentNumber.findUnique({
        where: { id },
        include: {
          generator: { select: { id: true, name: true, email: true } },
          voidedBy: { select: { id: true, name: true, email: true } },
        },
      })
    }

    if (!docNumber) {
      return NextResponse.json({ error: 'Document number not found' }, { status: 404 })
    }

    return NextResponse.json({ data: docNumber })
  } catch (error) {
    console.error('Get document number error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
