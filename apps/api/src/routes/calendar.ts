import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'

// ============================================================
// Types
// ============================================================

interface CalendarEventResult {
  id: string
  title: string
  type: 'MEETING' | 'REQUEST_DEADLINE' | 'WORK_ITEM_DUE' | 'OVERDUE' | 'MILESTONE' | 'GOOGLE_CALENDAR'
  date: string
  time?: string
  endDate?: string
  projectId?: string
  projectName?: string
  requestId?: string
  status?: string
  view?: string
  viewParams?: Record<string, string>
  // Google Calendar specific fields
  meetingUrl?: string
  location?: string
  organizerEmail?: string
  attendees?: Array<{ email: string; name: string; responseStatus: string }>
  isRecurring?: boolean
  googleEventId?: string
  isGoogleCalendar?: boolean
}

// ============================================================
// Demo Events Generator (for calendar page when no Google connected)
// ============================================================

function generateDemoEvents(monthParam: string, userId: string): CalendarEventResult[] {
  const [year, month] = monthParam.split('-').map(Number)
  const events: CalendarEventResult[] = []
  const now = new Date()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Add a few sample meetings around today
  const sampleMeetings = [
    { day: 3, title: 'Sprint Planning', time: '09:00' },
    { day: 7, title: 'Requirements Review', time: '10:30' },
    { day: 10, title: 'Architecture Design Review', time: '14:00' },
    { day: 14, title: 'UAT Sign-off Meeting', time: '11:00' },
    { day: 17, title: 'Stakeholder Update', time: '15:00' },
    { day: 21, title: 'Go-Live Readiness Check', time: '09:30' },
    { day: 24, title: 'Change Advisory Board', time: '13:00' },
    { day: 28, title: 'Retrospective', time: '16:00' },
  ]

  const daysInMonth = new Date(year, month, 0).getDate()
  for (const meeting of sampleMeetings) {
    if (meeting.day <= daysInMonth) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(meeting.day).padStart(2, '0')}`
      events.push({
        id: `demo_meeting_${meeting.day}`,
        title: meeting.title,
        type: 'MEETING',
        date: dateStr,
        time: meeting.time,
        projectId: undefined,
        projectName: 'Demo Project',
        status: 'SCHEDULED',
        view: 'meetings',
        viewParams: {},
      })
    }
  }

  // Add some deadlines
  const deadlines = [
    { day: 5, title: 'AIT2605-003: User Portal Enhancement', projectName: 'Portal Redesign' },
    { day: 12, title: 'AIT2605-005: API Integration', projectName: 'Mobile App' },
    { day: 20, title: 'AIT2605-007: Security Audit', projectName: 'Security Review' },
  ]

  for (const deadline of deadlines) {
    if (deadline.day <= daysInMonth) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(deadline.day).padStart(2, '0')}`
      const isOverdue = new Date(year, month - 1, deadline.day) < now
      events.push({
        id: `demo_deadline_${deadline.day}`,
        title: deadline.title,
        type: isOverdue ? 'OVERDUE' : 'REQUEST_DEADLINE',
        date: dateStr,
        projectName: deadline.projectName,
        status: isOverdue ? 'OVERDUE' : 'IN_PROGRESS',
        view: 'requests',
        viewParams: {},
      })
    }
  }

  // Add some work item due dates
  const workItems = [
    { day: 8, title: 'Frontend Development - Dashboard', projectName: 'Portal Redesign' },
    { day: 15, title: 'Backend API - Payment Module', projectName: 'Payment System' },
    { day: 22, title: 'QA Testing - Release 2.1', projectName: 'Mobile App' },
  ]

  for (const item of workItems) {
    if (item.day <= daysInMonth) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(item.day).padStart(2, '0')}`
      const isOverdue = new Date(year, month - 1, item.day) < now
      events.push({
        id: `demo_workitem_${item.day}`,
        title: item.title,
        type: isOverdue ? 'OVERDUE' : 'WORK_ITEM_DUE',
        date: dateStr,
        projectName: item.projectName,
        status: isOverdue ? 'OVERDUE' : 'IN_PROGRESS',
        view: 'work-items',
        viewParams: {},
      })
    }
  }

  // Add project milestone
  if (daysInMonth >= 30) {
    events.push({
      id: 'demo_milestone_30',
      title: '🏁 Portal Redesign Go-Live',
      type: 'MILESTONE',
      date: `${year}-${String(month).padStart(2, '0')}-30`,
      projectName: 'Portal Redesign',
      status: 'ON_TRACK',
      view: 'project-detail',
      viewParams: {},
    })
  }

  return events
}

// ============================================================
// Mock Calendar Events (for Google Calendar compatibility)
// ============================================================

function generateMockCalendarEvents(
  userId: string,
  oauthTokenId: string,
  projectId: string | undefined,
  fromDate: Date,
  toDate: Date
) {
  const events = []
  const meetingTitles = [
    'Sprint Planning Meeting',
    'Requirements Review',
    'Architecture Design Session',
    'Stakeholder Update',
    'UAT Sign-off Meeting',
    'Project Kickoff',
    'Daily Standup',
    'Change Advisory Board',
    'Technical Design Review',
    'Go-Live Readiness Check',
  ]

  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const rangeDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / dayMs)
  const numEvents = Math.min(rangeDays, 10)

  for (let i = 0; i < numEvents; i++) {
    const eventDate = new Date(fromDate.getTime() + i * dayMs)
    const startAt = new Date(eventDate)
    startAt.setHours(9 + (i % 3), 0, 0, 0)
    const endAt = new Date(startAt)
    endAt.setHours(startAt.getHours() + 1)

    const meetCode = `${randomAlpha(3)}-${randomAlpha(4)}-${randomAlpha(3)}`

    events.push({
      id: `mock_event_${i}_${Date.now()}`,
      googleEventId: `mock_google_${i}_${userId.slice(0, 6)}`,
      userId,
      oauthTokenId,
      projectId: i < 3 && projectId ? projectId : null,
      title: meetingTitles[i % meetingTitles.length],
      description: `This is a mock calendar event for demo purposes. Meeting #${i + 1}.`,
      meetingUrl: `https://meet.google.com/${meetCode}`,
      location: `Google Meet: https://meet.google.com/${meetCode}`,
      organizerEmail: 'organizer@demo.com',
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      status: startAt > now ? 'CONFIRMED' : 'CONFIRMED',
      attendees: [
        { email: 'attendee1@demo.com', name: 'Alice Demo', responseStatus: 'accepted' },
        { email: 'attendee2@demo.com', name: 'Bob Demo', responseStatus: 'accepted' },
        { email: 'attendee3@demo.com', name: 'Carol Demo', responseStatus: 'tentative' },
      ],
      isRecurring: i === 0,
    })
  }

  return events
}

