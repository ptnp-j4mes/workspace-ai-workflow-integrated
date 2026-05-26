import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/meetings/[id]/summary - Get latest meeting summary
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

    const summary = await db.meetingSummary.findFirst({
      where: { meetingId: id },
      orderBy: { createdAt: 'desc' },
    })

    if (!summary) {
      return NextResponse.json({ error: 'No summary found' }, { status: 404 })
    }

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Get meeting summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
