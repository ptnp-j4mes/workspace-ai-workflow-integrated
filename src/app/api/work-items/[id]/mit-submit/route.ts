import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { submitMit } from '@/lib/services/mit-assignment-service'

// POST /api/work-items/[id]/mit-submit - Submit MIT step
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

    await submitMit(assignment.id, authUser.id)

    return NextResponse.json({ data: { message: 'MIT step submitted' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('MIT submit error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
