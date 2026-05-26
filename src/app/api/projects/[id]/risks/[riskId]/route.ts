import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// PATCH /api/projects/[id]/risks/[riskId] - Update project risk
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; riskId: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, riskId } = await params
    const body = await request.json()

    const risk = await db.projectRisk.findFirst({
      where: { id: riskId, projectId: id },
    })

    if (!risk) {
      return NextResponse.json({ error: 'Risk not found' }, { status: 404 })
    }

    const allowedFields = ['title', 'description', 'probability', 'impact', 'mitigation', 'status', 'ownerId']
    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field]
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updated = await db.projectRisk.update({
      where: { id: riskId },
      data,
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'UPDATE_PROJECT_RISK',
      entity: 'ProjectRisk',
      entityId: riskId,
      newValue: data,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Update project risk error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
