'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  ArrowLeft,
  FolderKanban,
  Users,
  FileText,
  Video,
  Calendar,
  Plus,
  Loader2,
  Clock,
  UserPlus,
  Activity,
  ShieldAlert,
  AlertTriangle,
  Gavel,
  Github,
  Settings,
  Heart,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Link2,
  Unlink,
  GitCommitHorizontal,
  Zap,
  Bug,
  ClipboardList,
  ArrowRight,
  Send,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Rocket,
  Trash2,
  Pencil,
  History,
  GanttChart,
  Brain,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAppStore } from '@/store/app-store'
import { api } from '@/lib/api-client'
import { useI18n } from '@/i18n'
import ProjectTimeline from '@/components/project-timeline'
import MemoryVault from '@/components/memory-vault'

// ============================================================
// Types
// ============================================================

interface ProjectMember {
  id: string
  role: string
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
}

interface ProjectDetail {
  id: string
  code: string
  name: string
  description: string | null
  status: string
  startDate: string | null
  endDate: string | null
  aitNo: string | null
  healthScore: number | null
  currentVersion: number
  createdById: string
  createdAt: string
  updatedAt: string
  createdBy: {
    id: string
    name: string
    email: string
  }
  members: ProjectMember[]
  _count: {
    requests: number
    meetings: number
    uatCycles: number
  }
}

interface RequestItem {
  id: string
  code: string
  title: string
  status: string
  type: string
  priority: string
  aitNo: string | null
  createdAt: string
  project?: { id: string; name: string; code: string } | null
  createdBy?: { id: string; name: string; email: string } | null
  assignedBA?: { id: string; name: string; email: string } | null
  assignedDev?: { id: string; name: string; email: string } | null
  assignedQA?: { id: string; name: string; email: string } | null
}

interface MeetingItem {
  id: string
  title: string
  description: string | null
  scheduledAt: string | null
  status: string
  meetingUrl: string | null
  createdAt: string
}

interface WorkItem {
  id: string
  title: string
  description: string | null
  status: string
  currentStep: string | null
  priority: string
  aitNo: string | null
  dueDate: string | null
  createdAt: string
  projectId: string | null
  assignments: WorkItemAssignment[]
  mitStepAssignments: MitStepAssignment[]
}

interface WorkItemAssignment {
  id: string
  userId: string
  role: string
  isActive: boolean
  user: { id: string; name: string; email: string; avatarUrl?: string | null }
}

interface MitStepAssignment {
  id: string
  step: string
  assigneeId: string | null
  status: string
  assignee: { id: string; name: string; email: string } | null
  assignedAt: string | null
  acceptedAt: string | null
  submittedAt: string | null
  deployedAt: string | null
  rejectionReason: string | null
}

interface UatCycle {
  id: string
  name: string
  description: string | null
  status: string
  aitNo: string | null
  startDate: string | null
  endDate: string | null
  createdAt: string
}

interface BugItem {
  id: string
  title: string
  description: string
  severity: string
  status: string
  aitNo: string | null
  reportedById: string
  createdAt: string
  reportedBy: { id: string; name: string; email: string }
}

interface RiskItem {
  id: string
  title: string
  description: string | null
  probability: string
  impact: string
  mitigation: string | null
  status: string
  ownerId: string | null
  createdAt: string
  owner: { id: string; name: string; email: string } | null
}

interface IssueItem {
  id: string
  title: string
  description: string | null
  severity: string
  status: string
  resolution: string | null
  ownerId: string | null
  createdAt: string
  owner: { id: string; name: string; email: string } | null
}

interface DecisionItem {
  id: string
  title: string
  description: string | null
  decision: string | null
  rationale: string | null
  alternatives: string | null
  status: string
  decidedById: string | null
  decidedAt: string | null
  createdAt: string
  decidedBy: { id: string; name: string; email: string } | null
}

interface UserOption {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  roles: string[]
}

interface ProgressSummary {
  projectId: string
  projectName: string
  projectStatus: string
  requests: { total: number; completed: number }
  workItems: { total: number; completed: number }
  bugs: { open: number; critical: number }
  approvals: { pending: number }
  risks: { active: number }
  issues: { open: number }
  decisions: { pending: number }
  uat: { total: number; completed: number }
  members: { total: number }
}

interface ActivityItem {
  type: string
  action?: string
  entity?: string
  aitNo?: string
  user?: { id: string; name: string; email: string; avatarUrl?: string | null }
  fromStatus?: string | null
  toStatus?: string
  requestTitle?: string
  workItemTitle?: string
  comment?: string | null
  createdAt: string
}

interface LinkedRepo {
  id: string
  projectId: string
  repositoryId: string
  branch: string
  pathFilter: string | null
  isPrimary: boolean
  repository: {
    id: string
    owner: string
    repo: string
    fullName: string
    defaultBranch: string
    connection: { id: string; connectionName: string; owner: string }
  }
}

interface CommitItem {
  id: string
  sha: string
  message: string
  authorName: string
  authorEmail: string | null
  authorDate: string
  branch: string | null
  additions: number | null
  deletions: number | null
}

interface DailySummary {
  id: string
  projectId: string
  summaryDate: string
  summaryMarkdown: string
  totalCommits: number
  totalAdditions: number
  totalDeletions: number
  authors: string
  createdAt: string
}

interface AvailableRepo {
  id: string
  fullName: string
  owner: string
  repo: string
  defaultBranch: string
}

interface ProjectVersion {
  id: string
  projectId: string
  version: number
  name: string
  description: string | null
  status: string
  startDate: string | null
  endDate: string | null
  aitNo: string | null
  healthScore: number | null
  changeLog: string | null
  changeType: string // CREATE, UPDATE, STATUS_CHANGE, MANUAL, RESTORE
  snapshot: string // JSON
  createdById: string
  createdAt: string
  createdBy: {
    id: string
    name: string
    email: string
  }
}

// ============================================================
// Status badge helper
// ============================================================

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase()
  let className = ''

  if (s === 'ACTIVE') {
    className = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  } else if (s === 'ON_HOLD') {
    className = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  } else if (s === 'COMPLETED') {
    className = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  } else if (s === 'ARCHIVED') {
    className = 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  } else {
    className = 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  return (
    <Badge variant="secondary" className={`text-xs ${className}`}>
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

function RoleBadge({ role }: { role: string }) {
  let className = ''
  const r = role.toUpperCase()

  if (r === 'PROJECT_MANAGER') {
    className = 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300'
  } else if (r === 'LEAD') {
    className = 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
  } else {
    className = 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300'
  }

  return (
    <Badge variant="secondary" className={`text-[10px] ${className}`}>
      {role.replace(/_/g, ' ')}
    </Badge>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toUpperCase()
  let cls = 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  if (s === 'CRITICAL') cls = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  else if (s === 'HIGH') cls = 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
  else if (s === 'MEDIUM') cls = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  else if (s === 'LOW') cls = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'

  return <Badge variant="secondary" className={`text-[10px] ${cls}`}>{severity}</Badge>
}

function StepBadge({ step }: { step: string }) {
  const s = (step || '').toUpperCase()
  let cls = 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  if (s === 'BA') cls = 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
  else if (s === 'DEV') cls = 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300'
  else if (s === 'QA') cls = 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
  else if (s === 'UAT') cls = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
  else if (s === 'MA') cls = 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300'

  return <Badge variant="secondary" className={`text-[10px] ${cls}`}>{step || '—'}</Badge>
}

// ============================================================
// Health Score Gauge
// ============================================================

function HealthGauge({ score }: { score: number | null }) {
  const s = score ?? 0
  const color = s >= 70 ? 'text-green-500' : s >= 40 ? 'text-yellow-500' : 'text-red-500'
  const bgColor = s >= 70 ? 'bg-green-50 dark:bg-green-950' : s >= 40 ? 'bg-yellow-50 dark:bg-yellow-950' : 'bg-red-50 dark:bg-red-950'
  const ringColor = s >= 70 ? 'ring-green-200 dark:ring-green-800' : s >= 40 ? 'ring-yellow-200 dark:ring-yellow-800' : 'ring-red-200 dark:ring-red-800'
  const label = s >= 70 ? 'Healthy' : s >= 40 ? 'At Risk' : 'Critical'

  return (
    <div className={`flex flex-col items-center gap-2 rounded-xl p-6 ${bgColor} ring-1 ${ringColor}`}>
      <div className={`text-5xl font-bold ${color}`}>{s}</div>
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="w-full bg-muted rounded-full h-2 mt-1">
        <div
          className={`h-2 rounded-full transition-all ${
            s >= 70 ? 'bg-green-500' : s >= 40 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${s}%` }}
        />
      </div>
    </div>
  )
}

// ============================================================
// Loading & Empty placeholders
// ============================================================

function TabLoading() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="mb-3 h-10 w-10 text-muted-foreground/30" />
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground/70">{description}</p>
    </div>
  )
}

