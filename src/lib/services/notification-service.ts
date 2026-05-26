// ============================================================
// Notification Service - Unified Notification Management
// ============================================================

import { db } from '@/lib/db'

interface SendNotificationData {
  userId?: string
  entityType?: string
  entityId?: string
  aitNo?: string
  title: string
  message: string
  link?: string
  additionalUserIds?: string[]
  eventKey?: string
  type?: string // INFO, WARNING, ERROR, ACTION_REQUIRED
}

interface UserNotificationsOptions {
  page?: number
  limit?: number
  unreadOnly?: boolean
}

/**
 * Send a notification based on an event key.
 * Determines recipients based on the NotificationRule's recipientStrategy,
 * checks user preferences, creates the Notification record,
 * and creates delivery records for the appropriate channels.
 */
export async function sendNotification(
  eventKey: string,
  data: SendNotificationData
): Promise<void> {
  try {
    // Look up the notification rule by eventKey
    const rule = await db.notificationRule.findUnique({
      where: { eventKey },
    })

    // Determine channels from the rule, or default to IN_APP
    const channels: string[] = rule
      ? JSON.parse(rule.channels)
      : ['IN_APP']

    // Determine recipients based on the recipientStrategy
    const recipientUserIds = await determineRecipients(
      rule?.recipientStrategy ?? 'ASSIGNEE',
      data
    )

    if (recipientUserIds.length === 0) {
      return
    }

    // For each recipient: check preferences and create notification + deliveries
    for (const recipientId of recipientUserIds) {
      // Check notification preferences
      const preference = rule
        ? await db.notificationPreference.findUnique({
            where: {
              userId_eventKey: { userId: recipientId, eventKey },
            },
          })
        : null

      // Check user's global notification settings
      const user = await db.user.findUnique({
        where: { id: recipientId },
        select: {
          inAppNotificationEnabled: true,
          emailNotificationEnabled: true,
          isActive: true,
        },
      })

      if (!user || !user.isActive) continue

      const inAppEnabled =
        preference ? preference.inAppEnabled : user.inAppNotificationEnabled
      const emailEnabled =
        preference ? preference.emailEnabled : user.emailNotificationEnabled

      // Create the notification record
      const notification = await db.notification.create({
        data: {
          userId: recipientId,
          title: data.title,
          message: data.message,
          type: data.type ?? 'INFO',
          eventKey,
          entityType: data.entityType ?? null,
          entityId: data.entityId ?? null,
          aitNo: data.aitNo ?? null,
          isRead: false,
          link: data.link ?? null,
        },
      })

      // Create IN_APP delivery if enabled
      if (channels.includes('IN_APP') && inAppEnabled) {
        await db.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            channel: 'IN_APP',
            status: 'SENT',
            deliveredAt: new Date(),
          },
        })
      }

      // Create EMAIL delivery if enabled (actual sending handled by smtp-service)
      if (channels.includes('EMAIL') && emailEnabled) {
        await db.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            channel: 'EMAIL',
            status: 'PENDING',
          },
        })

        // Queue email delivery log for smtp-service to pick up
        try {
          const recipient = await db.user.findUnique({
            where: { id: recipientId },
            select: { email: true },
          })
          if (recipient) {
            const { createEmailDeliveryLog } = await import('./smtp-service')
            await createEmailDeliveryLog({
              toEmail: recipient.email,
              subject: data.title,
              templateKey: `notification_${eventKey}`,
              aitNo: data.aitNo,
              relatedEntityType: data.entityType,
              relatedEntityId: data.entityId,
            })
          }
        } catch {
          // SMTP service may not be available yet; silently skip
        }
      }
    }
  } catch (error) {
    console.error('[NotificationService] Error sending notification:', error)
    // Don't throw - notifications should not break the calling workflow
  }
}

/**
 * Determine recipient user IDs based on the recipientStrategy.
 */
async function determineRecipients(
  strategy: string,
  data: SendNotificationData
): Promise<string[]> {
  const userIds = new Set<string>()

  // Always include the explicitly provided userId
  if (data.userId) {
    userIds.add(data.userId)
  }

  // Include additional user IDs
  if (data.additionalUserIds) {
    for (const uid of data.additionalUserIds) {
      userIds.add(uid)
    }
  }

  switch (strategy) {
    case 'ALL_ADMINS': {
      const admins = await db.userRole.findMany({
        where: { role: { key: 'ADMIN' } },
        select: { userId: true },
      })
      for (const a of admins) {
        userIds.add(a.userId)
      }
      break
    }

    case 'ASSIGNED_ROLE': {
      // Find users with roles assigned to the entity
      if (data.entityType && data.entityId) {
        const assignments = await db.workItemAssignment.findMany({
          where: { workItemId: data.entityId, isActive: true },
          select: { userId: true },
        })
        for (const a of assignments) {
          userIds.add(a.userId)
        }
      }
      break
    }

    case 'CREATOR': {
      // Find the creator of the entity
      if (data.entityType === 'REQUEST' && data.entityId) {
        const request = await db.request.findUnique({
          where: { id: data.entityId },
          select: { createdById: true },
        })
        if (request) userIds.add(request.createdById)
      } else if (data.entityType === 'PROJECT' && data.entityId) {
        const project = await db.project.findUnique({
          where: { id: data.entityId },
          select: { createdById: true },
        })
        if (project) userIds.add(project.createdById)
      }
      break
    }

    case 'SPECIFIC_USERS': {
      // additionalUserIds already added above
      break
    }

    case 'ASSIGNEE':
    default: {
      // The primary userId is already added above
      break
    }
  }

  return Array.from(userIds)
}

/**
 * Mark a notification as read.
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  try {
    await db.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    })
  } catch (error) {
    console.error('[NotificationService] Error marking as read:', error)
    throw error
  }
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId: string): Promise<void> {
  try {
    await db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })
  } catch (error) {
    console.error('[NotificationService] Error marking all as read:', error)
    throw error
  }
}

/**
 * Get the count of unread notifications for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    return await db.notification.count({
      where: { userId, isRead: false },
    })
  } catch (error) {
    console.error('[NotificationService] Error getting unread count:', error)
    return 0
  }
}

/**
 * Get paginated notifications for a user.
 */
export async function getUserNotifications(
  userId: string,
  options: UserNotificationsOptions = {}
): Promise<{ items: unknown[]; total: number; unreadCount: number }> {
  const page = options.page ?? 1
  const limit = options.limit ?? 20
  const skip = (page - 1) * limit

  try {
    const where = {
      userId,
      ...(options.unreadOnly ? { isRead: false } : {}),
    }

    const [items, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: { userId, isRead: false },
      }),
    ])

    return { items, total, unreadCount }
  } catch (error) {
    console.error('[NotificationService] Error getting user notifications:', error)
    return { items: [], total: 0, unreadCount: 0 }
  }
}
