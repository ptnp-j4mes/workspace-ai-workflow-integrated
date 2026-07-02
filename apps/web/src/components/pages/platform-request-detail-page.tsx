'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Link2,
  Ban,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Monitor,
  Building,
  User,
  CalendarDays,
  Target,
  Users,
  Timer,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
import { toast } from '@/lib/toast'

// ============================================================
// Types
// ============================================================

interface ApprovalItem {
  id: string
  step: string
  status: string
  approverId: string
  comment: string | null
  actedAt: string | null
  createdAt: string
  approver: {
    id: string
    name: string
    email: string
  }
}

interface PlatformRequestDetail {
  id: string
  requestNo: string
  name: string
  description: string
  objective: string | null
  targetUsers: string | null
  expectedTimeline: string | null
  priority: string
  status: string
  requesterId: string
  departmentId: string | null
  divisionHeadId: string | null
  sdManagerId: string | null
  projectId: string | null
  rejectionReason: string | null
  approvedAt: string | null
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
    type: string | null
    description: string | null
    parent: {
      id: string
      name: string
      code: string
    } | null
  } | null
  divisionHead: {
    id: string
    name: string
    email: string
  } | null
  sdManager: {
    id: string
    name: string
    email: string
  } | null
  project: {
    id: string
    name: string
    status: string
    code: string | null
  } | null
  approvals: ApprovalItem[]
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

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  PENDING: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock, label: 'Pending' },
  DIVISION_APPROVED: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: ShieldCheck, label: 'Division Approved' },
  APPROVED: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2, label: 'Approved' },
  REJECTED: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Rejected' },
  CANCELLED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: Ban, label: 'Cancelled' },
  LINKED: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Link2, label: 'Linked' },
}

