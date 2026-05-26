import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { generateDocumentNo } from '@/lib/services/document-number-service'

// POST /api/document-numbers/generate - Generate a document number
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { documentType, entityType, entityId } = body

    if (!documentType) {
      return NextResponse.json(
        { error: 'documentType is required' },
        { status: 400 }
      )
    }

    const validTypes = ['REQUEST', 'PROJECT', 'MIT', 'UAT', 'BUG', 'CHANGE', 'APPROVAL', 'MA']
    if (!validTypes.includes(documentType)) {
      return NextResponse.json(
        { error: `Invalid documentType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const documentNo = await generateDocumentNo(
      documentType,
      entityType,
      entityId,
      authUser.id
    )

    return NextResponse.json({ data: { documentNo } }, { status: 201 })
  } catch (error) {
    console.error('Generate document number error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
