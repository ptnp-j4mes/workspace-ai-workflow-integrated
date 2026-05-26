import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// PATCH /api/projects/[id]/issues/[issueId] - Update project issue
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, issueId } = await params
    const body = await request.json()

    const issue = await db.projectIssue.findFirst({
      where: { id: issueId, projectId: id },
    })

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    const allowedFields = ['title', 'description', 'severity', 'status', 'resolution', 'ownerId']
    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field]
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updated = await db.projectIssue.update({
      where: { id: issueId },
      data,
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'UPDATE_PROJECT_ISSUE',
      entity: 'ProjectIssue',
      entityId: issueId,
      newValue: data,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Update project issue error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