const STEP_LABELS: Record<string, string> = {
  DIVISION_HEAD: 'Division Head Approval',
  SD_MANAGER: 'SD Manager Approval',
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

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ============================================================
// Component
// ============================================================

export default function PlatformRequestDetailPage() {
  const { navigate, viewParams, user } = useAppStore()
  const { t } = useI18n()
  const requestId = viewParams?.id

  const [detail, setDetail] = useState<PlatformRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Approval action state
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null)
  const [actionComment, setActionComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  const fetchDetail = useCallback(async () => {
    if (!requestId) return
    setLoading(true)
    setError(false)
    try {
      const data = await api.get<{ data: PlatformRequestDetail }>(
        `/api/platform-requests/${requestId}`
      )
      setDetail(data.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    ;(() => fetchDetail())()
  }, [fetchDetail])

  // Determine if current user is the requester
  const isRequester = user?.id === detail?.requesterId

  // Determine if current user is a pending approver
  const pendingApprovalForUser = detail?.approvals.find(
    (a) => a.approverId === user?.id && a.status === 'PENDING'
  )

  const canApprove = !!pendingApprovalForUser && ['PENDING', 'DIVISION_APPROVED'].includes(detail?.status || '')
  const canCancel = isRequester && detail?.status === 'PENDING'

  // Handle approve/reject action
  const handleAction = async () => {
    if (!actionType || !requestId) return

    if (actionType === 'REJECT' && !actionComment.trim()) {
      toast.warning('Comment Required', 'Please provide a reason for rejection.')
      return
    }

    setActionLoading(true)
    try {
      await api.post(`/api/platform-requests/${requestId}/approve`, {
        action: actionType,
        comment: actionComment.trim() || undefined,
      })

      toast.success(
        actionType === 'APPROVE'
          ? 'Request Approved'
          : 'Request Rejected',
        actionType === 'APPROVE'
          ? 'You have approved this platform request.'
          : 'You have rejected this platform request.'
      )

      setActionDialogOpen(false)
      setActionType(null)
      setActionComment('')
      fetchDetail()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to process action'
      toast.error('Action Failed', message)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle cancel
  const handleCancel = async () => {
    if (!requestId) return
    setCancelLoading(true)
    try {
      await api.patch(`/api/platform-requests/${requestId}`, {
        status: 'CANCELLED',
      })
      toast.info('Request Cancelled', 'This platform request has been cancelled.')
      setCancelDialogOpen(false)
      fetchDetail()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to cancel request'
      toast.error('Cancel Failed', message)
    } finally {
      setCancelLoading(false)
    }
  }

  // ============================================================
  // Loading State
  // ============================================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6 space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // Error State
  // ============================================================

  if (error || !detail) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Failed to load platform request details
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDetail}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t.common.retry}
          </Button>
        </div>
      </div>
    )
  }

  // ============================================================
  // Render helpers
  // ============================================================

  const statusConfig = STATUS_CONFIG[detail.status] || STATUS_CONFIG.PENDING
  const StatusIcon = statusConfig.icon

  const renderStatusBadge = () => (
    <Badge
      variant="outline"
      className={`text-xs font-semibold gap-1.5 ${statusConfig.color}`}
    >
      <StatusIcon className="h-3.5 w-3.5" />
      {statusConfig.label}
    </Badge>
  )

  const renderPriorityBadge = () => (
    <Badge
      variant="outline"
      className={`text-xs font-semibold ${
        PRIORITY_COLORS[detail.priority] || PRIORITY_COLORS.MEDIUM
      }`}
    >
      {detail.priority}
    </Badge>
  )

  const renderTimelineStep = (approval: ApprovalItem, index: number, total: number) => {
    const isLast = index === total - 1
    const isApproved = approval.status === 'APPROVED'
    const isRejected = approval.status === 'REJECTED'
    const isPending = approval.status === 'PENDING'
    const isCurrentStepForUser = approval.approverId === user?.id && isPending

    // Determine if this step is "active" (waiting for action)
    const isActive = isPending && (index === 0 || detail.approvals[index - 1]?.status === 'APPROVED')

    return (
      <div key={approval.id} className="flex gap-4">
        {/* Timeline indicator */}
        <div className="flex flex-col items-center">
          <div
            className={`
              flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2
              ${isApproved ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
              ${isRejected ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}
              ${isPending && isActive ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 animate-pulse' : ''}
              ${isPending && !isActive ? 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800' : ''}
            `}
          >
            {isApproved && <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
            {isRejected && <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
            {isPending && (
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                {index + 1}
              </span>
            )}
          </div>
          {!isLast && (
            <div
              className={`w-0.5 flex-1 min-h-[40px] ${
                isApproved ? 'bg-green-300 dark:bg-green-700' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          )}
        </div>

        {/* Step content */}
        <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">
              {STEP_LABELS[approval.step] || approval.step}
            </span>
            {isCurrentStepForUser && (
              <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                Your Action Required
              </Badge>
            )}
          </div>

          {isPending && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {isActive
                ? `Waiting for ${approval.approver.name}`
                : 'Waiting for previous step'}
            </div>
          )}

          {isApproved && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approved by {approval.approver.name}
              </div>
              {approval.actedAt && (
                <p className="text-xs text-muted-foreground">
                  {formatDate(approval.actedAt)}
                </p>
              )}
              {approval.comment && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  &ldquo;{approval.comment}&rdquo;
                </p>
              )}
            </div>
          )}

          {isRejected && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-400">
                <XCircle className="h-3.5 w-3.5" />
                Rejected by {approval.approver.name}
              </div>
              {approval.actedAt && (
                <p className="text-xs text-muted-foreground">
                  {formatDate(approval.actedAt)}
                </p>
              )}
              {approval.comment && (
                <div className="mt-1.5 rounded-md bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-2">
                  <p className="text-xs text-red-800 dark:text-red-300">
                    {approval.comment}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('platform-request')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                {detail.requestNo}
              </h1>
              {renderStatusBadge()}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {detail.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canCancel && (
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:bg-destructive/10"
              onClick={() => setCancelDialogOpen(true)}
            >
              <Ban className="h-4 w-4" />
              {t.common.cancel} Request
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Request Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                {t.platformRequest.requestDetail}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Platform Name
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {detail.name}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Priority
                  </p>
                  {renderPriorityBadge()}
                </div>
              </div>

              <Separator />

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Description
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {detail.description}
                </p>
              </div>

              {detail.objective && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">
                        Objective / Purpose
                      </p>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {detail.objective}
                    </p>
                  </div>
                </>
              )}

              {(detail.targetUsers || detail.expectedTimeline) && (
                <>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {detail.targetUsers && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-medium text-muted-foreground">
                            Target Users
                          </p>
                        </div>
                        <p className="text-sm text-foreground">
                          {detail.targetUsers}
                        </p>
                      </div>
                    )}
                    {detail.expectedTimeline && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-medium text-muted-foreground">
                            Expected Timeline
                          </p>
                        </div>
                        <p className="text-sm text-foreground">
                          {detail.expectedTimeline}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Linked Project */}
              {detail.project && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      <p className="text-xs font-medium text-muted-foreground">
                        Linked Project
                      </p>
                    </div>
                    <Button
                      variant="link"
                      className="h-auto p-0 text-primary font-medium text-sm gap-1"
                      onClick={() =>
                        navigate('project-detail', { id: detail.project!.id })
                      }
                    >
                      {detail.project.name}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}

              {/* Rejection Reason */}
              {detail.rejectionReason && (
                <>
                  <Separator />
                  <div className="rounded-md bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <p className="text-xs font-semibold text-red-800 dark:text-red-300">
                        Rejection Reason
                      </p>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {detail.rejectionReason}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Approval Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Approval Timeline
              </CardTitle>
              <CardDescription>
                Two-step approval process for platform requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detail.approvals.length > 0 ? (
                <div className="flex flex-col">
                  {detail.approvals.map((approval, index) =>
                    renderTimelineStep(
                      approval,
                      index,
                      detail.approvals.length
                    )
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No approval records found
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-4">
          {/* Requester Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Requester
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {detail.requester.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {detail.requester.email}
                </p>
              </div>

              {detail.department && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">
                        Department
                      </p>
                    </div>
                    <p className="text-sm text-foreground">
                      {detail.department.parent
                        ? `${detail.department.parent.name} › ${detail.department.name}`
                        : detail.department.name}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Created</span>
                <span className="text-sm text-foreground">
                  {formatDateShort(detail.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Updated</span>
                <span className="text-sm text-foreground">
                  {formatDateShort(detail.updatedAt)}
                </span>
              </div>
              {detail.approvedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Approved
                  </span>
                  <span className="text-sm text-green-700 dark:text-green-400">
                    {formatDateShort(detail.approvedAt)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approval Action */}
          {canApprove && pendingApprovalForUser && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Action Required
                </CardTitle>
                <CardDescription>
                  You are the current approver for this request (
                  {STEP_LABELS[pendingApprovalForUser.step]})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    setActionType('APPROVE')
                    setActionComment('')
                    setActionDialogOpen(true)
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t.common.approve}
                </Button>
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={() => {
                    setActionType('REJECT')
                    setActionComment('')
                    setActionDialogOpen(true)
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  {t.common.reject}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'APPROVE'
                ? 'Confirm Approval'
                : 'Confirm Rejection'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'APPROVE'
                ? `Are you sure you want to approve this platform request (${detail.requestNo})?`
                : `Are you sure you want to reject this platform request (${detail.requestNo})? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>

          {actionType === 'REJECT' && (
            <div className="space-y-2">
              <Label htmlFor="rejectComment">
                Rejection Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rejectComment"
                placeholder="Please provide a reason for rejection..."
                rows={3}
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                disabled={actionLoading}
              />
            </div>
          )}

          {actionType === 'APPROVE' && (
            <div className="space-y-2">
              <Label htmlFor="approveComment">Comment (optional)</Label>
              <Textarea
                id="approveComment"
                placeholder="Add an optional comment..."
                rows={2}
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                disabled={actionLoading}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDialogOpen(false)
                setActionType(null)
                setActionComment('')
              }}
              disabled={actionLoading}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant={
                actionType === 'APPROVE' ? 'default' : 'destructive'
              }
              onClick={handleAction}
              disabled={actionLoading}
              className="gap-2"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : actionType === 'APPROVE' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {actionLoading
                ? 'Processing...'
                : actionType === 'APPROVE'
                ? 'Confirm Approval'
                : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this platform request (
              {detail.requestNo})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelLoading}
            >
              Keep Request
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelLoading}
              className="gap-2"
            >
              {cancelLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              {cancelLoading ? 'Cancelling...' : 'Cancel Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
