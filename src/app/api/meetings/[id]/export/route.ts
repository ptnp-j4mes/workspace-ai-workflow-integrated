import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// POST /api/meetings/[id]/export - Export meeting transcript/summary
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: meetingId } = await params
    const body = await req.json()
    const { format = 'MARKDOWN', recordingId } = body

    if (!['MARKDOWN', 'GOOGLE_DOCS', 'BOTH'].includes(format)) {
      return NextResponse.json(
        { error: 'Format must be "MARKDOWN", "GOOGLE_DOCS", or "BOTH"' },
        { status: 400 }
      )
    }

    // Get meeting with all related data
    const meeting = await db.meeting.findUnique({
      where: { id: meetingId },
      include: {
        project: {
          select: { id: true, name: true, code: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        transcripts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        summaries: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        actionItems: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        recordings: recordingId
          ? { where: { id: recordingId }, take: 1 }
          : { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Get the recording if specified
    const recording = meeting.recordings[0] || null

    // Get transcript text
    const transcriptText = meeting.transcripts[0]?.content ||
      recording?.transcriptionText ||
      'No transcript available.'

    // Get summary data
    const summary = meeting.summaries[0]
    const summaryText = summary?.summaryMarkdown || 'No summary available.'

    // Parse structured data from summary
    let decisions: string[] = []
    let requirements: string[] = []
    let scopeIn: string[] = []
    let scopeOut: string[] = []
    let risks: string[] = []

    try {
      if (summary?.decisions) decisions = JSON.parse(summary.decisions)
      if (summary?.requirements) requirements = JSON.parse(summary.requirements)
      if (summary?.scopeIn) scopeIn = JSON.parse(summary.scopeIn)
      if (summary?.scopeOut) scopeOut = JSON.parse(summary.scopeOut)
      if (summary?.risks) risks = JSON.parse(summary.risks)
    } catch {
      // JSON parse failed, use empty arrays
    }

    // Calculate duration
    const duration = meeting.endedAt && meeting.scheduledAt
      ? Math.round((new Date(meeting.endedAt).getTime() - new Date(meeting.scheduledAt).getTime()) / 60000)
      : recording?.durationSeconds
        ? Math.round(recording.durationSeconds / 60)
        : null

    // Build participant list
    const participantNames = meeting.participants.map((p) => p.name).join(', ')

    // Build markdown content
    const markdown = buildExportMarkdown({
      title: meeting.title,
      date: meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleString() : 'N/A',
      projectName: meeting.project?.name || 'N/A',
      projectCode: meeting.project?.code || '',
      duration,
      participantNames,
      transcriptText,
      summaryText,
      decisions,
      requirements,
      scopeIn,
      scopeOut,
      risks,
      actionItems: meeting.actionItems,
    })

    // Save markdown file
    const exportDir = path.join(process.cwd(), 'download', 'exports', meetingId)
    await mkdir(exportDir, { recursive: true })
    const fileName = `meeting-${meetingId}-${Date.now()}.md`
    const filePath = path.join(exportDir, fileName)
    await writeFile(filePath, markdown, 'utf-8')

    // Determine relative file path for storage
    const relativeFilePath = `/exports/${meetingId}/${fileName}`

    // Update recording export status if applicable
    if (recording) {
      await db.meetingRecording.update({
        where: { id: recording.id },
        data: {
          exportStatus: 'COMPLETED',
          exportFormat: format,
          exportFilePath: relativeFilePath,
        },
      })
    }

    // Update bot session export status if exists
    const activeBotSession = await db.meetingBotSession.findFirst({
      where: { meetingId, exportStatus: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    })
    if (activeBotSession) {
      await db.meetingBotSession.update({
        where: { id: activeBotSession.id },
        data: {
          exportStatus: 'COMPLETED',
          exportFormat: format,
          exportFilePath: relativeFilePath,
        },
      })
    }

    // Handle Google Docs export
    let docsUrl: string | null = null
    if (format === 'GOOGLE_DOCS' || format === 'BOTH') {
      // In production, this would use Google Docs API to create a document
      // For now, we create a placeholder URL
      const oauthToken = await db.googleOAuthToken.findFirst({
        where: { userId: user.id, isActive: true },
      })

      if (oauthToken) {
        // Placeholder: In production, would call Google Docs API
        docsUrl = `https://docs.google.com/document/d/placeholder_${meetingId}`
        console.log('Google Docs export would be created for meeting:', meetingId)

        if (recording) {
          await db.meetingRecording.update({
            where: { id: recording.id },
            data: { exportDocsUrl: docsUrl },
          })
        }
        if (activeBotSession) {
          await db.meetingBotSession.update({
            where: { id: activeBotSession.id },
            data: { exportDocsUrl: docsUrl },
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      filePath: relativeFilePath,
      docsUrl,
      markdown,
      format,
      meeting: {
        id: meeting.id,
        title: meeting.title,
        scheduledAt: meeting.scheduledAt,
      },
    })
  } catch (error) {
    console.error('Meeting export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildExportMarkdown(data: {
  title: string
  date: string
  projectName: string
  projectCode: string
  duration: number | null
  participantNames: string
  transcriptText: string
  summaryText: string
  decisions: string[]
  requirements: string[]
  scopeIn: string[]
  scopeOut: string[]
  risks: string[]
  actionItems: any[]
}): string {
  const now = new Date().toLocaleString()
  const durationText = data.duration ? `${data.duration} minutes` : 'N/A'

  let md = `# Meeting: ${data.title}\n\n`
  md += `**Date:** ${data.date}\n\n`
  md += `**Project:** ${data.projectName}${data.projectCode ? ` (${data.projectCode})` : ''}\n\n`
  md += `**Duration:** ${durationText}\n\n`
  md += `**Participants:** ${data.participantNames}\n\n`

  md += `---\n\n`

  // Transcript section
  md += `## Transcript\n\n${data.transcriptText}\n\n`

  md += `---\n\n`

  // Summary section
  md += `## Summary\n\n${data.summaryText}\n\n`

  // Decisions
  if (data.decisions.length > 0) {
    md += `### Decisions\n\n`
    for (const decision of data.decisions) {
      md += `- ${decision}\n`
    }
    md += `\n`
  }

  // Requirements
  if (data.requirements.length > 0) {
    md += `### Requirements\n\n`
    for (const req of data.requirements) {
      md += `- ${req}\n`
    }
    md += `\n`
  }

  // Scope
  if (data.scopeIn.length > 0 || data.scopeOut.length > 0) {
    md += `### Scope\n\n`
    if (data.scopeIn.length > 0) {
      md += `**In Scope:**\n\n`
      for (const item of data.scopeIn) {
        md += `- ${item}\n`
      }
      md += `\n`
    }
    if (data.scopeOut.length > 0) {
      md += `**Out of Scope:**\n\n`
      for (const item of data.scopeOut) {
        md += `- ${item}\n`
      }
      md += `\n`
    }
  }

  // Risks
  if (data.risks.length > 0) {
    md += `### Risks\n\n`
    for (const risk of data.risks) {
      md += `- ${risk}\n`
    }
    md += `\n`
  }

  // Action Items
  if (data.actionItems.length > 0) {
    md += `### Action Items\n\n`
    for (const item of data.actionItems) {
      const assignee = item.assignee?.name || 'Unassigned'
      const due = item.dueDate ? `, due: ${new Date(item.dueDate).toLocaleDateString()}` : ''
      md += `- [ ] ${item.title} (@${assignee}${due})\n`
    }
    md += `\n`
  }

  md += `---\n\n`
  md += `*Generated by AIT Meeting Bot on ${now}*\n`

  return md
}
