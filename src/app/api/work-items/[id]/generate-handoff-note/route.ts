import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { executePrompt } from '@/lib/ai-service'

// POST /api/work-items/[id]/generate-handoff-note - Generate AI handoff note
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
    const body = await request.json()
    const { fromRole, toRole, toUserId, workDone, blockers, nextStep } = body

    if (!fromRole || !toRole || !workDone) {
      return NextResponse.json(
        { error: 'fromRole, toRole, and workDone are required' },
        { status: 400 }
      )
    }

    const workItem = await db.workItem.findUnique({
      where: { id },
      include: {
        request: {
          select: { id: true, title: true, description: true, code: true },
        },
        assignments: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    })

    if (!workItem) {
      return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
    }

    const result = await executePrompt('handoff.generate_note', {
      workItemTitle: workItem.title,
      workItemDescription: workItem.description || 'N/A',
      requestTitle: workItem.request?.title || 'N/A',
      requestDescription: workItem.request?.description || 'N/A',
      fromRole,
      toRole,
      workDone,
      blockers: blockers || 'None',
      nextStep: nextStep || 'Not specified',
      currentAssignments: JSON.stringify(
        workItem.assignments.map((a) => ({
          role: a.role,
          name: a.user.name,
        }))
      ),
    })

    // Create handoff record
    const handoff = await db.workItemHandoff.create({
      data: {
        workItemId: id,
        fromUserId: user.id,
        toUserId: toUserId || null,
        fromRole,
        toRole,
        aiGeneratedNote: result.parsedOutput ? JSON.stringify(result.parsedOutput) : result.output,
        status: 'PENDING',
      },
    })

    return NextResponse.json({
      handoff,
      note: result.parsedOutput || result.output,
      runId: result.runId,
      latencyMs: result.latencyMs,
    })
  } catch (error: any) {
    console.error('Generate handoff note error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate handoff note' },
      { status: 500 }
    )
  }
}
