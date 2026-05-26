import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/meetings/[id] - Get meeting detail with participants, transcripts, summaries, action items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

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
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    return NextResponse.json({ meeting })
  } catch (error) {
    console.error('Get meeting error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/meetings/[id] - Update meeting
export async function PATCH(
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

    const existing = await db.meeting.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
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

    return NextResponse.json({ meeting: updated })
  } catch (error) {
    console.error('Update meeting error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/meetings/[id] - Delete meeting by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existing = await db.meeting.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Cascade delete: participants, transcripts, summaries, action items, bot sessions
    // Prisma schema has onDelete: Cascade on all related models
    await db.meeting.delete({ where: { id } })

    return NextResponse.json({ message: 'Meeting deleted successfully' })
  } catch (error) {
    console.error('Delete meeting error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
