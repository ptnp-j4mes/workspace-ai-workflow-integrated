'use client'

import { useEffect, useRef, useCallback } from 'react'
import { toast } from '@/lib/toast'
import { api } from '@/lib/api-client'
import { Bell, CheckCircle, AlertTriangle, Info, MessageSquare } from 'lucide-react'

interface NotificationItem {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

// Map notification types to icons and colors
const NOTIFICATION_STYLES: Record<string, { icon: React.ElementType; color: string; variant: 'success' | 'destructive' | 'warning' | 'info' | 'default' }> = {
  APPROVAL: { icon: CheckCircle, color: 'text-green-500', variant: 'success' },
  BUG: { icon: AlertTriangle, color: 'text-red-500', variant: 'destructive' },
  SYSTEM: { icon: Info, color: 'text-blue-500', variant: 'info' },
  MENTION: { icon: MessageSquare, color: 'text-purple-500', variant: 'info' },
  ASSIGNMENT: { icon: Bell, color: 'text-amber-500', variant: 'info' },
  DEFAULT: { icon: Bell, color: 'text-gray-500', variant: 'default' },
}

export function NotificationToaster() {
  const lastCheckedAt = useRef<string>(new Date().toISOString())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const checkNewNotifications = useCallback(async () => {
    try {
      const data = await api.get<{ data: NotificationItem[]; unreadCount: number }>(
        `/api/notifications?limit=5&after=${encodeURIComponent(lastCheckedAt.current)}`
      )
      const newNotifs = data.data || []
      if (newNotifs.length > 0) {
        // Show toast for each new notification (max 3 to avoid spam)
        const toShow = newNotifs.slice(0, 3)
        for (const notif of toShow) {
          const style = NOTIFICATION_STYLES[notif.type] || NOTIFICATION_STYLES.DEFAULT
          const variant = style.variant
          // Use the appropriate toast method based on notification variant
          const title = notif.title
          const message = notif.message
          if (variant === 'success') {
            toast.success(title, message)
          } else if (variant === 'destructive') {
            toast.error(title, message)
          } else if (variant === 'warning') {
            toast.warning(title, message)
          } else if (variant === 'info') {
            toast.info(title, message)
          } else {
            toast(title)
          }
        }
        // Update last checked timestamp
        if (newNotifs[0]?.createdAt) {
          lastCheckedAt.current = newNotifs[0].createdAt
        }
      }
    } catch {
      // Silently ignore notification check errors
    }
  }, [])

  useEffect(() => {
    // Check every 30 seconds
    intervalRef.current = setInterval(checkNewNotifications, 30000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [checkNewNotifications])

  // This component doesn't render anything visible
  return null
}
