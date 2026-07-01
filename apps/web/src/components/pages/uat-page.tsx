'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  TestTube2,
  Plus,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  FolderKanban,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api-client'
import { toast } from '@/lib/toast'

// ============================================================
// Types
// ============================================================

interface UatCycle {
  id: string
  name: string
  description: string | null
  status: string
  startDate: string | null
  endDate: string | null
  projectId: string
  createdAt: string
  project: {
    id: string
    name: string
    code: string
  }
  _count: {
    testCases: number
  }
}

const cycleStatusConfig: Record<string, { label: string; color: string }> = {
  PLANNED: { label: 'Planned', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

// ============================================================
// Component
// ============================================================

export default function UatPage() {
  const { t } = useI18n()
  const [cycles, setCycles] = useState<UatCycle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New Cycle dialog
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formProjectId, setFormProjectId] = useState('')
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')

  // AI Generate dialog
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiReqTitle, setAiReqTitle] = useState('')
  const [aiReqDesc, setAiReqDesc] = useState('')
  const [aiCriteria, setAiCriteria] = useState('')
  const [aiReqType, setAiReqType] = useState('FEATURE')
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const fetchCycles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ cycles: UatCycle[] }>('/api/uat/cycles')
      setCycles(data.cycles || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load UAT cycles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCycles()
  }, [fetchCycles])

  const handleCreateCycle = async () => {
    if (!formProjectId || !formName) {
      toast.warning('Validation Error', 'Project and name are required.')
      return
    }
    setCreating(true)
    try {
      await api.post('/api/uat/cycles', {
        projectId: formProjectId,
        name: formName,
        description: formDescription,
        startDate: formStartDate || null,
        endDate: formEndDate || null,
      })
      toast.success('UAT Cycle created')
      setCycleDialogOpen(false)
      setFormProjectId('')
      setFormName('')
      setFormDescription('')
      setFormStartDate('')
      setFormEndDate('')
      fetchCycles()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to create cycle')
    } finally {
      setCreating(false)
    }
  }

  const handleAIGenerate = async () => {
    if (!aiReqTitle || !aiReqDesc) {
      toast.warning('Validation Error', 'Requirement title and description are required.')
      return
    }
    setAiGenerating(true)
    setAiResult(null)
    setAiError(null)
    try {
      const data = await api.post<{ testCases: string; runId: string; latencyMs: number }>('/api/ai/uat/generate-test-cases', {
        requirementTitle: aiReqTitle,
        requirementDescription: aiReqDesc,
        acceptanceCriteria: aiCriteria,
        requestType: aiReqType,
      })
      setAiResult(typeof data.testCases === 'string' ? data.testCases : JSON.stringify(data.testCases, null, 2))
      toast.success('Test cases generated', `Generated in ${data.latencyMs || 0}ms`)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate test cases')
    } finally {
      setAiGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <TestTube2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.uat.title}</h1>
            <p className="text-sm text-muted-foreground">{t.uat.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Sparkles className="h-4 w-4" />
                {t.uat.generateTestCases}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t.uat.generateTestCases}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Requirement Title *</Label>
                  <Input value={aiReqTitle} onChange={(e) => setAiReqTitle(e.target.value)} placeholder="e.g. User Login Flow" />
                </div>
                <div className="space-y-2">
                  <Label>Requirement Description *</Label>
                  <Textarea value={aiReqDesc} onChange={(e) => setAiReqDesc(e.target.value)} rows={4} placeholder="Describe the requirement..." />
                </div>
                <div className="space-y-2">
                  <Label>Acceptance Criteria</Label>
                  <Textarea value={aiCriteria} onChange={(e) => setAiCriteria(e.target.value)} rows={3} placeholder="List acceptance criteria..." />
                </div>
                <div className="space-y-2">
                  <Label>Request Type</Label>
                  <Select value={aiReqType} onValueChange={setAiReqType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FEATURE">Feature</SelectItem>
                      <SelectItem value="BUG">Bug Fix</SelectItem>
                      <SelectItem value="CHANGE">Change Request</SelectItem>
                      <SelectItem value="SUPPORT">Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAIGenerate} disabled={aiGenerating} className="gap-2">
                  {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {t.uat.generateTestCases}
                </Button>

                {aiError && (
                  <Card className="border-destructive/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-destructive">{aiError}</p>
                    </CardContent>
                  </Card>
                )}

                {aiResult && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{t.uat.testCases}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap">
                        {aiResult}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={cycleDialogOpen} onOpenChange={setCycleDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {t.uat.createCycle}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.uat.createCycle}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Project ID *</Label>
                  <Input value={formProjectId} onChange={(e) => setFormProjectId(e.target.value)} placeholder="Project ID" />
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="UAT cycle name" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setCycleDialogOpen(false)}>{t.common.cancel}</Button>
                  <Button onClick={handleCreateCycle} disabled={creating}>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="border-destructive/50">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={fetchCycles} className="mt-3">{t.common.retry}</Button>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && cycles.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <TestTube2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">{t.uat.noCycles}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create your first UAT cycle to begin testing</p>
          <Button className="mt-4 gap-2" onClick={() => setCycleDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            {t.uat.createCycle}
          </Button>
        </motion.div>
      )}

      {/* Cycle List */}
      {!loading && !error && cycles.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cycles.map((cycle, idx) => {
            const statusConf = cycleStatusConfig[cycle.status] || { label: cycle.status, color: '' }
            return (
              <motion.div
                key={cycle.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold line-clamp-1">{cycle.name}</CardTitle>
                      <Badge variant="secondary" className={statusConf.color}>
                        {statusConf.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FolderKanban className="h-3.5 w-3.5" />
                      <span>{cycle.project?.name || 'Unknown Project'}</span>
                    </div>
                    {cycle.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{cycle.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <TestTube2 className="h-3 w-3" />
                        <span>{cycle._count.testCases} {t.uat.testCases}</span>
                      </div>
                      {(cycle.startDate || cycle.endDate) && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {cycle.startDate ? new Date(cycle.startDate).toLocaleDateString() : ''}
                            {cycle.startDate && cycle.endDate ? ' - ' : ''}
                            {cycle.endDate ? new Date(cycle.endDate).toLocaleDateString() : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
