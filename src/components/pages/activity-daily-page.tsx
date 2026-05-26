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
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  Activity,
  GitCommit,
  Clock,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Calendar,
  Send,
  Eye,
  Sparkles,
  TrendingUp,
  Users,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  FileText,
  AlertTriangle,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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

const KPI_TARGET_DEFAULT = 25 // 25% = 2hr AI out of 8hr day

// ============================================================
// Types
// ============================================================
interface ProjectEntry {
  projectId: string
  projectName: string
  hours: number
  aiHours: number
  tasks: string
  commitCount: number
  commitMessages: string[]
}

interface ActivityDailyRecord {
  id: string
  userId: string
  date: string
  totalWorkHours: number
  aiUsageHours: number
  aiUsagePercentage: number
  kpiTargetPercentage: number
  kpiMet: boolean
  summary: string | null
  commitSummary: string | null
  commitCount: number
  projectEntries: ProjectEntry[]
  status: string
  approvedById: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
    department: { id: string; name: string } | null
  }
  approvedBy: { id: string; name: string; email: string } | null
}

interface ActivityListSummary {
  totalReports: number
  totalWorkHours: number
  totalAiHours: number
  avgAiUsagePercentage: number
  kpiMetCount: number
  totalCommits: number
}

interface CtoReportData {
  summary: {
    totalReports: number
    totalWorkHours: number
    totalAiHours: number
    avgAiUsagePercentage: number
    kpiMetCount: number
    kpiMetRate: number
    totalCommits: number
  }
  byUser: {
    userId: string
    userName: string
    userEmail: string
    avatarUrl: string | null
    department: string
    role: string
    totalWorkHours: number
    totalAiHours: number
    kpiMetCount: number
    kpiNotMetCount: number
    totalCommits: number
    avgAiUsagePercentage: number
    dailyEntries: {
      date: string
      totalWorkHours: number
      aiUsageHours: number
      aiUsagePercentage: number
      kpiMet: boolean
      commitCount: number
      summary: string | null
    }[]
  }[]
  byDepartment: {
    department: string
    userCount: number
    totalWorkHours: number
    totalAiHours: number
    avgAiUsagePercentage: number
    kpiMetRate: number
  }[]
  dailyTrend: {
    date: string
    totalWorkHours: number
    totalAiHours: number
    avgAiUsagePercentage: number
    kpiMetRate: number
    commitCount: number
  }[]
  aiUsageDistribution: {
    range: string
    count: number
  }[]
}

// ============================================================
// Stat Card
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
// KPI Gauge Component
// ============================================================
function KpiGauge({ percentage, target, kpiMet }: { percentage: number; target: number; kpiMet: boolean }) {
  const color = kpiMet ? 'text-green-500' : percentage >= target * 0.7 ? 'text-amber-500' : 'text-red-500'
  const progressColor = kpiMet ? '[&>div]:bg-green-500' : percentage >= target * 0.7 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">AI Usage KPI</span>
        <div className="flex items-center gap-2">
          {kpiMet ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0 text-xs">
              <CheckCircle className="h-3 w-3 mr-1" /> Met
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-0 text-xs">
              <XCircle className="h-3 w-3 mr-1" /> Not Met
            </Badge>
          )}
          <span className={`text-lg font-bold ${color}`}>{percentage.toFixed(1)}%</span>
        </div>
      </div>
      <Progress value={Math.min(percentage, 100)} className={`h-3 ${progressColor}`} />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Target: {target}% (min {((target / 100) * 8).toFixed(1)}h AI / 8h day)</span>
        <span>{percentage >= 100 ? 'Exceeded!' : `${(100 - percentage).toFixed(1)}% to 100%`}</span>
      </div>
    </div>
  )
}

