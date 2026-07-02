import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'
import { verifyPassword, hashPassword } from '../lib/auth'
import { logAudit } from '../lib/services/audit-service'
import { getActionInbox, dismissActionItem } from '../lib/services/action-inbox-service'
import { getPendingApprovals } from '../lib/services/approval-service'

export const meRoutes = new Elysia({ prefix: '/api/me' })
  // GET /api/me/action-inbox - Get action inbox items for current user
  .get('/action-inbox', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const type = searchParams.get('type') || undefined

      const { items, total } = await getActionInbox(authUser.id, { page, limit })

      // Filter by type if provided
      const filteredItems = type
        ? items.filter(item => item.type === type)
        : items

      const filteredTotal = type ? filteredItems.length : total

      return {
        data: filteredItems,
        pagination: {
          page,
          limit,
          total: filteredTotal,
          totalPages: Math.ceil(filteredTotal / limit),
        },
      }
    } catch (error) {
      console.error('Get action inbox error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/me/action-inbox/:itemId/dismiss - Dismiss an action inbox item
  .post('/action-inbox/:itemId/dismiss', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { itemId } = params

      const body = await request.json().catch(() => ({}))
      const itemType = body.type

      if (!itemType) {
        set.status = 400
        return { error: 'type is required in the request body (e.g. APPROVAL_PENDING, MIT_PENDING)' }
      }

      await dismissActionItem(itemId, itemType, authUser.id)

      return { data: { message: 'Action item dismissed' } }
    } catch (error) {
      console.error('Dismiss action item error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/me/approvals - Get pending approvals for current user
  .get('/approvals', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const approvals = await getPendingApprovals(authUser.id)

      return { data: approvals }
    } catch (error) {
      console.error('Get pending approvals error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/me/notification-preferences - Get current user's notification preferences
  .get('/notification-preferences', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const preferences = await db.notificationPreference.findMany({
        where: { userId: authUser.id },
        orderBy: { eventKey: 'asc' },
      })

      return { data: preferences }
    } catch (error) {
      console.error('Get notification preferences error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // PATCH /api/me/notification-preferences - Update notification preferences
  .patch('/notification-preferences', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { preferences } = body as {
        preferences: Array<{ eventKey: string; inAppEnabled: boolean; emailEnabled: boolean }>
      }

      if (!Array.isArray(preferences)) {
        set.status = 400
        return { error: 'preferences must be an array of { eventKey, inAppEnabled, emailEnabled }' }
      }

      const results = []

      for (const pref of preferences) {
        if (!pref.eventKey) continue

        const upserted = await db.notificationPreference.upsert({
          where: {
            userId_eventKey: {
              userId: authUser.id,
              eventKey: pref.eventKey,
            },
          },
          create: {
            userId: authUser.id,
            eventKey: pref.eventKey,
            inAppEnabled: pref.inAppEnabled ?? true,
            emailEnabled: pref.emailEnabled ?? true,
          },
          update: {
            inAppEnabled: pref.inAppEnabled ?? true,
            emailEnabled: pref.emailEnabled ?? true,
          },
        })

        results.push(upserted)
      }

      return { data: results }
    } catch (error) {
      console.error('Update notification preferences error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // PATCH /api/me/password - Change password
  .patch('/password', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { currentPassword, newPassword } = body

      if (!currentPassword || !newPassword) {
        set.status = 400
        return { error: 'currentPassword and newPassword are required' }
      }

      if (newPassword.length < 6) {
        set.status = 400
        return { error: 'New password must be at least 6 characters' }
      }

      const user = await db.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, password: true },
      })

      if (!user) {
        set.status = 404
        return { error: 'User not found' }
      }

      const isValid = await verifyPassword(currentPassword, user.password)
      if (!isValid) {
        set.status = 400
        return { error: 'Current password is incorrect' }
      }

      const hashedPassword = await hashPassword(newPassword)
      await db.user.update({
        where: { id: authUser.id },
        data: { password: hashedPassword },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CHANGE_PASSWORD',
        entity: 'User',
        entityId: authUser.id,
      })

      return { data: { message: 'Password changed successfully' } }
    } catch (error) {
      console.error('Change password error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/me/profile - Get current user's profile
  .get('/profile', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const user = await db.user.findUnique({
        where: { id: authUser.id },
        include: {
          department: { select: { id: true, name: true, code: true, type: true, description: true, parent: { select: { id: true, name: true, code: true } } } },
          roles: {
            include: {
              role: {
                select: { id: true, key: true, name: true, permissions: { include: { permission: { select: { key: true, name: true, module: true } } } } },
              },
            },
          },
        },
      })

      if (!user) {
        set.status = 404
        return { error: 'User not found' }
      }

      const { password: _, ...profile } = user

      return {
        data: {
          ...profile,
          roleKeys: user.roles.map(ur => ur.role.key),
        },
      }
    } catch (error) {
      console.error('Get profile error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // PATCH /api/me/profile - Update current user's profile
  .patch('/profile', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const allowedFields = ['name', 'phone', 'position', 'timezone', 'locale', 'themePreference', 'avatarUrl']

      const data: Record<string, unknown> = {}
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          data[field] = body[field]
        }
      }

      if (Object.keys(data).length === 0) {
        set.status = 400
        return { error: 'No valid fields to update' }
      }

      const updated = await db.user.update({
        where: { id: authUser.id },
        data,
        include: {
          department: { select: { id: true, name: true, code: true, type: true, description: true, parent: { select: { id: true, name: true, code: true } } } },
          roles: {
            include: {
              role: { select: { id: true, key: true, name: true } },
            },
          },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_PROFILE',
        entity: 'User',
        entityId: authUser.id,
        newValue: data,
      })

      const { password: _, ...profile } = updated

      return {
        data: {
          ...profile,
          roleKeys: updated.roles.map(ur => ur.role.key),
        },
      }
    } catch (error) {
      console.error('Update profile error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
