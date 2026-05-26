import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// POST /api/requests/[id]/approve - Approve request (SUBMITTED → APPROVED)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { comment } = body

    const req = await db.request.findUnique({ where: { id } })
    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (req.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: `Cannot approve request with status ${req.status}. Must be in SUBMITTED status.` },
        { status: 400 }
      )
    }

    const updated = await db.request.update({
      where: { id },
      data: { status: 'APPROVED' },
    })

    // Create status history entry
    await db.requestStatusHistory.create({
      data: {
        requestId: id,
        fromStatus: 'SUBMITTED',
        toStatus: 'APPROVED',
        comment: comment || 'Request approved',
        changedById: user.id,
      },
    })

    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error('Approve request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
