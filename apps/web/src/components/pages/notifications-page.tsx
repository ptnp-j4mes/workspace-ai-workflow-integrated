'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Bell,
  Info,
  AlertTriangle,
  AlertCircle,
  Zap,
  Check,
  CheckCheck,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface Notification {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  link: string | null
  createdAt: string
}

// ============================================================
// Notification type icon mapping
// ============================================================

function getNotificationIcon(type: string) {
  const t = type.toUpperCase()
  if (t === 'WARNING') return AlertTriangle
  if (t === 'ERROR') return AlertCircle
  if (t === 'ACTION_REQUIRED') return Zap
  return Info
}

function getNotificationIconStyle(type: string) {
  const t = type.toUpperCase()
  if (t === 'WARNING') return 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
  if (t === 'ERROR') return 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
  if (t === 'ACTION_REQUIRED') return 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400'
  return 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
}

// ============================================================
// Component
// ============================================================

export default function NotificationsPage() {
  const { t } = useI18n()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set())

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.get<{ notifications: Notification[]; unreadCount: number }>(
        '/api/notifications?limit=50'
      )
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    ;(() => fetchNotifications())()
  }, [fetchNotifications])

  // Mark as read
  const handleMarkAsRead = async (id: string) => {
    setMarkingIds((prev) => new Set(prev).add(id))
    try {
      await api.post(`/api/notifications/${id}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    setMarkingAll(true)
    try {
      const unreadNotifications = notifications.filter((n) => !n.isRead)
      await Promise.all(
        unreadNotifications.map((n) => api.post(`/api/notifications/${n.id}/read`))
      )
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    } finally {
      setMarkingAll(false)
    }
  }

  // Time ago
  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.notifications.title}</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} ${t.common.unread.toLowerCase()}`
              : t.notifications.noNotifications}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={markingAll}
          >
            {markingAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Marking...
              </>
            ) : (
              <>
                <CheckCheck className="mr-2 h-4 w-4" />
                {t.common.markAllRead}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Bell className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <h3 className="text-lg font-medium text-foreground">{t.notifications.noNotifications}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.notifications.subtitle}
          </p>
        </div>
      ) : (
        <div className="max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto">
          {notifications.map((notification) => {
            const Icon = getNotificationIcon(notification.type)
            const iconStyle = getNotificationIconStyle(notification.type)
            const isMarking = markingIds.has(notification.id)

            return (
              <Card
                key={notification.id}
                className={`transition-all cursor-pointer ${
                  notification.isRead
                    ? 'opacity-60 hover:opacity-80'
                    : 'border-l-4 border-l-primary hover:shadow-sm'
                }`}
                onClick={() => {
                  if (!notification.isRead) {
                    handleMarkAsRead(notification.id)
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconStyle}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {notification.title}
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                        </div>

                        {/* Right side: time + read indicator */}
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {timeAgo(notification.createdAt)}
                          </span>
                          {!notification.isRead && (
                            <div className="flex h-5 items-center">
                              {isMarking ? (
                                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                              ) : (
                                <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0">
                                  NEW
                                </Badge>
                              )}
                            </div>
                          )}
                          {notification.isRead && (
                            <div className="flex h-5 items-center">
                              <Check className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
