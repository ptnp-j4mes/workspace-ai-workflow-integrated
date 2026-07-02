'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  XCircle,
  UserPlus,
  Sparkles,
  Loader2,
  MessageSquare,
  Clock,
  Bot,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { useAppStore } from '@/store/app-store'
import { api } from '@/lib/api-client'
import { useI18n } from '@/i18n'

// ============================================================
// Types
// ============================================================

interface RequestDetail {
  id: string
  code: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  projectId: string | null
  aitNo: string | null
  affectedSystem: string | null
  businessImpact: string | null
  acceptanceCriteria: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  createdById: string
  assignedBAId: string | null
  assignedDevId: string | null
  assignedQAId: string | null
  project: { id: string; name: string; code: string; aitNo: string | null } | null
  createdBy: { id: string; name: string; email: string; avatarUrl: string | null } | null
  assignedBA: { id: string; name: string; email: string; avatarUrl: string | null } | null
  assignedDev: { id: string; name: string; email: string; avatarUrl: string | null } | null
  assignedQA: { id: string; name: string; email: string; avatarUrl: string | null } | null
  comments: CommentItem[]
  statusHistory: HistoryItem[]
}

interface CommentItem {
  id: string
  content: string
  createdAt: string
  userId: string
  user: { id: string; name: string; email: string; avatarUrl: string | null }
}

interface HistoryItem {
  id: string
  fromStatus: string | null
  toStatus: string
  comment: string | null
  createdAt: string
  changedById: string
}

