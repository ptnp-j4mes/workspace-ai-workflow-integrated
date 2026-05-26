import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// POST /api/requests/[id]/assign-ba - Assign BA (APPROVED → ASSIGNED)
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
    const { userId: baUserId, comment } = body

    if (!baUserId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const req = await db.request.findUnique({ where: { id } })
    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Verify the BA user exists
    const baUser = await db.user.findUnique({ where: { id: baUserId } })
    if (!baUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const newStatus = req.status === 'APPROVED' ? 'ASSIGNED' : req.status
    const updated = await db.request.update({
      where: { id },
      data: {
        assignedBAId: baUserId,
        ...(req.status === 'APPROVED' ? { status: 'ASSIGNED' } : {}),
      },
      include: {
        assignedBA: {
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
          comment: comment || `BA assigned: ${baUser.name}`,
          changedById: user.id,
        },
      })
    }

    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error('Assign BA error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
