'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Inbox,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  ClipboardList,
  ArrowRight,
  X,
  Clock,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface ActionItem {
  id: string
  type: string
  title: string
  description: string
  aitNo: string | null
  dueDate: string | null
  entityType: string | null
  entityId: string | null
  priority: string
  ctaLabel: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ============================================================
// Helpers
// ============================================================

const TYPE_ICONS: Record<string, React.ElementType> = {
  APPROVAL: CheckCircle,
  MIT_ASSIGNMENT: ClipboardList,
  HANDOFF: ArrowRight,
  OVERDUE: AlertTriangle,
}

const TYPE_COLORS: Record<string, { icon: string; bg: string }> = {
  APPROVAL: { icon: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  MIT_ASSIGNMENT: { icon: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/40' },
  HANDOFF: { icon: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  OVERDUE: { icon: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40' },
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  LOW: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ============================================================
// Component
// ============================================================

export default function ActionInboxPage() {
  const { navigate } = useAppStore()
  const { t } = useI18n()
  const [items, setItems] = useState<ActionItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('all')

  const fetchItems = useCallback(async (page: number = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (typeFilter !== 'all') params.set('type', typeFilter)

      const data = await api.get<{ data: ActionItem[]; pagination: Pagination }>(
        `/api/me/action-inbox?${params.toString()}`
      )
      setItems(data.data ?? [])
      setPagination(data.pagination || { page, limit: 20, total: 0, totalPages: 0 })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load action inbox')
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => {
    ;(() => fetchItems(1))()
  }, [fetchItems])

  const handleDismiss = async (itemId: string) => {
    try {
      await api.post(`/api/me/action-inbox/${itemId}/dismiss`)
      setItems((prev) => prev.filter((i) => i.id !== itemId))
    } catch {
      // Ignore
    }
  }

  const handleNavigate = (item: ActionItem) => {
    if (item.entityType && item.entityId) {
      const viewMap: Record<string, string> = {
        REQUEST: 'request-detail',
        PROJECT: 'project-detail',
        WORK_ITEM: 'work-items',
        MEETING: 'meeting-detail',
      }
      const view = viewMap[item.entityType]
      if (view) {
        navigate(view, { id: item.entityId })
      }
    }
  }

  // Get unique types for filter
  const typeOptions = ['all', ...Array.from(new Set(items.map((i) => i.type)))]

  if (loading && items.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => fetchItems(1)} className="gap-2">
          <RefreshCw className="h-4 w-4" /> {t.common.retry}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Inbox className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.actionInbox.title}</h1>
            <p className="text-sm text-muted-foreground">{pagination.total} {t.common.pending.toLowerCase()} action(s)</p>
          </div>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((typeOpt) => (
              <SelectItem key={typeOpt} value={typeOpt}>
                {typeOpt === 'all' ? t.common.all : typeOpt.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Inbox className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">{t.actionInbox.noItems}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const IconComp = TYPE_ICONS[item.type] || CheckCircle
            const colors = TYPE_COLORS[item.type] || TYPE_COLORS.APPROVAL
            return (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors.bg}`}>
                      <IconComp className={`h-5 w-5 ${colors.icon}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleDismiss(item.id)}
                          title={t.actionInbox.dismiss}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {item.type.replace(/_/g, ' ')}
                        </Badge>
                        {item.priority && (
                          <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[item.priority] || ''}`}>
                            {item.priority}
                          </Badge>
                        )}
                        {item.aitNo && (
                          <span className="text-xs font-mono text-muted-foreground">{item.aitNo}</span>
                        )}
                        {item.dueDate && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Due {formatDate(item.dueDate)}
                          </span>
                        )}
                      </div>
                      {(item.ctaLabel || (item.entityType && item.entityId)) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 h-7 text-xs gap-1"
                          onClick={() => handleNavigate(item)}
                        >
                          {item.ctaLabel || t.common.viewDetails}
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchItems(pagination.page - 1)} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> {t.common.previous}
            </Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchItems(pagination.page + 1)} className="gap-1">
              {t.common.next} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
