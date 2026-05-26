import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// POST /api/work-items/[id]/submit - Submit work item for review
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

    if (workItem.status !== 'ACCEPTED' && workItem.status !== 'IN_PROGRESS' && workItem.status !== 'RETURNED') {
      return NextResponse.json(
        { error: `Cannot submit work item with status ${workItem.status}` },
        { status: 400 }
      )
    }

    const previousStatus = workItem.status

    const updated = await db.workItem.update({
      where: { id },
      data: { status: 'SUBMITTED' },
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

    await db.workItemStatusHistory.create({
      data: {
        workItemId: id,
        fromStatus: previousStatus,
        toStatus: 'SUBMITTED',
        comment: 'Work item submitted for review',
        changedById: user.id,
      },
    })

    return NextResponse.json({ workItem: updated })
  } catch (error) {
    console.error('Submit work item error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
