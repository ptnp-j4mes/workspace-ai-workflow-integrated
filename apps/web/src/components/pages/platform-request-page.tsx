'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Link2,
  Ban,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Monitor,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api-client'
import { toast } from '@/lib/toast'

// ============================================================
// Types
// ============================================================

interface PlatformRequestItem {
  id: string
  requestNo: string
  name: string
  description: string
  priority: string
  status: string
  objective?: string | null
  targetUsers?: string | null
  expectedTimeline?: string | null
  requesterId: string
  departmentId?: string | null
  projectId?: string | null
  rejectionReason?: string | null
  approvedAt?: string | null
  createdAt: string
  updatedAt: string
  requester: {
    id: string
    name: string
    email: string
  }
  department: {
    id: string
    name: string
    code: string
    parent?: {
      id: string
      name: string
      code: string
    } | null
  } | null
  project: {
    id: string
    name: string
    status: string
  } | null
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ============================================================
// Badge color maps
// ============================================================

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  PENDING: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  DIVISION_APPROVED: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: ShieldCheck },
  APPROVED: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  REJECTED: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  CANCELLED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: Ban },
  LINKED: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Link2 },
}

function formatLabel(val: string): string {
  return val.replace(/_/g, ' ')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ============================================================
// Component
// ============================================================

export default function PlatformRequestPage() {
  const { navigate, user } = useAppStore()
  const { t } = useI18n()

  const [activeTab, setActiveTab] = useState('mine')
  const [requests, setRequests] = useState<PlatformRequestItem[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Check if user is admin/SD user
  const isAdminOrSD =
    (user?.roles as Array<{ key: string }>)?.some(
      (r) =>
        r.key === 'ADMIN' ||
        r.key === 'SD_MANAGER' ||
        r.key === 'IT_MANAGER' ||
        r.key === 'DIVISION_MANAGER' ||
        r.key === 'DIVISION_HEAD'
    ) ||
    (user?.role as string) === 'ADMIN' ||
    (user?.role as string) === 'SD_MANAGER'

  const fetchRequests = useCallback(
    async (page: number = 1) => {
      setLoading(true)
      setError(false)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', '20')

        if (activeTab === 'mine') {
          params.set('mine', 'true')
        } else if (activeTab === 'pending') {
          params.set('pendingApproval', 'true')
        }
        // 'all' tab — no special filter (only for admin/SD)

        const data = await api.get<{
          data: PlatformRequestItem[]
          pagination: PaginationInfo
        }>(`/api/platform-requests?${params.toString()}`)
        setRequests(data.data || [])
        setPagination(
          data.pagination || { page, limit: 20, total: 0, totalPages: 0 }
        )
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    },
    [activeTab]
  )

  useEffect(() => {
    ;(() => fetchRequests(1))()
  }, [fetchRequests])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchRequests(newPage)
    }
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
  }

  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING
    const Icon = config.icon
    return (
      <Badge
        variant="outline"
        className={`text-[10px] font-semibold gap-1 ${config.color}`}
      >
        <Icon className="h-3 w-3" />
        {formatLabel(status)}
      </Badge>
    )
  }

  const renderPriorityBadge = (priority: string) => {
    return (
      <Badge
        variant="outline"
        className={`text-[10px] font-semibold ${
          PRIORITY_COLORS[priority] || PRIORITY_COLORS.MEDIUM
        }`}
      >
        {formatLabel(priority)}
      </Badge>
    )
  }

  const renderEmptyState = () => {
    const messages: Record<string, { title: string; description: string }> = {
      mine: {
        title: 'No requests yet',
        description: 'You haven\'t created any platform requests. Click "New Request" to get started.',
      },
      pending: {
        title: 'No pending approvals',
        description: 'There are no platform requests waiting for your approval.',
      },
      all: {
        title: 'No platform requests',
        description: 'There are no platform requests in the system yet.',
      },
    }
    const msg = messages[activeTab] || messages.all
    return (
      <TableRow>
        <TableCell colSpan={7} className="text-center py-12">
          <div className="flex flex-col items-center gap-2">
            <Monitor className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              {msg.title}
            </p>
            <p className="text-xs text-muted-foreground/70">{msg.description}</p>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  const renderLoadingSkeleton = () => (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 7 }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-5 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Monitor className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t.platformRequest.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {pagination.total} {t.common.total.toLowerCase()} request{pagination.total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate('platform-request-create')}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t.platformRequest.createRequest}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="mine">My Requests</TabsTrigger>
          <TabsTrigger value="pending">{t.common.pending} Approval</TabsTrigger>
          {isAdminOrSD && <TabsTrigger value="all">{t.common.all} Requests</TabsTrigger>}
        </TabsList>

        {/* All tabs share the same table layout */}
        <TabsContent value={activeTab} className="mt-4">
          {error ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                <p className="text-sm text-muted-foreground">
                  Failed to load platform requests
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchRequests(pagination.page)}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t.common.retry}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request No</TableHead>
                    <TableHead className="min-w-[180px]">
                      Platform Name
                    </TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    {activeTab === 'all' && (
                      <TableHead className="hidden md:table-cell">
                        Requester
                      </TableHead>
                    )}
                    <TableHead className="hidden lg:table-cell">
                      Department
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                    <TableHead className="hidden xl:table-cell">
                      Linked Project
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    renderLoadingSkeleton()
                  ) : requests.length === 0 ? (
                    renderEmptyState()
                  ) : (
                    requests.map((req) => (
                      <TableRow
                        key={req.id}
                        className="cursor-pointer"
                        onClick={() =>
                          navigate('platform-request-detail', {
                            id: req.id,
                          })
                        }
                      >
                        <TableCell className="font-mono text-xs font-medium">
                          {req.requestNo}
                        </TableCell>
                        <TableCell className="font-medium max-w-[280px] truncate">
                          {req.name}
                        </TableCell>
                        <TableCell>{renderPriorityBadge(req.priority)}</TableCell>
                        <TableCell>{renderStatusBadge(req.status)}</TableCell>
                        {activeTab === 'all' && (
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {req.requester?.name || '—'}
                          </TableCell>
                        )}
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {req.department
                            ? req.department.parent
                              ? `${req.department.parent.name} › ${req.department.name}`
                              : req.department.name
                            : '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {formatDate(req.createdAt)}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {req.project ? (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-primary text-sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate('project-detail', {
                                  id: req.project!.id,
                                })
                              }}
                            >
                              {req.project.name}
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Pagination */}
          {!error && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} (
                {pagination.total} items)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t.common.previous}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                  className="gap-1"
                >
                  {t.common.next}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