// ============================================================
// Main Page Component
// ============================================================
export default function ActivityDailyPage() {
  const { user: currentUser } = useAppStore()
  const { t } = useI18n()

  // My Activity tab state
  const [records, setRecords] = useState<ActivityDailyRecord[]>([])
  const [listSummary, setListSummary] = useState<ActivityListSummary | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  // Create/Edit form state
  const [showForm, setShowForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ActivityDailyRecord | null>(null)
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0])
  const [formWorkHours, setFormWorkHours] = useState(8)
  const [formAiHours, setFormAiHours] = useState(0)
  const [formKpiTarget, setFormKpiTarget] = useState(KPI_TARGET_DEFAULT)
  const [formSummary, setFormSummary] = useState('')
  const [formProjectEntries, setFormProjectEntries] = useState<ProjectEntry[]>([])
  const [formSaving, setFormSaving] = useState(false)
  const [gitLoading, setGitLoading] = useState(false)

  // CTO Report tab state
  const [ctoData, setCtoData] = useState<CtoReportData | null>(null)
  const [ctoLoading, setCtoLoading] = useState(false)
  const [ctoDateFrom, setCtoDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return d.toISOString().split('T')[0]
  })
  const [ctoDateTo, setCtoDateTo] = useState(() => new Date().toISOString().split('T')[0])

  // Active tab
  const [activeTab, setActiveTab] = useState('my-activity')

  // Detail dialog
  const [detailRecord, setDetailRecord] = useState<ActivityDailyRecord | null>(null)

  // ── Fetch activity list ──
  const fetchRecords = useCallback(async () => {
    try {
      const data = await api.get<{
        records: ActivityDailyRecord[]
        pagination: typeof pagination
        summary: ActivityListSummary
      }>(`/api/activity-daily?userId=${currentUser?.id}&limit=30`)
      setRecords(data.records)
      setPagination(data.pagination)
      setListSummary(data.summary)
    } catch {
      toast.error('Error', 'Failed to load activity daily records')
    }
  }, [currentUser?.id])

  // ── Fetch CTO report ──
  const fetchCtoReport = useCallback(async () => {
    setCtoLoading(true)
    try {
      const data = await api.get<CtoReportData>(
        `/api/activity-daily/cto-report?dateFrom=${ctoDateFrom}&dateTo=${ctoDateTo}`
      )
      setCtoData(data)
    } catch {
      toast.error('Error', 'Failed to load CTO report')
    } finally {
      setCtoLoading(false)
    }
  }, [ctoDateFrom, ctoDateTo])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchRecords()
      setLoading(false)
    }
    load()
  }, [fetchRecords])

  useEffect(() => {
    if (activeTab === 'cto-report' && !ctoData) {
      fetchCtoReport()
    }
  }, [activeTab, ctoData, fetchCtoReport])

  // ── Git summary fetch ──
  const fetchGitSummary = async () => {
    if (!currentUser?.id || !formDate) return
    setGitLoading(true)
    try {
      const data = await api.get<{
        commitCount: number
        commitSummary: string
        projectEntries: ProjectEntry[]
      }>(`/api/activity-daily/git-summary?userId=${currentUser.id}&date=${formDate}`)

      if (data.projectEntries.length > 0) {
        setFormProjectEntries(data.projectEntries)
        toast.info('Git Commits Loaded', `Found ${data.commitCount} commit(s) across ${data.projectEntries.length} project(s)`)
      } else {
        toast.warning('No Commits Found', 'No git commits found for this date')
      }
    } catch {
      toast.error('Error', 'Failed to fetch git summary')
    } finally {
      setGitLoading(false)
    }
  }

  // ── Open create form ──
  const openCreateForm = () => {
    setEditingRecord(null)
    setFormDate(new Date().toISOString().split('T')[0])
    setFormWorkHours(8)
    setFormAiHours(0)
    setFormKpiTarget(KPI_TARGET_DEFAULT)
    setFormSummary('')
    setFormProjectEntries([])
    setShowForm(true)
  }

  // ── Open edit form ──
  const openEditForm = (record: ActivityDailyRecord) => {
    setEditingRecord(record)
    setFormDate(record.date.split('T')[0])
    setFormWorkHours(record.totalWorkHours)
    setFormAiHours(record.aiUsageHours)
    setFormKpiTarget(record.kpiTargetPercentage)
    setFormSummary(record.summary || '')
    setFormProjectEntries(record.projectEntries || [])
    setShowForm(true)
  }

  // ── Save activity daily ──
  const handleSave = async (status: string = 'DRAFT') => {
    if (!currentUser?.id || !formDate) return
    setFormSaving(true)
    try {
      const body: Record<string, unknown> = {
        userId: currentUser.id,
        date: formDate,
        totalWorkHours: formWorkHours,
        aiUsageHours: formAiHours,
        kpiTargetPercentage: formKpiTarget,
        summary: formSummary,
        projectEntries: formProjectEntries,
        status,
      }

      if (editingRecord) {
        await api.patch(`/api/activity-daily/${editingRecord.id}`, body)
      } else {
        await api.post('/api/activity-daily', body)
      }

      toast.success(status === 'DRAFT' ? 'Draft Saved' : 'Submitted', status === 'DRAFT' ? 'Activity daily saved as draft' : 'Activity daily submitted for review')
      setShowForm(false)
      fetchRecords()
    } catch {
      toast.error('Error', 'Failed to save activity daily')
    } finally {
      setFormSaving(false)
    }
  }

  // ── Delete record ──
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/activity-daily/${id}`)
      toast.success('Deleted', 'Activity daily record deleted')
      fetchRecords()
    } catch {
      toast.error('Error', 'Failed to delete record')
    }
  }

  // ── Approve record ──
  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/api/activity-daily/${id}`, { status: 'APPROVED' })
      toast.success('Approved', 'Activity daily record approved')
      fetchRecords()
      if (activeTab === 'cto-report') fetchCtoReport()
    } catch {
      toast.error('Error', 'Failed to approve record')
    }
  }

  // ── Calculate form KPI ──
  const formAiPercentage = formWorkHours > 0 ? (formAiHours / formWorkHours) * 100 : 0
  const formKpiMet = formAiPercentage >= formKpiTarget

  // ── Update project entry ──
  const updateProjectEntry = (index: number, field: string, value: string | number) => {
    const updated = [...formProjectEntries]
    updated[index] = { ...updated[index], [field]: value }
    setFormProjectEntries(updated)
  }

  const addProjectEntry = () => {
    setFormProjectEntries([
      ...formProjectEntries,
      { projectId: '', projectName: '', hours: 0, aiHours: 0, tasks: '', commitCount: 0, commitMessages: [] },
    ])
  }

  const removeProjectEntry = (index: number) => {
    setFormProjectEntries(formProjectEntries.filter((_, i) => i !== index))
  }

  // ── Status badge ──
  const statusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-0' },
      SUBMITTED: { label: 'Submitted', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-0' },
      APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0' },
    }
    const c = config[status] || config.DRAFT
    return <Badge className={`text-xs ${c.className}`}>{c.label}</Badge>
  }

  // ── Loading State ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
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
            <Activity className="h-6 w-6 text-primary" />
            Activity Daily
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t.activityDaily.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreateForm} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Log Activity
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="my-activity" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            My Activity
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="cto-report" className="gap-1.5">
            <Eye className="h-4 w-4" />
            {t.activityDaily.ctoReport}
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════
            TAB 1: MY ACTIVITY
        ════════════════════════════════════════════════════ */}
        <TabsContent value="my-activity" className="mt-4 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              title="Total Reports"
              value={listSummary?.totalReports ?? 0}
              subtitle="Activity daily records"
              icon={FileText}
              color="text-blue-600"
              bgColor="bg-blue-100 dark:bg-blue-900/30"
            />
            <StatCard
              title="Total Work Hours"
              value={listSummary?.totalWorkHours ?? 0}
              subtitle="Hours logged"
              icon={Clock}
              color="text-violet-600"
              bgColor="bg-violet-100 dark:bg-violet-900/30"
            />
            <StatCard
              title="AI Usage Hours"
              value={listSummary?.totalAiHours ?? 0}
              subtitle="Hours using AI tools"
              icon={Sparkles}
              color="text-emerald-600"
              bgColor="bg-emerald-100 dark:bg-emerald-900/30"
            />
            <StatCard
              title="Avg AI Usage"
              value={`${(listSummary?.avgAiUsagePercentage ?? 0).toFixed(1)}%`}
              subtitle={`Target: ${KPI_TARGET_DEFAULT}%`}
              icon={Target}
              trend={(listSummary?.avgAiUsagePercentage ?? 0) >= KPI_TARGET_DEFAULT ? 'up' : 'down'}
              trendLabel={(listSummary?.avgAiUsagePercentage ?? 0) >= KPI_TARGET_DEFAULT ? 'KPI Met' : 'Below Target'}
              color="text-amber-600"
              bgColor="bg-amber-100 dark:bg-amber-900/30"
            />
            <StatCard
              title="Total Commits"
              value={listSummary?.totalCommits ?? 0}
              subtitle="From git integration"
              icon={GitCommit}
              color="text-pink-600"
              bgColor="bg-pink-100 dark:bg-pink-900/30"
            />
          </div>

          {/* Activity Records Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  My Activity Daily Records
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => fetchRecords()} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t.common.refresh}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {records.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">{t.activityDaily.noActivities}</p>
                  <p className="text-sm text-muted-foreground mt-1">Click &quot;Log Activity&quot; to record your daily work</p>
                  <Button onClick={openCreateForm} className="mt-4 gap-1.5">
                    <Plus className="h-4 w-4" />
                    Log First Activity
                  </Button>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Work Hrs</TableHead>
                        <TableHead>AI Hrs</TableHead>
                        <TableHead>AI %</TableHead>
                        <TableHead>KPI</TableHead>
                        <TableHead>Commits</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record) => {
                        const dateStr = record.date
                          ? new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                          : 'N/A'
                        return (
                          <TableRow key={record.id}>
                            <TableCell className="text-sm font-medium whitespace-nowrap">{dateStr}</TableCell>
                            <TableCell className="text-sm">{record.totalWorkHours}h</TableCell>
                            <TableCell className="text-sm">{record.aiUsageHours}h</TableCell>
                            <TableCell>
                              <span className={`text-sm font-semibold ${record.kpiMet ? 'text-green-600' : 'text-red-600'}`}>
                                {record.aiUsagePercentage.toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell>
                              {record.kpiMet ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {record.commitCount > 0 ? (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <GitCommit className="h-3 w-3" />
                                  {record.commitCount}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell>{statusBadge(record.status)}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                              {record.summary || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setDetailRecord(record)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {record.status === 'DRAFT' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => openEditForm(record)}
                                    >
                                      <FileText className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleDelete(record.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </>
                                )}
                                {record.status === 'DRAFT' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1 text-blue-600"
                                    onClick={() => handleSave.call(null, 'SUBMITTED')}
                                  >
                                    <Send className="h-3 w-3" />
                                    Submit
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════════
            TAB 2: TEAM
        ════════════════════════════════════════════════════ */}
        <TabsContent value="team" className="mt-4 space-y-6">
          <TeamActivityTab onApprove={handleApprove} />
        </TabsContent>

        {/* ════════════════════════════════════════════════════
            TAB 3: CTO REPORT
        ════════════════════════════════════════════════════ */}
        <TabsContent value="cto-report" className="mt-4 space-y-6">
          {/* Date range controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={ctoDateFrom}
                onChange={(e) => { setCtoDateFrom(e.target.value); setCtoData(null) }}
                className="h-8 w-40 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={ctoDateTo}
                onChange={(e) => { setCtoDateTo(e.target.value); setCtoData(null) }}
                className="h-8 w-40 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCtoReport}
              disabled={ctoLoading}
              className="gap-1.5 h-8"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${ctoLoading ? 'animate-spin' : ''}`} />
              Generate Report
            </Button>
          </div>

          {ctoLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-28" />
                ))}
              </div>
              <Skeleton className="h-64" />
            </div>
          ) : ctoData ? (
            <>
              {/* CTO Summary Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Total Reports"
                  value={ctoData.summary.totalReports}
                  subtitle="Daily activity records"
                  icon={FileText}
                  color="text-blue-600"
                  bgColor="bg-blue-100 dark:bg-blue-900/30"
                />
                <StatCard
                  title="Total Work Hours"
                  value={ctoData.summary.totalWorkHours.toFixed(1)}
                  subtitle="Across all team members"
                  icon={Clock}
                  color="text-violet-600"
                  bgColor="bg-violet-100 dark:bg-violet-900/30"
                />
                <StatCard
                  title="Total AI Hours"
                  value={ctoData.summary.totalAiHours.toFixed(1)}
                  subtitle="AI tool usage"
                  icon={Sparkles}
                  color="text-emerald-600"
                  bgColor="bg-emerald-100 dark:bg-emerald-900/30"
                />
                <StatCard
                  title="KPI Met Rate"
                  value={`${ctoData.summary.kpiMetRate.toFixed(1)}%`}
                  subtitle={`${ctoData.summary.kpiMetCount}/${ctoData.summary.totalReports} reports met KPI`}
                  icon={Target}
                  trend={ctoData.summary.kpiMetRate >= 70 ? 'up' : ctoData.summary.kpiMetRate >= 40 ? 'neutral' : 'down'}
                  trendLabel={ctoData.summary.kpiMetRate >= 70 ? 'Good' : ctoData.summary.kpiMetRate >= 40 ? 'Fair' : 'Needs Attention'}
                  color="text-amber-600"
                  bgColor="bg-amber-100 dark:bg-amber-900/30"
                />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Daily Trend Chart */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      AI Usage Trend
                    </CardTitle>
                    <CardDescription>Daily AI usage percentage & KPI met rate</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={ctoData.dailyTrend} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Area type="monotone" dataKey="avgAiUsagePercentage" name="AI Usage %" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                          <Area type="monotone" dataKey="kpiMetRate" name="KPI Met Rate %" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Usage Distribution Pie */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      AI Usage Distribution
                    </CardTitle>
                    <CardDescription>How team members distribute across AI usage ranges</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={ctoData.aiUsageDistribution.filter((d) => d.count > 0)}
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            dataKey="count"
                            nameKey="range"
                            label={({ range, count }) => `${range}: ${count}`}
                          >
                            {ctoData.aiUsageDistribution.filter((d) => d.count > 0).map((_, idx) => (
                              <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* By Department Chart */}
              {ctoData.byDepartment.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      AI Usage by Department
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ctoData.byDepartment} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                          <XAxis dataKey="department" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="totalWorkHours" name="Work Hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={48} />
                          <Bar dataKey="totalAiHours" name="AI Hours" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={48} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* By User Table */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Team Member Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto scrollbar-thin">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Work Hrs</TableHead>
                          <TableHead>AI Hrs</TableHead>
                          <TableHead>AI %</TableHead>
                          <TableHead>KPI Met</TableHead>
                          <TableHead>Not Met</TableHead>
                          <TableHead>Commits</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ctoData.byUser.map((u) => (
                          <TableRow key={u.userId}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={u.avatarUrl || undefined} />
                                  <AvatarFallback className="text-[10px]">
                                    {u.userName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{u.userName}</p>
                                  <p className="text-[10px] text-muted-foreground">{u.userEmail}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{u.department}</TableCell>
                            <TableCell className="text-sm">{u.totalWorkHours.toFixed(1)}h</TableCell>
                            <TableCell className="text-sm">{u.totalAiHours.toFixed(1)}h</TableCell>
                            <TableCell>
                              <span className={`text-sm font-semibold ${u.avgAiUsagePercentage >= KPI_TARGET_DEFAULT ? 'text-green-600' : 'text-red-600'}`}>
                                {u.avgAiUsagePercentage.toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0 text-xs">
                                {u.kpiMetCount}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {u.kpiNotMetCount > 0 ? (
                                <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-0 text-xs">
                                  {u.kpiNotMetCount}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{u.totalCommits}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Eye className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Click &quot;Generate Report&quot; to view CTO report</p>
                <p className="text-sm text-muted-foreground mt-1">Select a date range and generate the report</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ════════════════════════════════════════════════════
          CREATE/EDIT FORM DIALOG
      ════════════════════════════════════════════════════ */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {editingRecord ? 'Edit Activity Daily' : 'Log Activity Daily'}
            </DialogTitle>
            <DialogDescription>
              Record your daily work activity. AI usage KPI target: {formKpiTarget}% ({((formKpiTarget / 100) * formWorkHours).toFixed(1)}h AI minimum per {formWorkHours}h day)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Date & Hours Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Date</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Work Hours</Label>
                <Input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={formWorkHours}
                  onChange={(e) => setFormWorkHours(parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">AI Usage Hours</Label>
                <Input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={formAiHours}
                  onChange={(e) => setFormAiHours(parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">KPI Target %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={formKpiTarget}
                  onChange={(e) => setFormKpiTarget(parseFloat(e.target.value) || 25)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* KPI Gauge */}
            <Card className="p-4">
              <KpiGauge percentage={formAiPercentage} target={formKpiTarget} kpiMet={formKpiMet} />
            </Card>

            {/* Git Commits Button */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchGitSummary}
                disabled={gitLoading || !formDate}
                className="gap-1.5"
              >
                {gitLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <GitCommit className="h-3.5 w-3.5" />
                )}
                Pull Git Commits
              </Button>
              <span className="text-xs text-muted-foreground">
                Auto-fill project entries from your git commits for this date
              </span>
            </div>

            {/* Project Entries */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Project Entries</Label>
                <Button variant="ghost" size="sm" onClick={addProjectEntry} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Add Project
                </Button>
              </div>

              {formProjectEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <GitCommit className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No project entries yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Pull git commits or manually add projects</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
                  {formProjectEntries.map((entry, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FolderIcon className="h-4 w-4 text-primary" />
                            <Input
                              value={entry.projectName}
                              onChange={(e) => updateProjectEntry(idx, 'projectName', e.target.value)}
                              placeholder="Project name"
                              className="h-7 text-sm w-48"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeProjectEntry(idx)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Hours</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={entry.hours}
                              onChange={(e) => updateProjectEntry(idx, 'hours', parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">AI Hours</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={entry.aiHours}
                              onChange={(e) => updateProjectEntry(idx, 'aiHours', parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="space-y-1 col-span-2">
                            <Label className="text-[10px] text-muted-foreground">Tasks / Description</Label>
                            <Input
                              value={entry.tasks}
                              onChange={(e) => updateProjectEntry(idx, 'tasks', e.target.value)}
                              placeholder="What you worked on"
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>

                        {entry.commitMessages.length > 0 && (
                          <div className="rounded-md bg-muted/50 p-2">
                            <p className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <GitCommit className="h-3 w-3" /> {entry.commitCount} commit(s)
                            </p>
                            <div className="space-y-0.5">
                              {entry.commitMessages.map((msg, mi) => (
                                <p key={mi} className="text-[10px] text-muted-foreground font-mono truncate">
                                  {msg}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Daily Summary</Label>
              <Textarea
                value={formSummary}
                onChange={(e) => setFormSummary(e.target.value)}
                placeholder="Summarize your work today..."
                rows={3}
                className="text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              disabled={formSaving}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSave('DRAFT')}
              disabled={formSaving}
              className="gap-1.5"
            >
              {formSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave('SUBMITTED')}
              disabled={formSaving}
              className="gap-1.5"
            >
              {formSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════
          DETAIL DIALOG
      ════════════════════════════════════════════════════ */}
      <Dialog open={!!detailRecord} onOpenChange={() => setDetailRecord(null)}>
        <DialogContent className="max-w-lg">
          {detailRecord && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Activity Detail - {new Date(detailRecord.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {statusBadge(detailRecord.status)}
                  <span className="text-xs text-muted-foreground">
                    by {detailRecord.user?.name || 'Unknown'}
                  </span>
                </div>

                <KpiGauge
                  percentage={detailRecord.aiUsagePercentage}
                  target={detailRecord.kpiTargetPercentage}
                  kpiMet={detailRecord.kpiMet}
                />

                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Work Hours</p>
                    <p className="text-lg font-bold">{detailRecord.totalWorkHours}h</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">AI Hours</p>
                    <p className="text-lg font-bold text-emerald-600">{detailRecord.aiUsageHours}h</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Commits</p>
                    <p className="text-lg font-bold text-pink-600">{detailRecord.commitCount}</p>
                  </div>
                </div>

                {detailRecord.commitSummary && (
                  <div className="rounded-md bg-muted/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <GitCommit className="h-3 w-3" /> Git Commit Summary
                    </p>
                    <p className="text-sm">{detailRecord.commitSummary}</p>
                  </div>
                )}

                {detailRecord.summary && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Daily Summary</p>
                    <p className="text-sm">{detailRecord.summary}</p>
                  </div>
                )}

                {detailRecord.projectEntries.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Project Entries</p>
                    <div className="space-y-2">
                      {detailRecord.projectEntries.map((entry, idx) => (
                        <div key={idx} className="rounded-md border border-border p-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium">{entry.projectName || 'Unknown Project'}</p>
                            <span className="text-xs text-muted-foreground">{entry.hours}h / AI: {entry.aiHours}h</span>
                          </div>
                          {entry.tasks && <p className="text-xs text-muted-foreground">{entry.tasks}</p>}
                          {entry.commitMessages.length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {entry.commitMessages.map((msg, mi) => (
                                <p key={mi} className="text-[10px] font-mono text-muted-foreground truncate">
                                  {msg}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailRecord.approvedBy && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Approved by {detailRecord.approvedBy.name} on {new Date(detailRecord.approvedAt!).toLocaleDateString()}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// FolderIcon helper
// ============================================================
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  )
}

// ============================================================
// Team Activity Tab Component
// ============================================================
function TeamActivityTab({ onApprove }: { onApprove: (id: string) => void }) {
  const { user: currentUser } = useAppStore()
  const [teamRecords, setTeamRecords] = useState<ActivityDailyRecord[]>([])
  const [teamLoading, setTeamLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const fetchTeamRecords = useCallback(async () => {
    setTeamLoading(true)
    try {
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : ''
      const data = await api.get<{
        records: ActivityDailyRecord[]
        pagination: { total: number }
      }>(`/api/activity-daily?limit=50${statusParam}`)
      setTeamRecords(data.records)
    } catch {
      toast.error('Error', 'Failed to load team records')
    } finally {
      setTeamLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchTeamRecords()
  }, [fetchTeamRecords])

  const pendingRecords = teamRecords.filter((r) => r.status === 'SUBMITTED')
  const isAdmin = currentUser?.roles ? true : false // Simplified check

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchTeamRecords} disabled={teamLoading} className="gap-1.5 h-8">
          <RefreshCw className={`h-3.5 w-3.5 ${teamLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Pending Approvals */}
      {pendingRecords.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Pending Approvals ({pendingRecords.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingRecords.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={record.user?.avatarUrl || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {record.user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{record.user?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · {record.totalWorkHours}h work · {record.aiUsageHours}h AI · {record.commitCount} commits
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.kpiMet ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0 text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" /> KPI Met
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-0 text-xs">
                        <XCircle className="h-3 w-3 mr-1" /> KPI Not Met
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => onApprove(record.id)}
                    >
                      <CheckCircle className="h-3 w-3" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Records Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Activity Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teamLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : teamRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No team records found</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Work Hrs</TableHead>
                    <TableHead>AI Hrs</TableHead>
                    <TableHead>AI %</TableHead>
                    <TableHead>KPI</TableHead>
                    <TableHead>Commits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={record.user?.avatarUrl || undefined} />
                            <AvatarFallback className="text-[9px]">
                              {record.user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{record.user?.name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </TableCell>
                      <TableCell className="text-xs">{record.totalWorkHours}h</TableCell>
                      <TableCell className="text-xs">{record.aiUsageHours}h</TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold ${record.kpiMet ? 'text-green-600' : 'text-red-600'}`}>
                          {record.aiUsagePercentage.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        {record.kpiMet ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{record.commitCount}</TableCell>
                      <TableCell>{statusBadge(record.status)}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                        {record.summary || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
