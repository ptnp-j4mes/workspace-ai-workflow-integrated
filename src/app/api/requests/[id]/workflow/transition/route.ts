import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// Valid workflow transitions with required roles
const VALID_TRANSITIONS: Record<string, Record<string, string[]>> = {
  DRAFT: { SUBMITTED: ['ADMIN', 'BUSINESS_ANALYST', 'REQUESTER'] },
  SUBMITTED: { APPROVED: ['ADMIN', 'APPROVER'], REJECTED: ['ADMIN', 'APPROVER'] },
  APPROVED: { ASSIGNED: ['ADMIN', 'PROJECT_MANAGER'] },
  ASSIGNED: { IN_DEVELOPMENT: ['ADMIN', 'PROJECT_MANAGER'] },
  IN_DEVELOPMENT: { QA: ['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER'] },
  QA: { UAT: ['ADMIN', 'PROJECT_MANAGER', 'QA'], IN_DEVELOPMENT: ['ADMIN', 'PROJECT_MANAGER'] },
  UAT: { COMPLETED: ['ADMIN', 'PROJECT_MANAGER'], IN_DEVELOPMENT: ['ADMIN', 'PROJECT_MANAGER'] },
  COMPLETED: { CLOSED: ['ADMIN', 'PROJECT_MANAGER'] },
  REJECTED: { DRAFT: ['ADMIN', 'REQUESTER'] },
}

// POST /api/requests/[id]/workflow/transition - Transition request to a new status
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
    const { action, comment } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    const req = await db.request.findUnique({ where: { id } })
    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Map action to target status
    const actionToStatus: Record<string, string> = {
      submit: 'SUBMITTED',
      approve: 'APPROVED',
      reject: 'REJECTED',
      assign: 'ASSIGNED',
      start_development: 'IN_DEVELOPMENT',
      move_to_qa: 'QA',
      move_to_uat: 'UAT',
      complete: 'COMPLETED',
      close: 'CLOSED',
      reopen: 'DRAFT',
    }

    const targetStatus = actionToStatus[action]
    if (!targetStatus) {
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      )
    }

    // Validate transition
    const currentTransitions = VALID_TRANSITIONS[req.status]
    if (!currentTransitions || !currentTransitions[targetStatus]) {
      return NextResponse.json(
        { error: `Transition from ${req.status} to ${targetStatus} is not allowed` },
        { status: 400 }
      )
    }

    // Check role permissions
    const allowedRoles = currentTransitions[targetStatus]
    const hasPermission = user.roles.some((role) => allowedRoles.includes(role))
    if (!hasPermission) {
      return NextResponse.json(
        { error: `You do not have permission to transition from ${req.status} to ${targetStatus}` },
        { status: 403 }
      )
    }

    const updated = await db.request.update({
      where: { id },
      data: {
        status: targetStatus,
        ...(targetStatus === 'COMPLETED' ? { completedAt: new Date() } : {}),
      },
    })

    // Create status history entry
    await db.requestStatusHistory.create({
      data: {
        requestId: id,
        fromStatus: req.status,
        toStatus: targetStatus,
        comment: comment || `Status changed via action: ${action}`,
        changedById: user.id,
      },
    })

    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error('Workflow transition error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
