'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Play,
  Save,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Hash,
  Zap,
  FileText,
  TestTube2,
  History,
  RotateCcw,
  ArrowUpCircle,
  ArrowDownCircle,
  ChevronRight,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api-client'
import { toast } from '@/lib/toast'

// ============================================================
// Types
// ============================================================

interface PromptVersion {
  id: string
  version: number
  status: string
  systemPrompt: string
  userPromptTemplate: string
  inputSchema: string | null
  outputSchema: string | null
  temperature: number
  maxTokens: number
  changeLog: string | null
  activatedAt: string | null
  createdAt: string
}

interface PromptTestCase {
  id: string
  name: string
  inputVars: string
  expectedOutput: string | null
  expectedContains: string | null
  description: string | null
  createdAt: string
}

interface PromptRun {
  id: string
  promptVersionId: string
  inputVars: string | null
  rawOutput: string | null
  parsedOutput: string | null
  isValid: boolean | null
  isTestRun: boolean
  testPassed: boolean | null
  tokenUsage: string | null
  latencyMs: number | null
  error: string | null
  createdAt: string
  promptVersion?: {
    id: string
    version: number
    status: string
  }
}

interface AiPrompt {
  id: string
  promptKey: string
  title: string
  description: string | null
  category: string
  status: string
  versions: PromptVersion[]
  testCases: PromptTestCase[]
  _count: { runs: number }
}

const statusColorMap: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  DEPRECATED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const categoryColorMap: Record<string, string> = {
  MEETING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  INTAKE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  WORKFLOW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  UAT: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  BUG: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  CHANGE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  HANDOFF: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  DASHBOARD: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  NOTIFICATION: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
}

// ============================================================
// Component
// ============================================================

