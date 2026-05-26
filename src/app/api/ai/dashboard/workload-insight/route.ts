import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { executePrompt } from '@/lib/ai-service'

// POST /api/ai/dashboard/workload-insight - Generate AI workload insight
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch real data from DB
    const now = new Date()

    const [users, activeRequests, activeWorkItems, overdueRequests, overdueWorkItems] =
      await Promise.all([
        db.user.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                assignedBAs: { where: { status: { in: ['ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT'] } } },
                assignedDevs: { where: { status: { in: ['ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT'] } } },
                assignedQAs: { where: { status: { in: ['ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT'] } } },
              },
            },
          },
        }),
        db.request.findMany({
          where: { status: { in: ['ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT'] } },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            type: true,
            dueDate: true,
            assignedBA: { select: { name: true } },
            assignedDev: { select: { name: true } },
            assignedQA: { select: { name: true } },
          },
        }),
        db.workItem.findMany({
          where: { status: { in: ['CREATED', 'ASSIGNED', 'ACCEPTED'] } },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
          },
        }),
        db.request.count({
          where: {
            dueDate: { lt: now },
            status: { notIn: ['COMPLETED', 'CLOSED', 'REJECTED'] },
          },
        }),
        db.workItem.count({
          where: {
            dueDate: { lt: now },
            status: { notIn: ['DEPLOYED', 'SUBMITTED', 'REJECTED'] },
          },
        }),
      ])

    const userWorkloadData = users.map((u) => ({
      name: u.name,
      activeRequests: u._count.assignedBAs + u._count.assignedDevs + u._count.assignedQAs,
    }))

    const requestData = activeRequests.map((r) => ({
      title: r.title,
      status: r.status,
      priority: r.priority,
      type: r.type,
      dueDate: r.dueDate?.toISOString() || 'N/A',
      assignedBA: r.assignedBA?.name || 'None',
      assignedDev: r.assignedDev?.name || 'None',
      assignedQA: r.assignedQA?.name || 'None',
    }))

    const result = await executePrompt('dashboard.workload_insight', {
      userWorkload: JSON.stringify(userWorkloadData),
      activeRequests: JSON.stringify(requestData),
      activeWorkItemCount: String(activeWorkItems.length),
      overdueRequestCount: String(overdueRequests),
      overdueWorkItemCount: String(overdueWorkItems),
    })

    return NextResponse.json({
      insight: result.parsedOutput || result.output,
      runId: result.runId,
      latencyMs: result.latencyMs,
    })
  } catch (error: any) {
    console.error('Workload insight error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate workload insight' },
      { status: 500 }
    )
  }
}
