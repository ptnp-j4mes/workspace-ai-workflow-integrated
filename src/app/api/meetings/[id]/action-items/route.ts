import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/meetings/[id]/action-items - Get meeting action items
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

    const meeting = await db.meeting.findUnique({ where: { id } })
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
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

    return NextResponse.json({ actionItems })
  } catch (error) {
    console.error('Get action items error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
