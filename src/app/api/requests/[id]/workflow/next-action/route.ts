import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { executePrompt } from '@/lib/ai-service'

// POST /api/requests/[id]/workflow/next-action - Get AI recommendation for next action
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

    const req = await db.request.findUnique({
      where: { id },
      include: {
        project: { select: { name: true } },
        assignedBA: { select: { name: true } },
        assignedDev: { select: { name: true } },
        assignedQA: { select: { name: true } },
        createdBy: { select: { name: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const result = await executePrompt('workflow.next_action', {
      requestTitle: req.title,
      requestStatus: req.status,
      requestType: req.type,
      requestPriority: req.priority,
      requestDescription: req.description,
      projectName: req.project?.name || 'N/A',
      assignedBA: req.assignedBA?.name || 'None',
      assignedDev: req.assignedDev?.name || 'None',
      assignedQA: req.assignedQA?.name || 'None',
      statusHistory: JSON.stringify(req.statusHistory.map(h => ({
        from: h.fromStatus,
        to: h.toStatus,
        comment: h.comment,
        date: h.createdAt,
      }))),
      currentUserRoles: user.roles.join(', '),
    })

    return NextResponse.json({
      recommendation: result.parsedOutput || result.output,
      runId: result.runId,
      latencyMs: result.latencyMs,
    })
  } catch (error: any) {
    console.error('Workflow next action error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get AI recommendation' },
      { status: 500 }
    )
  }
}
