'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  GitPullRequest,
  Plus,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface ChangeRequestItem {
  id: string
  title: string
  description: string
  category: string | null
  impactLevel: string | null
  isApproved: boolean
  aitNo: string | null
  status: string
  requestId: string | null
  projectId: string | null
  createdAt: string
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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  IMPLEMENTING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const CATEGORY_COLORS: Record<string, string> = {
  ENHANCEMENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  MODIFICATION: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  REMOVAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  MIGRATION: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

const IMPACT_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

function formatLabel(val: string): string {
  return val.replace(/_/g, ' ')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ============================================================
// Component
// ============================================================

export default function ChangeRequestsPage() {
  const { navigate } = useAppStore()
  const { t } = useI18n()
  const [changeRequests, setChangeRequests] = useState<ChangeRequestItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState('ENHANCEMENT')
  const [formImpactLevel, setFormImpactLevel] = useState('MEDIUM')

  const fetchChangeRequests = useCallback(async (page: number = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (search) params.set('search', search)

      const data = await api.get<{ data: ChangeRequestItem[]; pagination: Pagination }>(
        `/api/change-requests?${params.toString()}`
      )
      setChangeRequests(data.data || [])
      setPagination(data.pagination || { page, limit: 20, total: 0, totalPages: 0 })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load change requests')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter, search])

  useEffect(() => {
    ;(() => fetchChangeRequests(1))()
  }, [fetchChangeRequests])

  const handleCreate = async () => {
    if (!formTitle || !formDescription) return
    setSaving(true)
    try {
      await api.post('/api/change-requests', {
        title: formTitle,
        description: formDescription,
        category: formCategory,
        impactLevel: formImpactLevel,
      })
      setDialogOpen(false)
      setFormTitle('')
      setFormDescription('')
      fetchChangeRequests(1)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create change request')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
            <GitPullRequest className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.changeRequests.title}</h1>
            <p className="text-sm text-muted-foreground">{pagination.total} {t.common.total.toLowerCase()}</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> {t.common.create} Change Request
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => fetchChangeRequests(pagination.page)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="IMPLEMENTING">Implementing</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="ENHANCEMENT">Enhancement</SelectItem>
                <SelectItem value="MODIFICATION">Modification</SelectItem>
                <SelectItem value="REMOVAL">Removal</SelectItem>
                <SelectItem value="MIGRATION">Migration</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search change requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Impact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">AIT No</TableHead>
              <TableHead className="hidden lg:table-cell">Created</TableHead>
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
            ) : changeRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No change requests found. {t.changeRequests.noChangeRequests}
                </TableCell>
              </TableRow>
            ) : (
              changeRequests.map((cr) => (
                <TableRow key={cr.id} className="cursor-pointer" onClick={() => navigate('request-detail', { id: cr.requestId || cr.id })}>
                  <TableCell className="font-medium max-w-[300px] truncate">{cr.title}</TableCell>
                  <TableCell>
                    {cr.category ? (
                      <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[cr.category] || ''}`}>
                        {formatLabel(cr.category)}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {cr.impactLevel ? (
                      <Badge variant="outline" className={`text-[10px] ${IMPACT_COLORS[cr.impactLevel] || ''}`}>
                        {formatLabel(cr.impactLevel)}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[cr.status] || ''}`}>
                      {formatLabel(cr.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs font-mono text-muted-foreground">
                    {cr.aitNo ?? '—'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {formatDate(cr.createdAt)}
                  </TableCell>
                </TableRow>
              ))
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
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchChangeRequests(pagination.page - 1)} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> {t.common.previous}
            </Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchChangeRequests(pagination.page + 1)} className="gap-1">
              {t.common.next} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.common.create} Change Request</DialogTitle>
            <DialogDescription>Submit a change request for review</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Change request title" />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Describe the change..." rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENHANCEMENT">Enhancement</SelectItem>
                    <SelectItem value="MODIFICATION">Modification</SelectItem>
                    <SelectItem value="REMOVAL">Removal</SelectItem>
                    <SelectItem value="MIGRATION">Migration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Impact Level</Label>
                <Select value={formImpactLevel} onValueChange={setFormImpactLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleCreate} disabled={saving || !formTitle || !formDescription}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
