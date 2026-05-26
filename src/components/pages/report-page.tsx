'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
} from 'recharts'
import {
  BarChart3,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Bug,
  FolderKanban,
  Calendar,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Filter,
  Download,
  Eye,
  Zap,
  Shield,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api-client'
import { toast } from '@/lib/toast'

// ============================================================
// Color Palette
// ============================================================
const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

const TOOLTIP_STYLE = {
  borderRadius: '8px',
  border: '1px solid hsl(var(--border))',
  backgroundColor: 'hsl(var(--card))',
  color: 'hsl(var(--card-foreground))',
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#ef4444',
  IT_MANAGER: '#f59e0b',
  PROJECT_MANAGER: '#3b82f6',
  APPROVER: '#8b5cf6',
  BA: '#10b981',
  DEVELOPER: '#06b6d4',
  FULLSTACK: '#0ea5e9',
  QA: '#ec4899',
  REQUESTER: '#f97316',
  VIEWER: '#6b7280',
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  IT_MANAGER: 'IT Manager',
  PROJECT_MANAGER: 'PM',
  APPROVER: 'Approver',
  BA: 'BA',
  DEVELOPER: 'Dev',
  FULLSTACK: 'Fullstack',
  QA: 'QA',
  REQUESTER: 'Requester',
  VIEWER: 'Viewer',
}

// ============================================================
// Types
// ============================================================
interface DetailItem {
  id: string
  title: string
  type: 'BA' | 'DEV' | 'QA' | 'MIT'
  status: string
  priority: string
  dueDate: string | null
  projectName: string | null
  projectCode: string | null
  aitNo?: string | null
  estimatedManDays?: number
  spentManDays?: number
  currentStep?: string | null
  steps?: { step: string; status: string; estimatedManDays: number; spentManDays: number }[]
}

interface WorkOnHandUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  position: string | null
  department: string
  role: string
  baItems: number
  devItems: number
  qaItems: number
  mitItems: number
  totalActive: number
  overdue: number
  highPriority: number
  totalEstimatedManDays: number
  totalSpentManDays: number
  detailItems: DetailItem[]
}

interface DepartmentSummary {
  name: string
  totalActive: number
  totalOverdue: number
  userCount: number
}

interface RoleSummary {
  role: string
  baItems: number
  devItems: number
  qaItems: number
  mitItems: number
  userCount: number
}

interface UserPerformance {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  position: string | null
  department: string
  role: string
  totalCompleted: number
  totalActive: number
  onTimeRate: number
  overdueActive: number
  highPriorityActive: number
  throughput: number
  performanceScore: number
}

interface ProjectHealth {
  id: string
  name: string
  code: string
  healthScore: number
  startDate: string | null
  endDate: string | null
  _count: { requests: number; members: number }
}

interface ExecutiveSummary {
  totalRequests: number
  completedRequests: number
  completionRate: number
  totalWorkItems: number
  completedWorkItems: number
  workItemRate: number
  openBugs: number
  criticalBugs: number
  activeProjects: number
  upcomingMeetings: number
  overdueRequests: number
  avgTeamPerformance: number
}

interface DailyRequest {
  date: string
  created: number
  completed: number
}

interface BugSeverity {
  severity: string
  count: number
}

// ============================================================
// Custom Bar Label Component
// ============================================================
function BarLabel({ x, y, width, value }: { x: number; y: number; width: number; value: number }) {
  if (value === 0) return null
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={11} fontWeight={600}>
      {value}
    </text>
  )
}

