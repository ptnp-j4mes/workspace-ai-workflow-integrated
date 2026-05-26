import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { acceptMit } from '@/lib/services/mit-assignment-service'

// POST /api/work-items/[id]/mit-accept - Accept MIT assignment
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

    // Find the active MIT assignment for this work item where the user is the assignee
    const assignment = await db.mitStepAssignment.findFirst({
      where: {
        workItemId: id,
        assigneeId: authUser.id,
        status: { in: ['ASSIGNED', 'PENDING'] },
      },
    })

    if (!assignment) {
      return NextResponse.json(
        { error: 'No pending MIT assignment found for you on this work item' },
        { status: 404 }
      )
    }

    await acceptMit(assignment.id, authUser.id)

    return NextResponse.json({ data: { message: 'MIT assignment accepted' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('MIT accept error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
