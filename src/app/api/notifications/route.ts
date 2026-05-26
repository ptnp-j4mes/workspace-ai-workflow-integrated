import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getUserNotifications, getUnreadCount } from '@/lib/services/notification-service'

// GET /api/notifications - Get user's notifications (enhanced)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const isRead = searchParams.get('isRead')
    const eventKey = searchParams.get('eventKey')
    const entityType = searchParams.get('entityType')
    const after = searchParams.get('after') // ISO timestamp for polling new notifications

    const unreadOnly = isRead === 'false'

    const { items, total, unreadCount } = await getUserNotifications(
      authUser.id,
      { page, limit, unreadOnly }
    )

    // Apply additional filters
    let filteredItems = items as Array<Record<string, unknown>>
    if (eventKey) {
      filteredItems = filteredItems.filter(item => item.eventKey === eventKey)
    }
    if (entityType) {
      filteredItems = filteredItems.filter(item => item.entityType === entityType)
    }
    // Filter by 'after' timestamp for polling new notifications
    if (after) {
      const afterDate = new Date(after)
      if (!isNaN(afterDate.getTime())) {
        filteredItems = filteredItems.filter(item => {
          const createdAt = item.createdAt
          if (!createdAt) return false
          return new Date(createdAt as string) > afterDate
        })
      }
    }

    return NextResponse.json({
      data: filteredItems,
      unreadCount,
      pagination: {
        page,
        limit,
        total: eventKey || entityType || after ? filteredItems.length : total,
        totalPages: Math.ceil((eventKey || entityType || after ? filteredItems.length : total) / limit),
      },
    })
  } catch (error) {
    console.error('Get notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
