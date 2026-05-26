import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { returnMit } from '@/lib/services/mit-assignment-service'

// POST /api/work-items/[id]/mit-return - Return MIT assignment
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
        { error: 'reason is required when returning' },
        { status: 400 }
      )
    }

    const assignment = await db.mitStepAssignment.findFirst({
      where: {
        workItemId: id,
        assigneeId: authUser.id,
        status: { in: ['ASSIGNED', 'ACCEPTED'] },
      },
    })

    if (!assignment) {
      return NextResponse.json(
        { error: 'No active MIT assignment found for you on this work item' },
        { status: 404 }
      )
    }

    await returnMit(assignment.id, authUser.id, reason)

    return NextResponse.json({ data: { message: 'MIT assignment returned' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('MIT return error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