// ============================================================
// Stat Card Component
// ============================================================
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  color = 'text-primary',
  bgColor = 'bg-primary/10',
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  color?: string
  bgColor?: string
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {trend && trendLabel && (
              <div className="flex items-center gap-1 text-xs">
                {trend === 'up' && <ArrowUpRight className="h-3 w-3 text-green-500" />}
                {trend === 'down' && <ArrowDownRight className="h-3 w-3 text-red-500" />}
                {trend === 'neutral' && <Minus className="h-3 w-3 text-muted-foreground" />}
                <span className={trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'}>
                  {trendLabel}
                </span>
              </div>
            )}
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bgColor}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Performance Badge
// ============================================================
function PerformanceBadge({ score }: { score: number }) {
  const config = score >= 80
    ? { label: 'Excellent', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' }
    : score >= 60
    ? { label: 'Good', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' }
    : score >= 40
    ? { label: 'Average', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' }
    : { label: 'Needs Attention', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' }

  return <Badge variant="outline" className={`text-xs ${config.className}`}>{config.label}</Badge>
}

// ============================================================
// Main Report Page
// ============================================================
export default function ReportPage() {
  const { user: currentUser } = useAppStore()
  const { t } = useI18n()

  // Work on hand data
  const [workOnHand, setWorkOnHand] = useState<WorkOnHandUser[]>([])
  const [deptSummary, setDeptSummary] = useState<DepartmentSummary[]>([])
  const [roleSummary, setRoleSummary] = useState<RoleSummary[]>([])
  const [wohSummary, setWohSummary] = useState({ totalUsers: 0, totalActiveItems: 0, totalOverdue: 0, totalHighPriority: 0, totalEstimatedManDays: 0, totalSpentManDays: 0 })

  // Performance data
  const [userPerf, setUserPerf] = useState<UserPerformance[]>([])
  const [projectHealth, setProjectHealth] = useState<ProjectHealth[]>([])
  const [execSummary, setExecSummary] = useState<ExecutiveSummary | null>(null)
  const [dailyRequests, setDailyRequests] = useState<DailyRequest[]>([])
  const [bugSeverities, setBugSeverities] = useState<BugSeverity[]>([])

  // UI state
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('work-on-hand')
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // ── Data Fetching ──
  const fetchWorkOnHand = useCallback(async () => {
    try {
      const data = await api.get<{
        workOnHandByUser: WorkOnHandUser[]
        byDepartment: DepartmentSummary[]
        byRole: RoleSummary[]
        summary: typeof wohSummary
      }>('/api/reports/work-on-hand')
      setWorkOnHand(data.workOnHandByUser)
      setDeptSummary(data.byDepartment)
      setRoleSummary(data.byRole)
      setWohSummary(data.summary)
    } catch {
      toast.error('Error', 'Failed to load work-on-hand data')
    }
  }, [])

  const fetchPerformance = useCallback(async () => {
    try {
      const data = await api.get<{
        userPerformance: UserPerformance[]
        projectHealth: ProjectHealth[]
        executiveSummary: ExecutiveSummary
        dailyRequests: DailyRequest[]
        bugSeverities: BugSeverity[]
      }>('/api/reports/performance')
      setUserPerf(data.userPerformance)
      setProjectHealth(data.projectHealth)
      setExecSummary(data.executiveSummary)
      setDailyRequests(data.dailyRequests)
      setBugSeverities(data.bugSeverities)
    } catch {
      toast.error('Error', 'Failed to load performance data')
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchWorkOnHand(), fetchPerformance()])
      setLoading(false)
    }
    load()
  }, [fetchWorkOnHand, fetchPerformance])

  const handleRefresh = async () => {
    setLoading(true)
    await Promise.all([fetchWorkOnHand(), fetchPerformance()])
    setLoading(false)
    toast.info('Refreshed', 'Report data updated')
  }

  // ── Filtering ──
  const filteredWOH = workOnHand.filter((u) => {
    if (deptFilter !== 'all' && u.department !== deptFilter) return false
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    return true
  })

  const filteredPerf = userPerf.filter((u) => {
    if (deptFilter !== 'all' && u.department !== deptFilter) return false
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    return true
  })

  const departments = [...new Set(workOnHand.map((u) => u.department))].sort()
  const roles = [...new Set(workOnHand.map((u) => u.role))].sort()

  // ── Chart Data ──
  const barChartData = filteredWOH.map((u) => ({
    name: u.name.split(' ')[0],
    ba: u.baItems,
    dev: u.devItems,
    qa: u.qaItems,
    mit: u.mitItems,
    total: u.totalActive,
  }))

  const deptChartData = deptSummary.map((d) => ({
    name: d.name.length > 12 ? d.name.substring(0, 12) + '...' : d.name,
    active: d.totalActive,
    overdue: d.totalOverdue,
    users: d.userCount,
  }))

  const roleChartData = roleSummary.map((r) => ({
    name: ROLE_LABELS[r.role] || r.role,
    ba: r.baItems,
    dev: r.devItems,
    qa: r.qaItems,
    mit: r.mitItems,
    total: r.baItems + r.devItems + r.qaItems + r.mitItems,
  }))

  // ── Loading State ──
  if (loading && workOnHand.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            {t.reports.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t.reports.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t.common.refresh}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="work-on-hand" className="gap-1.5">
            <Users className="h-4 w-4" />
            {t.reports.workOnHand}
          </TabsTrigger>
          <TabsTrigger value="my-work" className="gap-1.5">
            <User className="h-4 w-4" />
            My Work
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5">
            <TrendingUp className="h-4 w-4" />
            {t.reports.performance}
          </TabsTrigger>
          <TabsTrigger value="cto-view" className="gap-1.5">
            <Eye className="h-4 w-4" />
            CTO View
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════
            TAB 1: WORK ON HAND
        ════════════════════════════════════════════════════ */}
        <TabsContent value="work-on-hand" className="mt-4 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              title="Total Active Items"
              value={wohSummary.totalActiveItems}
              subtitle="Across all team members"
              icon={Activity}
              color="text-blue-600"
              bgColor="bg-blue-100 dark:bg-blue-900/30"
            />
            <StatCard
              title="Total Overdue"
              value={wohSummary.totalOverdue}
              subtitle="Items past due date"
              icon={AlertTriangle}
              trend={wohSummary.totalOverdue > 0 ? 'down' : 'neutral'}
              trendLabel={wohSummary.totalOverdue > 0 ? 'Needs attention' : 'On track'}
              color="text-red-600"
              bgColor="bg-red-100 dark:bg-red-900/30"
            />
            <StatCard
              title="High Priority"
              value={wohSummary.totalHighPriority}
              subtitle="Urgent + High priority"
              icon={Zap}
              color="text-amber-600"
              bgColor="bg-amber-100 dark:bg-amber-900/30"
            />
            <StatCard
              title="Team Members"
              value={wohSummary.totalUsers}
              subtitle="Active users"
              icon={Users}
              color="text-green-600"
              bgColor="bg-green-100 dark:bg-green-900/30"
            />
            <StatCard
              title="Total Man-Days"
              value={`${wohSummary.totalSpentManDays}/${wohSummary.totalEstimatedManDays}`}
              subtitle="Spent / Estimated"
              icon={Clock}
              color="text-violet-600"
              bgColor="bg-violet-100 dark:bg-violet-900/30"
            />
          </div>

          {/* Work on Hand by User - Stacked Bar Chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Work on Hand by User
              </CardTitle>
              <CardDescription>Active items per user broken down by role assignment (BA / Dev / QA / MIT)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="ba" name="BA Requests" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={48} />
                    <Bar dataKey="dev" name="Dev Requests" stackId="a" fill="#3b82f6" maxBarSize={48} />
                    <Bar dataKey="qa" name="QA Requests" stackId="a" fill="#ec4899" maxBarSize={48} />
                    <Bar dataKey="mit" name="MIT Items" stackId="a" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Department & Role Charts Row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* By Department */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">By Department</CardTitle>
                <CardDescription>Active items per department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="active" name="Active" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="overdue" name="Overdue" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* By Role */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">By Role</CardTitle>
                <CardDescription>Active items broken down by team role</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={roleChartData} layout="vertical" margin={{ top: 10, right: 10, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={80} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="ba" name="BA" stackId="a" fill="#10b981" maxBarSize={28} />
                      <Bar dataKey="dev" name="Dev" stackId="a" fill="#3b82f6" maxBarSize={28} />
                      <Bar dataKey="qa" name="QA" stackId="a" fill="#ec4899" maxBarSize={28} />
                      <Bar dataKey="mit" name="MIT" stackId="a" fill="#f59e0b" radius={[0, 6, 6, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Work Detail Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                User Work Detail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-center">BA</TableHead>
                      <TableHead className="text-center">Dev</TableHead>
                      <TableHead className="text-center">QA</TableHead>
                      <TableHead className="text-center">MIT</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Overdue</TableHead>
                      <TableHead className="text-center">High Pri</TableHead>
                      <TableHead className="text-center">Est. MD</TableHead>
                      <TableHead className="text-center">Spent MD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWOH.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={u.avatarUrl || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {u.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{u.name}</p>
                              <p className="text-[10px] text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{u.department}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            style={{ borderColor: ROLE_COLORS[u.role], color: ROLE_COLORS[u.role] }}
                          >
                            {ROLE_LABELS[u.role] || u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">{u.baItems}</TableCell>
                        <TableCell className="text-center text-sm">{u.devItems}</TableCell>
                        <TableCell className="text-center text-sm">{u.qaItems}</TableCell>
                        <TableCell className="text-center text-sm">{u.mitItems}</TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-sm">{u.totalActive}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {u.overdue > 0 ? (
                            <Badge variant="destructive" className="text-[10px]">{u.overdue}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {u.highPriority > 0 ? (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200">
                              {u.highPriority}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm">{u.totalEstimatedManDays}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm">{u.totalSpentManDays}</span>
                            {u.totalEstimatedManDays > 0 && (
                              <Progress
                                value={Math.min((u.totalSpentManDays / u.totalEstimatedManDays) * 100, 100)}
                                className={`w-12 h-1.5 ${
                                  (u.totalSpentManDays / u.totalEstimatedManDays) <= 0.6 ? '[&>div]:bg-green-500' :
                                  (u.totalSpentManDays / u.totalEstimatedManDays) <= 0.85 ? '[&>div]:bg-amber-500' :
                                  '[&>div]:bg-red-500'
                                }`}
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Man-Day Bar Chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-violet-500" />
                Man-Days Overview by User
              </CardTitle>
              <CardDescription>Estimated vs Spent man-days per user</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredWOH.map((u) => ({
                    name: u.name.split(' ')[0],
                    estimated: u.totalEstimatedManDays,
                    spent: u.totalSpentManDays,
                  }))} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="estimated" name="Estimated MD" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="spent" name="Spent MD" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════════
            TAB 2: MY WORK
        ════════════════════════════════════════════════════ */}
        <TabsContent value="my-work" className="mt-4 space-y-6">
          {(() => {
            const myData = workOnHand.find(u => u.id === currentUser?.id)
            const myPerf = userPerf.find(u => u.id === currentUser?.id)

            if (!myData && !myPerf) {
              return (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <User className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">No work data found</p>
                    <p className="text-sm text-muted-foreground mt-1">Your work items will appear here once assigned</p>
                  </CardContent>
                </Card>
              )
            }

            const mandayPercent = myData && myData.totalEstimatedManDays > 0
              ? Math.round((myData.totalSpentManDays / myData.totalEstimatedManDays) * 100)
              : 0
            const mandayColor = mandayPercent <= 60 ? 'green' : mandayPercent <= 85 ? 'amber' : 'red'

            return (
              <>
                {/* Personal Summary Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    title="My Active Items"
                    value={myData?.totalActive ?? 0}
                    subtitle="Currently assigned to me"
                    icon={Activity}
                    color="text-blue-600"
                    bgColor="bg-blue-100 dark:bg-blue-900/30"
                  />
                  <StatCard
                    title="My Overdue"
                    value={myData?.overdue ?? 0}
                    subtitle="Items past due date"
                    icon={AlertTriangle}
                    trend={(myData?.overdue ?? 0) > 0 ? 'down' : 'neutral'}
                    trendLabel={(myData?.overdue ?? 0) > 0 ? 'Needs attention' : 'On track'}
                    color="text-red-600"
                    bgColor="bg-red-100 dark:bg-red-900/30"
                  />
                  <StatCard
                    title="My Estimated Man-Days"
                    value={myData?.totalEstimatedManDays ?? 0}
                    subtitle="Total estimated effort"
                    icon={Clock}
                    color="text-violet-600"
                    bgColor="bg-violet-100 dark:bg-violet-900/30"
                  />
                  <StatCard
                    title="My Spent Man-Days"
                    value={myData?.totalSpentManDays ?? 0}
                    subtitle="Total effort consumed"
                    icon={Zap}
                    color="text-amber-600"
                    bgColor="bg-amber-100 dark:bg-amber-900/30"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* My Performance Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        My Performance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {myPerf ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Performance Score</span>
                            <div className="flex items-center gap-2">
                              <PerformanceBadge score={myPerf.performanceScore} />
                              <span className="text-sm font-bold">{myPerf.performanceScore}%</span>
                            </div>
                          </div>
                          <Progress
                            value={myPerf.performanceScore}
                            className={`h-3 ${
                              myPerf.performanceScore >= 80 ? '[&>div]:bg-green-500' :
                              myPerf.performanceScore >= 60 ? '[&>div]:bg-blue-500' :
                              myPerf.performanceScore >= 40 ? '[&>div]:bg-amber-500' :
                              '[&>div]:bg-red-500'
                            }`}
                          />
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <div>
                                <p className="text-xs text-muted-foreground">On-time Rate</p>
                                <p className="font-semibold">{myPerf.onTimeRate}%</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Activity className="h-4 w-4 text-blue-500" />
                              <div>
                                <p className="text-xs text-muted-foreground">Throughput</p>
                                <p className="font-semibold">{myPerf.throughput}/wk</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-violet-500" />
                              <div>
                                <p className="text-xs text-muted-foreground">Completed</p>
                                <p className="font-semibold">{myPerf.totalCompleted}</p>
                              </div>
                            </div>
                            {myPerf.overdueActive > 0 && (
                              <div className="flex items-center gap-2 text-sm">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Overdue</p>
                                  <p className="font-semibold text-red-600">{myPerf.overdueActive}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                          No performance data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Man-Day Progress Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4 text-violet-500" />
                        Man-Day Progress
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {myData && myData.totalEstimatedManDays > 0 ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Effort Consumed</span>
                            <span className={`text-sm font-bold ${
                              mandayColor === 'green' ? 'text-green-600' :
                              mandayColor === 'amber' ? 'text-amber-600' :
                              'text-red-600'
                            }`}>
                              {myData.totalSpentManDays} / {myData.totalEstimatedManDays} man-days ({mandayPercent}%)
                            </span>
                          </div>
                          <Progress
                            value={Math.min(mandayPercent, 100)}
                            className={`h-4 ${
                              mandayColor === 'green' ? '[&>div]:bg-green-500' :
                              mandayColor === 'amber' ? '[&>div]:bg-amber-500' :
                              '[&>div]:bg-red-500'
                            }`}
                          />
                          <div className="grid grid-cols-3 gap-2 pt-2">
                            <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                              <p className="text-xs text-muted-foreground">≤60%</p>
                              <p className="text-xs font-medium text-green-600">On Track</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                              <p className="text-xs text-muted-foreground">61-85%</p>
                              <p className="text-xs font-medium text-amber-600">Caution</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                              <p className="text-xs text-muted-foreground">&gt;85%</p>
                              <p className="text-xs font-medium text-red-600">Over Budget</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                          No man-day data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* My Work Items Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      My Work Items
                    </CardTitle>
                    <CardDescription>
                      {myData?.detailItems?.length ?? 0} items assigned to you
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[500px] overflow-y-auto scrollbar-thin space-y-3 pr-1">
                      {myData?.detailItems && myData.detailItems.length > 0 ? (
                        myData.detailItems.map((item) => {
                          const typeColor: Record<string, string> = {
                            BA: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                            DEV: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                            QA: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
                            MIT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                          }
                          const isOverdue = item.dueDate && new Date(item.dueDate) < new Date()
                          const itemMandayPercent = item.estimatedManDays && item.estimatedManDays > 0
                            ? Math.round(((item.spentManDays ?? 0) / item.estimatedManDays) * 100)
                            : 0

                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className={`text-[10px] ${typeColor[item.type] || ''}`}>
                                      {item.type}
                                    </Badge>
                                    <span className="text-sm font-medium truncate">{item.title}</span>
                                    {(item.priority === 'HIGH' || item.priority === 'URGENT') && (
                                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200">
                                        {item.priority}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <Badge variant="outline" className="text-[10px]">{item.status}</Badge>
                                    {item.projectName && (
                                      <span className="truncate">{item.projectName}</span>
                                    )}
                                    {item.aitNo && (
                                      <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{item.aitNo}</code>
                                    )}
                                    {item.dueDate && (
                                      <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                        Due: {new Date(item.dueDate).toLocaleDateString()}
                                        {isOverdue && ' (Overdue)'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* MIT-specific manday info */}
                              {item.type === 'MIT' && item.estimatedManDays !== undefined && item.estimatedManDays > 0 && (
                                <div className="mt-2 pt-2 border-t space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                      Man-days: {item.spentManDays ?? 0} / {item.estimatedManDays}
                                    </span>
                                    <span className={`font-medium ${
                                      itemMandayPercent <= 60 ? 'text-green-600' :
                                      itemMandayPercent <= 85 ? 'text-amber-600' :
                                      'text-red-600'
                                    }`}>
                                      {itemMandayPercent}%
                                    </span>
                                  </div>
                                  <Progress
                                    value={Math.min(itemMandayPercent, 100)}
                                    className={`h-1.5 ${
                                      itemMandayPercent <= 60 ? '[&>div]:bg-green-500' :
                                      itemMandayPercent <= 85 ? '[&>div]:bg-amber-500' :
                                      '[&>div]:bg-red-500'
                                    }`}
                                  />
                                  {/* MIT Step Progress */}
                                  {item.steps && item.steps.length > 0 && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                      {item.steps.map((step, stepIdx) => {
                                        const stepColor =
                                          step.status === 'DONE' ? 'bg-green-500' :
                                          step.status === 'IN_PROGRESS' ? 'bg-amber-500' :
                                          'bg-muted-foreground/30'
                                        return (
                                          <div
                                            key={stepIdx}
                                            className={`h-2 w-2 rounded-full ${stepColor}`}
                                            title={`${step.step}: ${step.status}`}
                                          />
                                        )
                                      })}
                                      <span className="text-[10px] text-muted-foreground ml-1">
                                        {item.steps.filter(s => s.status === 'DONE').length}/{item.steps.length} steps
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </motion.div>
                          )
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <CheckCircle className="h-8 w-8 mb-2 text-green-500" />
                          <p className="text-sm font-medium">No work items</p>
                          <p className="text-xs">You have no assigned work items</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )
          })()}
        </TabsContent>

        {/* ════════════════════════════════════════════════════
            TAB 3: PERFORMANCE
        ════════════════════════════════════════════════════ */}
        <TabsContent value="performance" className="mt-4 space-y-6">
          {/* Performance by User - Progress Bars */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Team Performance Score
              </CardTitle>
              <CardDescription>
                Composite score based on on-time delivery (40%), throughput (30%), and low overdue ratio (30%)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[500px] overflow-y-auto scrollbar-thin pr-2">
                {filteredPerf
                  .sort((a, b) => b.performanceScore - a.performanceScore)
                  .map((u, idx) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-5 text-right">{idx + 1}</span>
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={u.avatarUrl || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {u.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="text-sm font-medium">{u.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {ROLE_LABELS[u.role] || u.role} · {u.department}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <PerformanceBadge score={u.performanceScore} />
                        <span className="text-sm font-bold min-w-[3ch] text-right">{u.performanceScore}%</span>
                      </div>
                    </div>
                    <Progress
                      value={u.performanceScore}
                      className={`h-2.5 ${
                        u.performanceScore >= 80 ? '[&>div]:bg-green-500' :
                        u.performanceScore >= 60 ? '[&>div]:bg-blue-500' :
                        u.performanceScore >= 40 ? '[&>div]:bg-amber-500' :
                        '[&>div]:bg-red-500'
                      }`}
                    />
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground pl-7">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        On-time: <strong>{u.onTimeRate}%</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        Throughput: <strong>{u.throughput}/wk</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Completed: <strong>{u.totalCompleted}</strong>
                      </span>
                      {u.overdueActive > 0 && (
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          Overdue: <strong>{u.overdueActive}</strong>
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* On-Time Rate + Throughput Grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-500" />
                  On-Time Delivery Rate
                </CardTitle>
                <CardDescription>Percentage of items completed within expected timeframe</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-thin">
                  {filteredPerf
                    .sort((a, b) => b.onTimeRate - a.onTimeRate)
                    .map((u) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[9px]">{u.name.split(' ')[0][0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium min-w-[100px] truncate">{u.name}</span>
                      <div className="flex-1">
                        <Progress
                          value={u.onTimeRate}
                          className={`h-2 ${
                            u.onTimeRate >= 80 ? '[&>div]:bg-green-500' :
                            u.onTimeRate >= 60 ? '[&>div]:bg-blue-500' :
                            u.onTimeRate >= 40 ? '[&>div]:bg-amber-500' :
                            '[&>div]:bg-red-500'
                          }`}
                        />
                      </div>
                      <span className="text-xs font-semibold min-w-[40px] text-right">{u.onTimeRate}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  Weekly Throughput
                </CardTitle>
                <CardDescription>Average items completed per week (last 30 days)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredPerf.sort((a, b) => b.throughput - a.throughput).map((u) => ({
                      name: u.name.split(' ')[0],
                      throughput: u.throughput,
                    }))} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="throughput" name="Items/Week" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════════════
            TAB 3: CTO EXECUTIVE VIEW
        ════════════════════════════════════════════════════ */}
        <TabsContent value="cto-view" className="mt-4 space-y-6">
          {execSummary && (
            <>
              {/* Executive KPI Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard
                  title="Active Projects"
                  value={execSummary.activeProjects}
                  icon={FolderKanban}
                  color="text-blue-600"
                  bgColor="bg-blue-100 dark:bg-blue-900/30"
                />
                <StatCard
                  title="Completion Rate"
                  value={`${execSummary.completionRate}%`}
                  subtitle={`${execSummary.completedRequests}/${execSummary.totalRequests} requests`}
                  icon={Target}
                  trend={execSummary.completionRate >= 70 ? 'up' : 'down'}
                  trendLabel={execSummary.completionRate >= 70 ? 'On track' : 'Behind'}
                  color="text-green-600"
                  bgColor="bg-green-100 dark:bg-green-900/30"
                />
                <StatCard
                  title="Overdue"
                  value={execSummary.overdueRequests}
                  subtitle="Past due date"
                  icon={AlertTriangle}
                  trend={execSummary.overdueRequests > 5 ? 'down' : 'neutral'}
                  trendLabel={execSummary.overdueRequests > 5 ? 'Critical' : 'Manageable'}
                  color="text-red-600"
                  bgColor="bg-red-100 dark:bg-red-900/30"
                />
                <StatCard
                  title="Open Bugs"
                  value={execSummary.openBugs}
                  subtitle={`${execSummary.criticalBugs} critical`}
                  icon={Bug}
                  trend={execSummary.criticalBugs > 0 ? 'down' : 'neutral'}
                  trendLabel={execSummary.criticalBugs > 0 ? 'Has critical' : 'No critical'}
                  color="text-amber-600"
                  bgColor="bg-amber-100 dark:bg-amber-900/30"
                />
                <StatCard
                  title="Upcoming Meetings"
                  value={execSummary.upcomingMeetings}
                  icon={Calendar}
                  color="text-purple-600"
                  bgColor="bg-purple-100 dark:bg-purple-900/30"
                />
                <StatCard
                  title="Team Performance"
                  value={`${execSummary.avgTeamPerformance}%`}
                  subtitle="Avg score"
                  icon={Shield}
                  trend={execSummary.avgTeamPerformance >= 70 ? 'up' : 'down'}
                  trendLabel={execSummary.avgTeamPerformance >= 70 ? 'Healthy' : 'Needs attention'}
                  color="text-emerald-600"
                  bgColor="bg-emerald-100 dark:bg-emerald-900/30"
                />
              </div>

              {/* Request Trend + Bug Severity */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* 7-Day Request Trend */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      7-Day Request Trend
                    </CardTitle>
                    <CardDescription>Daily created vs completed requests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyRequests} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Area type="monotone" dataKey="created" name="Created" stroke="#3b82f6" fill="url(#colorCreated)" strokeWidth={2} />
                          <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" fill="url(#colorCompleted)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Bug Severity */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Bug className="h-4 w-4 text-red-500" />
                      Bug Severity
                    </CardTitle>
                    <CardDescription>Open bugs by severity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={bugSeverities.map((b) => ({
                              name: b.severity,
                              value: b.count,
                            }))}
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {bugSeverities.map((_, index) => (
                              <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {bugSeverities.length === 0 && (
                      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 mr-1.5 text-green-500" />
                        No open bugs!
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Project Health Board */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Project Health Board
                  </CardTitle>
                  <CardDescription>Active projects ranked by health score</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-80 overflow-y-auto scrollbar-thin">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead className="text-center">Health</TableHead>
                          <TableHead className="text-center">Requests</TableHead>
                          <TableHead className="text-center">Members</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectHealth.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium text-sm">{p.name}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.code}</code>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Progress
                                  value={p.healthScore || 0}
                                  className={`w-16 h-2 ${
                                    (p.healthScore || 0) >= 80 ? '[&>div]:bg-green-500' :
                                    (p.healthScore || 0) >= 60 ? '[&>div]:bg-blue-500' :
                                    (p.healthScore || 0) >= 40 ? '[&>div]:bg-amber-500' :
                                    '[&>div]:bg-red-500'
                                  }`}
                                />
                                <span className="text-xs font-semibold">{p.healthScore || 0}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm">{p._count.requests}</TableCell>
                            <TableCell className="text-center text-sm">{p._count.members}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  (p.healthScore || 0) >= 80
                                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                    : (p.healthScore || 0) >= 60
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                    : (p.healthScore || 0) >= 40
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                }`}
                              >
                                {(p.healthScore || 0) >= 80 ? 'Healthy' :
                                 (p.healthScore || 0) >= 60 ? 'Fair' :
                                 (p.healthScore || 0) >= 40 ? 'At Risk' : 'Critical'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {projectHealth.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                              No active projects
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Team Performance Leaderboard */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Team Performance Leaderboard
                  </CardTitle>
                  <CardDescription>Top performers ranked by composite performance score</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {userPerf
                      .sort((a, b) => b.performanceScore - a.performanceScore)
                      .slice(0, 9)
                      .map((u, idx) => (
                      <motion.div
                        key={u.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                          idx === 0 ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10' :
                          idx === 1 ? 'border-gray-300 bg-gray-50/50 dark:bg-gray-900/10' :
                          idx === 2 ? 'border-orange-300 bg-orange-50/50 dark:bg-orange-900/10' :
                          'border-border'
                        }`}>
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                            idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                            idx === 1 ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' :
                            idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {idx + 1}
                          </div>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.avatarUrl || undefined} />
                            <AvatarFallback className="text-[10px]">{u.name.split(' ')[0][0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{u.name}</p>
                            <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[u.role]} · {u.department}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{u.performanceScore}%</p>
                            <PerformanceBadge score={u.performanceScore} />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
