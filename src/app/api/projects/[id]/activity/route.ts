import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/projects/[id]/activity - Get recent project activity
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
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get audit logs related to this project
    const auditLogs = await db.auditLog.findMany({
      where: {
        OR: [
          { entityId: id, entity: 'Project' },
          { aitNo: project.aitNo ?? '' },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    // Get recent status changes for requests in this project
    const requestStatusChanges = await db.requestStatusHistory.findMany({
      where: {
        request: { projectId: id },
      },
      include: {
        request: { select: { id: true, title: true, aitNo: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 20),
    })

    // Get recent work item status changes
    const workItemChanges = await db.workItemStatusHistory.findMany({
      where: {
        workItem: { projectId: id },
      },
      include: {
        workItem: { select: { id: true, title: true, aitNo: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 20),
    })

    const activities: Array<Record<string, unknown>> = []

    for (const log of auditLogs) {
      activities.push({
        type: 'AUDIT_LOG',
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        aitNo: log.aitNo,
        user: log.user,
        oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
        newValue: log.newValue ? JSON.parse(log.newValue) : null,
        createdAt: log.createdAt,
      })
    }

    for (const change of requestStatusChanges) {
      activities.push({
        type: 'REQUEST_STATUS_CHANGE',
        requestId: change.requestId,
        requestTitle: change.request.title,
        requestAitNo: change.request.aitNo,
        fromStatus: change.fromStatus,
        toStatus: change.toStatus,
        comment: change.comment,
        createdAt: change.createdAt,
      })
    }

    for (const change of workItemChanges) {
      activities.push({
        type: 'WORK_ITEM_STATUS_CHANGE',
        workItemId: change.workItemId,
        workItemTitle: change.workItem.title,
        workItemAitNo: change.workItem.aitNo,
        fromStatus: change.fromStatus,
        toStatus: change.toStatus,
        comment: change.comment,
        createdAt: change.createdAt,
      })
    }

    // Sort all by createdAt descending
    activities.sort((a, b) =>
      new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
    )

    return NextResponse.json({
      data: activities.slice(0, limit),
    })
  } catch (error) {
    console.error('Get project activity error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
