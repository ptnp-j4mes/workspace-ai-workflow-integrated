import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// POST /api/requests/[id]/assign-qa - Assign QA
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
    const { userId: qaUserId, comment } = body

    if (!qaUserId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const req = await db.request.findUnique({ where: { id } })
    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Verify the QA user exists
    const qaUser = await db.user.findUnique({ where: { id: qaUserId } })
    if (!qaUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Transition to QA if currently IN_DEVELOPMENT
    const newStatus = req.status === 'IN_DEVELOPMENT' ? 'QA' : req.status
    const updated = await db.request.update({
      where: { id },
      data: {
        assignedQAId: qaUserId,
        ...(req.status === 'IN_DEVELOPMENT' ? { status: 'QA' } : {}),
      },
      include: {
        assignedQA: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Create status history if status changed
    if (newStatus !== req.status) {
      await db.requestStatusHistory.create({
        data: {
          requestId: id,
          fromStatus: req.status,
          toStatus: newStatus,
          comment: comment || `QA assigned: ${qaUser.name}`,
          changedById: user.id,
        },
      })
    }

    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error('Assign QA error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
