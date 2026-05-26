import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// POST /api/work-items/[id]/accept - Accept work item assignment
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

    const workItem = await db.workItem.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { userId: user.id, isActive: true },
        },
      },
    })

    if (!workItem) {
      return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
    }

    if (workItem.assignments.length === 0) {
      return NextResponse.json(
        { error: 'You are not assigned to this work item' },
        { status: 403 }
      )
    }

    // Mark assignment as accepted
    await db.workItemAssignment.updateMany({
      where: { workItemId: id, userId: user.id, isActive: true },
      data: { acceptedAt: new Date() },
    })

    // Update work item status to ACCEPTED
    if (workItem.status === 'ASSIGNED') {
      await db.workItem.update({
        where: { id },
        data: { status: 'ACCEPTED' },
      })

      await db.workItemStatusHistory.create({
        data: {
          workItemId: id,
          fromStatus: 'ASSIGNED',
          toStatus: 'ACCEPTED',
          comment: `Assignment accepted by ${user.email}`,
          changedById: user.id,
        },
      })
    }

    const updated = await db.workItem.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    })

    return NextResponse.json({ workItem: updated })
  } catch (error) {
    console.error('Accept work item error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
