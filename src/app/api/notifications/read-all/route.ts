import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { markAllAsRead } from '@/lib/services/notification-service'

// POST /api/notifications/read-all - Mark all notifications as read for current user
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await markAllAsRead(authUser.id)

    return NextResponse.json({ data: { message: 'All notifications marked as read' } })
  } catch (error) {
    console.error('Mark all notifications read error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
