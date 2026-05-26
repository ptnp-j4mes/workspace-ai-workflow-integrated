import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { approveStep } from '@/lib/services/approval-service'

// POST /api/approval-instances/[id]/approve - Approve current step
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
    const { comment } = body

    // Get the current step for this instance
    const instance = await db.approvalInstance.findUnique({
      where: { id },
      select: { currentStepId: true, status: true },
    })

    if (!instance) {
      return NextResponse.json({ error: 'Approval instance not found' }, { status: 404 })
    }

    if (instance.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Cannot approve instance with status: ${instance.status}` },
        { status: 400 }
      )
    }

    if (!instance.currentStepId) {
      return NextResponse.json({ error: 'No current step to approve' }, { status: 400 })
    }

    const updated = await approveStep(id, instance.currentStepId, authUser.id, comment)

    return NextResponse.json({ data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Approve step error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
