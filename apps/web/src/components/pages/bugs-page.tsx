'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Bug,
  Plus,
  Sparkles,
  Loader2,
  AlertTriangle,
  Search,
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
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api-client'
import { toast } from '@/lib/toast'

// ============================================================
// Types
// ============================================================

interface BugReport {
  id: string
  title: string
  description: string
  severity: string
  actualResult: string | null
  expectedResult: string | null
  reproductionSteps: string | null
  rootCause: string | null
  status: string
  reportedById: string
  requestId: string | null
  aiRca: string | null
  createdAt: string
  updatedAt: string
  reportedBy: {
    id: string
    name: string
    email: string
  }
  request?: {
    id: string
    title: string
    code: string
  } | null
}

const severityConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Low', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  MEDIUM: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  CRITICAL: { label: 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

const bugStatusConfig: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Open', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  INVESTIGATING: { label: 'Investigating', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  FIXING: { label: 'Fixing', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  FIXED: { label: 'Fixed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  VERIFIED: { label: 'Verified', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
  CLOSED: { label: 'Closed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
}

// ============================================================
// Component
// ============================================================

export default function BugsPage() {
  const { t } = useI18n()
  const [bugs, setBugs] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New Bug dialog
  const [bugDialogOpen, setBugDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSeverity, setFormSeverity] = useState('MEDIUM')
  const [formActual, setFormActual] = useState('')
  const [formExpected, setFormExpected] = useState('')
  const [formSteps, setFormSteps] = useState('')
  const [formRequestId, setFormRequestId] = useState('')

  // AI RCA dialog
  const [rcaDialogOpen, setRcaDialogOpen] = useState(false)
  const [rcaLoading, setRcaLoading] = useState(false)
  const [rcaBugTitle, setRcaBugTitle] = useState('')
  const [rcaDescription, setRcaDescription] = useState('')
  const [rcaSeverity, setRcaSeverity] = useState('MEDIUM')
  const [rcaActual, setRcaActual] = useState('')
  const [rcaExpected, setRcaExpected] = useState('')
  const [rcaSteps, setRcaSteps] = useState('')
  const [rcaResult, setRcaResult] = useState<any>(null)
  const [rcaError, setRcaError] = useState<string | null>(null)

  const fetchBugs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ bugs: BugReport[] }>('/api/bugs')
      setBugs(data.bugs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bugs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    ;(() => fetchBugs())()
  }, [fetchBugs])

  const handleCreateBug = async () => {
    if (!formTitle || !formDescription) {
      toast.warning('Validation Error', 'Title and description are required.')
      return
    }
    setCreating(true)
    try {
      await api.post('/api/bugs', {
        title: formTitle,
        description: formDescription,
        severity: formSeverity,
        actualResult: formActual || null,
        expectedResult: formExpected || null,
        reproductionSteps: formSteps || null,
        requestId: formRequestId || null,
      })
      toast.success('Bug reported')
      setBugDialogOpen(false)
      setFormTitle('')
      setFormDescription('')
      setFormSeverity('MEDIUM')
      setFormActual('')
      setFormExpected('')
      setFormSteps('')
      setFormRequestId('')
      fetchBugs()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to report bug')
    } finally {
      setCreating(false)
    }
  }

  const handleRCA = async () => {
    if (!rcaBugTitle || !rcaDescription) {
      toast.warning('Validation Error', 'Bug title and description are required.')
      return
    }
    setRcaLoading(true)
    setRcaResult(null)
    setRcaError(null)
    try {
      const data = await api.post<{ analysis: any; runId: string; latencyMs: number }>('/api/ai/bugs/root-cause-analysis', {
        bugTitle: rcaBugTitle,
        description: rcaDescription,
        severity: rcaSeverity,
        actualResult: rcaActual || 'Not specified',
        expectedResult: rcaExpected || 'Not specified',
        reproductionSteps: rcaSteps || 'Not provided',
      })
      setRcaResult(typeof data.analysis === 'string' ? JSON.parse(data.analysis) : data.analysis)
      toast.success('RCA complete', `Analysis generated in ${data.latencyMs || 0}ms`)
    } catch (err) {
      setRcaError(err instanceof Error ? err.message : 'RCA failed')
    } finally {
      setRcaLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Bug className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.bugs.title}</h1>
            <p className="text-sm text-muted-foreground">{t.bugs.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={rcaDialogOpen} onOpenChange={setRcaDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Sparkles className="h-4 w-4" />
                {t.bugs.rca}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t.bugs.rca}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bug Title *</Label>
                    <Input value={rcaBugTitle} onChange={(e) => setRcaBugTitle(e.target.value)} placeholder="Bug title" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.bugs.severity}</Label>
                    <Select value={rcaSeverity} onValueChange={setRcaSeverity}>
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
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Textarea value={rcaDescription} onChange={(e) => setRcaDescription(e.target.value)} rows={3} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Actual Result</Label>
                    <Input value={rcaActual} onChange={(e) => setRcaActual(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Expected Result</Label>
                    <Input value={rcaExpected} onChange={(e) => setRcaExpected(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reproduction Steps</Label>
                  <Textarea value={rcaSteps} onChange={(e) => setRcaSteps(e.target.value)} rows={3} />
                </div>
                <Button onClick={handleRCA} disabled={rcaLoading} className="gap-2">
                  {rcaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Analyze Root Cause
                </Button>

                {rcaError && (
                  <Card className="border-destructive/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-destructive">{rcaError}</p>
                    </CardContent>
                  </Card>
                )}

                {rcaResult && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Root Cause Analysis Result
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {rcaResult.summary && (
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Summary</h4>
                          <p className="text-sm text-muted-foreground">{rcaResult.summary}</p>
                        </div>
                      )}
                      {rcaResult.probableRootCauses && (
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Probable Root Causes</h4>
                          <ul className="space-y-1">
                            {(Array.isArray(rcaResult.probableRootCauses) ? rcaResult.probableRootCauses : [rcaResult.probableRootCauses]).map((c: any, i: number) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <span className="text-primary mt-0.5">&#x2022;</span>
                                <span>{typeof c === 'string' ? c : JSON.stringify(c)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {rcaResult.reproductionSteps && (
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Reproduction Steps</h4>
                          <p className="text-sm text-muted-foreground">{typeof rcaResult.reproductionSteps === 'string' ? rcaResult.reproductionSteps : JSON.stringify(rcaResult.reproductionSteps)}</p>
                        </div>
                      )}
                      {rcaResult.impactArea && (
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Impact Area</h4>
                          <p className="text-sm text-muted-foreground">{typeof rcaResult.impactArea === 'string' ? rcaResult.impactArea : JSON.stringify(rcaResult.impactArea)}</p>
                        </div>
                      )}
                      {rcaResult.suggestedFixes && (
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Suggested Fixes</h4>
                          <ul className="space-y-1">
                            {(Array.isArray(rcaResult.suggestedFixes) ? rcaResult.suggestedFixes : [rcaResult.suggestedFixes]).map((f: any, i: number) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <span className="text-green-600 mt-0.5">&#x2713;</span>
                                <span>{typeof f === 'string' ? f : JSON.stringify(f)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {rcaResult.regressionTests && (
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Regression Tests</h4>
                          <ul className="space-y-1">
                            {(Array.isArray(rcaResult.regressionTests) ? rcaResult.regressionTests : [rcaResult.regressionTests]).map((t: any, i: number) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <span className="text-amber-600 mt-0.5">&#x2022;</span>
                                <span>{typeof t === 'string' ? t : JSON.stringify(t)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* Fallback: show raw JSON if no structured fields */}
                      {!rcaResult.summary && !rcaResult.probableRootCauses && !rcaResult.suggestedFixes && (
                        <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap">
                          {JSON.stringify(rcaResult, null, 2)}
                        </pre>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={bugDialogOpen} onOpenChange={setBugDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {t.bugs.reportBug}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{t.bugs.reportBug}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Bug title" />
                </div>
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t.bugs.severity}</Label>
                    <Select value={formSeverity} onValueChange={setFormSeverity}>
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
                  <div className="space-y-2">
                    <Label>Request ID</Label>
                    <Input value={formRequestId} onChange={(e) => setFormRequestId(e.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Actual Result</Label>
                  <Input value={formActual} onChange={(e) => setFormActual(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Expected Result</Label>
                  <Input value={formExpected} onChange={(e) => setFormExpected(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Reproduction Steps</Label>
                  <Textarea value={formSteps} onChange={(e) => setFormSteps(e.target.value)} rows={3} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setBugDialogOpen(false)}>{t.common.cancel}</Button>
                  <Button onClick={handleCreateBug} disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {t.bugs.reportBug}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="border-destructive/50">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={fetchBugs} className="mt-3">{t.common.retry}</Button>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && bugs.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Bug className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">{t.bugs.noBugs}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Report your first bug to get started</p>
          <Button className="mt-4 gap-2" onClick={() => setBugDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            {t.bugs.reportBug}
          </Button>
        </motion.div>
      )}

      {/* Bug Table */}
      {!loading && !error && bugs.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.common.name}</TableHead>
                  <TableHead>{t.bugs.severity}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>{t.common.createdAt}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bugs.map((bug) => {
                  const sevConf = severityConfig[bug.severity] || { label: bug.severity, color: '' }
                  const statConf = bugStatusConfig[bug.status] || { label: bug.status, color: '' }
                  return (
                    <TableRow key={bug.id}>
                      <TableCell className="font-medium text-sm max-w-48">
                        <div>
                          <span className="line-clamp-1">{bug.title}</span>
                          {bug.aiRca && (
                            <Badge variant="outline" className="text-xs mt-1">
                              <Sparkles className="h-3 w-3 mr-1" />
                              RCA
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={sevConf.color}>
                          {sevConf.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statConf.color}>
                          {statConf.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{bug.reportedBy?.name || 'Unknown'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {bug.request?.code || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(bug.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
