'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Sparkles, Save, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useAppStore } from '@/store/app-store'
import { api } from '@/lib/api-client'
import { useI18n } from '@/i18n'

// ============================================================
// Types
// ============================================================

interface Project {
  id: string
  name: string
  code: string
}

interface FormData {
  title: string
  description: string
  type: string
  priority: string
  projectId: string
  affectedSystem: string
  businessImpact: string
  acceptanceCriteria: string
  dueDate: string
}

const INITIAL_FORM: FormData = {
  title: '',
  description: '',
  type: 'FEATURE',
  priority: 'MEDIUM',
  projectId: '',
  affectedSystem: '',
  businessImpact: '',
  acceptanceCriteria: '',
  dueDate: '',
}

const TYPE_OPTIONS = [
  { value: 'FEATURE', label: 'Feature' },
  { value: 'BUG', label: 'Bug' },
  { value: 'CHANGE', label: 'Change' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'QUESTION', label: 'Question' },
  { value: 'INCIDENT', label: 'Incident' },
]

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

// ============================================================
// Component
// ============================================================

export default function RequestCreatePage() {
  const { navigate, viewParams } = useAppStore()
  const { t } = useI18n()

  const [form, setForm] = useState<FormData>(() => {
    // Pre-populate from viewParams if coming from AI Intake
    if (viewParams?.draft) {
      try {
        return { ...INITIAL_FORM, ...JSON.parse(viewParams.draft) }
      } catch {
        return INITIAL_FORM
      }
    }
    return INITIAL_FORM
  })
  const [projects, setProjects] = useState<Project[]>([])
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await api.get<{ projects: Project[] }>('/api/projects')
        setProjects(data.projects || [])
      } catch {
        // Silently handle
      }
    }
    fetchProjects()
  }, [])

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleAiAssist = async () => {
    if (!form.title && !form.description) {
      toast.error(t.common.error)
      return
    }

    setAiLoading(true)
    try {
      const message = [form.title, form.description].filter(Boolean).join('\n\n')
      const data = await api.post<{
        draft: {
          title?: string
          description?: string
          priority?: string
          affectedSystem?: string
          businessImpact?: string
          acceptanceCriteria?: string[]
          missingFields?: string[]
        }
      }>('/api/ai/request-intake/generate-draft', { message })

      const draft = data.draft
      if (draft) {
        setForm((prev) => ({
          ...prev,
          title: draft.title || prev.title,
          description: draft.description || prev.description,
          priority: draft.priority || prev.priority,
          affectedSystem: draft.affectedSystem || prev.affectedSystem,
          businessImpact: draft.businessImpact || prev.businessImpact,
          acceptanceCriteria: Array.isArray(draft.acceptanceCriteria)
            ? draft.acceptanceCriteria.join('\n')
            : prev.acceptanceCriteria,
        }))
        toast.success(t.common.success)
      }
    } catch (err) {
      toast.error(t.common.error)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!form.title.trim()) {
      toast.error(t.common.error)
      return
    }
    if (!form.description.trim()) {
      toast.error(t.common.error)
      return
    }

    setSaving(true)
    try {
      await api.post('/api/requests', {
        ...form,
        projectId: form.projectId || null,
        dueDate: form.dueDate || null,
      })
      toast.success(t.common.success)
      navigate('requests')
    } catch {
      toast.error(t.common.error)
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error(t.common.error)
      return
    }
    if (!form.description.trim()) {
      toast.error(t.common.error)
      return
    }

    setSubmitting(true)
    try {
      // Create the request first
      const data = await api.post<{ request: { id: string } }>('/api/requests', {
        ...form,
        projectId: form.projectId || null,
        dueDate: form.dueDate || null,
      })
      // Then submit it
      await api.post(`/api/requests/${data.request.id}/submit`)
      toast.success(t.common.success)
      navigate('requests')
    } catch {
      toast.error(t.common.error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('requests')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.requests.createRequest}</h1>
          <p className="text-sm text-muted-foreground">{t.requests.submitRequest}</p>
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.requests.requestDetail}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  {t.common.name} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder={`${t.common.name}...`}
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  {t.common.description} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder={`${t.common.description}...`}
                  rows={5}
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                />
              </div>

              {/* Type & Priority */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.common.type}</Label>
                  <Select value={form.type} onValueChange={(v) => updateField('type', v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t.common.priority}</Label>
                  <Select value={form.priority} onValueChange={(v) => updateField('priority', v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Project */}
              <div className="space-y-2">
                <Label>{t.projects.title}</Label>
                <Select value={form.projectId} onValueChange={(v) => updateField('projectId', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={`${t.projects.title}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Affected System */}
              <div className="space-y-2">
                <Label htmlFor="affectedSystem">Affected System</Label>
                <Input
                  id="affectedSystem"
                  placeholder="e.g., ERP, CRM, Portal"
                  value={form.affectedSystem}
                  onChange={(e) => updateField('affectedSystem', e.target.value)}
                />
              </div>

              {/* Business Impact */}
              <div className="space-y-2">
                <Label htmlFor="businessImpact">Business Impact</Label>
                <Textarea
                  id="businessImpact"
                  placeholder="Describe the business impact"
                  rows={3}
                  value={form.businessImpact}
                  onChange={(e) => updateField('businessImpact', e.target.value)}
                />
              </div>

              {/* Acceptance Criteria */}
              <div className="space-y-2">
                <Label htmlFor="acceptanceCriteria">Acceptance Criteria</Label>
                <Textarea
                  id="acceptanceCriteria"
                  placeholder="Define acceptance criteria (one per line)"
                  rows={4}
                  value={form.acceptanceCriteria}
                  onChange={(e) => updateField('acceptanceCriteria', e.target.value)}
                />
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label htmlFor="dueDate">{t.common.dueDate}</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => updateField('dueDate', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.common.actions}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full gap-2"
                onClick={handleSubmit}
                disabled={submitting || saving}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? 'Submitting...' : t.common.submit}
              </Button>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleSaveDraft}
                disabled={saving || submitting}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? 'Saving...' : t.common.save}
              </Button>

              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={handleAiAssist}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {aiLoading ? 'AI Processing...' : 'AI Assist'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AI Assist</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Click the <strong>AI Assist</strong> button to let AI analyze your title and
                description and auto-fill priority, affected system, business impact, and
                acceptance criteria.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
