import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// POST /api/calendar/sync - Syncs Google Calendar events to meetings
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { projectId } = body

    // Check for active Google OAuth token
    const oauthToken = await db.googleOAuthToken.findFirst({
      where: { userId: user.id, isActive: true },
    })

    if (!oauthToken) {
      return NextResponse.json(
        { error: 'Google account not connected. Please connect your Google account first.' },
        { status: 400 }
      )
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
        return NextResponse.json(
          { error: 'Failed to fetch Google Calendar events' },
          { status: 502 }
        )
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

    return NextResponse.json({
      success: true,
      syncedCount,
      totalEvents: syncedEvents.length,
      events: syncedEvents,
      mode: isDemo ? 'demo' : 'production',
    })
  } catch (error) {
    console.error('Calendar sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
