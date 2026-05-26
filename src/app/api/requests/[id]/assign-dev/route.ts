import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// POST /api/requests/[id]/assign-dev - Assign Developer
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
    const { userId: devUserId, comment } = body

    if (!devUserId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const req = await db.request.findUnique({ where: { id } })
    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Verify the dev user exists
    const devUser = await db.user.findUnique({ where: { id: devUserId } })
    if (!devUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Transition to IN_DEVELOPMENT if currently ASSIGNED
    const newStatus = req.status === 'ASSIGNED' ? 'IN_DEVELOPMENT' : req.status
    const updated = await db.request.update({
      where: { id },
      data: {
        assignedDevId: devUserId,
        ...(req.status === 'ASSIGNED' ? { status: 'IN_DEVELOPMENT' } : {}),
      },
      include: {
        assignedDev: {
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
          comment: comment || `Developer assigned: ${devUser.name}`,
          changedById: user.id,
        },
      })
    }

    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error('Assign Dev error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
