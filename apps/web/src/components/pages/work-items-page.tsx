'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ClipboardList,
  Plus,
  LayoutGrid,
  List,
  Loader2,
  Calendar,
  User,
  Link2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/store/app-store'
import { api } from '@/lib/api-client'
import { toast } from '@/lib/toast'
import { useI18n } from '@/i18n'

// ============================================================
// Types
// ============================================================

interface WorkItemAssignment {
  id: string
  userId: string
  role: string
  isActive: boolean
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
}

interface WorkItem {
  id: string
  title: string
  description: string | null
  requestId: string | null
  projectId: string | null
  status: string
  priority: string
  dueDate: string | null
  createdAt: string
  updatedAt: string
  request?: {
    id: string
    title: string
    code: string
    status: string
  } | null
  assignments: WorkItemAssignment[]
}

const KANBAN_COLUMNS = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'DEPLOYED']

const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Low', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  MEDIUM: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  URGENT: { label: 'Urgent', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

const statusConfig: Record<string, { label: string; color: string }> = {
  CREATED: { label: 'Created', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  ASSIGNED: { label: 'Assigned', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  ACCEPTED: { label: 'Accepted', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  SUBMITTED: { label: 'Submitted', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300' },
  DEPLOYED: { label: 'Deployed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  RETURNED: { label: 'Returned', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

// ============================================================
// Component
// ============================================================

export default function WorkItemsPage() {
  const { t } = useI18n()
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [detailItem, setDetailItem] = useState<WorkItem | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formRequestId, setFormRequestId] = useState('')
  const [formProjectId, setFormProjectId] = useState('')
  const [formPriority, setFormPriority] = useState('MEDIUM')
  const [formDueDate, setFormDueDate] = useState('')

  const fetchWorkItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ workItems: WorkItem[] }>('/api/work-items')
      setWorkItems(data.workItems || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work items')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkItems()
  }, [fetchWorkItems])

  const handleCreate = async () => {
    if (!formTitle) {
      toast.warning('Validation Error', 'Title is required.')
      return
    }
    setCreating(true)
    try {
      await api.post('/api/work-items', {
        title: formTitle,
        description: formDescription,
        requestId: formRequestId || null,
        projectId: formProjectId || null,
        priority: formPriority,
        dueDate: formDueDate || null,
      })
      toast.success('Work item created')
      setDialogOpen(false)
      resetForm()
      fetchWorkItems()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setFormTitle('')
    setFormDescription('')
    setFormRequestId('')
    setFormProjectId('')
    setFormPriority('MEDIUM')
    setFormDueDate('')
  }

  const getAssigneeName = (item: WorkItem) => {
    const active = item.assignments?.find((a) => a.isActive)
    return active?.user?.name || 'Unassigned'
  }

  // Board view items grouped by status
  const boardItems: Record<string, WorkItem[]> = {}
  KANBAN_COLUMNS.forEach((col) => {
    boardItems[col] = workItems.filter((wi) => wi.status === col)
  })
  // Items not in standard columns
  const otherItems = workItems.filter((wi) => !KANBAN_COLUMNS.includes(wi.status))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.workItems.title}</h1>
            <p className="text-sm text-muted-foreground">{t.workItems.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-muted p-0.5">
            <Button
              variant={viewMode === 'board' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setViewMode('board')}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              Board
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setViewMode('table')}
            >
              <List className="h-3.5 w-3.5 mr-1" />
              Table
            </Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {t.workItems.createWorkItem}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.workItems.createWorkItem}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>{t.common.name} *</Label>
                  <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Work item title" />
                </div>
                <div className="space-y-2">
                  <Label>{t.common.description}</Label>
                  <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Request ID</Label>
                    <Input value={formRequestId} onChange={(e) => setFormRequestId(e.target.value)} placeholder="Optional" />
                  </div>
                  <div className="space-y-2">
                    <Label>Project ID</Label>
                    <Input value={formProjectId} onChange={(e) => setFormProjectId(e.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t.common.priority}</Label>
                    <Select value={formPriority} onValueChange={setFormPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.common.dueDate}</Label>
                    <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {t.common.create}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="border-destructive/50">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={fetchWorkItems} className="mt-3">{t.common.retry}</Button>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && workItems.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">{t.workItems.noWorkItems}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t.workItems.createWorkItem}</p>
          <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            {t.workItems.createWorkItem}
          </Button>
        </motion.div>
      )}

      {/* Board View */}
      {!loading && !error && workItems.length > 0 && viewMode === 'board' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => {
            const colStatus = statusConfig[col] || { label: col, color: '' }
            const items = boardItems[col] || []
            return (
              <div key={col} className="min-w-[260px] flex-1">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={colStatus.color}>
                      {colStatus.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <Card
                        className="cursor-pointer transition-shadow hover:shadow-md"
                        onClick={() => setDetailItem(item)}
                      >
                        <CardContent className="p-4 space-y-2">
                          <h4 className="text-sm font-medium line-clamp-2">{item.title}</h4>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className={`text-xs ${priorityConfig[item.priority]?.color || ''}`}>
                              {item.priority}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{getAssigneeName(item)}</span>
                            </div>
                            {item.dueDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{new Date(item.dueDate).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                          {item.request && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Link2 className="h-3 w-3" />
                              <span className="truncate">{item.request.code}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      No items
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {/* Other statuses */}
          {otherItems.length > 0 && (
            <div className="min-w-[260px] flex-1">
              <div className="mb-3">
                <Badge variant="secondary">Other</Badge>
                <span className="ml-2 text-xs text-muted-foreground">{otherItems.length}</span>
              </div>
              <div className="space-y-3">
                {otherItems.map((item) => (
                  <Card
                    key={item.id}
                    className="cursor-pointer transition-shadow hover:shadow-md"
                    onClick={() => setDetailItem(item)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <h4 className="text-sm font-medium line-clamp-2">{item.title}</h4>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className={`text-xs ${statusConfig[item.status]?.color || ''}`}>
                          {item.status}
                        </Badge>
                        <Badge variant="secondary" className={`text-xs ${priorityConfig[item.priority]?.color || ''}`}>
                          {item.priority}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table View */}
      {!loading && !error && workItems.length > 0 && viewMode === 'table' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.common.name}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead>{t.common.priority}</TableHead>
                  <TableHead>{t.common.assignee}</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>{t.common.dueDate}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm max-w-48 truncate">{item.title}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${statusConfig[item.status]?.color || ''}`}>
                        {statusConfig[item.status]?.label || item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${priorityConfig[item.priority]?.color || ''}`}>
                        {priorityConfig[item.priority]?.label || item.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{getAssigneeName(item)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.projectId ? item.projectId.substring(0, 8) + '...' : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDetailItem(item)}>
                        {t.common.viewDetails.split(' ')[0]}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailItem?.title}</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className={statusConfig[detailItem.status]?.color || ''}>
                  {statusConfig[detailItem.status]?.label || detailItem.status}
                </Badge>
                <Badge variant="secondary" className={priorityConfig[detailItem.priority]?.color || ''}>
                  {priorityConfig[detailItem.priority]?.label || detailItem.priority}
                </Badge>
              </div>
              {detailItem.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">{t.common.description}</Label>
                  <p className="text-sm mt-1">{detailItem.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t.common.assignee}:</span>{' '}
                  <span>{getAssigneeName(detailItem)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t.common.dueDate}:</span>{' '}
                  <span>{detailItem.dueDate ? new Date(detailItem.dueDate).toLocaleDateString() : '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t.common.createdAt}:</span>{' '}
                  <span>{new Date(detailItem.createdAt).toLocaleDateString()}</span>
                </div>
                {detailItem.request && (
                  <div>
                    <span className="text-muted-foreground">Request:</span>{' '}
                    <span>{detailItem.request.code}</span>
                  </div>
                )}
              </div>
              {detailItem.assignments?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">{t.common.assignee}</Label>
                  <div className="mt-1 space-y-1">
                    {detailItem.assignments.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{a.user.name}</span>
                        <Badge variant="outline" className="text-xs">{a.role}</Badge>
                        {!a.isActive && <span className="text-xs text-muted-foreground">(inactive)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
