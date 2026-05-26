import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { deployMit } from '@/lib/services/mit-assignment-service'

// POST /api/work-items/[id]/mit-deploy - Deploy MIT step
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
        status: 'SUBMITTED',
      },
    })

    if (!assignment) {
      return NextResponse.json(
        { error: 'No submitted MIT assignment found for you on this work item' },
        { status: 404 }
      )
    }

    await deployMit(assignment.id, authUser.id)

    return NextResponse.json({ data: { message: 'MIT step deployed' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('MIT deploy error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