interface UserItem {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  roles: string[]
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

const WORKFLOW_STEPS = [
  'DRAFT', 'SUBMITTED', 'APPROVED', 'ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT', 'COMPLETED', 'CLOSED',
]

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

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ============================================================
// Status Workflow Timeline
// ============================================================

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const currentIndex = WORKFLOW_STEPS.indexOf(currentStatus)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-center min-w-max">
        {WORKFLOW_STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex
          const isCurrent = idx === currentIndex
          const isFuture = idx > currentIndex

          return (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`
                    flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold
                    ${isCompleted ? 'border-green-500 bg-green-500 text-white' : ''}
                    ${isCurrent ? 'border-primary bg-primary text-primary-foreground' : ''}
                    ${isFuture ? 'border-muted-foreground/30 bg-background text-muted-foreground' : ''}
                  `}
                >
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <span
                  className={`
                    mt-1 text-[10px] font-medium whitespace-nowrap
                    ${isCurrent ? 'text-primary' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}
                  `}
                >
                  {formatLabel(step)}
                </span>
              </div>
              {idx < WORKFLOW_STEPS.length - 1 && (
                <div
                  className={`
                    mx-1 h-0.5 w-6 sm:w-10
                    ${idx < currentIndex ? 'bg-green-500' : 'bg-muted-foreground/30'}
                  `}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function RequestDetailPage() {
  const { viewParams, navigate, user } = useAppStore()
  const { t } = useI18n()
  const requestId = viewParams?.id

  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Dialog states
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignType, setAssignType] = useState<'BA' | 'DEV' | 'QA'>('BA')
  const [assignUserId, setAssignUserId] = useState('')
  const [users, setUsers] = useState<UserItem[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [generatingAitNo, setGeneratingAitNo] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const [creatingMit, setCreatingMit] = useState(false)

  const fetchRequest = useCallback(async () => {
    if (!requestId) return
    setLoading(true)
    try {
      const data = await api.get<{ request: RequestDetail }>(`/api/requests/${requestId}`)
      setRequest(data.request)
    } catch {
      toast.error(t.common.error)
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    ;(() => fetchRequest())()
  }, [fetchRequest])

  const fetchUsers = useCallback(async (role?: string) => {
    try {
      const params = role ? `?role=${role}` : ''
      const data = await api.get<{ users: UserItem[] }>(`/api/users${params}`)
      setUsers(data.users || [])
    } catch {
      // Silently handle
    }
  }, [])

  // Post comment
  const handlePostComment = async () => {
    if (!requestId || !commentText.trim()) return
    setPostingComment(true)
    try {
      await api.post(`/api/requests/${requestId}/comments`, { content: commentText.trim() })
      setCommentText('')
      fetchRequest()
      toast.success(t.requests.comments)
    } catch {
      toast.error(t.common.error)
    } finally {
      setPostingComment(false)
    }
  }

  // Workflow actions
  const handleSubmit = async () => {
    if (!requestId) return
    setActionLoading(true)
    try {
      await api.post(`/api/requests/${requestId}/submit`)
      toast.success(t.requests.submitRequest)
      fetchRequest()
    } catch {
      toast.error(t.common.error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!requestId) return
    setActionLoading(true)
    try {
      await api.post(`/api/requests/${requestId}/approve`, { comment: 'Approved' })
      toast.success(t.requests.approveRequest)
      fetchRequest()
    } catch {
      toast.error(t.common.error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!requestId || !rejectComment.trim()) {
      toast.error(t.common.error)
      return
    }
    setActionLoading(true)
    try {
      await api.post(`/api/requests/${requestId}/reject`, { comment: rejectComment.trim() })
      toast.success(t.requests.rejectRequest)
      setRejectDialogOpen(false)
      setRejectComment('')
      fetchRequest()
    } catch {
      toast.error(t.common.error)
    } finally {
      setActionLoading(false)
    }
  }

  const openAssignDialog = (type: 'BA' | 'DEV' | 'QA') => {
    setAssignType(type)
    setAssignUserId('')
    setAssignDialogOpen(true)
    const roleMap = { BA: 'BA', DEV: 'DEVELOPER', QA: 'QA' }
    fetchUsers(roleMap[type])
  }

  const handleAssign = async () => {
    if (!requestId || !assignUserId) {
      toast.error(t.common.error)
      return
    }
    setActionLoading(true)
    try {
      const endpointMap = {
        BA: `/api/requests/${requestId}/assign-ba`,
        DEV: `/api/requests/${requestId}/assign-dev`,
        QA: `/api/requests/${requestId}/assign-qa`,
      }
      await api.post(endpointMap[assignType], { userId: assignUserId })
      toast.success(t.common.success)
      setAssignDialogOpen(false)
      setAssignUserId('')
      fetchRequest()
    } catch {
      toast.error(t.common.error)
    } finally {
      setActionLoading(false)
    }
  }

  // AI Recommendation
  const handleAiRecommendation = async () => {
    if (!requestId) return
    setAiLoading(true)
    try {
      const data = await api.post<{ recommendation: string }>(
        `/api/requests/${requestId}/workflow/next-action`
      )
      setAiRecommendation(
        typeof data.recommendation === 'string'
          ? data.recommendation
          : JSON.stringify(data.recommendation, null, 2)
      )
    } catch {
      toast.error(t.common.error)
    } finally {
      setAiLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">{t.requests.noRequests}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('requests')}>
          {t.common.back}
        </Button>
      </div>
    )
  }

  // Generate AIT No
  const handleGenerateAitNo = async () => {
    if (!requestId) return
    setGeneratingAitNo(true)
    try {
      await api.post(`/api/requests/${requestId}/generate-document-no`)
      toast.success(t.common.success)
      fetchRequest()
    } catch {
      toast.error(t.common.error)
    } finally {
      setGeneratingAitNo(false)
    }
  }

  // Create project from request
  const handleCreateProject = async () => {
    if (!requestId) return
    setCreatingProject(true)
    try {
      const data = await api.post<{ project: { id: string } }>(`/api/requests/${requestId}/create-project`)
      toast.success(t.common.success)
      navigate('project-detail', { id: data.project.id })
    } catch {
      toast.error(t.common.error)
    } finally {
      setCreatingProject(false)
    }
  }

  // Create MIT from request
  const handleCreateMit = async () => {
    if (!requestId) return
    setCreatingMit(true)
    try {
      const data = await api.post<{ workItem: { id: string } }>(`/api/requests/${requestId}/create-mit`)
      toast.success(t.common.success)
      fetchRequest()
    } catch {
      toast.error(t.common.error)
    } finally {
      setCreatingMit(false)
    }
  }

  // Determine available actions based on status
  const status = request.status

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('requests')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            {/* AIT No. prominently displayed */}
            {request.aitNo ? (
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default" className="font-mono text-xs font-bold tracking-wider">
                  {request.aitNo}
                </Badge>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mb-1 text-xs gap-1"
                onClick={handleGenerateAitNo}
                disabled={generatingAitNo}
              >
                {generatingAitNo ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Generate AIT No.
              </Button>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground">{request.code}</span>
              <Badge variant="outline" className={`text-[10px] font-semibold ${TYPE_COLORS[request.type] || ''}`}>
                {formatLabel(request.type)}
              </Badge>
              <Badge variant="outline" className={`text-[10px] font-semibold ${PRIORITY_COLORS[request.priority] || ''}`}>
                {formatLabel(request.priority)}
              </Badge>
              <Badge variant="outline" className={`text-[10px] font-semibold ${STATUS_COLORS[request.status] || ''}`}>
                {formatLabel(request.status)}
              </Badge>
            </div>
            <h1 className="text-xl font-bold text-foreground mt-1">{request.title}</h1>
          </div>
        </div>

        {/* Post-Approval CTAs */}
        {['APPROVED', 'ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT'].includes(status) && (
          <div className="flex items-center gap-2 shrink-0">
            {!request.projectId && (
              <Button
                size="sm"
                className="gap-1"
                onClick={handleCreateProject}
                disabled={creatingProject}
              >
                {creatingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t.requests.createProject}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={handleCreateMit}
              disabled={creatingMit}
            >
              {creatingMit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t.requests.createMIT}
            </Button>
          </div>
        )}
      </div>

      {/* Status Workflow Timeline */}
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Workflow Progress</h3>
        <StatusTimeline currentStatus={status} />
      </Card>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t.common.description}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap">{request.description || t.common.noData}</p>
            </CardContent>
          </Card>

          {/* Acceptance Criteria */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Acceptance Criteria</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {request.acceptanceCriteria || t.common.noData}
              </p>
            </CardContent>
          </Card>

          {/* Business Impact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Business Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {request.businessImpact || t.common.noData}
              </p>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="comments" className="gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {t.requests.comments}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1">
                <Clock className="h-3.5 w-3.5" />
                {t.requests.workflowHistory}
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                AI
              </TabsTrigger>
            </TabsList>

            {/* Comments Tab */}
            <TabsContent value="comments">
              <Card>
                <CardContent className="pt-4">
                  <ScrollArea className="max-h-96">
                    <div className="space-y-4">
                      {request.comments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">{t.common.noData}</p>
                      ) : (
                        request.comments.map((comment) => (
                          <div key={comment.id} className="flex gap-3">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={comment.user.avatarUrl || undefined} />
                              <AvatarFallback className="text-xs">
                                {getUserInitials(comment.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium">{comment.user.name}</span>
                                <span className="text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                              </div>
                              <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{comment.content}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  <Separator className="my-4" />
                  <div className="flex gap-2">
                    <Textarea
                      placeholder={`${t.requests.comments}...`}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={2}
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      onClick={handlePostComment}
                      disabled={postingComment || !commentText.trim()}
                      className="shrink-0 self-end"
                    >
                      {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history">
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {request.statusHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t.common.noData}</p>
                    ) : (
                      request.statusHistory.map((item, idx) => (
                        <div key={item.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                                idx === 0 ? 'border-primary bg-primary/10' : 'border-muted bg-background'
                              }`}
                            >
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            </div>
                            {idx < request.statusHistory.length - 1 && (
                              <div className="w-px h-6 bg-border" />
                            )}
                          </div>
                          <div className="min-w-0 pb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.fromStatus && (
                                <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[item.fromStatus] || ''}`}>
                                  {formatLabel(item.fromStatus)}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">→</span>
                              <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[item.toStatus] || ''}`}>
                                {formatLabel(item.toStatus)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{formatDateTime(item.createdAt)}</p>
                            {item.comment && (
                              <p className="text-sm text-foreground mt-1">{item.comment}</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* AI Tab */}
            <TabsContent value="ai">
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <Button
                    onClick={handleAiRecommendation}
                    disabled={aiLoading}
                    className="gap-2"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Get AI Recommendation
                  </Button>
                  {aiRecommendation && (
                    <Card className="border-primary/20 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Bot className="h-4 w-4 text-primary" />
                          AI Recommendation
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-wrap">{aiRecommendation}</p>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-4">
          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t.common.overview}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.requests.requestNumber}</span>
                <span className="font-medium font-mono">{request.aitNo || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.projects.title}</span>
                {request.project ? (
                  <button
                    className="font-medium text-primary hover:underline"
                    onClick={() => navigate('project-detail', { id: request.project!.id })}
                  >
                    {request.project.name} {request.project.aitNo ? `(${request.project.aitNo})` : ''}
                  </button>
                ) : (
                  <span className="font-medium">—</span>
                )}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Affected System</span>
                <span className="font-medium">{request.affectedSystem || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.common.createdBy}</span>
                <span className="font-medium">{request.createdBy?.name || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.common.createdAt}</span>
                <span className="font-medium">{formatDate(request.createdAt)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.common.dueDate}</span>
                <span className="font-medium">{request.dueDate ? formatDate(request.dueDate) : '—'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Assigned People Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t.requests.assignedTo}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(['BA', 'Dev', 'QA'] as const).map((role) => {
                const person =
                  role === 'BA'
                    ? request.assignedBA
                    : role === 'Dev'
                    ? request.assignedDev
                    : request.assignedQA

                const canAssign =
                  (role === 'BA' && status === 'APPROVED') ||
                  (role === 'Dev' && status === 'ASSIGNED') ||
                  (role === 'QA' && status === 'IN_DEVELOPMENT')

                return (
                  <div key={role} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        {person ? (
                          <>
                            <AvatarImage src={person.avatarUrl || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {getUserInitials(person.name)}
                            </AvatarFallback>
                          </>
                        ) : (
                          <AvatarFallback className="text-[10px] bg-muted">?</AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p className="text-xs font-medium">{role}</p>
                        <p className="text-xs text-muted-foreground">{person?.name || 'Unassigned'}</p>
                      </div>
                    </div>
                    {canAssign && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => openAssignDialog(role === 'Dev' ? 'DEV' : role as 'BA' | 'QA')}
                      >
                        <UserPlus className="h-3 w-3" />
                        {t.requests.assignedTo.split(' ')[0]}
                      </Button>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t.common.actions}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {status === 'DRAFT' && (
                <Button
                  className="w-full gap-2"
                  onClick={handleSubmit}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t.common.submit}
                </Button>
              )}

              {status === 'SUBMITTED' && (
                <>
                  <Button
                    className="w-full gap-2"
                    onClick={handleApprove}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {t.common.approve}
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={() => setRejectDialogOpen(true)}
                    disabled={actionLoading}
                  >
                    <XCircle className="h-4 w-4" />
                    {t.common.reject}
                  </Button>
                </>
              )}

              {status === 'APPROVED' && (
                <Button
                  className="w-full gap-2"
                  onClick={() => openAssignDialog('BA')}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {t.requests.assignBA}
                </Button>
              )}

              {status === 'ASSIGNED' && (
                <Button
                  className="w-full gap-2"
                  onClick={() => openAssignDialog('DEV')}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {t.requests.assignDeveloper}
                </Button>
              )}

              {status === 'IN_DEVELOPMENT' && (
                <Button
                  className="w-full gap-2"
                  onClick={() => openAssignDialog('QA')}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {t.requests.assignQA}
                </Button>
              )}

              {!['DRAFT', 'SUBMITTED', 'APPROVED', 'ASSIGNED', 'IN_DEVELOPMENT'].includes(status) && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  {t.common.noData}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.requests.rejectRequest}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                {t.requests.rejectRequest} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="..."
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading || !rejectComment.trim()}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t.common.reject}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.requests.assignedTo} {assignType}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t.requests.assignedTo}</Label>
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex items-center gap-2">
                        {u.name}
                        <span className="text-xs text-muted-foreground">({u.email})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleAssign} disabled={actionLoading || !assignUserId}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t.requests.assignedTo.split(' ')[0]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
