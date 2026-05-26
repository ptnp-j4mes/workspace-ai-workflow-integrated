import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/meetings/[id]/recordings - Lists recordings for a meeting
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: meetingId } = await params

    // Verify meeting exists
    const meeting = await db.meeting.findUnique({
      where: { id: meetingId },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const recordings = await db.meetingRecording.findMany({
      where: { meetingId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ recordings })
  } catch (error) {
    console.error('Get meeting recordings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
