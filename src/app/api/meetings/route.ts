import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/meetings - List meetings
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    return NextResponse.json({ meetings })
  } catch (error) {
    console.error('List meetings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/meetings - Create meeting
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, requestId, title, description, meetingUrl, scheduledAt } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
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

    return NextResponse.json({ meeting }, { status: 201 })
  } catch (error) {
    console.error('Create meeting error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
