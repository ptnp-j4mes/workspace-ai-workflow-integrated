import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

function isAdmin(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

// GET /api/admin/approval-workflows - List approval workflows
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType') || undefined
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (entityType) where.entityType = entityType
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    const workflows = await db.approvalWorkflow.findMany({
      where,
      orderBy: { workflowKey: 'asc' },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    })

    return NextResponse.json({ data: workflows })
  } catch (error) {
    console.error('List approval workflows error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/approval-workflows - Create approval workflow
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdmin(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: admin permission required' }, { status: 403 })
    }

    const body = await request.json()
    const { workflowKey, entityType, name, description, isActive, steps } = body

    if (!workflowKey || !entityType || !name) {
      return NextResponse.json(
        { error: 'workflowKey, entityType, and name are required' },
        { status: 400 }
      )
    }

    // Check for duplicate key
    const existing = await db.approvalWorkflow.findUnique({ where: { workflowKey } })
    if (existing) {
      return NextResponse.json({ error: 'Workflow key already exists' }, { status: 400 })
    }

    const workflow = await db.approvalWorkflow.create({
      data: {
        workflowKey,
        entityType,
        name,
        description: description ?? null,
        isActive: isActive ?? true,
        steps: steps && Array.isArray(steps) && steps.length > 0
          ? {
              create: steps.map((step: Record<string, unknown>, index: number) => ({
                stepOrder: (step.stepOrder as number) ?? index + 1,
                stepName: step.stepName as string,
                approverRole: (step.approverRole as string) ?? null,
                approverUserId: (step.approverUserId as string) ?? null,
                requiredAction: (step.requiredAction as string) ?? 'APPROVE',
                isRequired: (step.isRequired as boolean) ?? true,
                slaHours: (step.slaHours as number) ?? null,
              })),
            }
          : undefined,
      },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'CREATE_APPROVAL_WORKFLOW',
      entity: 'ApprovalWorkflow',
      entityId: workflow.id,
      newValue: { workflowKey, entityType, name, stepCount: workflow.steps.length },
    })

    return NextResponse.json({ data: workflow }, { status: 201 })
  } catch (error) {
    console.error('Create approval workflow error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
