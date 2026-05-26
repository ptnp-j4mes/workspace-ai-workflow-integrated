'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Database,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface AuditLogItem {
  id: string
  action: string
  entity: string
  entityId: string | null
  aitNo: string | null
  oldValue: string | null
  newValue: string | null
  createdAt: string
  user: { id: string; name: string; email: string } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============================================================
// Component
// ============================================================

export default function AdminAuditLogsPage() {
  const { t } = useI18n()
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filters
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [aitNoFilter, setAitNoFilter] = useState('')

  const fetchLogs = useCallback(async (page: number = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (actionFilter) params.set('action', actionFilter)
      if (entityFilter) params.set('entity', entityFilter)
      if (aitNoFilter) params.set('aitNo', aitNoFilter)

      const data = await api.get<{ data: AuditLogItem[]; pagination: Pagination }>(
        `/api/admin/audit-logs?${params.toString()}`
      )
      setLogs(data.data ?? [])
      setPagination(data.pagination || { page, limit: 20, total: 0, totalPages: 0 })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [actionFilter, entityFilter, aitNoFilter])

  useEffect(() => {
    fetchLogs(1)
  }, [fetchLogs])

  const tryParseJson = (val: string | null): unknown => {
    if (!val) return null
    try {
      return JSON.parse(val)
    } catch {
      return val
    }
  }

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Card className="p-4">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => fetchLogs(1)} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
          <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.admin.auditLogs}</h1>
          <p className="text-sm text-muted-foreground">{pagination.total} log entries</p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <Input
            placeholder="Filter by action..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full sm:w-[180px]"
          />
          <Input
            placeholder="Filter by entity..."
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="w-full sm:w-[180px]"
          />
          <Input
            placeholder="Filter by AIT No..."
            value={aitNoFilter}
            onChange={(e) => setAitNoFilter(e.target.value)}
            className="w-full sm:w-[160px]"
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]" />
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="hidden md:table-cell">Entity</TableHead>
              <TableHead className="hidden lg:table-cell">AIT No</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  {t.common.noData}
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedId === log.id
                const hasDetail = log.oldValue || log.newValue
                return (
                  <React.Fragment key={log.id}>
                    <TableRow
                      className={hasDetail ? 'cursor-pointer' : ''}
                      onClick={() => hasDetail && setExpandedId(isExpanded ? null : log.id)}
                    >
                      <TableCell>
                        {hasDetail ? (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                          )
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">{log.user?.name ?? 'System'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{log.entity}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs font-mono text-muted-foreground">
                        {log.aitNo ?? '—'}
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasDetail && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30 p-4">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {log.oldValue && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">Before</p>
                                <pre className="rounded-lg border bg-background p-3 text-xs overflow-auto max-h-48">
                                  {typeof tryParseJson(log.oldValue) === 'string'
                                    ? log.oldValue
                                    : JSON.stringify(tryParseJson(log.oldValue), null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.newValue && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">After</p>
                                <pre className="rounded-lg border bg-background p-3 text-xs overflow-auto max-h-48">
                                  {typeof tryParseJson(log.newValue) === 'string'
                                    ? log.newValue
                                    : JSON.stringify(tryParseJson(log.newValue), null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchLogs(pagination.page - 1)} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchLogs(pagination.page + 1)} className="gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
