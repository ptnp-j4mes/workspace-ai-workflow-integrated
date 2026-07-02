import { Elysia } from 'elysia'
import { getAuthUser } from '../lib/api-auth'
import { getUserNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../lib/services/notification-service'

export const notificationsRoutes = new Elysia({ prefix: '/api/notifications' })
  // GET /api/notifications - Get user's notifications (enhanced)
  .get('/', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
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

      return {
        data: filteredItems,
        unreadCount,
        pagination: {
          page,
          limit,
          total: eventKey || entityType || after ? filteredItems.length : total,
          totalPages: Math.ceil((eventKey || entityType || after ? filteredItems.length : total) / limit),
        },
      }
    } catch (error) {
      console.error('Get notifications error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/notifications/:id/read - Mark notification as read
  .post('/:id/read', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      await markAsRead(id, authUser.id)

      return { data: { message: 'Notification marked as read' } }
    } catch (error) {
      console.error('Mark notification read error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/notifications/read-all - Mark all notifications as read for current user
  .post('/read-all', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      await markAllAsRead(authUser.id)

      return { data: { message: 'All notifications marked as read' } }
    } catch (error) {
      console.error('Mark all notifications read error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
