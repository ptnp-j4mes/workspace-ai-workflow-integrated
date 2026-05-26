import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

function isAdmin(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

// PATCH /api/admin/approval-workflows/[id] - Update approval workflow
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdmin(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: admin permission required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const existing = await db.approvalWorkflow.findUnique({
      where: { id },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Approval workflow not found' }, { status: 404 })
    }

    // Update workflow fields
    const updateData: Record<string, unknown> = {}
    const allowedFields = ['name', 'description', 'entityType', 'isActive']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Handle steps update if provided
    if (body.steps && Array.isArray(body.steps)) {
      // Delete existing steps and recreate
      await db.approvalStep.deleteMany({ where: { workflowId: id } })

      updateData.steps = {
        create: body.steps.map((step: Record<string, unknown>, index: number) => ({
          stepOrder: (step.stepOrder as number) ?? index + 1,
          stepName: step.stepName as string,
          approverRole: (step.approverRole as string) ?? null,
          approverUserId: (step.approverUserId as string) ?? null,
          requiredAction: (step.requiredAction as string) ?? 'APPROVE',
          isRequired: (step.isRequired as boolean) ?? true,
          slaHours: (step.slaHours as number) ?? null,
        })),
      }
    }

    const updated = await db.approvalWorkflow.update({
      where: { id },
      data: updateData,
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'UPDATE_APPROVAL_WORKFLOW',
      entity: 'ApprovalWorkflow',
      entityId: id,
      oldValue: { name: existing.name, workflowKey: existing.workflowKey, stepCount: existing.steps.length },
      newValue: { name: updated.name, workflowKey: updated.workflowKey, stepCount: updated.steps.length },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Update approval workflow error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
