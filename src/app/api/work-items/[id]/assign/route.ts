import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// POST /api/work-items/[id]/assign - Assign work item
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
    const { userId, role } = body

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'userId and role are required' },
        { status: 400 }
      )
    }

    const workItem = await db.workItem.findUnique({ where: { id } })
    if (!workItem) {
      return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
    }

    // Verify user exists
    const targetUser = await db.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Deactivate existing assignments for this role
    await db.workItemAssignment.updateMany({
      where: { workItemId: id, role, isActive: true },
      data: { isActive: false },
    })

    // Create new assignment
    const assignment = await db.workItemAssignment.create({
      data: {
        workItemId: id,
        userId,
        role,
        isActive: true,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    })

    // Update work item status to ASSIGNED if it was CREATED
    if (workItem.status === 'CREATED') {
      await db.workItem.update({
        where: { id },
        data: { status: 'ASSIGNED' },
      })

      await db.workItemStatusHistory.create({
        data: {
          workItemId: id,
          fromStatus: 'CREATED',
          toStatus: 'ASSIGNED',
          comment: `Assigned to ${targetUser.name} as ${role}`,
          changedById: user.id,
        },
      })
    }

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (error) {
    console.error('Assign work item error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