export default function PromptDetailPage() {
  const { viewParams, goBack } = useAppStore()
  const { t } = useI18n()
  const promptId = viewParams?.id

  const [prompt, setPrompt] = useState<AiPrompt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('editor')

  // Editor state
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userTemplate, setUserTemplate] = useState('')
  const [inputSchema, setInputSchema] = useState('')
  const [outputSchema, setOutputSchema] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(4096)
  const [changeLog, setChangeLog] = useState('')
  const [saving, setSaving] = useState(false)

  // Test run state
  const [testRunOpen, setTestRunOpen] = useState(false)
  const [testVars, setTestVars] = useState('{}')
  const [testRunning, setTestRunning] = useState(false)
  const [testOutput, setTestOutput] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  // Run logs
  const [runs, setRuns] = useState<PromptRun[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null)

  // New test case dialog
  const [tcDialogOpen, setTcDialogOpen] = useState(false)
  const [tcName, setTcName] = useState('')
  const [tcInputVars, setTcInputVars] = useState('{}')
  const [tcExpectedOutput, setTcExpectedOutput] = useState('')
  const [tcExpectedContains, setTcExpectedContains] = useState('')
  const [tcCreating, setTcCreating] = useState(false)

  // Run all tests
  const [runningAllTests, setRunningAllTests] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})

  const fetchPrompt = useCallback(async () => {
    if (!promptId) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ prompt: AiPrompt }>(`/api/ai/prompts/${promptId}`)
      setPrompt(data.prompt)
      // Populate editor with latest version
      const latestVersion = data.prompt.versions?.[0]
      if (latestVersion) {
        setSystemPrompt(latestVersion.systemPrompt || '')
        setUserTemplate(latestVersion.userPromptTemplate || '')
        setInputSchema(latestVersion.inputSchema || '')
        setOutputSchema(latestVersion.outputSchema || '')
        setTemperature(latestVersion.temperature)
        setMaxTokens(latestVersion.maxTokens)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompt')
    } finally {
      setLoading(false)
    }
  }, [promptId])

  const fetchRuns = useCallback(async () => {
    if (!promptId) return
    setRunsLoading(true)
    try {
      const data = await api.get<{ runs: PromptRun[] }>(`/api/ai/prompt-runs?promptId=${promptId}&pageSize=50`)
      setRuns(data.runs || [])
    } catch {
      // Ignore
    } finally {
      setRunsLoading(false)
    }
  }, [promptId])

  useEffect(() => {
    ;(() => fetchPrompt())()
  }, [fetchPrompt])

  useEffect(() => {
    if (activeTab === 'run-logs') {
      ;(() => fetchRuns())()
    }
  }, [activeTab, fetchRuns])

  const handleSaveVersion = async () => {
    if (!promptId) return
    setSaving(true)
    try {
      await api.post(`/api/ai/prompts/${promptId}/create-version`, {
        systemPrompt,
        userPromptTemplate: userTemplate,
        inputSchema: inputSchema || null,
        outputSchema: outputSchema || null,
        temperature,
        maxTokens,
        changeLog: changeLog || 'Updated version',
      })
      toast.success('Version saved', 'New version has been created.')
      setChangeLog('')
      fetchPrompt()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to save version')
    } finally {
      setSaving(false)
    }
  }

  const handleTestRun = async () => {
    if (!promptId) return
    setTestRunning(true)
    setTestOutput(null)
    setTestError(null)
    try {
      let vars = {}
      try {
        vars = JSON.parse(testVars)
      } catch {
        toast.warning('Invalid JSON', 'Variables must be valid JSON')
        setTestRunning(false)
        return
      }
      const data = await api.post<{ result: { rawOutput: string; parsedOutput: string; latencyMs: number; error: string } }>(`/api/ai/prompts/${promptId}/run`, {
        variables: vars,
      })
      if (data.result?.error) {
        setTestError(data.result.error)
      } else {
        setTestOutput(data.result?.parsedOutput || data.result?.rawOutput || 'No output')
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Test run failed')
    } finally {
      setTestRunning(false)
    }
  }

  const handleActivateVersion = async (versionId: string) => {
    if (!promptId) return
    try {
      await api.post(`/api/ai/prompts/${promptId}/activate`, { versionId })
      toast.success('Version activated', 'The version is now active.')
      fetchPrompt()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to activate')
    }
  }

  const handleDeprecateVersion = async (versionId: string) => {
    if (!promptId) return
    try {
      await api.post(`/api/ai/prompts/${promptId}/deprecate`, { versionId })
      toast.info('Version deprecated', 'The version has been deprecated.')
      fetchPrompt()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to deprecate')
    }
  }

  const handleRollback = async (version: PromptVersion) => {
    if (!promptId) return
    try {
      await api.post(`/api/ai/prompts/${promptId}/create-version`, {
        systemPrompt: version.systemPrompt,
        userPromptTemplate: version.userPromptTemplate,
        inputSchema: version.inputSchema,
        outputSchema: version.outputSchema,
        temperature: version.temperature,
        maxTokens: version.maxTokens,
        changeLog: `Rollback from v${version.version}`,
      })
      toast.success('Rollback created', `New version created from v${version.version}`)
      fetchPrompt()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to rollback')
    }
  }

  const handleCreateTestCase = async () => {
    if (!promptId || !tcName) return
    setTcCreating(true)
    try {
      let vars = {}
      try {
        vars = JSON.parse(tcInputVars)
      } catch {
        toast.warning('Invalid JSON', 'Input vars must be valid JSON')
        setTcCreating(false)
        return
      }
      await api.post(`/api/ai/prompts/${promptId}/test-cases`, {
        name: tcName,
        inputVars: vars,
        expectedOutput: tcExpectedOutput || null,
        expectedContains: tcExpectedContains ? tcExpectedContains.split(',').map((s) => s.trim()) : null,
      })
      toast.success('Test case created')
      setTcDialogOpen(false)
      setTcName('')
      setTcInputVars('{}')
      setTcExpectedOutput('')
      setTcExpectedContains('')
      fetchPrompt()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to create test case')
    } finally {
      setTcCreating(false)
    }
  }

  const handleRunAllTests = async () => {
    if (!prompt?.testCases?.length) return
    setRunningAllTests(true)
    setTestResults({})
    const results: Record<string, boolean> = {}
    for (const tc of prompt.testCases) {
      try {
        let vars = {}
        try { vars = JSON.parse(tc.inputVars) } catch { /* skip */ }
        const data = await api.post<{ result: { rawOutput: string; parsedOutput: string; error: string } }>(`/api/ai/prompts/${promptId}/run`, {
          variables: vars,
        })
        const output = data.result?.parsedOutput || data.result?.rawOutput || ''
        const hasError = !!data.result?.error
        let passed = !hasError
        if (tc.expectedContains) {
          try {
            const contains = JSON.parse(tc.expectedContains) as string[]
            passed = passed && contains.every((c) => output.toLowerCase().includes(c.toLowerCase()))
          } catch { /* skip contains check */ }
        }
        results[tc.id] = passed
      } catch {
        results[tc.id] = false
      }
    }
    setTestResults(results)
    setRunningAllTests(false)
  }

  // Highlight template variables like {{variable}}
  const highlightVariables = (text: string) => {
    const parts = text.split(/(\{\{[^}]+\}\})/g)
    return parts.map((part, i) => {
      if (/^\{\{[^}]+\}\}$/.test(part)) {
        return (
          <span key={i} className="text-primary font-semibold">
            {part}
          </span>
        )
      }
      return part
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !prompt) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-6 text-center">
          <p className="text-destructive">{error || 'Prompt not found'}</p>
          <Button variant="outline" onClick={goBack} className="mt-3">
            {t.common.back}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const latestVersion = prompt.versions?.[0]
  const activeVersion = prompt.versions?.find((v) => v.status === 'ACTIVE')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{prompt.title}</h1>
              <Badge variant="secondary" className={categoryColorMap[prompt.category] || ''}>
                {prompt.category}
              </Badge>
              <Badge variant="secondary" className={statusColorMap[prompt.status] || ''}>
                {prompt.status}
              </Badge>
            </div>
            <p className="text-sm font-mono text-muted-foreground">{prompt.promptKey}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="editor" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1.5">
            <History className="h-4 w-4" />
            {t.prompts.versions}
          </TabsTrigger>
          <TabsTrigger value="test-cases" className="gap-1.5">
            <TestTube2 className="h-4 w-4" />
            Test Cases
          </TabsTrigger>
          <TabsTrigger value="run-logs" className="gap-1.5">
            <Zap className="h-4 w-4" />
            Run Logs
          </TabsTrigger>
        </TabsList>

        {/* Editor Tab */}
        <TabsContent value="editor" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">System Prompt</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={10}
                    className="font-mono text-sm resize-y"
                    placeholder="You are a helpful assistant..."
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">User Prompt Template</CardTitle>
                  <CardDescription>
                    Use {`{{variable}}`} syntax for template variables
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={userTemplate}
                    onChange={(e) => setUserTemplate(e.target.value)}
                    rows={8}
                    className="font-mono text-sm resize-y"
                    placeholder="Analyze the following: {{content}}"
                  />
                  {userTemplate && (
                    <div className="mt-2 rounded-md bg-muted/50 p-3 text-sm">
                      <span className="text-xs text-muted-foreground font-medium">Preview: </span>
                      {highlightVariables(userTemplate)}
                    </div>
                  )}
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Input Schema (JSON)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={inputSchema}
                      onChange={(e) => setInputSchema(e.target.value)}
                      rows={6}
                      className="font-mono text-sm resize-y"
                      placeholder='{"type": "object", "properties": {...}}'
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Output Schema (JSON)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={outputSchema}
                      onChange={(e) => setOutputSchema(e.target.value)}
                      rows={6}
                      className="font-mono text-sm resize-y"
                      placeholder='{"type": "object", "properties": {...}}'
                    />
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Temperature</Label>
                      <span className="text-sm font-mono text-muted-foreground">{temperature.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[temperature]}
                      onValueChange={([v]) => setTemperature(v)}
                      min={0}
                      max={2}
                      step={0.1}
                    />
                    <p className="text-xs text-muted-foreground">Higher = more creative, Lower = more focused</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxTokens" className="text-sm">Max Tokens</Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
                      min={1}
                      max={32000}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Version Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current</span>
                    <span className="font-mono">v{latestVersion?.version || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.common.active}</span>
                    <span className="font-mono">v{activeVersion?.version || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Versions</span>
                    <span>{prompt.versions?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Test Cases</span>
                    <span>{prompt.testCases?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Runs</span>
                    <span>{prompt._count?.runs || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <div className="space-y-2">
                  <Label htmlFor="changeLog" className="text-sm">Change Log</Label>
                  <Input
                    id="changeLog"
                    placeholder="What changed in this version?"
                    value={changeLog}
                    onChange={(e) => setChangeLog(e.target.value)}
                  />
                </div>
                <Button className="w-full gap-2" onClick={handleSaveVersion} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save as New Version
                </Button>
                <Dialog open={testRunOpen} onOpenChange={setTestRunOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full gap-2">
                      <Play className="h-4 w-4" />
                      Test Run
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Test Run</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Template Variables (JSON)</Label>
                        <Textarea
                          value={testVars}
                          onChange={(e) => setTestVars(e.target.value)}
                          rows={6}
                          className="font-mono text-sm"
                          placeholder='{"key": "value"}'
                        />
                      </div>
                      <Button onClick={handleTestRun} disabled={testRunning} className="gap-2">
                        {testRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Run Prompt
                      </Button>
                      {testError && (
                        <Card className="border-destructive/50">
                          <CardContent className="p-4">
                            <p className="text-sm text-destructive">{testError}</p>
                          </CardContent>
                        </Card>
                      )}
                      {testOutput && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Output</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap">
                              {testOutput}
                            </pre>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Versions Tab */}
        <TabsContent value="versions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                    <TableHead>Change Log</TableHead>
                    <TableHead>Activated At</TableHead>
                    <TableHead>{t.common.createdAt}</TableHead>
                    <TableHead className="text-right">{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prompt.versions?.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono font-medium">v{v.version}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColorMap[v.status] || ''}>
                          {v.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                        {v.changeLog || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {v.activatedAt ? new Date(v.activatedAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {v.status === 'DRAFT' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleActivateVersion(v.id)}
                            >
                              <ArrowUpCircle className="h-3 w-3" />
                              {t.prompts.activate}
                            </Button>
                          )}
                          {v.status === 'ACTIVE' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleDeprecateVersion(v.id)}
                            >
                              <ArrowDownCircle className="h-3 w-3" />
                              {t.prompts.deactivate}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleRollback(v)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Rollback
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!prompt.versions || prompt.versions.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No versions found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Cases Tab */}
        <TabsContent value="test-cases" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Test Cases</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleRunAllTests}
                disabled={runningAllTests || !prompt.testCases?.length}
              >
                {runningAllTests ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {t.prompts.runTests}
              </Button>
              <Dialog open={tcDialogOpen} onOpenChange={setTcDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Test Case
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Test Case</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input value={tcName} onChange={(e) => setTcName(e.target.value)} placeholder="Test case name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Input Variables (JSON) *</Label>
                      <Textarea value={tcInputVars} onChange={(e) => setTcInputVars(e.target.value)} rows={4} className="font-mono text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label>Expected Output</Label>
                      <Textarea value={tcExpectedOutput} onChange={(e) => setTcExpectedOutput(e.target.value)} rows={3} className="font-mono text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label>Expected Contains (comma-separated)</Label>
                      <Input value={tcExpectedContains} onChange={(e) => setTcExpectedContains(e.target.value)} placeholder="keyword1, keyword2" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setTcDialogOpen(false)}>{t.common.cancel}</Button>
                      <Button onClick={handleCreateTestCase} disabled={tcCreating}>
                        {tcCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {t.common.create}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {prompt.testCases?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <TestTube2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h4 className="font-semibold text-foreground">No test cases yet</h4>
                <p className="text-sm text-muted-foreground mt-1">Add test cases to validate your prompt outputs</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {prompt.testCases?.map((tc, idx) => (
                <motion.div
                  key={tc.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{tc.name}</h4>
                            {testResults[tc.id] !== undefined && (
                              testResults[tc.id]
                                ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                                : <XCircle className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            Input: {tc.inputVars.length > 80 ? tc.inputVars.substring(0, 80) + '...' : tc.inputVars}
                          </p>
                          {tc.expectedContains && (
                            <p className="text-xs text-muted-foreground">
                              Must contain: {tc.expectedContains}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Run Logs Tab */}
        <TabsContent value="run-logs" className="mt-4 space-y-4">
          <h3 className="text-lg font-semibold">Run Logs</h3>
          {runsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Zap className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h4 className="font-semibold text-foreground">No run logs yet</h4>
                <p className="text-sm text-muted-foreground mt-1">Run the prompt to see execution logs here</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.common.date}</TableHead>
                        <TableHead>{t.prompts.versions}</TableHead>
                        <TableHead>Latency</TableHead>
                        <TableHead>{t.common.status}</TableHead>
                        <TableHead>Token Usage</TableHead>
                        <TableHead className="text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((run) => {
                        let tokenUsage = '-'
                        if (run.tokenUsage) {
                          try {
                            const tu = JSON.parse(run.tokenUsage)
                            tokenUsage = `${tu.total || tu.input + tu.output}`
                          } catch { /* skip */ }
                        }
                        return (
                          <TableRow key={run.id}>
                            <TableCell className="text-sm">
                              {new Date(run.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              v{run.promptVersion?.version || '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {run.latencyMs ? `${run.latencyMs}ms` : '-'}
                            </TableCell>
                            <TableCell>
                              {run.error ? (
                                <Badge variant="destructive" className="text-xs">{t.common.error}</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">{t.common.success}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{tokenUsage}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => setSelectedRun(run)}
                              >
                                <ExternalLink className="h-3 w-3" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Run Detail Dialog */}
              <Dialog open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Run Detail</DialogTitle>
                  </DialogHeader>
                  {selectedRun && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Version:</span>{' '}
                          <span className="font-mono">v{selectedRun.promptVersion?.version || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Latency:</span>{' '}
                          <span>{selectedRun.latencyMs ? `${selectedRun.latencyMs}ms` : '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Test Run:</span>{' '}
                          <span>{selectedRun.isTestRun ? t.common.yes : t.common.no}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Valid:</span>{' '}
                          <span>{selectedRun.isValid === null ? '-' : selectedRun.isValid ? t.common.yes : t.common.no}</span>
                        </div>
                      </div>
                      {selectedRun.inputVars && (
                        <div>
                          <Label className="text-sm font-medium">Input Variables</Label>
                          <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
                            {selectedRun.inputVars}
                          </pre>
                        </div>
                      )}
                      {selectedRun.error ? (
                        <div>
                          <Label className="text-sm font-medium text-destructive">Error</Label>
                          <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-destructive/10 p-3 text-xs font-mono text-destructive">
                            {selectedRun.error}
                          </pre>
                        </div>
                      ) : (
                        <div>
                          <Label className="text-sm font-medium">Output</Label>
                          <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap">
                            {selectedRun.parsedOutput || selectedRun.rawOutput || 'No output'}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
