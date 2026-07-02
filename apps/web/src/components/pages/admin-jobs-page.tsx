'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState } from 'react'
import {
  Clock,
  RefreshCw,
  Loader2,
  Play,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface JobRun {
  id: string
  startedAt: string
  finishedAt: string | null
  status: string
  result: string | null
  errorMessage: string | null
}

interface BackgroundJob {
  id: string
  jobKey: string
  name: string
  schedule: string
  isEnabled: boolean
  lastRunAt: string | null
  lastRun: JobRun | null
  runs?: JobRun[]
}

// ============================================================
// Component
// ============================================================

export default function AdminJobsPage() {
  const { t } = useI18n()
  const [jobs, setJobs] = useState<BackgroundJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedJobKey, setExpandedJobKey] = useState<string | null>(null)
  const [runHistory, setRunHistory] = useState<Record<string, JobRun[]>>({})
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null)
  const [runningJob, setRunningJob] = useState<string | null>(null)
  const [togglingJob, setTogglingJob] = useState<string | null>(null)

  const fetchJobs = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ data: BackgroundJob[] }>('/api/admin/jobs')
      setJobs(data.data ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(() => fetchJobs())()
  }, [])

  const handleToggle = async (job: BackgroundJob) => {
    setTogglingJob(job.jobKey)
    try {
      await api.patch(`/api/admin/jobs/${job.jobKey}`, {
        isEnabled: !job.isEnabled,
      })
      setJobs((prev) =>
        prev.map((j) => (j.jobKey === job.jobKey ? { ...j, isEnabled: !j.isEnabled } : j))
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to toggle job')
    } finally {
      setTogglingJob(null)
    }
  }

  const handleManualRun = async (job: BackgroundJob) => {
    setRunningJob(job.jobKey)
    try {
      await api.post(`/api/admin/jobs/${job.jobKey}/run`)
      fetchJobs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to run job')
    } finally {
      setRunningJob(null)
    }
  }

  const loadRunHistory = async (jobKey: string) => {
    if (expandedJobKey === jobKey) {
      setExpandedJobKey(null)
      return
    }
    setExpandedJobKey(jobKey)
    if (runHistory[jobKey]) return

    setLoadingHistory(jobKey)
    try {
      const data = await api.get<{ data: JobRun[] }>(`/api/admin/job-runs?jobKey=${jobKey}&limit=10`)
      setRunHistory((prev) => ({ ...prev, [jobKey]: data.data ?? [] }))
    } catch {
      // Ignore
    } finally {
      setLoadingHistory(null)
    }
  }

  const RUN_STATUS_COLORS: Record<string, string> = {
    RUNNING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    SUCCESS: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Card className="p-4">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchJobs} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/40">
          <Clock className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.admin.jobs}</h1>
          <p className="text-sm text-muted-foreground">{jobs.length} job(s) configured</p>
        </div>
      </div>

      {/* Jobs Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]" />
              <TableHead>{t.common.name}</TableHead>
              <TableHead className="hidden md:table-cell">Schedule</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Last Status</TableHead>
              <TableHead>{t.common.enabled}</TableHead>
              <TableHead className="w-[100px]">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  {t.common.noData}
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => {
                const isExpanded = expandedJobKey === job.jobKey
                return (
                  <React.Fragment key={job.id}>
                    <TableRow>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => loadRunHistory(job.jobKey)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{job.name}</p>
                          <p className="text-xs text-muted-foreground">{job.jobKey}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm font-mono">
                        {job.schedule}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {job.lastRunAt ? formatDate(job.lastRunAt) : 'Never'}
                      </TableCell>
                      <TableCell>
                        {job.lastRun ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${RUN_STATUS_COLORS[job.lastRun.status] || ''}`}
                          >
                            {job.lastRun.status}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={job.isEnabled}
                          onCheckedChange={() => handleToggle(job)}
                          disabled={togglingJob === job.jobKey}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => handleManualRun(job)}
                          disabled={runningJob === job.jobKey || !job.isEnabled}
                        >
                          {runningJob === job.jobKey ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          Run
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          {loadingHistory === job.jobKey ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                          ) : (runHistory[job.jobKey] ?? []).length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">{t.common.noData}</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Started</TableHead>
                                  <TableHead>Finished</TableHead>
                                  <TableHead>{t.common.status}</TableHead>
                                  <TableHead className="hidden md:table-cell">Error</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(runHistory[job.jobKey] ?? []).map((run) => (
                                  <TableRow key={run.id}>
                                    <TableCell className="text-xs">{formatDate(run.startedAt)}</TableCell>
                                    <TableCell className="text-xs">
                                      {run.finishedAt ? formatDate(run.finishedAt) : '—'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] ${RUN_STATUS_COLORS[run.status] || ''}`}
                                      >
                                        {run.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-xs text-red-500 max-w-[200px] truncate">
                                      {run.errorMessage ?? '—'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
