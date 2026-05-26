import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/projects/[id]/action-items - Get project action items (pending items)
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

    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Collect pending action items across the project
    const actionItems: Array<Record<string, unknown>> = []

    // Pending approvals
    const pendingApprovals = await db.approvalInstance.findMany({
      where: { entityType: 'PROJECT', entityId: id, status: 'PENDING' },
      select: {
        id: true,
        aitNo: true,
        entityType: true,
        requestedAt: true,
        workflow: { select: { name: true } },
      },
    })
    for (const pa of pendingApprovals) {
      actionItems.push({
        type: 'PENDING_APPROVAL',
        id: pa.id,
        aitNo: pa.aitNo,
        title: `Pending Approval: ${pa.workflow.name}`,
        createdAt: pa.requestedAt,
      })
    }

    // Overdue work items
    const overdueWorkItems = await db.workItem.findMany({
      where: {
        projectId: id,
        dueDate: { lt: new Date() },
        status: { notIn: ['DEPLOYED', 'COMPLETED', 'CLOSED'] },
      },
      select: { id: true, title: true, aitNo: true, dueDate: true, priority: true },
    })
    for (const wi of overdueWorkItems) {
      actionItems.push({
        type: 'OVERDUE_WORK_ITEM',
        id: wi.id,
        aitNo: wi.aitNo,
        title: `Overdue: ${wi.title}`,
        dueDate: wi.dueDate,
        priority: wi.priority,
        createdAt: wi.dueDate,
      })
    }

    // Pending MIT assignments
    const pendingMit = await db.mitStepAssignment.findMany({
      where: {
        workItem: { projectId: id },
        status: { in: ['PENDING', 'ASSIGNED'] },
      },
      include: {
        workItem: { select: { id: true, title: true, aitNo: true } },
        assignee: { select: { id: true, name: true } },
      },
    })
    for (const mit of pendingMit) {
      actionItems.push({
        type: 'PENDING_MIT',
        id: mit.id,
        aitNo: mit.workItem.aitNo,
        title: `MIT ${mit.step}: ${mit.workItem.title}`,
        assignee: mit.assignee?.name ?? 'Unassigned',
        createdAt: mit.createdAt,
      })
    }

    // Open issues
    const openIssues = await db.projectIssue.findMany({
      where: { projectId: id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { id: true, title: true, severity: true, createdAt: true },
    })
    for (const issue of openIssues) {
      actionItems.push({
        type: 'OPEN_ISSUE',
        id: issue.id,
        title: issue.title,
        severity: issue.severity,
        createdAt: issue.createdAt,
      })
    }

    return NextResponse.json({ data: actionItems })
  } catch (error) {
    console.error('Get project action items error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
