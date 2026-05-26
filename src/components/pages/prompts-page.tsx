'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  FileCode2,
  Clock,
  Loader2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
  temperature: number
  maxTokens: number
  changeLog: string | null
  createdAt: string
  activatedAt: string | null
}

interface AiPrompt {
  id: string
  promptKey: string
  title: string
  description: string | null
  category: string
  status: string
  updatedAt: string
  versions: PromptVersion[]
  _count: {
    versions: number
    testCases: number
    runs: number
  }
}

const CATEGORIES = ['ALL', 'MEETING', 'INTAKE', 'WORKFLOW', 'UAT', 'BUG', 'CHANGE', 'HANDOFF', 'DASHBOARD', 'NOTIFICATION']
const STATUSES = ['ALL', 'DRAFT', 'ACTIVE', 'DEPRECATED']

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

const statusColorMap: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  DEPRECATED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

// ============================================================
// Component
// ============================================================

export default function PromptsPage() {
  const navigate = useAppStore((s) => s.navigate)
  const { t } = useI18n()

  const [prompts, setPrompts] = useState<AiPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
  const [formKey, setFormKey] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState('MEETING')
  const [formSystemPrompt, setFormSystemPrompt] = useState('')
  const [formUserTemplate, setFormUserTemplate] = useState('')

  const fetchPrompts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter)
      const query = params.toString() ? `?${params.toString()}` : ''
      const data = await api.get<{ prompts: AiPrompt[] }>(`/api/ai/prompts${query}`)
      setPrompts(data.prompts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompts')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  const filteredPrompts = prompts.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        p.title.toLowerCase().includes(q) ||
        p.promptKey.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleCreate = async () => {
    if (!formKey || !formTitle || !formCategory) {
      toast.warning('Validation Error', 'Key, title, and category are required.')
      return
    }
    setCreating(true)
    try {
      await api.post('/api/ai/prompts', {
        promptKey: formKey,
        title: formTitle,
        description: formDescription,
        category: formCategory,
        systemPrompt: formSystemPrompt,
        userPromptTemplate: formUserTemplate,
      })
      toast.success('Prompt created', 'New prompt has been created successfully.')
      setDialogOpen(false)
      setFormKey('')
      setFormTitle('')
      setFormDescription('')
      setFormCategory('MEETING')
      setFormSystemPrompt('')
      setFormUserTemplate('')
      fetchPrompts()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to create prompt')
    } finally {
      setCreating(false)
    }
  }

  const getActiveVersion = (prompt: AiPrompt) => {
    return prompt.versions?.find((v) => v.status === 'ACTIVE')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.prompts.title}</h1>
            <p className="text-sm text-muted-foreground">{t.prompts.subtitle}</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t.prompts.createPrompt}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t.prompts.createPrompt}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="promptKey">Prompt Key *</Label>
                  <Input
                    id="promptKey"
                    placeholder="e.g. meeting.summarize"
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promptTitle">Title *</Label>
                  <Input
                    id="promptTitle"
                    placeholder="e.g. Meeting Summarizer"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="promptDesc">Description</Label>
                <Input
                  id="promptDesc"
                  placeholder="Brief description of this prompt"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.filter((c) => c !== 'ALL').map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  placeholder="You are a helpful assistant..."
                  value={formSystemPrompt}
                  onChange={(e) => setFormSystemPrompt(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userTemplate">User Prompt Template</Label>
                <Textarea
                  id="userTemplate"
                  placeholder="Summarize the following meeting: {{transcript}}"
                  value={formUserTemplate}
                  onChange={(e) => setFormUserTemplate(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t.common.cancel}
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t.prompts.createPrompt}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">{t.common.filter}:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategoryFilter(cat)}
                  className="h-7 text-xs"
                >
                  {cat}
                </Button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search prompts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-48 pl-8 text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-32 text-sm">
                  <SelectValue placeholder={t.common.status} />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === 'ALL' ? t.common.all : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card className="border-destructive/50">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={fetchPrompts} className="mt-3">
              {t.common.retry}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && filteredPrompts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <FileCode2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{t.prompts.noPrompts}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Try adjusting your filters or search query'
              : 'Create your first AI prompt to get started'}
          </p>
          {!searchQuery && categoryFilter === 'ALL' && statusFilter === 'ALL' && (
            <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              {t.prompts.createPrompt}
            </Button>
          )}
        </motion.div>
      )}

      {/* Prompt Grid */}
      {!loading && !error && filteredPrompts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPrompts.map((prompt, index) => {
            const activeVer = getActiveVersion(prompt)
            return (
              <motion.div
                key={prompt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
              >
                <Card
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => navigate('prompt-detail', { id: prompt.id })}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold line-clamp-1">
                        {prompt.title}
                      </CardTitle>
                    </div>
                    <CardDescription className="font-mono text-xs">
                      {prompt.promptKey}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className={categoryColorMap[prompt.category] || ''}>
                        {prompt.category}
                      </Badge>
                      <Badge variant="secondary" className={statusColorMap[prompt.status] || ''}>
                        {prompt.status}
                      </Badge>
                    </div>
                    {prompt.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {prompt.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FileCode2 className="h-3 w-3" />
                        <span>v{activeVer?.version || prompt.versions?.[0]?.version || '-'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(prompt.updatedAt).toLocaleDateString()}</span>
                      </div>
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
