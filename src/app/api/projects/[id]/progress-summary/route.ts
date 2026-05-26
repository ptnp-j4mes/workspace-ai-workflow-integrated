import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/projects/[id]/progress-summary - Get project progress summary
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

    const project = await db.project.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Aggregate metrics
    const [
      totalRequests,
      completedRequests,
      totalWorkItems,
      completedWorkItems,
      openBugs,
      criticalBugs,
      pendingApprovals,
      activeRisks,
      openIssues,
      pendingDecisions,
      totalUatCycles,
      completedUatCycles,
      totalMembers,
    ] = await Promise.all([
      db.request.count({ where: { projectId: id } }),
      db.request.count({ where: { projectId: id, status: { in: ['COMPLETED', 'CLOSED'] } } }),
      db.workItem.count({ where: { projectId: id } }),
      db.workItem.count({ where: { projectId: id, status: { in: ['DEPLOYED', 'COMPLETED'] } } }),
      db.bugReport.count({ where: { projectId: id, status: { in: ['OPEN', 'INVESTIGATING', 'FIXING'] } } }),
      db.bugReport.count({ where: { projectId: id, severity: 'CRITICAL', status: { in: ['OPEN', 'INVESTIGATING', 'FIXING'] } } }),
      db.approvalInstance.count({ where: { entityType: 'PROJECT', entityId: id, status: 'PENDING' } }),
      db.projectRisk.count({ where: { projectId: id, status: { notIn: ['RESOLVED', 'ACCEPTED'] } } }),
      db.projectIssue.count({ where: { projectId: id, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      db.projectDecision.count({ where: { projectId: id, status: 'PROPOSED' } }),
      db.uatCycle.count({ where: { projectId: id } }),
      db.uatCycle.count({ where: { projectId: id, status: 'COMPLETED' } }),
      db.projectMember.count({ where: { projectId: id } }),
    ])

    return NextResponse.json({
      data: {
        projectId: id,
        projectName: project.name,
        projectStatus: project.status,
        requests: { total: totalRequests, completed: completedRequests },
        workItems: { total: totalWorkItems, completed: completedWorkItems },
        bugs: { open: openBugs, critical: criticalBugs },
        approvals: { pending: pendingApprovals },
        risks: { active: activeRisks },
        issues: { open: openIssues },
        decisions: { pending: pendingDecisions },
        uat: { total: totalUatCycles, completed: completedUatCycles },
        members: { total: totalMembers },
      },
    })
  } catch (error) {
    console.error('Get project progress summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
