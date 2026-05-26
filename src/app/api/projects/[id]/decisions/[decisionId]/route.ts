import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// PATCH /api/projects/[id]/decisions/[decisionId] - Update project decision
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; decisionId: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, decisionId } = await params
    const body = await request.json()

    const decision = await db.projectDecision.findFirst({
      where: { id: decisionId, projectId: id },
    })

    if (!decision) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 })
    }

    const allowedFields = ['title', 'description', 'decision', 'rationale', 'alternatives', 'status', 'decidedById']
    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'alternatives') {
          data[field] = JSON.stringify(body[field])
        } else {
          data[field] = body[field]
        }
      }
    }

    // If status changed to ACCEPTED or REJECTED, set decidedAt
    if (body.status === 'ACCEPTED' || body.status === 'REJECTED') {
      data.decidedAt = new Date()
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updated = await db.projectDecision.update({
      where: { id: decisionId },
      data,
      include: {
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'UPDATE_PROJECT_DECISION',
      entity: 'ProjectDecision',
      entityId: decisionId,
      newValue: data,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Update project decision error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
