'use client'

import { useEffect, useState, useCallback } from 'react'
import { FileText, Plus, Sparkles, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface RequestItem {
  id: string
  code: string
  title: string
  type: string
  priority: string
  status: string
  projectId: string | null
  affectedSystem: string | null
  createdById: string
  createdAt: string
  dueDate: string | null
  project: { id: string; name: string; code: string } | null
  createdBy: { id: string; name: string; email: string } | null
  assignedBA: { id: string; name: string; email: string } | null
  assignedDev: { id: string; name: string; email: string } | null
  assignedQA: { id: string; name: string; email: string } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ============================================================
// Badge color maps
// ============================================================

const TYPE_COLORS: Record<string, string> = {
  FEATURE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  BUG: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CHANGE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  SUPPORT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  QUESTION: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  INCIDENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  URGENT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  SUBMITTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  ASSIGNED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  IN_DEVELOPMENT: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  QA: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  UAT: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CLOSED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
}

const STATUS_OPTIONS = ['All', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT', 'COMPLETED', 'CLOSED']
const TYPE_OPTIONS = ['All', 'FEATURE', 'BUG', 'CHANGE', 'SUPPORT', 'QUESTION', 'INCIDENT']
const PRIORITY_OPTIONS = ['All', 'LOW', 'MEDIUM', 'HIGH', 'URGENT']

function formatLabel(val: string): string {
  return val.replace(/_/g, ' ')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ============================================================
// Component
// ============================================================

export default function RequestsPage() {
  const { navigate } = useAppStore()
  const { t } = useI18n()

  const [requests, setRequests] = useState<RequestItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [search, setSearch] = useState('')

  const fetchRequests = useCallback(async (page: number = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (statusFilter !== 'All') params.set('status', statusFilter)
      if (typeFilter !== 'All') params.set('type', typeFilter)
      if (priorityFilter !== 'All') params.set('priority', priorityFilter)
      if (search) params.set('search', search)

      const data = await api.get<{ requests: RequestItem[]; pagination: Pagination }>(
        `/api/requests?${params.toString()}`
      )
      setRequests(data.requests || [])
      setPagination(data.pagination || { page, limit: 20, total: 0, totalPages: 0 })
    } catch {
      // Handle error silently
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, priorityFilter, search])

  useEffect(() => {
    fetchRequests(1)
  }, [fetchRequests])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchRequests(newPage)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.requests.title}</h1>
            <p className="text-sm text-muted-foreground">
              {pagination.total} {t.common.total} {t.requests.title.toLowerCase()}{pagination.total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('ai-intake')}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            AI Intake
          </Button>
          <Button onClick={() => navigate('request-create')} className="gap-2">
            <Plus className="h-4 w-4" />
            {t.requests.createRequest}
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t.common.status} />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'All' ? `${t.common.all} ${t.common.status}es` : formatLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t.common.type} />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((typeOpt) => (
                  <SelectItem key={typeOpt} value={typeOpt}>
                    {typeOpt === 'All' ? `${t.common.all} ${t.common.type}s` : formatLabel(typeOpt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t.common.priority} />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === 'All' ? `${t.common.all} ${t.common.priority}s` : formatLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`${t.common.search} ${t.requests.title.toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Request Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead className="min-w-[200px]">Title</TableHead>
              <TableHead>{t.common.type}</TableHead>
              <TableHead>{t.common.priority}</TableHead>
              <TableHead>{t.common.status}</TableHead>
              <TableHead className="hidden md:table-cell">Project</TableHead>
              <TableHead className="hidden lg:table-cell">{t.requests.assignedTo}</TableHead>
              <TableHead className="hidden lg:table-cell">{t.common.createdAt}</TableHead>
              <TableHead className="w-[50px]">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  {t.requests.noRequests}
                </TableCell>
              </TableRow>
            ) : (
              requests.map((req) => {
                const assignedPerson = req.assignedBA || req.assignedDev || req.assignedQA
                return (
                  <TableRow
                    key={req.id}
                    className="cursor-pointer"
                    onClick={() => navigate('request-detail', { id: req.id })}
                  >
                    <TableCell className="font-mono text-xs font-medium">{req.code}</TableCell>
                    <TableCell className="font-medium max-w-[300px] truncate">{req.title}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${TYPE_COLORS[req.type] || ''}`}
                      >
                        {formatLabel(req.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${PRIORITY_COLORS[req.priority] || ''}`}
                      >
                        {formatLabel(req.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${STATUS_COLORS[req.status] || ''}`}
                      >
                        {formatLabel(req.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {req.project?.name || '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {assignedPerson?.name || '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {formatDate(req.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate('request-detail', { id: req.id })
                        }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
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
    </div>
  )
}
