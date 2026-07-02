'use client'

import { useState } from 'react'
import { ArrowLeft, Loader2, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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

interface FormData {
  name: string
  description: string
  objective: string
  targetUsers: string
  expectedTimeline: string
  priority: string
}

const INITIAL_FORM: FormData = {
  name: '',
  description: '',
  objective: '',
  targetUsers: '',
  expectedTimeline: '',
  priority: 'MEDIUM',
}

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
]

// ============================================================
// Component
// ============================================================

export default function PlatformRequestCreatePage() {
  const { navigate } = useAppStore()
  const { t } = useI18n()

  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const validate = (): boolean => {
    if (!form.name.trim()) {
      toast.warning('Validation Error', 'Platform name is required')
      return false
    }
    if (!form.description.trim()) {
      toast.warning('Validation Error', 'Description is required')
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setSubmitting(true)
    try {
      const data = await api.post<{
        data: {
          id: string
          requestNo: string
          name: string
        }
      }>('/api/platform-requests', {
        name: form.name.trim(),
        description: form.description.trim(),
        objective: form.objective.trim() || undefined,
        targetUsers: form.targetUsers.trim() || undefined,
        expectedTimeline: form.expectedTimeline.trim() || undefined,
        priority: form.priority,
      })

      const requestNo = data.data?.requestNo
      toast.success(
        'Request Submitted',
        requestNo
          ? `Your platform request ${requestNo} has been created successfully.`
          : 'Your platform request has been created successfully.'
      )

      navigate('platform-request-detail', { id: data.data?.id })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to submit platform request'
      toast.error('Submission Failed', message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('platform-request')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t.platformRequest.createRequest}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.platformRequest.subtitle}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Details</CardTitle>
              <CardDescription>
                Provide information about the platform you are requesting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Platform Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Platform Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Employee Self-Service Portal"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  disabled={submitting}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe the platform or program in detail"
                  rows={5}
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  disabled={submitting}
                />
              </div>

              {/* Objective / Purpose */}
              <div className="space-y-2">
                <Label htmlFor="objective">Objective / Purpose</Label>
                <Textarea
                  id="objective"
                  placeholder="What business objective does this platform serve?"
                  rows={3}
                  value={form.objective}
                  onChange={(e) => updateField('objective', e.target.value)}
                  disabled={submitting}
                />
              </div>

              {/* Target Users & Expected Timeline */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="targetUsers">Target Users</Label>
                  <Input
                    id="targetUsers"
                    placeholder="e.g., HR Department, All employees"
                    value={form.targetUsers}
                    onChange={(e) => updateField('targetUsers', e.target.value)}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expectedTimeline">Expected Timeline</Label>
                  <Input
                    id="expectedTimeline"
                    placeholder="e.g., Q3 2026, 3 months"
                    value={form.expectedTimeline}
                    onChange={(e) =>
                      updateField('expectedTimeline', e.target.value)
                    }
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => updateField('priority', v)}
                  disabled={submitting}
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
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
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? 'Submitting...' : t.common.submit + ' Request'}
              </Button>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => navigate('platform-request')}
                disabled={submitting}
              >
                <X className="h-4 w-4" />
                {t.common.cancel}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Approval Process</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                    1
                  </span>
                  <span>Division Head Approval</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                    2
                  </span>
                  <span>SD Manager Approval</span>
                </div>
                <p className="text-xs text-muted-foreground/70 pt-1">
                  Once both approvals are granted, a project will be
                  automatically created and linked to this request.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