function DetailsSection({ v }: { v: ProjectVersion }) {
  const [open, setOpen] = useState(false)
  let snapshotData: Record<string, unknown> | null = null
  try {
    snapshotData = JSON.parse(v.snapshot)
  } catch {
    // ignore parse errors
  }

  if (!snapshotData) return null

  const fields = [
    { label: 'Name', value: v.name },
    { label: 'Description', value: v.description || '\u2014' },
    { label: 'Status', value: v.status },
    { label: 'Start Date', value: v.startDate ? new Date(v.startDate).toLocaleDateString() : '\u2014' },
    { label: 'End Date', value: v.endDate ? new Date(v.endDate).toLocaleDateString() : '\u2014' },
    { label: 'AIT No', value: v.aitNo || '\u2014' },
    { label: 'Health Score', value: v.healthScore != null ? `${v.healthScore}` : '\u2014' },
  ]

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-primary hover:underline flex items-center gap-1"
      >
        {open ? 'Hide' : 'Show'} snapshot details
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {fields.map(f => (
            <div key={f.label} className="rounded bg-muted/50 p-2">
              <span className="text-muted-foreground">{f.label}:</span>{' '}
              <span className="font-medium">{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Component
// ============================================================

export default function ProjectDetailPage() {
  const { viewParams, navigate } = useAppStore()
  const { t } = useI18n()
  const projectId = viewParams.id

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // Tab data states
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [meetings, setMeetings] = useState<MeetingItem[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [uatCycles, setUatCycles] = useState<UatCycle[]>([])
  const [bugs, setBugs] = useState<BugItem[]>([])
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [issues, setIssues] = useState<IssueItem[]>([])
  const [decisions, setDecisions] = useState<DecisionItem[]>([])
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null)
  const [healthScore, setHealthScore] = useState<number | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [linkedRepos, setLinkedRepos] = useState<LinkedRepo[]>([])
  const [commits, setCommits] = useState<CommitItem[]>([])
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([])
  const [availableRepos, setAvailableRepos] = useState<AvailableRepo[]>([])
  const [versions, setVersions] = useState<ProjectVersion[]>([])

  // Loading states per tab
  const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({})
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [expandedMit, setExpandedMit] = useState<string | null>(null)

  // Dialog states
  const [createRiskOpen, setCreateRiskOpen] = useState(false)
  const [createIssueOpen, setCreateIssueOpen] = useState(false)
  const [createDecisionOpen, setCreateDecisionOpen] = useState(false)
  const [createMitOpen, setCreateMitOpen] = useState(false)
  const [linkRepoOpen, setLinkRepoOpen] = useState(false)
  const [editProjectOpen, setEditProjectOpen] = useState(false)
  const [generatingAitNo, setGeneratingAitNo] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  // CRUD dialog states for Requests, UAT, Bugs, Meetings
  const [createRequestOpen, setCreateRequestOpen] = useState(false)
  const [editRequestOpen, setEditRequestOpen] = useState(false)
  const [editingRequest, setEditingRequest] = useState<RequestItem | null>(null)
  const [createUatOpen, setCreateUatOpen] = useState(false)
  const [editUatOpen, setEditUatOpen] = useState(false)
  const [editingUat, setEditingUat] = useState<UatCycle | null>(null)
  const [createBugOpen, setCreateBugOpen] = useState(false)
  const [editBugOpen, setEditBugOpen] = useState(false)
  const [editingBug, setEditingBug] = useState<BugItem | null>(null)
  const [createMeetingOpen, setCreateMeetingOpen] = useState(false)
  const [editMeetingOpen, setEditMeetingOpen] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<MeetingItem | null>(null)

  // Form states for dialogs
  const [riskForm, setRiskForm] = useState({ title: '', description: '', probability: 'MEDIUM', impact: 'MEDIUM', mitigation: '' })
  const [issueForm, setIssueForm] = useState({ title: '', description: '', severity: 'MEDIUM', resolution: '' })
  const [decisionForm, setDecisionForm] = useState({ title: '', description: '', decision: '', rationale: '', status: 'PROPOSED' })
  const [mitForm, setMitForm] = useState({ title: '', description: '', priority: 'MEDIUM', currentStep: 'BA' })
  const [editForm, setEditForm] = useState({ name: '', description: '', status: '', startDate: '', endDate: '' })

  // CRUD form states for Requests, UAT, Bugs, Meetings
  const [requestForm, setRequestForm] = useState({ title: '', type: 'FEATURE', priority: 'MEDIUM', description: '' })
  const [uatForm, setUatForm] = useState({ name: '', description: '', startDate: '', endDate: '' })
  const [bugForm, setBugForm] = useState({ title: '', description: '', severity: 'MEDIUM', actualResult: '', expectedResult: '', reproductionSteps: '' })
  const [meetingForm, setMeetingForm] = useState({ title: '', description: '', meetingUrl: '', scheduledAt: '' })

  // Submitting states
  const [submitting, setSubmitting] = useState(false)

  // Track which tabs have been loaded
  const loadedTabs = useRef<{ projectId: string | undefined; tabs: Set<string> }>({
    projectId: undefined,
    tabs: new Set(),
  })

  // Fetch project detail
  const fetchProject = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await api.get<{ project: ProjectDetail }>(`/api/projects/${projectId}`)
      setProject(data.project)
      setHealthScore(data.project.healthScore)
    } catch (error) {
      console.error('Failed to fetch project:', error)
    }
  }, [projectId])

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      await fetchProject()
      setLoading(false)
    }
    loadAll()
  }, [fetchProject])

  // Tab data loaders
  const loadTabData = useCallback(async (tab: string) => {
    if (loadedTabs.current.projectId !== projectId) {
      loadedTabs.current = { projectId, tabs: new Set() }
    }

    if (!projectId || loadedTabs.current.tabs.has(tab)) return
    setTabLoading(prev => ({ ...prev, [tab]: true }))
    try {
      switch (tab) {
        case 'overview': {
          const [progressRes, healthRes, activityRes] = await Promise.allSettled([
            api.get<{ data: ProgressSummary }>(`/api/projects/${projectId}/progress-summary`),
            api.get<{ data: { healthScore: number } }>(`/api/projects/${projectId}/health`),
            api.get<{ data: ActivityItem[] }>(`/api/projects/${projectId}/activity?limit=10`),
          ])
          if (progressRes.status === 'fulfilled') setProgressSummary(progressRes.value.data)
          if (healthRes.status === 'fulfilled') setHealthScore(healthRes.value.data.healthScore)
          if (activityRes.status === 'fulfilled') setActivities(activityRes.value.data)
          break
        }
        case 'requests': {
          const data = await api.get<{ requests: RequestItem[] }>(`/api/requests?projectId=${projectId}&limit=50`)
          setRequests(data.requests || [])
          break
        }
        case 'mit-items': {
          const data = await api.get<{ workItems: WorkItem[] }>(`/api/work-items?projectId=${projectId}&limit=100`)
          setWorkItems(data.workItems || [])
          break
        }
        case 'uat': {
          const data = await api.get<{ cycles?: UatCycle[]; data?: UatCycle[] }>(`/api/uat/cycles?projectId=${projectId}`)
          setUatCycles(data.cycles || data.data || [])
          break
        }
        case 'bugs': {
          const data = await api.get<{ bugs: BugItem[] }>(`/api/bugs?projectId=${projectId}&limit=50`)
          setBugs(data.bugs || [])
          break
        }
        case 'risks': {
          const data = await api.get<{ data: RiskItem[] }>(`/api/projects/${projectId}/risks`)
          setRisks(data.data || [])
          break
        }
        case 'issues': {
          const data = await api.get<{ data: IssueItem[] }>(`/api/projects/${projectId}/issues`)
          setIssues(data.data || [])
          break
        }
        case 'decisions': {
          const data = await api.get<{ data: DecisionItem[] }>(`/api/projects/${projectId}/decisions`)
          setDecisions(data.data || [])
          break
        }
        case 'members': {
          await fetchProject()
          break
        }
        case 'github': {
          const [reposRes, commitsRes, summariesRes] = await Promise.allSettled([
            api.get<{ data: LinkedRepo[] }>(`/api/projects/${projectId}/github/repositories`),
            api.get<{ data: CommitItem[] }>(`/api/projects/${projectId}/github/commits?limit=20`),
            api.get<{ data: DailySummary[] }>(`/api/projects/${projectId}/github/daily-summaries`),
          ])
          if (reposRes.status === 'fulfilled') setLinkedRepos(reposRes.value.data)
          if (commitsRes.status === 'fulfilled') setCommits(commitsRes.value.data)
          if (summariesRes.status === 'fulfilled') setDailySummaries(summariesRes.value.data)
          break
        }
        case 'meetings': {
          const data = await api.get<{ meetings: MeetingItem[] }>('/api/meetings?projectId=' + projectId)
          setMeetings(data.meetings || [])
          break
        }
        case 'versions': {
          const data = await api.get<{ data: ProjectVersion[] }>(`/api/projects/${projectId}/versions`)
          setVersions(data.data || [])
          break
        }
        case 'timeline': {
          // Timeline component manages its own data loading
          break
        }
        case 'settings': {
          // project already loaded
          break
        }
        case 'vault': {
          // MemoryVault component manages its own data loading
          break
        }
      }
      loadedTabs.current.tabs.add(tab)
    } catch (error) {
      console.error(`Failed to load ${tab} data:`, error)
    } finally {
      setTabLoading(prev => ({ ...prev, [tab]: false }))
    }
  }, [projectId, fetchProject])

  // Load tab data when tab changes
  useEffect(() => {
    loadTabData(activeTab)
  }, [activeTab, loadTabData])

  // Refresh a specific tab
  const refreshTab = async (tab: string) => {
    loadedTabs.current.tabs.delete(tab)
    await loadTabData(tab)
  }

  // Fetch users for member dialog
  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.get<{ users: UserOption[] }>('/api/users')
      setUsers(data.users || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }, [])

  // Add member handler
  const handleAddMember = async () => {
    if (!selectedUserId || !selectedRole || !projectId) return
    setAddingMember(true)
    try {
      await api.post(`/api/projects/${projectId}/members`, {
        userId: selectedUserId,
        role: selectedRole,
      })
      loadedTabs.current.tabs.delete('members')
      await fetchProject()
      setAddMemberOpen(false)
      setSelectedUserId('')
      setSelectedRole('')
    } catch (error) {
      console.error('Failed to add member:', error)
    } finally {
      setAddingMember(false)
    }
  }

  // Generate AIT No
  const handleGenerateAitNo = async () => {
    if (!projectId) return
    setGeneratingAitNo(true)
    try {
      const data = await api.post<{ data: { aitNo: string } }>(`/api/projects/${projectId}/generate-document-no`)
      if (data.data?.aitNo) {
        await fetchProject()
      }
    } catch (error: any) {
      console.error('Failed to generate AIT No:', error)
    } finally {
      setGeneratingAitNo(false)
    }
  }

  // Recalculate health
  const handleRecalcHealth = async () => {
    if (!projectId) return
    setRecalculating(true)
    try {
      const data = await api.post<{ data: { healthScore: number } }>(`/api/projects/${projectId}/health`)
      setHealthScore(data.data.healthScore)
      await fetchProject()
      loadedTabs.current.tabs.delete('overview')
      refreshTab('overview')
    } catch (error) {
      console.error('Failed to recalculate health:', error)
    } finally {
      setRecalculating(false)
    }
  }

  // Create risk
  const handleCreateRisk = async () => {
    if (!riskForm.title || !projectId) return
    setSubmitting(true)
    try {
      await api.post(`/api/projects/${projectId}/risks`, riskForm)
      loadedTabs.current.tabs.delete('risks')
      await refreshTab('risks')
      setCreateRiskOpen(false)
      setRiskForm({ title: '', description: '', probability: 'MEDIUM', impact: 'MEDIUM', mitigation: '' })
    } catch (error) {
      console.error('Failed to create risk:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Create issue
  const handleCreateIssue = async () => {
    if (!issueForm.title || !projectId) return
    setSubmitting(true)
    try {
      await api.post(`/api/projects/${projectId}/issues`, issueForm)
      loadedTabs.current.tabs.delete('issues')
      await refreshTab('issues')
      setCreateIssueOpen(false)
      setIssueForm({ title: '', description: '', severity: 'MEDIUM', resolution: '' })
    } catch (error) {
      console.error('Failed to create issue:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Create decision
  const handleCreateDecision = async () => {
    if (!decisionForm.title || !projectId) return
    setSubmitting(true)
    try {
      await api.post(`/api/projects/${projectId}/decisions`, decisionForm)
      loadedTabs.current.tabs.delete('decisions')
      await refreshTab('decisions')
      setCreateDecisionOpen(false)
      setDecisionForm({ title: '', description: '', decision: '', rationale: '', status: 'PROPOSED' })
    } catch (error) {
      console.error('Failed to create decision:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Create MIT
  const handleCreateMit = async () => {
    if (!mitForm.title || !projectId) return
    setSubmitting(true)
    try {
      await api.post('/api/work-items', {
        ...mitForm,
        projectId,
      })
      loadedTabs.current.tabs.delete('mit-items')
      await refreshTab('mit-items')
      setCreateMitOpen(false)
      setMitForm({ title: '', description: '', priority: 'MEDIUM', currentStep: 'BA' })
    } catch (error) {
      console.error('Failed to create MIT:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // MIT action handlers
  const handleMitAction = async (workItemId: string, action: string) => {
    try {
      await api.post(`/api/work-items/${workItemId}/mit-${action}`, {})
      loadedTabs.current.tabs.delete('mit-items')
      await refreshTab('mit-items')
    } catch (error) {
      console.error(`Failed to ${action} MIT:`, error)
    }
  }

  // Link repo
  const handleLinkRepo = async (repositoryId: string, branch: string) => {
    if (!projectId) return
    setSubmitting(true)
    try {
      await api.post(`/api/projects/${projectId}/github/repositories`, { repositoryId, branch })
      loadedTabs.current.tabs.delete('github')
      await refreshTab('github')
      setLinkRepoOpen(false)
    } catch (error) {
      console.error('Failed to link repo:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Unlink repo
  const handleUnlinkRepo = async (repoLinkId: string) => {
    if (!projectId) return
    try {
      await api.delete(`/api/projects/${projectId}/github/repositories/${repoLinkId}`)
      loadedTabs.current.tabs.delete('github')
      await refreshTab('github')
    } catch (error) {
      console.error('Failed to unlink repo:', error)
    }
  }

  // Sync commits
  const handleSyncCommits = async () => {
    if (!projectId) return
    setSyncing(true)
    try {
      await api.post(`/api/projects/${projectId}/github/sync-commits`)
      loadedTabs.current.tabs.delete('github')
      await refreshTab('github')
    } catch (error) {
      console.error('Failed to sync commits:', error)
    } finally {
      setSyncing(false)
    }
  }

  // Generate daily summary
  const handleGenerateSummary = async () => {
    if (!projectId) return
    setSyncing(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      await api.post(`/api/projects/${projectId}/github/daily-summaries`, { date: today })
      loadedTabs.current.tabs.delete('github')
      await refreshTab('github')
    } catch (error) {
      console.error('Failed to generate summary:', error)
    } finally {
      setSyncing(false)
    }
  }

  // Edit project
  const handleEditProject = async () => {
    if (!projectId) return
    setSubmitting(true)
    try {
      await api.patch(`/api/projects/${projectId}`, editForm)
      await fetchProject()
      setEditProjectOpen(false)
    } catch (error) {
      console.error('Failed to update project:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Create manual version snapshot
  const handleCreateSnapshot = async () => {
    if (!projectId) return
    setSubmitting(true)
    try {
      await api.post(`/api/projects/${projectId}/versions`, {
        changeLog: 'Manual snapshot',
        changeType: 'MANUAL',
      })
      loadedTabs.current.tabs.delete('versions')
      await refreshTab('versions')
      await fetchProject()
    } catch (error) {
      console.error('Failed to create snapshot:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Open edit project dialog
  const openEditProject = () => {
    if (project) {
      setEditForm({
        name: project.name,
        description: project.description || '',
        status: project.status,
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
        endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
      })
    }
    setEditProjectOpen(true)
  }

  // ============================================================
  // CRUD: Requests
  // ============================================================
  const handleCreateRequest = async () => {
    if (!requestForm.title || !projectId) return
    setSubmitting(true)
    try {
      await api.post('/api/requests', { ...requestForm, projectId })
      await refreshTab('requests')
      setCreateRequestOpen(false)
      setRequestForm({ title: '', type: 'FEATURE', priority: 'MEDIUM', description: '' })
    } catch (error) {
      console.error('Failed to create request:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditRequest = async () => {
    if (!editingRequest || !requestForm.title) return
    setSubmitting(true)
    try {
      await api.patch(`/api/requests/${editingRequest.id}`, requestForm)
      await refreshTab('requests')
      setEditRequestOpen(false)
      setEditingRequest(null)
      setRequestForm({ title: '', type: 'FEATURE', priority: 'MEDIUM', description: '' })
    } catch (error) {
      console.error('Failed to update request:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteRequest = async (id: string) => {
    if (!confirm('Cancel this request?')) return
    try {
      await api.delete(`/api/requests/${id}`)
      await refreshTab('requests')
    } catch (error) {
      console.error('Failed to cancel request:', error)
    }
  }

  const openEditRequest = (req: RequestItem) => {
    setEditingRequest(req)
    setRequestForm({ title: req.title, type: req.type, priority: req.priority, description: '' })
    setEditRequestOpen(true)
  }

  // ============================================================
  // CRUD: UAT Cycles
  // ============================================================
  const handleCreateUat = async () => {
    if (!uatForm.name || !projectId) return
    setSubmitting(true)
    try {
      await api.post('/api/uat/cycles', { ...uatForm, projectId })
      await refreshTab('uat')
      setCreateUatOpen(false)
      setUatForm({ name: '', description: '', startDate: '', endDate: '' })
    } catch (error) {
      console.error('Failed to create UAT cycle:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditUat = async () => {
    if (!editingUat || !uatForm.name) return
    setSubmitting(true)
    try {
      await api.patch(`/api/uat/cycles/${editingUat.id}`, uatForm)
      await refreshTab('uat')
      setEditUatOpen(false)
      setEditingUat(null)
      setUatForm({ name: '', description: '', startDate: '', endDate: '' })
    } catch (error) {
      console.error('Failed to update UAT cycle:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteUat = async (id: string) => {
    if (!confirm('Delete this UAT cycle and all its test cases?')) return
    try {
      await api.delete(`/api/uat/cycles/${id}`)
      await refreshTab('uat')
    } catch (error) {
      console.error('Failed to delete UAT cycle:', error)
    }
  }

  const openEditUat = (cycle: UatCycle) => {
    setEditingUat(cycle)
    setUatForm({
      name: cycle.name,
      description: cycle.description || '',
      startDate: cycle.startDate ? new Date(cycle.startDate).toISOString().split('T')[0] : '',
      endDate: cycle.endDate ? new Date(cycle.endDate).toISOString().split('T')[0] : '',
    })
    setEditUatOpen(true)
  }

  // ============================================================
  // CRUD: Bugs
  // ============================================================
  const handleCreateBug = async () => {
    if (!bugForm.title || !bugForm.description || !projectId) return
    setSubmitting(true)
    try {
      await api.post('/api/bugs', { ...bugForm, projectId })
      await refreshTab('bugs')
      setCreateBugOpen(false)
      setBugForm({ title: '', description: '', severity: 'MEDIUM', actualResult: '', expectedResult: '', reproductionSteps: '' })
    } catch (error) {
      console.error('Failed to create bug:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditBug = async () => {
    if (!editingBug || !bugForm.title) return
    setSubmitting(true)
    try {
      await api.patch(`/api/bugs/${editingBug.id}`, bugForm)
      await refreshTab('bugs')
      setEditBugOpen(false)
      setEditingBug(null)
      setBugForm({ title: '', description: '', severity: 'MEDIUM', actualResult: '', expectedResult: '', reproductionSteps: '' })
    } catch (error) {
      console.error('Failed to update bug:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteBug = async (id: string) => {
    if (!confirm('Delete this bug report?')) return
    try {
      await api.delete(`/api/bugs/${id}`)
      await refreshTab('bugs')
    } catch (error) {
      console.error('Failed to delete bug:', error)
    }
  }

  const openEditBug = (bug: BugItem) => {
    setEditingBug(bug)
    setBugForm({
      title: bug.title,
      description: bug.description,
      severity: bug.severity,
      actualResult: '',
      expectedResult: '',
      reproductionSteps: '',
    })
    setEditBugOpen(true)
  }

  // ============================================================
  // CRUD: Meetings
  // ============================================================
  const handleCreateMeeting = async () => {
    if (!meetingForm.title || !projectId) return
    setSubmitting(true)
    try {
      await api.post('/api/meetings', { ...meetingForm, projectId })
      await refreshTab('meetings')
      setCreateMeetingOpen(false)
      setMeetingForm({ title: '', description: '', meetingUrl: '', scheduledAt: '' })
    } catch (error) {
      console.error('Failed to create meeting:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditMeeting = async () => {
    if (!editingMeeting || !meetingForm.title) return
    setSubmitting(true)
    try {
      await api.patch(`/api/meetings/${editingMeeting.id}`, meetingForm)
      await refreshTab('meetings')
      setEditMeetingOpen(false)
      setEditingMeeting(null)
      setMeetingForm({ title: '', description: '', meetingUrl: '', scheduledAt: '' })
    } catch (error) {
      console.error('Failed to update meeting:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm('Delete this meeting?')) return
    try {
      await api.delete(`/api/meetings/${id}`)
      await refreshTab('meetings')
    } catch (error) {
      console.error('Failed to delete meeting:', error)
    }
  }

  const openEditMeeting = (meeting: MeetingItem) => {
    setEditingMeeting(meeting)
    setMeetingForm({
      title: meeting.title,
      description: meeting.description || '',
      meetingUrl: meeting.meetingUrl || '',
      scheduledAt: meeting.scheduledAt ? new Date(meeting.scheduledAt).toISOString().slice(0, 16) : '',
    })
    setEditMeetingOpen(true)
  }

  // Open add member dialog
  const handleOpenAddMember = () => {
    fetchUsers()
    setAddMemberOpen(true)
  }

  // Load available repos when linking
  const handleOpenLinkRepo = async () => {
    setLinkRepoOpen(true)
    try {
      const data = await api.get<{ data: AvailableRepo[] }>('/api/admin/github/connections')
      // Flatten repos from connections
      const allRepos: AvailableRepo[] = []
      if (Array.isArray(data.data)) {
        for (const conn of data.data as any[]) {
          if (conn.repositories) {
            for (const repo of conn.repositories) {
              if (!linkedRepos.some(lr => lr.repositoryId === repo.id)) {
                allRepos.push(repo)
              }
            }
          }
        }
      }
      setAvailableRepos(allRepos)
    } catch {
      // Graceful fallback - try alternate structure
      try {
        const data2 = await api.get<any>('/api/admin/github/connections')
        const allRepos: AvailableRepo[] = []
        if (Array.isArray(data2.data)) {
          for (const conn of data2.data as any[]) {
            if (conn.repositories) {
              for (const repo of conn.repositories) {
                if (!linkedRepos.some(lr => lr.repositoryId === repo.id)) {
                  allRepos.push({ id: repo.id, fullName: repo.fullName, owner: repo.owner, repo: repo.repo, defaultBranch: repo.defaultBranch })
                }
              }
            }
          }
        }
        setAvailableRepos(allRepos)
      } catch {
        setAvailableRepos([])
      }
    }
  }

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Status color for requests
  const requestStatusColor = (status: string) => {
    const s = status.toUpperCase()
    if (['COMPLETED', 'CLOSED'].includes(s)) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    if (['IN_DEVELOPMENT', 'QA', 'UAT'].includes(s)) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    if (['DRAFT', 'SUBMITTED'].includes(s)) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    if (['REJECTED'].includes(s)) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  // Meeting status color
  const meetingStatusColor = (status: string) => {
    const s = status.toUpperCase()
    if (s === 'COMPLETED') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    if (s === 'IN_PROGRESS') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    if (s === 'SCHEDULED') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    if (s === 'CANCELLED') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  // Bug status color
  const bugStatusColor = (status: string) => {
    const s = status.toUpperCase()
    if (['VERIFIED', 'CLOSED'].includes(s)) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    if (['FIXING', 'INVESTIGATING'].includes(s)) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    if (['OPEN'].includes(s)) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    if (['FIXED'].includes(s)) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  // Work item status color
  const workItemStatusColor = (status: string) => {
    const s = status.toUpperCase()
    if (['DEPLOYED'].includes(s)) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    if (['IN_PROGRESS', 'ACCEPTED'].includes(s)) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    if (['CREATED', 'ASSIGNED'].includes(s)) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    if (['REJECTED', 'RETURNED'].includes(s)) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    if (['SUBMITTED'].includes(s)) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  // Risk status color
  const riskStatusColor = (status: string) => {
    const s = status.toUpperCase()
    if (s === 'RESOLVED') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    if (s === 'MITIGATING') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    if (s === 'ANALYZING') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    if (s === 'IDENTIFIED') return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
    if (s === 'ACCEPTED') return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  // Decision status color
  const decisionStatusColor = (status: string) => {
    const s = status.toUpperCase()
    if (s === 'ACCEPTED') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    if (s === 'REJECTED') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    if (s === 'PROPOSED') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    if (s === 'DEFERRED') return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  // UAT status color
  const uatStatusColor = (status: string) => {
    const s = status.toUpperCase()
    if (s === 'COMPLETED') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    if (s === 'IN_PROGRESS') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    if (s === 'PLANNED') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    if (s === 'FAILED') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  // Issue status color
  const issueStatusColor = (status: string) => {
    const s = status.toUpperCase()
    if (['RESOLVED', 'CLOSED'].includes(s)) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    if (s === 'IN_PROGRESS') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    if (s === 'OPEN') return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  // Time ago
  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  // Get MIT actions for a given status
  const getMitActions = (status: string) => {
    const s = status.toUpperCase()
    const actions: Array<{ key: string; label: string; icon: React.ElementType; variant: 'default' | 'outline' | 'destructive' }> = []
    if (s === 'CREATED' || s === 'RETURNED') {
      actions.push({ key: 'assign', label: 'Assign', icon: UserPlus, variant: 'default' })
    }
    if (s === 'ASSIGNED') {
      actions.push({ key: 'accept', label: 'Accept', icon: ThumbsUp, variant: 'default' })
      actions.push({ key: 'reject', label: 'Reject', icon: ThumbsDown, variant: 'destructive' })
    }
    if (s === 'ACCEPTED' || s === 'IN_PROGRESS') {
      actions.push({ key: 'submit', label: 'Submit', icon: Send, variant: 'default' })
      actions.push({ key: 'return', label: 'Return', icon: RotateCcw, variant: 'outline' })
    }
    if (s === 'SUBMITTED') {
      actions.push({ key: 'deploy', label: 'Deploy', icon: Rocket, variant: 'default' })
      actions.push({ key: 'return', label: 'Return', icon: RotateCcw, variant: 'outline' })
    }
    return actions
  }

  // Probability/impact matrix cell color
  const riskMatrixColor = (prob: string, impact: string) => {
    const pMap: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 }
    const iMap: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }
    const score = (pMap[prob] || 1) * (iMap[impact] || 1)
    if (score >= 8) return 'bg-red-200 dark:bg-red-900'
    if (score >= 4) return 'bg-yellow-200 dark:bg-yellow-900'
    return 'bg-green-200 dark:bg-green-900'
  }

  // Activity icon
  const activityIcon = (type: string) => {
    if (type === 'REQUEST_STATUS_CHANGE') return <FileText className="h-4 w-4 text-sky-500" />
    if (type === 'WORK_ITEM_STATUS_CHANGE') return <ClipboardList className="h-4 w-4 text-purple-500" />
    return <Activity className="h-4 w-4 text-muted-foreground" />
  }

  // ============================================================
  // Loading state
  // ============================================================
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-full max-w-2xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <FolderKanban className="mb-3 h-12 w-12 text-muted-foreground/30" />
        <h3 className="text-lg font-medium">{t.projects.noProjectsFound}</h3>
        <Button variant="outline" className="mt-4" onClick={() => navigate('projects')}>
          {t.common.back}
        </Button>
      </div>
    )
  }

  // Filter out existing members from user list
  const existingMemberIds = new Set(project.members.map((m) => m.user.id))
  const availableUsers = users.filter((u) => !existingMemberIds.has(u.id))

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Back button and header */}
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('projects')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
              <StatusBadge status={project.status} />
              <Badge variant="outline" className="text-xs">v{project.currentVersion}</Badge>
              {project.aitNo && (
                <Badge variant="outline" className="text-xs font-mono">
                  {project.aitNo}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {project.code} · Created by {project.createdBy.name}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {formatDate(project.startDate)} — {formatDate(project.endDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="timeline">
              <GanttChart className="mr-1 h-3.5 w-3.5" />
              {t.projects.timeline}
            </TabsTrigger>
            <TabsTrigger value="overview">{t.common.overview}</TabsTrigger>
            <TabsTrigger value="requests">
              <FileText className="mr-1 h-3.5 w-3.5" />
              {t.requests.title}
            </TabsTrigger>
            <TabsTrigger value="mit-items">
              <ClipboardList className="mr-1 h-3.5 w-3.5" />
              {t.workItems.title}
            </TabsTrigger>
            <TabsTrigger value="uat">UAT</TabsTrigger>
            <TabsTrigger value="bugs">
              <Bug className="mr-1 h-3.5 w-3.5" />
              {t.bugs.title}
            </TabsTrigger>
            <TabsTrigger value="risks">
              <ShieldAlert className="mr-1 h-3.5 w-3.5" />
              {t.projects.risks}
            </TabsTrigger>
            <TabsTrigger value="issues">
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              {t.projects.issues}
            </TabsTrigger>
            <TabsTrigger value="decisions">
              <Gavel className="mr-1 h-3.5 w-3.5" />
              {t.projects.decisions}
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="mr-1 h-3.5 w-3.5" />
              {t.projects.members}
            </TabsTrigger>
            <TabsTrigger value="github">
              <Github className="mr-1 h-3.5 w-3.5" />
              GitHub
            </TabsTrigger>
            <TabsTrigger value="meetings">
              <Video className="mr-1 h-3.5 w-3.5" />
              {t.meetings.title}
            </TabsTrigger>
            <TabsTrigger value="versions">
              <History className="mr-1 h-3.5 w-3.5" />
              Versions
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-1 h-3.5 w-3.5" />
              {t.common.settings}
            </TabsTrigger>
            <TabsTrigger value="vault">
              <Brain className="mr-1 h-3.5 w-3.5" />
              {t.vault?.title || 'Memory Vault'}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ============================================================
            TIMELINE TAB
            ============================================================ */}
        <TabsContent value="timeline">
          <ProjectTimeline projectId={projectId!} />
        </TabsContent>

        {/* ============================================================
            OVERVIEW TAB
            ============================================================ */}
        <TabsContent value="overview">
          {tabLoading['overview'] ? <TabLoading /> : (
            <div className="space-y-6">
              {/* AIT No and Health Row */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* AIT Project No */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">AIT Project No</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {project.aitNo ? (
                      <p className="text-2xl font-bold font-mono">{project.aitNo}</p>
                    ) : (
                      <Button
                        size="sm"
                        onClick={handleGenerateAitNo}
                        disabled={generatingAitNo}
                        className="mt-1"
                      >
                        {generatingAitNo ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                        ) : (
                          <><Zap className="mr-2 h-4 w-4" />Generate AIT No</>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Health Score */}
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t.projects.projectHealth}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <HealthGauge score={healthScore} />
                  </CardContent>
                </Card>

                {/* Progress Summary Cards */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t.requests.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {progressSummary ? (
                      <>
                        <p className="text-2xl font-bold">{progressSummary.requests.total}</p>
                        <p className="text-xs text-muted-foreground">
                          {progressSummary.requests.completed} completed
                        </p>
                        <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-green-500 transition-all" style={{ width: `${progressSummary.requests.total ? (progressSummary.requests.completed / progressSummary.requests.total) * 100 : 0}%` }} />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No data</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t.workItems.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {progressSummary ? (
                      <>
                        <p className="text-2xl font-bold">{progressSummary.workItems.total}</p>
                        <p className="text-xs text-muted-foreground">
                          {progressSummary.workItems.completed} deployed
                        </p>
                        <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-sky-500 transition-all" style={{ width: `${progressSummary.workItems.total ? (progressSummary.workItems.completed / progressSummary.workItems.total) * 100 : 0}%` }} />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No data</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Second Row of Metrics */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs">{t.uat.cycles}</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold">
                    {progressSummary?.uat.total ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {progressSummary?.uat.completed ?? 0} completed
                  </p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Bug className="h-4 w-4" />
                    <span className="text-xs">{t.bugs.title}</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold">
                    {progressSummary?.bugs.open ?? 0}
                  </p>
                  {progressSummary && progressSummary.bugs.critical > 0 && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {progressSummary.bugs.critical} critical
                    </p>
                  )}
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs">{t.projects.risks}</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold">
                    {progressSummary?.risks.active ?? 0}
                  </p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ShieldAlert className="h-4 w-4" />
                    <span className="text-xs">{t.projects.issues}</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold">
                    {progressSummary?.issues.open ?? 0}
                  </p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">{t.common.pending}</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold">
                    {progressSummary?.approvals.pending ?? 0}
                  </p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Gavel className="h-4 w-4" />
                    <span className="text-xs">{t.projects.decisions}</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold">
                    {progressSummary?.decisions.pending ?? 0}
                  </p>
                </Card>
              </div>

              {/* Description + Latest Summary */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t.common.description}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-foreground">
                      {project.description || 'No description provided for this project.'}
                    </p>
                    <Separator className="my-4" />
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Start</p>
                        <p className="font-medium text-sm">{formatDate(project.startDate)}</p>
                      </div>
                      <div className="h-px flex-1 bg-border" />
                      <div>
                        <p className="text-muted-foreground text-xs">End</p>
                        <p className="font-medium text-sm">{formatDate(project.endDate)}</p>
                      </div>
                      <div className="h-px flex-1 bg-border" />
                      <div>
                        <p className="text-muted-foreground text-xs">Created</p>
                        <p className="font-medium text-sm">{formatDate(project.createdAt)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Latest GitHub Daily Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Github className="h-4 w-4" />
                      Latest GitHub Daily Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dailySummaries.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(dailySummaries[0].summaryDate)}
                          <span>·</span>
                          <span>{dailySummaries[0].totalCommits} commits</span>
                          <span>·</span>
                          <span>+{dailySummaries[0].totalAdditions} / -{dailySummaries[0].totalDeletions}</span>
                        </div>
                        <div className="max-h-40 overflow-y-auto rounded-lg bg-muted/50 p-3">
                          <p className="text-sm whitespace-pre-wrap">{dailySummaries[0].summaryMarkdown}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-6 text-center">
                        <Github className="mb-2 h-8 w-8 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground">No daily summaries yet</p>
                        <p className="text-xs text-muted-foreground/70">Link a repository and sync commits to generate summaries</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t.projects.activity}</CardTitle>
                </CardHeader>
                <CardContent>
                  {activities.length === 0 ? (
                    <EmptyState icon={Activity} title={t.common.noData} description="Activity will appear here as work progresses" />
                  ) : (
                    <div className="max-h-72 space-y-3 overflow-y-auto">
                      {activities.map((act, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-sm">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                            {activityIcon(act.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            {act.type === 'REQUEST_STATUS_CHANGE' && (
                              <p>
                                <span className="font-medium">{act.requestTitle}</span>
                                {' '}changed from{' '}
                                <Badge variant="secondary" className={`text-[10px] px-1 py-0 ${requestStatusColor(act.fromStatus || '')}`}>
                                  {act.fromStatus || '—'}
                                </Badge>
                                {' '}to{' '}
                                <Badge variant="secondary" className={`text-[10px] px-1 py-0 ${requestStatusColor(act.toStatus || '')}`}>
                                  {act.toStatus}
                                </Badge>
                              </p>
                            )}
                            {act.type === 'WORK_ITEM_STATUS_CHANGE' && (
                              <p>
                                <span className="font-medium">{act.workItemTitle}</span>
                                {' '}changed from{' '}
                                <Badge variant="secondary" className={`text-[10px] px-1 py-0 ${workItemStatusColor(act.fromStatus || '')}`}>
                                  {act.fromStatus || '—'}
                                </Badge>
                                {' '}to{' '}
                                <Badge variant="secondary" className={`text-[10px] px-1 py-0 ${workItemStatusColor(act.toStatus || '')}`}>
                                  {act.toStatus}
                                </Badge>
                              </p>
                            )}
                            {act.type === 'AUDIT_LOG' && (
                              <p>
                                <span className="font-medium">{act.action}</span>
                                {' '}on {act.entity}
                                {act.aitNo && <span className="text-muted-foreground"> ({act.aitNo})</span>}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {act.user?.name && <span>{act.user.name} · </span>}
                              {timeAgo(act.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ============================================================
            REQUESTS TAB
            ============================================================ */}
        <TabsContent value="requests">
          {tabLoading['requests'] ? <TabLoading /> : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{t.requests.title}</CardTitle>
                    <CardDescription>{requests.length} requests in this project</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refreshTab('requests')}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button size="sm" onClick={() => setCreateRequestOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Request
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {requests.length === 0 ? (
                  <EmptyState icon={FileText} title={t.requests.noRequests} description={t.requests.createRequest} />
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>AIT No</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requests.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell className="font-mono text-xs cursor-pointer" onClick={() => navigate('request-detail', { id: req.id })}>
                              {req.aitNo || '—'}
                            </TableCell>
                            <TableCell className="font-medium max-w-[200px] truncate cursor-pointer" onClick={() => navigate('request-detail', { id: req.id })}>{req.title}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${requestStatusColor(req.status)}`}>
                                {req.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{req.type}</TableCell>
                            <TableCell><SeverityBadge severity={req.priority} /></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{timeAgo(req.createdAt)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRequest(req)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteRequest(req.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================
            MIT ITEMS TAB
            ============================================================ */}
        <TabsContent value="mit-items">
          {tabLoading['mit-items'] ? <TabLoading /> : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">MIT Work Items</CardTitle>
                    <CardDescription>{workItems.length} items in this project</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refreshTab('mit-items')}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button size="sm" onClick={() => setCreateMitOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create MIT
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {workItems.length === 0 ? (
                  <EmptyState icon={ClipboardList} title={t.workItems.noWorkItems} description={t.workItems.createWorkItem} />
                ) : (
                  <div className="max-h-[600px] overflow-y-auto space-y-2">
                    {workItems.map((wi) => {
                      const isExpanded = expandedMit === wi.id
                      const actions = getMitActions(wi.status)
                      const currentMitStep = (wi.mitStepAssignments ?? []).find(m => m.step === wi.currentStep)

                      return (
                        <div key={wi.id} className="rounded-lg border">
                          <div
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => setExpandedMit(isExpanded ? null : wi.id)}
                          >
                            <div className="shrink-0">
                              {wi.aitNo ? (
                                <Badge variant="outline" className="font-mono text-xs">{wi.aitNo}</Badge>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={(e) => {
                                      e.stopPropagation()
                                      api.post(`/api/work-items/${wi.id}/generate-document-no`, {}).catch(console.error)
                                    }}>
                                      <Zap className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Generate AIT MIT No</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{wi.title}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <StepBadge step={wi.currentStep || ''} />
                                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${workItemStatusColor(wi.status)}`}>
                                  {wi.status}
                                </Badge>
                                <SeverityBadge severity={wi.priority} />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                              {currentMitStep?.assignee && (
                                <span>{currentMitStep.assignee.name}</span>
                              )}
                              {wi.dueDate && <span>Due: {formatDate(wi.dueDate)}</span>}
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>

                          {/* Expanded MIT Details */}
                          {isExpanded && (
                            <div className="border-t p-4 space-y-4">
                              {wi.description && (
                                <p className="text-sm text-muted-foreground">{wi.description}</p>
                              )}

                              {/* MIT Step Assignments */}
                              <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2">Step Assignments</h4>
                                <div className="flex flex-wrap gap-2">
                                  {['BA', 'DEV', 'QA', 'UAT', 'MA'].map(step => {
                                    const assignment = (wi.mitStepAssignments ?? []).find(a => a.step === step)
                                    const isActive = wi.currentStep === step
                                    return (
                                      <div
                                        key={step}
                                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                          isActive ? 'border-primary bg-primary/5' : ''
                                        }`}
                                      >
                                        <StepBadge step={step} />
                                        {assignment ? (
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs">{assignment.assignee?.name || 'Unassigned'}</span>
                                            <Badge variant="secondary" className="text-[9px] px-1 py-0">
                                              {assignment.status}
                                            </Badge>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">Not started</span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Role Eligibility Info */}
                              <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-1">Role Eligibility</h4>
                                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                                  <span>BA step → BA role</span>
                                  <span>·</span>
                                  <span>DEV step → DEVELOPER role</span>
                                  <span>·</span>
                                  <span>QA step → QA role</span>
                                  <span>·</span>
                                  <span>UAT step → UAT_TESTER role</span>
                                  <span>·</span>
                                  <span>MA step → MA role</span>
                                </div>
                              </div>

                              {/* Actions */}
                              {actions.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Actions</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {actions.map(action => (
                                      <Button
                                        key={action.key}
                                        size="sm"
                                        variant={action.variant}
                                        onClick={() => handleMitAction(wi.id, action.key)}
                                      >
                                        <action.icon className="mr-1.5 h-3.5 w-3.5" />
                                        {action.label}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Create MIT Dialog */}
          <Dialog open={createMitOpen} onOpenChange={setCreateMitOpen}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Create MIT Work Item</DialogTitle>
                <DialogDescription>Add a new managed item tracking entry to this project.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Input value={mitForm.title} onChange={e => setMitForm(p => ({ ...p, title: e.target.value }))} placeholder="Work item title" />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea value={mitForm.description} onChange={e => setMitForm(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Priority</Label>
                    <Select value={mitForm.priority} onValueChange={v => setMitForm(p => ({ ...p, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Current Step</Label>
                    <Select value={mitForm.currentStep} onValueChange={v => setMitForm(p => ({ ...p, currentStep: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BA">BA</SelectItem>
                        <SelectItem value="DEV">DEV</SelectItem>
                        <SelectItem value="QA">QA</SelectItem>
                        <SelectItem value="UAT">UAT</SelectItem>
                        <SelectItem value="MA">MA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateMitOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateMit} disabled={submitting || !mitForm.title}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============================================================
            UAT TAB
            ============================================================ */}
        <TabsContent value="uat">
          {tabLoading['uat'] ? <TabLoading /> : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">UAT Cycles</CardTitle>
                    <CardDescription>{uatCycles.length} UAT cycles in this project</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refreshTab('uat')}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button size="sm" onClick={() => setCreateUatOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      New UAT Cycle
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {uatCycles.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title={t.uat.noCycles} description={t.uat.createCycle} />
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>AIT UAT No</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Start</TableHead>
                          <TableHead>End</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uatCycles.map((cycle) => (
                          <TableRow key={cycle.id}>
                            <TableCell className="font-mono text-xs">{cycle.aitNo || '—'}</TableCell>
                            <TableCell className="font-medium">{cycle.name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${uatStatusColor(cycle.status)}`}>
                                {cycle.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(cycle.startDate)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(cycle.endDate)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditUat(cycle)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteUat(cycle.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================
            BUGS TAB
            ============================================================ */}
        <TabsContent value="bugs">
          {tabLoading['bugs'] ? <TabLoading /> : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{t.bugs.title}</CardTitle>
                    <CardDescription>{bugs.length} bugs reported</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refreshTab('bugs')}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button size="sm" onClick={() => setCreateBugOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Report Bug
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {bugs.length === 0 ? (
                  <EmptyState icon={Bug} title={t.bugs.noBugs} description={t.bugs.reportBug} />
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>AIT BUG No</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Reported By</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bugs.map((bug) => (
                          <TableRow key={bug.id}>
                            <TableCell className="font-mono text-xs">{bug.aitNo || '—'}</TableCell>
                            <TableCell className="font-medium max-w-[200px] truncate">{bug.title}</TableCell>
                            <TableCell><SeverityBadge severity={bug.severity} /></TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${bugStatusColor(bug.status)}`}>
                                {bug.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{bug.reportedBy?.name || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{timeAgo(bug.createdAt)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBug(bug)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteBug(bug.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================
            RISKS TAB
            ============================================================ */}
        <TabsContent value="risks">
          {tabLoading['risks'] ? <TabLoading /> : (
            <div className="space-y-6">
              {/* Probability/Impact Matrix */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t.projects.risks}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="grid grid-cols-5 gap-1 min-w-[400px]">
                      {/* Header row */}
                      <div className="text-xs font-medium text-muted-foreground p-2" />
                      <div className="text-xs font-medium text-muted-foreground p-2 text-center">LOW</div>
                      <div className="text-xs font-medium text-muted-foreground p-2 text-center">MEDIUM</div>
                      <div className="text-xs font-medium text-muted-foreground p-2 text-center">HIGH</div>
                      <div className="text-xs font-medium text-muted-foreground p-2 text-center">CRITICAL</div>

                      {['HIGH', 'MEDIUM', 'LOW'].map(prob => (
                        <React.Fragment key={prob}>
                          <div className="text-xs font-medium text-muted-foreground p-2 flex items-center">{prob}</div>
                          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(impact => {
                            const cellRisks = risks.filter(r => r.probibility === prob || r.probability === prob)
                              .filter(r => r.impact === impact)
                            return (
                              <div
                                key={`${prob}-${impact}`}
                                className={`rounded p-2 text-center ${riskMatrixColor(prob, impact)} min-h-[60px]`}
                              >
                                {cellRisks.length > 0 && (
                                  <div className="text-xs font-medium">
                                    {cellRisks.length} risk{cellRisks.length > 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risks Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{t.projects.risks}</CardTitle>
                      <CardDescription>{risks.length} risks identified</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => refreshTab('risks')}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                      <Button size="sm" onClick={() => setCreateRiskOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Risk
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {risks.length === 0 ? (
                    <EmptyState icon={ShieldAlert} title={t.common.noData} description="Add a risk to start tracking potential issues" />
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Probability</TableHead>
                            <TableHead>Impact</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>Mitigation</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {risks.map((risk) => (
                            <TableRow key={risk.id}>
                              <TableCell className="font-medium max-w-[180px] truncate">{risk.title}</TableCell>
                              <TableCell><SeverityBadge severity={risk.probability} /></TableCell>
                              <TableCell><SeverityBadge severity={risk.impact} /></TableCell>
                              <TableCell>
                                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${riskStatusColor(risk.status)}`}>
                                  {risk.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">{risk.owner?.name || '—'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{risk.mitigation || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ============================================================
              CRUD DIALOGS: Request, UAT, Bug, Meeting
              ============================================================ */}

          {/* Create Request Dialog */}
          <Dialog open={createRequestOpen} onOpenChange={setCreateRequestOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Request</DialogTitle>
                <DialogDescription>Add a new request to this project.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Title *</Label>
                  <Input value={requestForm.title} onChange={(e) => setRequestForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Request title" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select value={requestForm.type} onValueChange={(v) => setRequestForm(prev => ({ ...prev, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FEATURE">Feature</SelectItem>
                        <SelectItem value="BUG_FIX">Bug Fix</SelectItem>
                        <SelectItem value="ENHANCEMENT">Enhancement</SelectItem>
                        <SelectItem value="SUPPORT">Support</SelectItem>
                        <SelectItem value="CHANGE">Change Request</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Priority</Label>
                    <Select value={requestForm.priority} onValueChange={(v) => setRequestForm(prev => ({ ...prev, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea value={requestForm.description} onChange={(e) => setRequestForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Describe the request..." rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateRequestOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateRequest} disabled={submitting || !requestForm.title}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Request Dialog */}
          <Dialog open={editRequestOpen} onOpenChange={setEditRequestOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Edit Request</DialogTitle>
                <DialogDescription>Update request details.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Title *</Label>
                  <Input value={requestForm.title} onChange={(e) => setRequestForm(prev => ({ ...prev, title: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select value={requestForm.type} onValueChange={(v) => setRequestForm(prev => ({ ...prev, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FEATURE">Feature</SelectItem>
                        <SelectItem value="BUG_FIX">Bug Fix</SelectItem>
                        <SelectItem value="ENHANCEMENT">Enhancement</SelectItem>
                        <SelectItem value="SUPPORT">Support</SelectItem>
                        <SelectItem value="CHANGE">Change Request</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Priority</Label>
                    <Select value={requestForm.priority} onValueChange={(v) => setRequestForm(prev => ({ ...prev, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea value={requestForm.description} onChange={(e) => setRequestForm(prev => ({ ...prev, description: e.target.value }))} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditRequestOpen(false)}>Cancel</Button>
                <Button onClick={handleEditRequest} disabled={submitting || !requestForm.title}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create UAT Cycle Dialog */}
          <Dialog open={createUatOpen} onOpenChange={setCreateUatOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create UAT Cycle</DialogTitle>
                <DialogDescription>Start a new UAT testing cycle for this project.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Cycle Name *</Label>
                  <Input value={uatForm.name} onChange={(e) => setUatForm(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. UAT Round 1" />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea value={uatForm.description} onChange={(e) => setUatForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Describe the UAT cycle scope..." rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={uatForm.startDate} onChange={(e) => setUatForm(prev => ({ ...prev, startDate: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>End Date</Label>
                    <Input type="date" value={uatForm.endDate} onChange={(e) => setUatForm(prev => ({ ...prev, endDate: e.target.value }))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateUatOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateUat} disabled={submitting || !uatForm.name}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit UAT Cycle Dialog */}
          <Dialog open={editUatOpen} onOpenChange={setEditUatOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Edit UAT Cycle</DialogTitle>
                <DialogDescription>Update UAT cycle details.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Cycle Name *</Label>
                  <Input value={uatForm.name} onChange={(e) => setUatForm(prev => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea value={uatForm.description} onChange={(e) => setUatForm(prev => ({ ...prev, description: e.target.value }))} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={uatForm.startDate} onChange={(e) => setUatForm(prev => ({ ...prev, startDate: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>End Date</Label>
                    <Input type="date" value={uatForm.endDate} onChange={(e) => setUatForm(prev => ({ ...prev, endDate: e.target.value }))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditUatOpen(false)}>Cancel</Button>
                <Button onClick={handleEditUat} disabled={submitting || !uatForm.name}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Bug Dialog */}
          <Dialog open={createBugOpen} onOpenChange={setCreateBugOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Report Bug</DialogTitle>
                <DialogDescription>File a new bug report for this project.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Title *</Label>
                  <Input value={bugForm.title} onChange={(e) => setBugForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Bug title" />
                </div>
                <div className="grid gap-2">
                  <Label>Description *</Label>
                  <Textarea value={bugForm.description} onChange={(e) => setBugForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Describe the bug..." rows={3} />
                </div>
                <div className="grid gap-2">
                  <Label>Severity</Label>
                  <Select value={bugForm.severity} onValueChange={(v) => setBugForm(prev => ({ ...prev, severity: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Actual Result</Label>
                  <Input value={bugForm.actualResult} onChange={(e) => setBugForm(prev => ({ ...prev, actualResult: e.target.value }))} placeholder="What actually happened" />
                </div>
                <div className="grid gap-2">
                  <Label>Expected Result</Label>
                  <Input value={bugForm.expectedResult} onChange={(e) => setBugForm(prev => ({ ...prev, expectedResult: e.target.value }))} placeholder="What should have happened" />
                </div>
                <div className="grid gap-2">
                  <Label>Reproduction Steps</Label>
                  <Textarea value={bugForm.reproductionSteps} onChange={(e) => setBugForm(prev => ({ ...prev, reproductionSteps: e.target.value }))} placeholder="Steps to reproduce..." rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateBugOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateBug} disabled={submitting || !bugForm.title || !bugForm.description}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Report Bug
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Bug Dialog */}
          <Dialog open={editBugOpen} onOpenChange={setEditBugOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Edit Bug</DialogTitle>
                <DialogDescription>Update bug report details.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Title *</Label>
                  <Input value={bugForm.title} onChange={(e) => setBugForm(prev => ({ ...prev, title: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea value={bugForm.description} onChange={(e) => setBugForm(prev => ({ ...prev, description: e.target.value }))} rows={3} />
                </div>
                <div className="grid gap-2">
                  <Label>Severity</Label>
                  <Select value={bugForm.severity} onValueChange={(v) => setBugForm(prev => ({ ...prev, severity: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditBugOpen(false)}>Cancel</Button>
                <Button onClick={handleEditBug} disabled={submitting || !bugForm.title}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Meeting Dialog */}
          <Dialog open={createMeetingOpen} onOpenChange={setCreateMeetingOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Schedule Meeting</DialogTitle>
                <DialogDescription>Schedule a new meeting for this project.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Title *</Label>
                  <Input value={meetingForm.title} onChange={(e) => setMeetingForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Meeting title" />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea value={meetingForm.description} onChange={(e) => setMeetingForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Meeting agenda or description..." rows={3} />
                </div>
                <div className="grid gap-2">
                  <Label>Meeting URL</Label>
                  <Input value={meetingForm.meetingUrl} onChange={(e) => setMeetingForm(prev => ({ ...prev, meetingUrl: e.target.value }))} placeholder="https://meet.example.com/..." />
                </div>
                <div className="grid gap-2">
                  <Label>Scheduled At</Label>
                  <Input type="datetime-local" value={meetingForm.scheduledAt} onChange={(e) => setMeetingForm(prev => ({ ...prev, scheduledAt: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateMeetingOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateMeeting} disabled={submitting || !meetingForm.title}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Schedule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Meeting Dialog */}
          <Dialog open={editMeetingOpen} onOpenChange={setEditMeetingOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Edit Meeting</DialogTitle>
                <DialogDescription>Update meeting details.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Title *</Label>
                  <Input value={meetingForm.title} onChange={(e) => setMeetingForm(prev => ({ ...prev, title: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea value={meetingForm.description} onChange={(e) => setMeetingForm(prev => ({ ...prev, description: e.target.value }))} rows={3} />
                </div>
                <div className="grid gap-2">
                  <Label>Meeting URL</Label>
                  <Input value={meetingForm.meetingUrl} onChange={(e) => setMeetingForm(prev => ({ ...prev, meetingUrl: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Scheduled At</Label>
                  <Input type="datetime-local" value={meetingForm.scheduledAt} onChange={(e) => setMeetingForm(prev => ({ ...prev, scheduledAt: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditMeetingOpen(false)}>Cancel</Button>
                <Button onClick={handleEditMeeting} disabled={submitting || !meetingForm.title}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Risk Dialog */}
          <Dialog open={createRiskOpen} onOpenChange={setCreateRiskOpen}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Add Project Risk</DialogTitle>
                <DialogDescription>Identify a new risk for this project.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Input value={riskForm.title} onChange={e => setRiskForm(p => ({ ...p, title: e.target.value }))} placeholder="Risk title" />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea value={riskForm.description} onChange={e => setRiskForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the risk (optional)" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Probability</Label>
                    <Select value={riskForm.probability} onValueChange={v => setRiskForm(p => ({ ...p, probability: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Impact</Label>
                    <Select value={riskForm.impact} onValueChange={v => setRiskForm(p => ({ ...p, impact: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Mitigation Plan</Label>
                  <Textarea value={riskForm.mitigation} onChange={e => setRiskForm(p => ({ ...p, mitigation: e.target.value }))} placeholder="How to mitigate this risk (optional)" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateRiskOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateRisk} disabled={submitting || !riskForm.title}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Add Risk'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============================================================
            ISSUES TAB
            ============================================================ */}
        <TabsContent value="issues">
          {tabLoading['issues'] ? <TabLoading /> : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{t.projects.issues}</CardTitle>
                    <CardDescription>{issues.length} issues logged</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refreshTab('issues')}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button size="sm" onClick={() => setCreateIssueOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Issue
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {issues.length === 0 ? (
                  <EmptyState icon={AlertTriangle} title={t.common.noData} description="Add an issue to track project problems" />
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Resolution</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {issues.map((issue) => (
                          <TableRow key={issue.id}>
                            <TableCell className="font-medium max-w-[180px] truncate">{issue.title}</TableCell>
                            <TableCell><SeverityBadge severity={issue.severity} /></TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${issueStatusColor(issue.status)}`}>
                                {issue.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{issue.owner?.name || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{issue.resolution || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{timeAgo(issue.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Create Issue Dialog */}
          <Dialog open={createIssueOpen} onOpenChange={setCreateIssueOpen}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Add Project Issue</DialogTitle>
                <DialogDescription>Log a new issue for this project.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Input value={issueForm.title} onChange={e => setIssueForm(p => ({ ...p, title: e.target.value }))} placeholder="Issue title" />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea value={issueForm.description} onChange={e => setIssueForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the issue (optional)" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Severity</Label>
                    <Select value={issueForm.severity} onValueChange={v => setIssueForm(p => ({ ...p, severity: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Resolution</Label>
                    <Input value={issueForm.resolution} onChange={e => setIssueForm(p => ({ ...p, resolution: e.target.value }))} placeholder="Resolution (optional)" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateIssueOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateIssue} disabled={submitting || !issueForm.title}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Add Issue'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============================================================
            DECISIONS TAB
            ============================================================ */}
        <TabsContent value="decisions">
          {tabLoading['decisions'] ? <TabLoading /> : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{t.projects.decisions}</CardTitle>
                    <CardDescription>{decisions.length} decisions logged</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refreshTab('decisions')}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button size="sm" onClick={() => setCreateDecisionOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Decision
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {decisions.length === 0 ? (
                  <EmptyState icon={Gavel} title={t.common.noData} description="Document project decisions for future reference" />
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Decision</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Decided By</TableHead>
                          <TableHead>Rationale</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {decisions.map((dec) => (
                          <TableRow key={dec.id}>
                            <TableCell className="font-medium max-w-[160px] truncate">{dec.title}</TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate">{dec.decision || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${decisionStatusColor(dec.status)}`}>
                                {dec.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{dec.decidedBy?.name || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{dec.rationale || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{timeAgo(dec.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Create Decision Dialog */}
          <Dialog open={createDecisionOpen} onOpenChange={setCreateDecisionOpen}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Add Project Decision</DialogTitle>
                <DialogDescription>Log a decision made for this project.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Input value={decisionForm.title} onChange={e => setDecisionForm(p => ({ ...p, title: e.target.value }))} placeholder="Decision title" />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea value={decisionForm.description} onChange={e => setDecisionForm(p => ({ ...p, description: e.target.value }))} placeholder="Context (optional)" />
                </div>
                <div className="grid gap-2">
                  <Label>Decision</Label>
                  <Input value={decisionForm.decision} onChange={e => setDecisionForm(p => ({ ...p, decision: e.target.value }))} placeholder="What was decided" />
                </div>
                <div className="grid gap-2">
                  <Label>Rationale</Label>
                  <Textarea value={decisionForm.rationale} onChange={e => setDecisionForm(p => ({ ...p, rationale: e.target.value }))} placeholder="Why this decision was made (optional)" />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={decisionForm.status} onValueChange={v => setDecisionForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROPOSED">Proposed</SelectItem>
                      <SelectItem value="ACCEPTED">Accepted</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                      <SelectItem value="DEFERRED">Deferred</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDecisionOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateDecision} disabled={submitting || !decisionForm.title}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Add Decision'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============================================================
            MEMBERS TAB
            ============================================================ */}
        <TabsContent value="members">
          {tabLoading['members'] ? <TabLoading /> : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Project Members</CardTitle>
                    <CardDescription>{project.members.length} members in this project</CardDescription>
                  </div>
                  <Button size="sm" onClick={handleOpenAddMember}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Member
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 space-y-3 overflow-y-auto">
                  {project.members.length === 0 ? (
                    <EmptyState icon={Users} title="No members" description="Add members to this project" />
                  ) : (
                    project.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={member.user.avatarUrl || undefined} alt={member.user.name} />
                            <AvatarFallback className="text-xs">
                              {member.user.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{member.user.name}</p>
                            <p className="text-xs text-muted-foreground">{member.user.email}</p>
                          </div>
                        </div>
                        <RoleBadge role={member.role} />
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add Member Dialog */}
          <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Add Project Member</DialogTitle>
                <DialogDescription>
                  Select a user and role to add to this project.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROJECT_MANAGER">Project Manager</SelectItem>
                      <SelectItem value="LEAD">Lead</SelectItem>
                      <SelectItem value="MEMBER">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddMember}
                  disabled={addingMember || !selectedUserId || !selectedRole}
                >
                  {addingMember ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Member'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============================================================
            GITHUB TAB
            ============================================================ */}
        <TabsContent value="github">
          {tabLoading['github'] ? <TabLoading /> : (
            <div className="space-y-6">
              {/* Connected Repositories */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Github className="h-4 w-4" />
                        Connected Repositories
                      </CardTitle>
                      <CardDescription>{linkedRepos.length} repositories linked</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => refreshTab('github')}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                      <Button size="sm" onClick={handleOpenLinkRepo}>
                        <Link2 className="mr-2 h-4 w-4" />
                        Link Repo
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {linkedRepos.length === 0 ? (
                    <EmptyState icon={Github} title="No repositories linked" description="Link a GitHub repository to track commits and generate summaries" />
                  ) : (
                    <div className="space-y-2">
                      {linkedRepos.map((link) => (
                        <div key={link.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                              <Github className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{link.repository.fullName}</p>
                              <p className="text-xs text-muted-foreground">
                                Branch: {link.branch}
                                {link.isPrimary && ' · Primary'}
                                {link.pathFilter && ` · Path: ${link.pathFilter}`}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleUnlinkRepo(link.id)}>
                            <Unlink className="mr-2 h-4 w-4" />
                            Unlink
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sync & Generate Actions */}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={handleSyncCommits} disabled={syncing || linkedRepos.length === 0}>
                  {syncing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Syncing...</> : <><RefreshCw className="mr-2 h-4 w-4" />Sync Commits</>}
                </Button>
                <Button variant="outline" onClick={handleGenerateSummary} disabled={syncing || linkedRepos.length === 0}>
                  {syncing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : <><Zap className="mr-2 h-4 w-4" />Generate Daily Summary</>}
                </Button>
              </div>

              {/* Commits Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Commits</CardTitle>
                </CardHeader>
                <CardContent>
                  {commits.length === 0 ? (
                    <EmptyState icon={GitCommitHorizontal} title="No commits" description="Sync commits from linked repositories" />
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SHA</TableHead>
                            <TableHead>Message</TableHead>
                            <TableHead>Author</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {commits.map((commit) => (
                            <TableRow key={commit.id}>
                              <TableCell className="font-mono text-xs">{commit.sha.slice(0, 7)}</TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm">{commit.message}</TableCell>
                              <TableCell className="text-xs">{commit.authorName}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{commit.branch || '—'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(commit.authorDate)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Daily Summaries Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Daily Summaries</CardTitle>
                </CardHeader>
                <CardContent>
                  {dailySummaries.length === 0 ? (
                    <EmptyState icon={FileText} title="No daily summaries" description="Generate a daily summary to see AI-powered commit analysis" />
                  ) : (
                    <div className="max-h-96 space-y-4 overflow-y-auto">
                      {dailySummaries.map((summary) => (
                        <div key={summary.id} className="rounded-lg border p-4 space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(summary.summaryDate)}
                            <span className="text-xs text-muted-foreground font-normal">
                              {summary.totalCommits} commits · +{summary.totalAdditions} / -{summary.totalDeletions}
                            </span>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-3">
                            <p className="text-sm whitespace-pre-wrap">{summary.summaryMarkdown}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Link Repository Dialog */}
          <Dialog open={linkRepoOpen} onOpenChange={setLinkRepoOpen}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Link Repository</DialogTitle>
                <DialogDescription>Select a repository to link to this project.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                {availableRepos.length === 0 ? (
                  <div className="text-center py-8">
                    <Github className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No available repositories found.</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Configure GitHub connections in Admin settings first.</p>
                  </div>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {availableRepos.map((repo) => (
                      <button
                        key={repo.id}
                        className="flex items-center justify-between w-full rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => handleLinkRepo(repo.id, repo.defaultBranch)}
                        disabled={submitting}
                      >
                        <div className="flex items-center gap-3">
                          <Github className="h-4 w-4" />
                          <div>
                            <p className="text-sm font-medium">{repo.fullName}</p>
                            <p className="text-xs text-muted-foreground">Default: {repo.defaultBranch}</p>
                          </div>
                        </div>
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLinkRepoOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============================================================
            MEETINGS TAB
            ============================================================ */}
        <TabsContent value="meetings">
          {tabLoading['meetings'] ? <TabLoading /> : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Linked Meetings</CardTitle>
                    <CardDescription>{meetings.length} meetings in this project</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refreshTab('meetings')}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button size="sm" onClick={() => setCreateMeetingOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Meeting
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 space-y-3 overflow-y-auto">
                  {meetings.length === 0 ? (
                    <EmptyState icon={Video} title="No meetings linked" description="Schedule a meeting for this project" />
                  ) : (
                    meetings.map((meeting) => (
                      <div
                        key={meeting.id}
                        className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Video className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{meeting.title}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 ${meetingStatusColor(meeting.status)}`}
                            >
                              {meeting.status}
                            </Badge>
                            {meeting.scheduledAt && (
                              <span className="text-xs text-muted-foreground">
                                {formatDate(meeting.scheduledAt)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMeeting(meeting)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteMeeting(meeting.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================
            VERSIONS TAB
            ============================================================ */}
        <TabsContent value="versions">
          {tabLoading['versions'] ? <TabLoading /> : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Version History</h3>
                  <p className="text-sm text-muted-foreground">
                    {versions.length} version{versions.length !== 1 ? 's' : ''} · Current: v{project?.currentVersion ?? 1}
                  </p>
                </div>
                <Button onClick={handleCreateSnapshot} disabled={submitting} className="gap-2" size="sm">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Snapshot
                </Button>
              </div>

              {versions.length === 0 ? (
                <EmptyState icon={History} title="No versions yet" description="Versions are created automatically when the project is updated, or you can create a manual snapshot." />
              ) : (
                <div className="relative space-y-0">
                  {/* Timeline line */}
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

                  {versions.map((v, idx) => {
                    const isCurrent = v.version === project?.currentVersion
                    const changeTypeColors: Record<string, string> = {
                      CREATE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
                      UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
                      STATUS_CHANGE: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
                      MANUAL: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
                      RESTORE: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
                    }
                    const changeTypeLabels: Record<string, string> = {
                      CREATE: 'Created',
                      UPDATE: 'Updated',
                      STATUS_CHANGE: 'Status Changed',
                      MANUAL: 'Manual Snapshot',
                      RESTORE: 'Restored',
                    }

                    return (
                      <div key={v.id} className="relative flex gap-4 pb-6">
                        {/* Timeline dot */}
                        <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                          isCurrent
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/30 bg-background text-muted-foreground'
                        }`}>
                          <span className="text-xs font-bold">{v.version}</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <Card className={isCurrent ? 'ring-2 ring-primary/20' : ''}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm">v{v.version}</span>
                                    <Badge variant="secondary" className={`text-[10px] ${changeTypeColors[v.changeType] || ''}`}>
                                      {changeTypeLabels[v.changeType] || v.changeType}
                                    </Badge>
                                    {isCurrent && (
                                      <Badge className="text-[10px] bg-primary/10 text-primary">Current</Badge>
                                    )}
                                  </div>
                                  {v.changeLog && (
                                    <p className="mt-1 text-sm text-muted-foreground">{v.changeLog}</p>
                                  )}
                                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                    <span>By {v.createdBy?.name || 'Unknown'}</span>
                                    <span>{new Date(v.createdAt).toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Snapshot details - expandable */}
                              <DetailsSection v={v} />
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ============================================================
            SETTINGS TAB
            ============================================================ */}
        <TabsContent value="settings">
          <div className="space-y-6">
            {/* AIT Project Number */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AIT Project Number</CardTitle>
                <CardDescription>Generate or view the AIT document number for this project.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  {project.aitNo ? (
                    <>
                      <p className="text-2xl font-bold font-mono">{project.aitNo}</p>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Generated</Badge>
                    </>
                  ) : (
                    <Button onClick={handleGenerateAitNo} disabled={generatingAitNo}>
                      {generatingAitNo ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                      ) : (
                        <><Zap className="mr-2 h-4 w-4" />Generate AIT Project No</>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Edit Project Details */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Project Details</CardTitle>
                    <CardDescription>Edit project information</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={openEditProject}>
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Name</p>
                    <p className="font-medium">{project.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Code</p>
                    <p className="font-medium">{project.code}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Status</p>
                    <StatusBadge status={project.status} />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Start Date</p>
                    <p>{formatDate(project.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">End Date</p>
                    <p>{formatDate(project.endDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Created By</p>
                    <p>{project.createdBy.name}</p>
                  </div>
                </div>
                {project.description && (
                  <div className="mt-4">
                    <p className="text-muted-foreground text-xs">Description</p>
                    <p className="text-sm mt-1">{project.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Health Score */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Health Score</CardTitle>
                    <CardDescription>Current score: {healthScore ?? 'Not calculated'}</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRecalcHealth} disabled={recalculating}>
                    {recalculating ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Calculating...</>
                    ) : (
                      <><RefreshCw className="mr-2 h-4 w-4" />Recalculate</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <HealthGauge score={healthScore} />
              </CardContent>
            </Card>

            {/* GitHub Repository Management */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Github className="h-4 w-4" />
                      GitHub Repositories
                    </CardTitle>
                    <CardDescription>{linkedRepos.length} repositories connected</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { loadedTabs.current.tabs.delete('github'); refreshTab('github') }}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button size="sm" onClick={handleOpenLinkRepo}>
                      <Link2 className="mr-2 h-4 w-4" />
                      Link Repo
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {linkedRepos.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No repositories linked to this project.</p>
                ) : (
                  <div className="space-y-2">
                    {linkedRepos.map((link) => (
                      <div key={link.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <Github className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{link.repository.fullName}</p>
                            <p className="text-xs text-muted-foreground">
                              Branch: {link.branch}{link.isPrimary ? ' · Primary' : ''}{link.pathFilter ? ` · ${link.pathFilter}` : ''}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleUnlinkRepo(link.id)}>
                          <Unlink className="mr-2 h-4 w-4" />
                          Unlink
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Edit Project Dialog */}
          <Dialog open={editProjectOpen} onOpenChange={setEditProjectOpen}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Edit Project</DialogTitle>
                <DialogDescription>Update project details.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={v => setEditForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="ON_HOLD">On Hold</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={editForm.startDate} onChange={e => setEditForm(p => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>End Date</Label>
                    <Input type="date" value={editForm.endDate} onChange={e => setEditForm(p => ({ ...p, endDate: e.target.value }))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditProjectOpen(false)}>Cancel</Button>
                <Button onClick={handleEditProject} disabled={submitting}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============================================================
            VAULT TAB (Memory Vault)
            ============================================================ */}
        <TabsContent value="vault">
          {projectId && <MemoryVault projectId={projectId} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}