function randomAlpha(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export const calendarRoutes = new Elysia({ prefix: '/api/calendar' })
  // ============================================================
  // GET /api/calendar/events
  // Query params:
  //   - month: YYYY-MM format (new parameter for calendar page)
  //   - from/to: ISO date range (existing parameter for meetings page)
  //   - projectId: optional project filter
  // ============================================================
  .get('/events', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const monthParam = searchParams.get('month') // YYYY-MM
      const fromParam = searchParams.get('from')
      const toParam = searchParams.get('to')
      const projectId = searchParams.get('projectId') || undefined

      let fromDate: Date
      let toDate: Date

      // Support new `month` parameter
      if (monthParam) {
        const [year, month] = monthParam.split('-').map(Number)
        if (!year || !month || month < 1 || month > 12) {
          set.status = 400
          return { error: 'Invalid month format. Use YYYY-MM' }
        }
        // Include a few days from prev/next months for calendar grid padding
        const firstDay = new Date(year, month - 1, 1)
        const dayOfWeek = firstDay.getDay()
        fromDate = new Date(year, month - 1, 1 - dayOfWeek) // Start from Sunday of the week containing the 1st
        const lastDay = new Date(year, month, 0)
        const remainingDays = 42 - (dayOfWeek + lastDay.getDate()) // 6 rows
        toDate = new Date(year, month - 1, lastDay.getDate() + remainingDays)
        toDate.setHours(23, 59, 59, 999)
      } else if (fromParam && toParam) {
        fromDate = new Date(fromParam)
        toDate = new Date(toParam)
      } else {
        // Default: current month
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        const dayOfWeek = firstDay.getDay()
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1 - dayOfWeek)
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        const remainingDays = 42 - (dayOfWeek + lastDay.getDate())
        toDate = new Date(now.getFullYear(), now.getMonth(), lastDay.getDate() + remainingDays)
        toDate.setHours(23, 59, 59, 999)
      }

      // Build CalendarEvents from multiple data sources
      const events: CalendarEventResult[] = []

      // 1. Meetings (scheduled in the date range)
      const meetings = await db.meeting.findMany({
        where: {
          scheduledAt: {
            gte: fromDate,
            lte: toDate,
          },
          status: { not: 'CANCELLED' },
          ...(projectId ? { projectId } : {}),
        },
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
        },
      })

      for (const meeting of meetings) {
        if (meeting.scheduledAt) {
          events.push({
            id: `meeting_${meeting.id}`,
            title: meeting.title,
            type: 'MEETING',
            date: meeting.scheduledAt.toISOString().split('T')[0],
            time: meeting.scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            endDate: meeting.endedAt ? meeting.endedAt.toISOString().split('T')[0] : undefined,
            projectId: meeting.projectId || undefined,
            projectName: meeting.project?.name || undefined,
            status: meeting.status,
            view: 'meeting-detail',
            viewParams: { id: meeting.id },
          })
        }
      }

      // 2. Google Calendar Events
      const oauthToken = await db.googleOAuthToken.findFirst({
        where: { userId: user.id, isActive: true },
      })

      if (oauthToken) {
        const googleEvents = await db.googleCalendarEvent.findMany({
          where: {
            userId: user.id,
            startAt: {
              gte: fromDate,
              lte: toDate,
            },
          },
          include: {
            project: {
              select: { id: true, name: true },
            },
          },
        })

        for (const gEvent of googleEvents) {
          // Skip if we already have a meeting for this (avoid duplicates)
          const isDuplicate = gEvent.meetingId && events.some(
            (e) => e.id === `meeting_${gEvent.meetingId}`
          )
          if (isDuplicate) continue

          // Parse attendees from JSON
          let attendees: Array<{ email: string; name: string; responseStatus: string }> | undefined
          if (gEvent.attendees) {
            try {
              attendees = JSON.parse(gEvent.attendees)
            } catch {
              attendees = undefined
            }
          }

          events.push({
            id: `gcal_${gEvent.id}`,
            title: gEvent.title,
            type: 'GOOGLE_CALENDAR',
            date: gEvent.startAt.toISOString().split('T')[0],
            time: gEvent.startAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            endDate: gEvent.endAt ? gEvent.endAt.toISOString().split('T')[0] : undefined,
            projectId: gEvent.projectId || undefined,
            projectName: gEvent.project?.name || undefined,
            status: gEvent.status,
            view: gEvent.meetingId ? 'meeting-detail' : undefined,
            viewParams: gEvent.meetingId ? { id: gEvent.meetingId } : undefined,
            meetingUrl: gEvent.meetingUrl || undefined,
            location: gEvent.location || undefined,
            organizerEmail: gEvent.organizerEmail || undefined,
            attendees,
            isRecurring: gEvent.isRecurring,
            googleEventId: gEvent.googleEventId,
            isGoogleCalendar: true,
          })
        }
      }

      // 3. Request Deadlines (due dates)
      const requests = await db.request.findMany({
        where: {
          dueDate: {
            gte: fromDate,
            lte: toDate,
          },
          status: { notIn: ['COMPLETED', 'CLOSED', 'REJECTED'] },
          ...(projectId ? { projectId } : {}),
        },
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
        },
      })

      for (const request of requests) {
        if (request.dueDate) {
          events.push({
            id: `request_${request.id}`,
            title: `${request.code}: ${request.title}`,
            type: 'REQUEST_DEADLINE',
            date: request.dueDate.toISOString().split('T')[0],
            time: undefined,
            projectId: request.projectId || undefined,
            projectName: request.project?.name || undefined,
            requestId: request.id,
            status: request.status,
            view: 'request-detail',
            viewParams: { id: request.id },
          })
        }
      }

      // 4. Work Item Due Dates
      const workItems = await db.workItem.findMany({
        where: {
          dueDate: {
            gte: fromDate,
            lte: toDate,
          },
          status: { notIn: ['DEPLOYED', 'REJECTED'] },
          ...(projectId ? { projectId } : {}),
        },
        include: {
          request: {
            select: { id: true, title: true, project: { select: { id: true, name: true } } },
          },
        },
      })

      for (const workItem of workItems) {
        if (workItem.dueDate) {
          events.push({
            id: `workitem_${workItem.id}`,
            title: workItem.title,
            type: 'WORK_ITEM_DUE',
            date: workItem.dueDate.toISOString().split('T')[0],
            time: undefined,
            projectId: workItem.request?.project?.id || undefined,
            projectName: workItem.request?.project?.name || undefined,
            status: workItem.status,
            view: 'work-items',
            viewParams: {},
          })
        }
      }

      // 5. Overdue Items (requests and work items that are past due)
      const overdueRequests = await db.request.findMany({
        where: {
          dueDate: {
            lt: new Date(),
            gte: fromDate,
          },
          status: { notIn: ['COMPLETED', 'CLOSED', 'REJECTED'] },
          ...(projectId ? { projectId } : {}),
        },
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
      })

      for (const request of overdueRequests) {
        if (request.dueDate) {
          // Check if we already added this as REQUEST_DEADLINE
          const existingIdx = events.findIndex((e) => e.id === `request_${request.id}`)
          if (existingIdx >= 0) {
            // Upgrade to OVERDUE
            events[existingIdx].type = 'OVERDUE'
          } else {
            events.push({
              id: `overdue_req_${request.id}`,
              title: `⚠️ ${request.code}: ${request.title}`,
              type: 'OVERDUE',
              date: request.dueDate.toISOString().split('T')[0],
              time: undefined,
              projectId: request.projectId || undefined,
              projectName: request.project?.name || undefined,
              requestId: request.id,
              status: 'OVERDUE',
              view: 'request-detail',
              viewParams: { id: request.id },
            })
          }
        }
      }

      const overdueWorkItems = await db.workItem.findMany({
        where: {
          dueDate: {
            lt: new Date(),
            gte: fromDate,
          },
          status: { notIn: ['DEPLOYED', 'REJECTED'] },
          ...(projectId ? { projectId } : {}),
        },
        include: {
          request: {
            select: { id: true, project: { select: { id: true, name: true } } },
          },
        },
      })

      for (const workItem of overdueWorkItems) {
        if (workItem.dueDate) {
          const existingIdx = events.findIndex((e) => e.id === `workitem_${workItem.id}`)
          if (existingIdx >= 0) {
            events[existingIdx].type = 'OVERDUE'
          } else {
            events.push({
              id: `overdue_wi_${workItem.id}`,
              title: `⚠️ ${workItem.title}`,
              type: 'OVERDUE',
              date: workItem.dueDate.toISOString().split('T')[0],
              time: undefined,
              projectId: workItem.request?.project?.id || undefined,
              projectName: workItem.request?.project?.name || undefined,
              status: 'OVERDUE',
              view: 'work-items',
              viewParams: {},
            })
          }
        }
      }

      // 6. Project Milestones (project end dates)
      const projectEndDates = await db.project.findMany({
        where: {
          endDate: {
            gte: fromDate,
            lte: toDate,
          },
          status: { notIn: ['ARCHIVED'] },
        },
      })

      for (const project of projectEndDates) {
        if (project.endDate) {
          events.push({
            id: `milestone_${project.id}`,
            title: `🏁 ${project.name} End Date`,
            type: 'MILESTONE',
            date: project.endDate.toISOString().split('T')[0],
            time: undefined,
            projectId: project.id,
            projectName: project.name,
            status: project.status,
            view: 'project-detail',
            viewParams: { id: project.id },
          })
        }
      }

      // If month parameter is used, also add demo/mock events if no Google connection
      if (monthParam && !oauthToken) {
        // Add some demo events so the calendar isn't completely empty for new users
        const demoEvents = generateDemoEvents(monthParam, user.id)
        events.push(...demoEvents)
      }

      // Sort events by date, then by time
      events.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date)
        if (dateCompare !== 0) return dateCompare
        if (a.time && b.time) return a.time.localeCompare(b.time)
        if (a.time) return -1
        if (b.time) return 1
        return 0
      })

      // If using from/to params (meetings page compatibility), also return Google Calendar format
      if (fromParam && toParam && oauthToken) {
        const isDemo = oauthToken.accessToken.startsWith('demo_')
        if (isDemo) {
          const mockGoogleEvents = generateMockCalendarEvents(user.id, oauthToken.id, projectId, fromDate, toDate)
          return {
            connected: true,
            mode: 'demo',
            events: mockGoogleEvents,
          }
        }
      }

      // Include Google connection status in response
      const googleConnected = !!oauthToken
      const googleEmail = oauthToken?.googleEmail || null
      const googleMode = oauthToken?.accessToken.startsWith('demo_') ? 'demo' : oauthToken ? 'production' : null

      return { events, googleConnected, googleEmail, googleMode }
    } catch (error) {
      console.error('Calendar events error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/calendar/sync - Syncs Google Calendar events to meetings
  .post('/sync', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { projectId } = body

      // Check for active Google OAuth token
      const oauthToken = await db.googleOAuthToken.findFirst({
        where: { userId: user.id, isActive: true },
      })

      if (!oauthToken) {
        set.status = 400
        return { error: 'Google account not connected. Please connect your Google account first.' }
      }

      const isDemo = oauthToken.accessToken.startsWith('demo_')
      let syncedCount = 0
      const syncedEvents: any[] = []

      if (isDemo) {
        // Demo mode: create mock synced events and link them to meetings
        const mockEventData = [
          {
            title: 'Sprint Planning Meeting',
            description: 'Bi-weekly sprint planning to review backlog and assign tasks.',
            meetCode: 'abc-defg-hij',
            hourOffset: 0,
          },
          {
            title: 'Requirements Review',
            description: 'Review and validate business requirements with stakeholders.',
            meetCode: 'klm-nopq-rst',
            hourOffset: 2,
          },
          {
            title: 'UAT Sign-off Meeting',
            description: 'Final UAT sign-off with business users before go-live.',
            meetCode: 'uvw-xyza-bcd',
            hourOffset: 4,
          },
        ]

        for (let i = 0; i < mockEventData.length; i++) {
          const mock = mockEventData[i]
          const googleEventId = `demo_synced_${Date.now()}_${i}`

          // Check if this event already exists
          const existingEvent = await db.googleCalendarEvent.findUnique({
            where: { googleEventId },
          })

          if (existingEvent) {
            syncedEvents.push(existingEvent)
            continue
          }

          const scheduledAt = new Date()
          scheduledAt.setHours(9 + mock.hourOffset, 0, 0, 0)
          const endAt = new Date(scheduledAt)
          endAt.setHours(scheduledAt.getHours() + 1)

          // Create a meeting for this calendar event
          const meeting = await db.meeting.create({
            data: {
              projectId: projectId || null,
              title: mock.title,
              description: mock.description,
              meetingUrl: `https://meet.google.com/${mock.meetCode}`,
              scheduledAt,
              status: 'SCHEDULED',
              botStatus: 'IDLE',
              recordingStatus: 'NONE',
            },
          })

          // Create the calendar event linked to the meeting
          const calendarEvent = await db.googleCalendarEvent.create({
            data: {
              googleEventId,
              userId: user.id,
              oauthTokenId: oauthToken.id,
              projectId: projectId || null,
              meetingId: meeting.id,
              title: mock.title,
              description: mock.description,
              meetingUrl: `https://meet.google.com/${mock.meetCode}`,
              location: `Google Meet: https://meet.google.com/${mock.meetCode}`,
              organizerEmail: user.email,
              startAt: scheduledAt,
              endAt,
              status: 'CONFIRMED',
              attendees: JSON.stringify([
                { email: 'attendee1@demo.com', name: 'Alice Demo', responseStatus: 'accepted' },
                { email: 'attendee2@demo.com', name: 'Bob Demo', responseStatus: 'accepted' },
              ]),
              isRecurring: false,
              syncedAt: new Date(),
            },
            include: {
              meeting: {
                select: { id: true, title: true, status: true, meetingUrl: true },
              },
            },
          })

          syncedEvents.push(calendarEvent)
          syncedCount++
        }
      } else {
        // Production mode: fetch from Google Calendar API and sync
        const now = new Date()
        const from = new Date(now)
        from.setDate(from.getDate() - 7)
        const to = new Date(now)
        to.setDate(to.getDate() + 30)

        const calendarResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(from.toISOString())}&timeMax=${encodeURIComponent(to.toISOString())}&singleEvents=true&orderBy=startTime`,
          {
            headers: { Authorization: `Bearer ${oauthToken.accessToken}` },
          }
        )

        if (!calendarResponse.ok) {
          set.status = 502
          return { error: 'Failed to fetch Google Calendar events' }
        }

        const calendarData = await calendarResponse.json()
        const items = calendarData.items || []

        for (const event of items) {
          const googleEventId = event.id

          // Skip if already synced
          const existing = await db.googleCalendarEvent.findUnique({
            where: { googleEventId },
          })

          if (existing) {
            // Update existing if changed
            if (event.summary !== existing.title || event.status?.toUpperCase() !== existing.status) {
              await db.googleCalendarEvent.update({
                where: { googleEventId },
                data: {
                  title: event.summary || existing.title,
                  description: event.description || existing.description,
                  meetingUrl: event.hangoutLink || existing.meetingUrl,
                  location: event.location || existing.location,
                  startAt: event.start?.dateTime ? new Date(event.start.dateTime) : existing.startAt,
                  endAt: event.end?.dateTime ? new Date(event.end.dateTime) : existing.endAt,
                  status: (event.status || 'CONFIRMED').toUpperCase(),
                  attendees: event.attendees ? JSON.stringify(event.attendees) : existing.attendees,
                  syncedAt: new Date(),
                },
              })
            }
            continue
          }

          const meetingUrl = event.hangoutLink || null
          const startAt = event.start?.dateTime ? new Date(event.start.dateTime) : new Date()

          // Create meeting if it has a Google Meet link
          let meetingId: string | null = null
          if (meetingUrl) {
            const meeting = await db.meeting.create({
              data: {
                projectId: projectId || null,
                title: event.summary || 'Untitled Calendar Event',
                description: event.description || null,
                meetingUrl,
                scheduledAt: startAt,
                status: 'SCHEDULED',
                botStatus: 'IDLE',
                recordingStatus: 'NONE',
              },
            })
            meetingId = meeting.id
          }

          // Create calendar event record
          const calendarEvent = await db.googleCalendarEvent.create({
            data: {
              googleEventId,
              userId: user.id,
              oauthTokenId: oauthToken.id,
              projectId: projectId || null,
              meetingId,
              title: event.summary || 'Untitled Calendar Event',
              description: event.description || null,
              meetingUrl,
              location: event.location || null,
              organizerEmail: event.organizer?.email || null,
              startAt,
              endAt: event.end?.dateTime ? new Date(event.end.dateTime) : new Date(startAt.getTime() + 3600000),
              status: (event.status || 'CONFIRMED').toUpperCase(),
              attendees: event.attendees ? JSON.stringify(event.attendees) : null,
              isRecurring: !!event.recurrence,
              recurrenceRule: event.recurrence?.[0] || null,
              syncedAt: new Date(),
            },
          })

          syncedEvents.push(calendarEvent)
          syncedCount++
        }
      }

      return {
        success: true,
        syncedCount,
        totalEvents: syncedEvents.length,
        events: syncedEvents,
        mode: isDemo ? 'demo' : 'production',
      }
    } catch (error) {
      console.error('Calendar sync error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
