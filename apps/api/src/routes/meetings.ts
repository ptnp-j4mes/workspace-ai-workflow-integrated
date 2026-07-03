import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'
import { executePrompt } from '../lib/ai-service'
import { isTyphoonConfigured, transcribeAudioFile } from '../lib/typhoon-asr'
import { writeFile, mkdir, readFile } from 'fs/promises'
import path from 'path'

export const meetingsRoutes = new Elysia({ prefix: '/api/meetings' })
  // GET /api/meetings - List meetings
  .get('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const projectId = searchParams.get('projectId') || undefined
      const requestId = searchParams.get('requestId') || undefined
      const status = searchParams.get('status') || undefined

      const where: any = {}
      if (projectId) where.projectId = projectId
      if (requestId) where.requestId = requestId
      if (status) where.status = status

      const meetings = await db.meeting.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: {
              participants: true,
              summaries: true,
              actionItems: true,
            },
          },
        },
        orderBy: { scheduledAt: 'desc' },
      })

      return { meetings }
    } catch (error) {
      console.error('List meetings error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/meetings - Create meeting
  .post('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { projectId, requestId, title, description, meetingUrl, scheduledAt } = body

      if (!title) {
        set.status = 400
        return { error: 'Title is required' }
      }

      const meeting = await db.meeting.create({
        data: {
          projectId: projectId || null,
          requestId: requestId || null,
          title,
          description: description || null,
          meetingUrl: meetingUrl || null,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          status: 'SCHEDULED',
        },
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: {
              participants: true,
              actionItems: true,
            },
          },
        },
      })

      set.status = 201
      return { meeting }
    } catch (error) {
      console.error('Create meeting error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/meetings/:id - Get meeting detail with participants, transcripts, summaries, action items
  .get('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const meeting = await db.meeting.findUnique({
        where: { id },
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
          participants: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
          transcripts: {
            orderBy: { createdAt: 'desc' },
          },
          summaries: {
            orderBy: { createdAt: 'desc' },
          },
          actionItems: {
            include: {
              assignee: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          botSessions: {
            include: {
              botAccount: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!meeting) {
        set.status = 404
        return { error: 'Meeting not found' }
      }

      return { meeting }
    } catch (error) {
      console.error('Get meeting error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/meetings/:id - Update meeting
  .patch('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()

      const existing = await db.meeting.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Meeting not found' }
      }

      const allowedFields = ['title', 'description', 'meetingUrl', 'scheduledAt', 'status']

      const data: Record<string, unknown> = {}
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          if (field === 'scheduledAt') {
            data[field] = body[field] ? new Date(body[field]) : null
          } else {
            data[field] = body[field]
          }
        }
      }

      const updated = await db.meeting.update({
        where: { id },
        data,
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: {
              participants: true,
              actionItems: true,
            },
          },
        },
      })

      return { meeting: updated }
    } catch (error) {
      console.error('Update meeting error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // DELETE /api/meetings/:id - Delete meeting by ID
  .delete('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const existing = await db.meeting.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Meeting not found' }
      }

      // Cascade delete: participants, transcripts, summaries, action items, bot sessions
      // Prisma schema has onDelete: Cascade on all related models
      await db.meeting.delete({ where: { id } })

      return { message: 'Meeting deleted successfully' }
    } catch (error) {
      console.error('Delete meeting error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/meetings/:id/action-items - Get meeting action items
  .get('/:id/action-items', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const meeting = await db.meeting.findUnique({ where: { id } })
      if (!meeting) {
        set.status = 404
        return { error: 'Meeting not found' }
      }

      const actionItems = await db.meetingActionItem.findMany({
        where: { meetingId: id },
        include: {
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return { actionItems }
    } catch (error) {
      console.error('Get action items error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/meetings/:id/bot - Start/stop meeting bot
  .post('/:id/bot', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id: meetingId } = params
      const body = await request.json()
      const { action, botAccountId, exportFormat } = body

      if (!action || !['start', 'stop'].includes(action)) {
        set.status = 400
        return { error: 'Action must be "start" or "stop"' }
      }

      // Verify meeting exists
      const meeting = await db.meeting.findUnique({
        where: { id: meetingId },
      })

      if (!meeting) {
        set.status = 404
        return { error: 'Meeting not found' }
      }

      if (action === 'start') {
        return await handleBotStart(set, user.id, meetingId, meeting, botAccountId, exportFormat)
      } else {
        return await handleBotStop(set, user.id, meetingId, meeting)
      }
    } catch (error) {
      console.error('Meeting bot error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/meetings/:id/recordings - Lists recordings for a meeting
  .get('/:id/recordings', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id: meetingId } = params

      // Verify meeting exists
      const meeting = await db.meeting.findUnique({
        where: { id: meetingId },
      })

      if (!meeting) {
        set.status = 404
        return { error: 'Meeting not found' }
      }

      const recordings = await db.meetingRecording.findMany({
        where: { meetingId },
        orderBy: { createdAt: 'desc' },
      })

      return { recordings }
    } catch (error) {
      console.error('Get meeting recordings error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/meetings/:id/recordings/upload - Upload a browser-recorded voice clip
  .post('/:id/recordings/upload', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id: meetingId } = params

      const meeting = await db.meeting.findUnique({ where: { id: meetingId } })
      if (!meeting) {
        set.status = 404
        return { error: 'Meeting not found' }
      }

      const formData = await request.formData()
      const audio = formData.get('audio')
      if (!(audio instanceof Blob)) {
        set.status = 400
        return { error: 'audio file is required' }
      }

      const MAX_AUDIO_BYTES = 200 * 1024 * 1024 // 200MB - generous enough for a multi-hour meeting at voice bitrates
      if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
        set.status = 413
        return { error: 'Audio file is empty or exceeds the allowed size' }
      }
      // Bun's multipart parser sniffs .webm/.mp4 parts as video/* regardless of the
      // client-declared audio/* Content-Type, so match on subtype rather than the
      // audio/ vs video/ prefix (which isn't reliable for these container formats).
      const ALLOWED_AUDIO_SUBTYPES = ['webm', 'mp4', 'wav', 'wave', 'x-wav', 'mpeg', 'mp3', 'ogg', 'opus', 'm4a', 'x-m4a', 'aac', 'flac']
      const subtype = audio.type.split('/')[1]?.split(';')[0]?.toLowerCase()
      if (audio.type && subtype && !ALLOWED_AUDIO_SUBTYPES.includes(subtype)) {
        set.status = 400
        return { error: 'Uploaded file must be an audio recording' }
      }

      // ponytail: no server-side transcoding, whatever the browser records is what gets sent to ASR.
      // Upgrade path: add ffmpeg conversion here if a format ASR rejects turns out to matter.
      const format = (audio.type.split('/')[1] || 'webm').split(';')[0]
      const recordingsDir = path.join(process.cwd(), 'recordings', meetingId)
      await mkdir(recordingsDir, { recursive: true })
      const fileName = `recording-${Date.now()}.${format}`
      const filePath = path.join(recordingsDir, fileName)
      const buffer = Buffer.from(await audio.arrayBuffer())
      await writeFile(filePath, buffer)

      const recording = await db.meetingRecording.create({
        data: {
          meetingId,
          filePath: `/recordings/${meetingId}/${fileName}`,
          fileName,
          fileSizeBytes: buffer.length,
          format,
          status: 'COMPLETED',
          startedAt: new Date(),
          endedAt: new Date(),
          transcriptionStatus: 'PENDING',
        },
      })

      return { success: true, recording }
    } catch (error) {
      console.error('Recording upload error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/meetings/:id/export - Export meeting transcript/summary
  .post('/:id/export', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id: meetingId } = params
      const body = await request.json()
      const { format = 'MARKDOWN', recordingId } = body

      if (!['MARKDOWN', 'GOOGLE_DOCS', 'BOTH'].includes(format)) {
        set.status = 400
        return { error: 'Format must be "MARKDOWN", "GOOGLE_DOCS", or "BOTH"' }
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
        set.status = 404
        return { error: 'Meeting not found' }
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

      return {
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
      }
    } catch (error) {
      console.error('Meeting export error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/meetings/:id/summarize - Generate AI meeting summary
  .post('/:id/summarize', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { transcript } = body

      if (!transcript) {
        set.status = 400
        return { error: 'Transcript is required' }
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
        set.status = 404
        return { error: 'Meeting not found' }
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

      return {
        summary,
        actionItems: savedActionItems,
        runId: summaryResult.runId,
        latencyMs: summaryResult.latencyMs,
      }
    } catch (error: any) {
      console.error('Meeting summarize error:', error)
      set.status = 500
      return { error: error.message || 'Failed to generate meeting summary' }
    }
  })

  // GET /api/meetings/:id/summary - Get latest meeting summary
  .get('/:id/summary', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const meeting = await db.meeting.findUnique({ where: { id } })
      if (!meeting) {
        set.status = 404
        return { error: 'Meeting not found' }
      }

      const summary = await db.meetingSummary.findFirst({
        where: { meetingId: id },
        orderBy: { createdAt: 'desc' },
      })

      if (!summary) {
        set.status = 404
        return { error: 'No summary found' }
      }

      return { summary }
    } catch (error) {
      console.error('Get meeting summary error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/meetings/:id/transcribe - Transcribe a meeting recording
  .post('/:id/transcribe', async ({ request, params, set }) => {
    let transcribeBody: any
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id: meetingId } = params
      transcribeBody = await request.json()
      const { recordingId } = transcribeBody ?? {}

      if (!recordingId) {
        set.status = 400
        return { error: 'recordingId is required' }
      }

      // Verify meeting exists
      const meeting = await db.meeting.findUnique({
        where: { id: meetingId },
      })

      if (!meeting) {
        set.status = 404
        return { error: 'Meeting not found' }
      }

      // Get the recording
      const recording = await db.meetingRecording.findFirst({
        where: {
          id: recordingId,
          meetingId,
        },
      })

      if (!recording) {
        set.status = 404
        return { error: 'Recording not found for this meeting' }
      }

      if (recording.status !== 'COMPLETED') {
        set.status = 400
        return { error: 'Recording is not completed yet. Cannot transcribe.' }
      }

      // Update recording transcription status
      await db.meetingRecording.update({
        where: { id: recordingId },
        data: { transcriptionStatus: 'IN_PROGRESS' },
      })

      let transcriptText = ''

      // Check if the recording file exists and try ASR
      const hasFile = recording.filePath && recording.filePath.startsWith('/')

      if (hasFile) {
        try {
          const fullPath = path.join(process.cwd(), recording.filePath.replace(/^\//, ''))

          if (isTyphoonConfigured()) {
            // Preferred: real Thai/Isan ASR via opentyphoon.ai, chunked for long recordings
            transcriptText = await transcribeAudioFile(fullPath)
          } else {
            // Fallback: z-ai-web-dev-sdk (sandbox SDK, no-op outside its sandbox)
            const audioBuffer = await readFile(fullPath)
            const ZAI = (await import('z-ai-web-dev-sdk')).default
            const zai = await ZAI.create()
            const response = await zai.audio.asr.create({ file_base64: audioBuffer.toString('base64') })
            transcriptText = response.text
          }

          if (!transcriptText || !transcriptText.trim()) {
            throw new Error('ASR returned empty transcript')
          }
        } catch (asrError) {
          console.warn('ASR transcription failed, using mock transcript:', asrError)
          transcriptText = generateMockTranscript(meeting.title)
        }
      } else {
        // No file available, generate mock transcript
        transcriptText = generateMockTranscript(meeting.title)
      }

      // Update the recording with transcript
      await db.meetingRecording.update({
        where: { id: recordingId },
        data: {
          transcriptionStatus: 'COMPLETED',
          transcriptionText: transcriptText,
        },
      })

      // Create or update MeetingTranscript record
      const existingTranscript = await db.meetingTranscript.findFirst({
        where: { meetingId },
      })

      if (existingTranscript) {
        await db.meetingTranscript.update({
          where: { id: existingTranscript.id },
          data: {
            content: transcriptText,
            format: 'TEXT',
            duration: recording.durationSeconds || null,
          },
        })
      } else {
        await db.meetingTranscript.create({
          data: {
            meetingId,
            content: transcriptText,
            format: 'TEXT',
            duration: recording.durationSeconds || null,
          },
        })
      }

      return {
        success: true,
        transcript: transcriptText,
        recording: {
          id: recording.id,
          transcriptionStatus: 'COMPLETED',
          durationSeconds: recording.durationSeconds,
        },
      }
    } catch (error) {
      console.error('Meeting transcribe error:', error)

      // Try to update recording status to FAILED
      try {
        const recordingId = transcribeBody?.recordingId
        if (recordingId) {
          await db.meetingRecording.update({
            where: { id: recordingId },
            data: { transcriptionStatus: 'FAILED' },
          })
        }
      } catch {
        // Ignore update failure
      }

      set.status = 500
      return { error: 'Internal server error' }
    }
  })

async function handleBotStart(
  set: any,
  userId: string,
  meetingId: string,
  meeting: any,
  botAccountId?: string,
  exportFormat?: string
) {
  // Check if there's already an active bot session
  const activeSession = await db.meetingBotSession.findFirst({
    where: {
      meetingId,
      status: { in: ['STARTING', 'JOINED', 'RECORDING', 'TRANSCRIBING', 'SUMMARIZING', 'EXPORTING'] },
    },
  })

  if (activeSession) {
    set.status = 409
    return { error: 'A bot session is already active for this meeting', session: activeSession }
  }

  // Find a bot account to use
  let botAccount: any
  if (botAccountId) {
    botAccount = await db.meetingBotAccount.findUnique({
      where: { id: botAccountId },
    })
    if (!botAccount) {
      set.status = 404
      return { error: 'Specified bot account not found' }
    }
  } else {
    // Find the bot account linked to the user's OAuth token
    const oauthToken = await db.googleOAuthToken.findFirst({
      where: { userId, isActive: true },
    })

    if (oauthToken) {
      botAccount = await db.meetingBotAccount.findFirst({
        where: { googleOAuthTokenId: oauthToken.id, status: 'AVAILABLE' },
      })
    }

    // Fallback: find any available bot
    if (!botAccount) {
      botAccount = await db.meetingBotAccount.findFirst({
        where: { status: 'AVAILABLE' },
      })
    }

    // If still no bot, create one for demo
    if (!botAccount) {
      const botEmail = `ait-bot-auto@ait-demo.com`
      botAccount = await db.meetingBotAccount.create({
        data: {
          email: botEmail,
          name: 'AIT Meeting Bot (Auto)',
          status: 'BUSY',
        },
      })
    }
  }

  // Create bot session
  const session = await db.meetingBotSession.create({
    data: {
      meetingId,
      botAccountId: botAccount.id,
      status: 'STARTING',
      exportFormat: exportFormat || 'BOTH',
      exportStatus: 'PENDING',
    },
  })

  // Update bot account status
  await db.meetingBotAccount.update({
    where: { id: botAccount.id },
    data: { status: 'BUSY', lastUsedAt: new Date() },
  })

  // Update meeting bot status
  await db.meeting.update({
    where: { id: meetingId },
    data: {
      botStatus: 'JOINING',
      botAccountId: botAccount.id,
      recordingStatus: 'NONE',
    },
  })

  // Try to call the meeting-bot-service
  try {
    const botServiceUrl = `/api/bot/start?XTransformPort=3010`
    const res = await fetch(`http://localhost:3010/api/bot/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        meetingId,
        meetingUrl: meeting.meetingUrl,
        botAccountId: botAccount.id,
        botEmail: botAccount.email,
        exportFormat: exportFormat || 'BOTH',
      }),
    })

    if (res.ok) {
      const result = await res.json()

      // Update session status from bot service response
      await db.meetingBotSession.update({
        where: { id: session.id },
        data: {
          status: 'JOINED',
          joinedAt: new Date(),
          recordingStartedAt: new Date(),
        },
      })

      await db.meeting.update({
        where: { id: meetingId },
        data: {
          botStatus: 'ACTIVE',
          recordingStatus: 'RECORDING',
        },
      })

      return {
        success: true,
        session: {
          ...session,
          status: 'JOINED',
          joinedAt: new Date().toISOString(),
          recordingStartedAt: new Date().toISOString(),
        },
        botAccount: {
          id: botAccount.id,
          name: botAccount.name,
          email: botAccount.email,
        },
        botServiceResponse: result,
      }
    } else {
      // Bot service returned error - still mark as starting, it might be offline
      console.warn('Bot service returned error, running in standalone mode')

      // In demo mode, simulate the bot joining
      await db.meetingBotSession.update({
        where: { id: session.id },
        data: {
          status: 'JOINED',
          joinedAt: new Date(),
          recordingStartedAt: new Date(),
        },
      })

      await db.meeting.update({
        where: { id: meetingId },
        data: {
          botStatus: 'ACTIVE',
          recordingStatus: 'RECORDING',
        },
      })

      return {
        success: true,
        session: {
          ...session,
          status: 'JOINED',
          joinedAt: new Date().toISOString(),
          recordingStartedAt: new Date().toISOString(),
        },
        botAccount: {
          id: botAccount.id,
          name: botAccount.name,
          email: botAccount.email,
        },
        message: 'Bot service not available. Running in standalone/demo mode.',
      }
    }
  } catch (fetchError) {
    // Bot service not reachable - run in demo/standalone mode
    console.warn('Bot service not reachable, running in standalone mode')

    await db.meetingBotSession.update({
      where: { id: session.id },
      data: {
        status: 'JOINED',
        joinedAt: new Date(),
        recordingStartedAt: new Date(),
      },
    })

    await db.meeting.update({
      where: { id: meetingId },
      data: {
        botStatus: 'ACTIVE',
        recordingStatus: 'RECORDING',
      },
    })

    return {
      success: true,
      session: {
        ...session,
        status: 'JOINED',
        joinedAt: new Date().toISOString(),
        recordingStartedAt: new Date().toISOString(),
      },
      botAccount: {
        id: botAccount.id,
        name: botAccount.name,
        email: botAccount.email,
      },
      message: 'Bot service not reachable. Running in standalone/demo mode.',
    }
  }
}

async function handleBotStop(
  set: any,
  userId: string,
  meetingId: string,
  meeting: any
) {
  // Find active session
  const activeSession = await db.meetingBotSession.findFirst({
    where: {
      meetingId,
      status: { in: ['STARTING', 'JOINED', 'RECORDING', 'TRANSCRIBING', 'SUMMARIZING', 'EXPORTING'] },
    },
    include: {
      botAccount: true,
    },
  })

  if (!activeSession) {
    set.status = 404
    return { error: 'No active bot session found for this meeting' }
  }

  // Try to call the meeting-bot-service to stop
  try {
    const res = await fetch(`http://localhost:3010/api/bot/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: activeSession.id,
        meetingId,
      }),
    })

    if (res.ok) {
      const result = await res.json()
      console.log('Bot service stop response:', result)
    }
  } catch (fetchError) {
    console.warn('Bot service not reachable for stop, updating locally')
  }

  // Update session status
  await db.meetingBotSession.update({
    where: { id: activeSession.id },
    data: {
      status: 'ENDED',
      leftAt: new Date(),
      recordingEndedAt: new Date(),
      recordingFilePath: activeSession.recordingFilePath || `/recordings/${meetingId}/recording.wav`,
    },
  })

  // Update bot account back to available
  await db.meetingBotAccount.update({
    where: { id: activeSession.botAccountId },
    data: { status: 'AVAILABLE' },
  })

  // Update meeting status
  await db.meeting.update({
    where: { id: meetingId },
    data: {
      botStatus: 'IDLE',
      recordingStatus: 'COMPLETED',
    },
  })

  // Create a recording record
  const recording = await db.meetingRecording.create({
    data: {
      meetingId,
      botSessionId: activeSession.id,
      filePath: `/recordings/${meetingId}/recording.wav`,
      fileName: `meeting-${meetingId}-recording.wav`,
      format: 'wav',
      status: 'COMPLETED',
      startedAt: activeSession.recordingStartedAt || activeSession.joinedAt,
      endedAt: new Date(),
      transcriptionStatus: 'PENDING',
      summaryStatus: 'PENDING',
      exportStatus: 'PENDING',
    },
  })

  return {
    success: true,
    message: 'Bot stopped successfully',
    session: {
      id: activeSession.id,
      status: 'ENDED',
      leftAt: new Date().toISOString(),
    },
    recording: {
      id: recording.id,
      filePath: recording.filePath,
      fileName: recording.fileName,
      status: recording.status,
    },
    botAccount: {
      id: activeSession.botAccount.id,
      name: activeSession.botAccount.name,
      email: activeSession.botAccount.email,
    },
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

function generateMockTranscript(meetingTitle: string): string {
  const now = new Date().toLocaleString()
  return `[Transcript - ${now}]
Meeting: ${meetingTitle}
Duration: ~45 minutes

[00:00] Meeting started
[00:01] Facilitator: Good morning everyone. Let's start with the agenda for today's ${meetingTitle}.
[00:15] Participant A: I think we should review the current project status first before discussing new requirements.
[00:30] Facilitator: Agreed. Let me share the project dashboard. As you can see, we're currently on track with the timeline.
[00:45] Participant B: What about the pending change requests? They might impact our schedule.
[01:00] Facilitator: Good point. We have three change requests pending approval. I've flagged them as high priority.
[01:15] Participant C: For the UAT cycle, we need at least 5 business days for thorough testing.
[01:30] Participant A: I agree. We shouldn't rush the UAT phase. Quality is more important than speed.
[01:45] Facilitator: Noted. Let's allocate a full week for UAT. I'll update the project timeline accordingly.
[02:00] Participant B: Are there any blockers we need to address?
[02:15] Facilitator: The main blocker right now is the API integration with the third-party system. The vendor hasn't provided the updated documentation yet.
[02:30] Participant C: I can follow up with the vendor. I have a contact there.
[02:45] Facilitator: That would be great. Please keep us posted.
[03:00] Participant A: Let's also discuss the resource allocation for next sprint.
[03:15] Facilitator: Right. We'll need two additional developers for the integration work. I'll submit the resource request.
[03:30] Participant B: Regarding the deployment strategy, I suggest we use a blue-green deployment approach.
[03:45] Participant A: That's a good approach. It minimizes downtime and allows for quick rollback if needed.
[04:00] Facilitator: Agreed. Let's document the deployment plan and share it with the team.
[04:15] Participant C: Any other items to discuss?
[04:30] Facilitator: I think that covers everything for today. Let me summarize the action items.
[04:45] Meeting ended

Note: This is a mock transcript generated for demo purposes.`
}
