import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { executePrompt } from '@/lib/ai-service'

// POST /api/meetings/[id]/summarize - Generate AI meeting summary
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
    const { transcript } = body

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      )
    }

    const meeting = await db.meeting.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Generate summary using AI
    const participantNames = meeting.participants.map((p) => p.name).join(', ')

    const summaryResult = await executePrompt('meeting.summary.ba_requirement', {
      meetingTitle: meeting.title,
      meetingDescription: meeting.description || 'N/A',
      participants: participantNames,
      transcript,
    })

    const summaryContent = summaryResult.parsedOutput || summaryResult.output

    // Parse the summary output to extract structured data
    let summaryMarkdown = ''
    let decisions: string[] = []
    let requirements: string[] = []
    let scopeIn: string[] = []
    let scopeOut: string[] = []
    let risks: string[] = []
    let openQuestions: string[] = []

    if (typeof summaryContent === 'object' && summaryContent !== null) {
      const parsed = summaryContent as any
      summaryMarkdown = parsed.summaryMarkdown || parsed.summary || JSON.stringify(parsed, null, 2)
      decisions = parsed.decisions || []
      requirements = parsed.requirements || []
      scopeIn = parsed.scopeIn || []
      scopeOut = parsed.scopeOut || []
      risks = parsed.risks || []
      openQuestions = parsed.openQuestions || []
    } else {
      summaryMarkdown = String(summaryContent)
    }

    // Save transcript
    await db.meetingTranscript.create({
      data: {
        meetingId: id,
        content: transcript,
        format: 'TEXT',
      },
    })

    // Save summary
    const summary = await db.meetingSummary.create({
      data: {
        meetingId: id,
        summaryMarkdown,
        decisions: decisions.length > 0 ? JSON.stringify(decisions) : null,
        requirements: requirements.length > 0 ? JSON.stringify(requirements) : null,
        scopeIn: scopeIn.length > 0 ? JSON.stringify(scopeIn) : null,
        scopeOut: scopeOut.length > 0 ? JSON.stringify(scopeOut) : null,
        risks: risks.length > 0 ? JSON.stringify(risks) : null,
        openQuestions: openQuestions.length > 0 ? JSON.stringify(openQuestions) : null,
      },
    })

    // Extract action items using AI
    let actionItems: any[] = []
    try {
      const actionResult = await executePrompt('meeting.action_items.extract', {
        meetingTitle: meeting.title,
        transcript,
        summary: summaryMarkdown,
      })

      const actionContent = actionResult.parsedOutput || actionResult.output
      if (Array.isArray(actionContent)) {
        actionItems = actionContent
      } else if (typeof actionContent === 'object' && actionContent !== null) {
        const parsed = actionContent as any
        actionItems = parsed.actionItems || parsed.items || []
      }
    } catch (err) {
      console.error('Failed to extract action items:', err)
    }

    // Save action items
    const savedActionItems = []
    for (const item of actionItems) {
      if (typeof item === 'object' && item.title) {
        const saved = await db.meetingActionItem.create({
          data: {
            meetingId: id,
            title: item.title,
            description: item.description || null,
            assigneeId: item.assigneeId || null,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            status: 'OPEN',
            confidence: item.confidence || null,
            sourceQuote: item.sourceQuote || null,
          },
        })
        savedActionItems.push(saved)
      }
    }

    // Update meeting status
    await db.meeting.update({
      where: { id },
      data: { status: 'COMPLETED', endedAt: new Date() },
    })

    return NextResponse.json({
      summary,
      actionItems: savedActionItems,
      runId: summaryResult.runId,
      latencyMs: summaryResult.latencyMs,
    })
  } catch (error: any) {
    console.error('Meeting summarize error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate meeting summary' },
      { status: 500 }
    )
  }
}
