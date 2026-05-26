import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { generateDocumentNo } from '@/lib/services/document-number-service'
import { logAudit } from '@/lib/services/audit-service'

// POST /api/requests/[id]/generate-document-no - Generate AIT Request No for a request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const req = await db.request.findUnique({ where: { id } })
    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (req.aitNo) {
      return NextResponse.json(
        { error: 'Request already has an AIT number', data: { aitNo: req.aitNo } },
        { status: 400 }
      )
    }

    const aitNo = await generateDocumentNo('REQUEST', 'Request', id, authUser.id)

    await db.request.update({
      where: { id },
      data: { aitNo },
    })

    await logAudit({
      userId: authUser.id,
      action: 'GENERATE_REQUEST_AIT_NO',
      entity: 'Request',
      entityId: id,
      aitNo,
      newValue: { aitNo },
    })

    return NextResponse.json({ data: { aitNo } }, { status: 201 })
  } catch (error) {
    console.error('Generate request document no error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
