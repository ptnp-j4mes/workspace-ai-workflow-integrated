import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { getApprovalTimeline } from '@/lib/services/approval-service'

// GET /api/approval-instances/[id] - Get approval instance with timeline
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const instance = await db.approvalInstance.findUnique({
      where: { id },
      include: {
        workflow: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
        actions: {
          include: {
            actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
            step: { select: { stepName: true, stepOrder: true, requiredAction: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!instance) {
      return NextResponse.json({ error: 'Approval instance not found' }, { status: 404 })
    }

    const timeline = await getApprovalTimeline(id)

    return NextResponse.json({
      data: {
        ...instance,
        timeline,
      },
    })
  } catch (error) {
    console.error('Get approval instance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
