'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState } from 'react'
import {
  Users,
  FolderKanban,
  CheckCircle,
  Activity,
  Shield,
  KeyRound,
  Building2,
  GitBranch,
  Mail,
  FileText,
  Bell,
  Settings,
  Database,
  Clock,
  Loader2,
  RefreshCw,
  ArrowRight,
  Cloud,
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
import { useAppStore } from '@/store/app-store'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface AdminStats {
  totalUsers: number
  activeProjects: number
  pendingApprovals: number
  systemHealth: string
}

interface AuditLogItem {
  id: string
  action: string
  entity: string
  entityId?: string
  aitNo?: string
  createdAt: string
  user?: { id: string; name: string; email: string } | null
}

// ============================================================
// Quick link config
// ============================================================

const QUICK_LINKS = [
  { labelKey: 'users', icon: Users, view: 'admin-users', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  { labelKey: 'roles', icon: Shield, view: 'admin-roles', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/40' },
  { labelKey: 'departments', icon: Building2, view: 'admin-departments', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  { labelKey: 'approvalWorkflows', icon: CheckCircle, view: 'admin-approval-workflows', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  { labelKey: 'notificationRules', icon: Bell, view: 'admin-notification-rules', color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-900/40' },
  { labelKey: 'smtp', icon: Mail, view: 'admin-smtp', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/40' },
  { labelKey: 'emailTemplates', icon: FileText, view: 'admin-email-templates', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/40' },
  { labelKey: 'emailLogs', icon: Mail, view: 'admin-email-logs', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40' },
  { labelKey: 'github', icon: GitBranch, view: 'admin-github', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-900/40' },
  { labelKey: 'aiSettings', icon: Activity, view: 'admin-ai-settings', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/40' },
  { labelKey: 'documentNumbers', icon: KeyRound, view: 'admin-document-numbers', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/40' },
  { labelKey: 'systemSettings', icon: Settings, view: 'admin-system-settings', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-900/40' },
  { labelKey: 'auditLogs', icon: Database, view: 'admin-audit-logs', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
  { labelKey: 'jobs', icon: Clock, view: 'admin-jobs', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/40' },
  { labelKey: 'googleSettings', icon: Cloud, view: 'admin-google-settings', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/40' },
]

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function timeAgo(dateStr: string): string {
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

// ============================================================
// Component
// ============================================================

export default function AdminPage() {
  const { navigate } = useAppStore()
  const { t } = useI18n()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, auditRes] = await Promise.all([
        api.get<{ data: unknown[]; pagination: { total: number } }>('/api/admin/users?limit=1'),
        api.get<{ data: AuditLogItem[]; pagination: { total: number } }>('/api/admin/audit-logs?limit=10'),
      ])
      const totalUsers = usersRes.pagination?.total ?? 0
      const logs = auditRes.data ?? []
      setStats({
        totalUsers,
        activeProjects: 0,
        pendingApprovals: 0,
        systemHealth: 'Healthy',
      })
      setAuditLogs(logs)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load admin data'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(() => fetchData())()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
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
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t.common.retry}
        </Button>
      </div>
    )
  }

  const statCards = [
    {
      title: t.dashboard.activeRequests,
      value: stats?.totalUsers ?? 0,
      icon: Users,
      gradient: 'from-emerald-500/10 to-emerald-600/5',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: t.dashboard.totalProjects,
      value: stats?.activeProjects ?? 0,
      icon: FolderKanban,
      gradient: 'from-blue-500/10 to-blue-600/5',
      iconBg: 'bg-blue-100 dark:bg-blue-900/40',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: t.dashboard.pendingApprovals,
      value: stats?.pendingApprovals ?? 0,
      icon: CheckCircle,
      gradient: 'from-amber-500/10 to-amber-600/5',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      title: t.common.settings,
      value: stats?.systemHealth ?? 'Unknown',
      icon: Activity,
      gradient: 'from-green-500/10 to-green-600/5',
      iconBg: 'bg-green-100 dark:bg-green-900/40',
      iconColor: 'text-green-600 dark:text-green-400',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className={`bg-gradient-to-br ${card.gradient} border-0 overflow-hidden`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">{card.value}</p>
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

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Links</CardTitle>
          <CardDescription>{t.admin.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon
              return (
                <button
                  key={link.view}
                  onClick={() => navigate(link.view)}
                  className="flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50 cursor-pointer"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${link.bg}`}>
                    <Icon className={`h-5 w-5 ${link.color}`} />
                  </div>
                  <span className="text-xs font-medium text-foreground">{t.admin[link.labelKey as keyof typeof t.admin]}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Audit Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{t.admin.auditLogs}</CardTitle>
            <CardDescription>Last 10 system activities</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('admin-audit-logs')} className="gap-1">
            {t.common.viewAll} <ArrowRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t.common.noData}</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="hidden md:table-cell">AIT No</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(log.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">{log.user?.name ?? 'System'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.entity}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs font-mono text-muted-foreground">
                        {log.aitNo ?? '—'}
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
