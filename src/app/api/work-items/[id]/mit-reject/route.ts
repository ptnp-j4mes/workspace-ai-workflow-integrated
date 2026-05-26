import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { rejectMit } from '@/lib/services/mit-assignment-service'

// POST /api/work-items/[id]/mit-reject - Reject MIT assignment
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
    const body = await request.json()
    const { reason } = body

    if (!reason) {
      return NextResponse.json(
        { error: 'reason is required when rejecting' },
        { status: 400 }
      )
    }

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

    await rejectMit(assignment.id, authUser.id, reason)

    return NextResponse.json({ data: { message: 'MIT assignment rejected' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('MIT reject error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
