'use client'

import React, { useEffect, useState } from 'react'
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
} from 'recharts'
import {
  FileText,
  ClipboardList,
  AlertTriangle,
  Users,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Loader2,
  ArrowUpRight,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface DashboardStats {
  totalRequests: number
  activeRequests: number
  totalWorkItems: number
  activeWorkItems: number
  openBugs: number
  upcomingMeetings: number
}

interface WorkloadUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  totalActiveRequests: number
  activeWorkItems: number
}

interface WorkloadProject {
  id: string
  name: string
  code: string
  activeRequests: number
  activeMeetings: number
  activeUatCycles: number
}

interface WorkloadData {
  workloadByUser: WorkloadUser[]
  workloadByProject: WorkloadProject[]
  stats: DashboardStats
}

interface RequestItem {
  id: string
  code: string
  title: string
  status: string
  type: string
  priority: string
  createdAt: string
  project?: { id: string; name: string; code: string } | null
  createdBy?: { id: string; name: string; email: string } | null
}

interface OverdueData {
  summary: {
    totalOverdueRequests: number
    totalOverdueWorkItems: number
  }
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

// ============================================================
// Component
// ============================================================

export default function DashboardPage() {
  const { navigate } = useAppStore()
  const { t } = useI18n()

  const [workload, setWorkload] = useState<WorkloadData | null>(null)
  const [recentRequests, setRecentRequests] = useState<RequestItem[]>([])
  const [overdue, setOverdue] = useState<OverdueData | null>(null)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [aiInsightLoading, setAiInsightLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [workloadData, requestsData, overdueData] = await Promise.all([
          api.get<WorkloadData>('/api/dashboard/workload'),
          api.get<{ requests: RequestItem[] }>('/api/requests?limit=5'),
          api.get<OverdueData>('/api/dashboard/overdue'),
        ])
        setWorkload(workloadData)
        setRecentRequests(requestsData.requests || [])
        setOverdue(overdueData)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Generate AI insight
  const handleGenerateInsight = async () => {
    setAiInsightLoading(true)
    try {
      const result = await api.post<{ insight: string }>('/api/ai/dashboard/workload-insight')
      setAiInsight(
        typeof result.insight === 'string'
          ? result.insight
          : JSON.stringify(result.insight, null, 2)
      )
    } catch (error: any) {
      setAiInsight('Failed to generate insight. Please try again.')
    } finally {
      setAiInsightLoading(false)
    }
  }

  // Build chart data from request types
  const requestTypeData = React.useMemo(() => {
    if (!recentRequests.length) return []
    const typeCounts: Record<string, number> = {}
    recentRequests.forEach((r) => {
      typeCounts[r.type] = (typeCounts[r.type] || 0) + 1
    })
    return Object.entries(typeCounts).map(([name, value]) => ({ name, value }))
  }, [recentRequests])

  // Build chart data for request status distribution
  const requestStatusData = React.useMemo(() => {
    if (!workload) return []
    return [
      { name: 'Active', count: workload.stats.activeRequests },
      { name: 'Work Items', count: workload.stats.activeWorkItems },
      { name: 'Open Bugs', count: workload.stats.openBugs },
      { name: 'Meetings', count: workload.stats.upcomingMeetings },
    ]
  }, [workload])

  // Stats cards data
  const statsCards = React.useMemo(() => {
    if (!workload || !overdue) return []
    const totalOverdue = overdue.summary.totalOverdueRequests + overdue.summary.totalOverdueWorkItems
    return [
      {
        title: t.dashboard.totalProjects,
        value: workload.stats.totalRequests,
        trend: '+12%',
        trendUp: true,
        icon: FileText,
        gradient: 'from-emerald-500/10 to-emerald-600/5',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
      },
      {
        title: t.dashboard.activeRequests,
        value: workload.stats.activeWorkItems,
        trend: '+5%',
        trendUp: true,
        icon: ClipboardList,
        gradient: 'from-blue-500/10 to-blue-600/5',
        iconBg: 'bg-blue-100 dark:bg-blue-900/40',
        iconColor: 'text-blue-600 dark:text-blue-400',
      },
      {
        title: t.dashboard.overdueItems,
        value: totalOverdue,
        trend: totalOverdue > 0 ? '+3' : '0',
        trendUp: false,
        icon: AlertTriangle,
        gradient: 'from-red-500/10 to-red-600/5',
        iconBg: 'bg-red-100 dark:bg-red-900/40',
        iconColor: 'text-red-600 dark:text-red-400',
      },
      {
        title: t.dashboard.teamWorkload,
        value: workload.workloadByUser.length,
        trend: '',
        trendUp: true,
        icon: Users,
        gradient: 'from-violet-500/10 to-violet-600/5',
        iconBg: 'bg-violet-100 dark:bg-violet-900/40',
        iconColor: 'text-violet-600 dark:text-violet-400',
      },
    ]
  }, [workload, overdue, t.dashboard.totalProjects])

  // Format time ago
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

  // Status badge color
  const statusColor = (status: string) => {
    const s = status.toUpperCase()
    if (['COMPLETED', 'CLOSED', 'DEPLOYED'].includes(s)) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    if (['IN_DEVELOPMENT', 'IN_PROGRESS', 'QA', 'UAT'].includes(s)) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    if (['DRAFT', 'CREATED', 'SUBMITTED'].includes(s)) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    if (['REJECTED', 'RETURNED'].includes(s)) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Charts skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((card) => {
          const Icon = card.icon
          return (
            <Card
              key={card.title}
              className={`bg-gradient-to-br ${card.gradient} border-0 overflow-hidden`}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">{card.value}</p>
                    {card.trend && (
                      <div className="mt-1 flex items-center gap-1">
                        {card.trendUp ? (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span
                          className={`text-xs font-medium ${
                            card.trendUp ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {card.trend}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg}`}>
                    <Icon className={`h-5 w-5 ${card.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bar Chart - Request by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.dashboard.projectHealth}</CardTitle>
            <CardDescription>{t.dashboard.overview}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={requestStatusData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--card-foreground))',
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {requestStatusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - Requests by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.dashboard.recentActivity}</CardTitle>
            <CardDescription>{t.dashboard.overview}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {requestTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={requestTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {requestTypeData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--card))',
                        color: 'hsl(var(--card-foreground))',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  {t.common.noData}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & AI Insight Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.dashboard.recentActivity}</CardTitle>
            <CardDescription>{t.dashboard.overview}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {recentRequests.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t.common.noData}
                </p>
              ) : (
                recentRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate('request-detail', { id: req.id })}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {req.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 ${statusColor(req.status)}`}
                        >
                          {req.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{req.code}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {timeAgo(req.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
            {recentRequests.length > 0 && (
              <Button
                variant="ghost"
                className="mt-3 w-full"
                onClick={() => navigate('requests')}
              >
                {t.dashboard.viewAllRequests}
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* AI Workload Insight */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <CardTitle className="text-base">{t.dashboard.workloadInsight}</CardTitle>
                <CardDescription>AI {t.dashboard.teamWorkload}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiInsight ? (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {aiInsight}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                  <Sparkles className="mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Click the button below to generate an AI-powered insight about your team&apos;s workload.
                  </p>
                </div>
              )}
              <Button
                onClick={handleGenerateInsight}
                disabled={aiInsightLoading}
                className="w-full"
              >
                {aiInsightLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Insight...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Insight
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workload Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.dashboard.teamWorkload}</CardTitle>
          <CardDescription>{t.dashboard.overview}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.common.name}</TableHead>
                  <TableHead className="text-center">{t.dashboard.activeRequests}</TableHead>
                  <TableHead className="text-center">{t.workItems.title}</TableHead>
                  <TableHead className="text-center">{t.common.total}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workload?.workloadByUser.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      {t.common.noData}
                    </TableCell>
                  </TableRow>
                ) : (
                  workload?.workloadByUser.map((user) => {
                    const totalLoad = user.totalActiveRequests + user.activeWorkItems
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatarUrl || undefined} alt={user.name} />
                              <AvatarFallback className="text-xs">
                                {user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{user.totalActiveRequests}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{user.activeWorkItems}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={totalLoad > 5 ? 'destructive' : 'secondary'}
                          >
                            {totalLoad}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
