'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState } from 'react'
import {
  CheckCircle,
  Plus,
  RefreshCw,
  Loader2,
  Pencil,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface ApprovalStep {
  id: string
  stepOrder: number
  stepName: string
  approverRole: string | null
  approverUserId: string | null
  requiredAction: string
  isRequired: boolean
  slaHours: number | null
}

interface RoleOption {
  id: string
  key: string
  name: string
}

interface ApprovalWorkflow {
  id: string
  workflowKey: string
  entityType: string
  name: string
  description: string | null
  isActive: boolean
  steps: ApprovalStep[]
}

// ============================================================
// Component
// ============================================================

export default function AdminApprovalWorkflowsPage() {
  const { t } = useI18n()
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<ApprovalWorkflow | null>(null)
  const [saving, setSaving] = useState(false)
  const [roles, setRoles] = useState<RoleOption[]>([])

  // Form
  const [formKey, setFormKey] = useState('')
  const [formName, setFormName] = useState('')
  const [formEntityType, setFormEntityType] = useState('REQUEST')
  const [formDescription, setFormDescription] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [formSteps, setFormSteps] = useState<Array<{
    stepOrder: number
    stepName: string
    approverRole: string
    requiredAction: string
    isRequired: boolean
    slaHours: string
  }>>([])

  const fetchWorkflows = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ data: ApprovalWorkflow[] }>('/api/admin/approval-workflows')
      setWorkflows(data.data ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const data = await api.get<{ data: Array<{ id: string; key: string; name: string }> }>('/api/admin/roles')
      setRoles(data.data ?? [])
    } catch {
      // silent - roles dropdown will be empty
    }
  }

  useEffect(() => {
    fetchWorkflows()
    fetchRoles()
  }, [])

  const openAddDialog = () => {
    setEditMode(false)
    setSelectedWorkflow(null)
    setFormKey('')
    setFormName('')
    setFormEntityType('REQUEST')
    setFormDescription('')
    setFormIsActive(true)
    setFormSteps([
      { stepOrder: 1, stepName: '', approverRole: '', requiredAction: 'APPROVE', isRequired: true, slaHours: '' },
    ])
    setDialogOpen(true)
  }

  const openEditDialog = (wf: ApprovalWorkflow) => {
    setEditMode(true)
    setSelectedWorkflow(wf)
    setFormKey(wf.workflowKey)
    setFormName(wf.name)
    setFormEntityType(wf.entityType)
    setFormDescription(wf.description ?? '')
    setFormIsActive(wf.isActive)
    setFormSteps(
      wf.steps.map((s) => ({
        stepOrder: s.stepOrder,
        stepName: s.stepName,
        approverRole: s.approverRole ?? '',
        requiredAction: s.requiredAction,
        isRequired: s.isRequired,
        slaHours: s.slaHours?.toString() ?? '',
      }))
    )
    setDialogOpen(true)
  }

  const addStep = () => {
    setFormSteps((prev) => [
      ...prev,
      {
        stepOrder: prev.length + 1,
        stepName: '',
        approverRole: '',
        requiredAction: 'APPROVE',
        isRequired: true,
        slaHours: '',
      },
    ])
  }

  const removeStep = (index: number) => {
    setFormSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepOrder: i + 1 })))
  }

  const updateStep = (index: number, field: string, value: unknown) => {
    setFormSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    )
  }

  const handleSave = async () => {
    if (!formKey || !formName) return
    setSaving(true)
    try {
      const payload = {
        workflowKey: formKey,
        name: formName,
        entityType: formEntityType,
        description: formDescription || null,
        isActive: formIsActive,
        steps: formSteps.map((s) => ({
          stepOrder: s.stepOrder,
          stepName: s.stepName,
          approverRole: s.approverRole || null,
          requiredAction: s.requiredAction,
          isRequired: s.isRequired,
          slaHours: s.slaHours ? parseInt(s.slaHours) : null,
        })),
      }

      if (editMode && selectedWorkflow) {
        await api.patch(`/api/admin/approval-workflows/${selectedWorkflow.id}`, payload)
      } else {
        await api.post('/api/admin/approval-workflows', payload)
      }
      setDialogOpen(false)
      fetchWorkflows()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow')
    } finally {
      setSaving(false)
    }
  }

  const ENTITY_TYPE_COLORS: Record<string, string> = {
    REQUEST: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    PROJECT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    CHANGE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    UAT_SIGNOFF: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-48" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchWorkflows} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
            <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.admin.approvalWorkflows}</h1>
            <p className="text-sm text-muted-foreground">{workflows.length} workflows</p>
          </div>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="h-4 w-4" /> {t.common.create}
        </Button>
      </div>

      {/* Workflow List */}
      {workflows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t.common.noData}
          </CardContent>
        </Card>
      ) : (
        workflows.map((wf) => {
          const isExpanded = expandedId === wf.id
          return (
            <Card key={wf.id}>
              <CardHeader
                className="cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : wf.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <CardTitle className="text-base">{wf.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Key: {wf.workflowKey} · {wf.steps.length} step{wf.steps.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${ENTITY_TYPE_COLORS[wf.entityType] || ''}`}
                    >
                      {wf.entityType}
                    </Badge>
                    {wf.isActive ? (
                      <Badge className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">{t.common.inactive}</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditDialog(wf)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {isExpanded && wf.steps.length > 0 && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {wf.steps
                      .sort((a, b) => a.stepOrder - b.stepOrder)
                      .map((step, idx) => (
                        <div
                          key={step.id}
                          className="flex items-start gap-3 rounded-lg border p-3"
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {step.stepOrder}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{step.stepName}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {step.approverRole && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Role: {roles.find(r => r.key === step.approverRole)?.name ?? step.approverRole}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px]">
                                {step.requiredAction}
                              </Badge>
                              {step.slaHours && (
                                <Badge variant="outline" className="text-[10px]">
                                  SLA: {step.slaHours}h
                                </Badge>
                              )}
                              {step.isRequired && (
                                <Badge variant="outline" className="text-[10px]">Required</Badge>
                              )}
                            </div>
                          </div>
                          {idx < wf.steps.length - 1 && (
                            <div className="hidden sm:flex items-center text-muted-foreground">
                              →
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                  {wf.description && (
                    <p className="mt-3 text-sm text-muted-foreground">{wf.description}</p>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })
      )}

      {/* Create/{t.common.edit} Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode ? '{t.common.edit}' : '{t.common.create}'}</DialogTitle>
            <DialogDescription>
              {editMode ? '{t.common.edit}' : '{t.common.create}'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Workflow Key *</Label>
              <Input
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                placeholder="e.g. request_approval"
                disabled={editMode}
              />
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Workflow name" />
            </div>
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select value={formEntityType} onValueChange={setFormEntityType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REQUEST">Request</SelectItem>
                  <SelectItem value="PROJECT">Project</SelectItem>
                  <SelectItem value="CHANGE">Change</SelectItem>
                  <SelectItem value="UAT_SIGNOFF">UAT Signoff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.common.description}</Label>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Optional description" />
            </div>
            <label className="flex items-center gap-2">
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
              <span className="text-sm">{t.common.active}</span>
            </label>

            {/* Steps */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Steps</Label>
                <Button variant="outline" size="sm" onClick={addStep} className="gap-1">
                  <Plus className="h-3 w-3" /> Add Step
                </Button>
              </div>
              {formSteps.map((step, idx) => (
                <div key={idx} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Step {idx + 1}</span>
                    </div>
                    {formSteps.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeStep(idx)}>
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Step Name *</Label>
                      <Input
                        value={step.stepName}
                        onChange={(e) => updateStep(idx, 'stepName', e.target.value)}
                        placeholder="Step name"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Approver Role</Label>
                      <Select
                        value={step.approverRole || '__none__'}
                        onValueChange={(v) => updateStep(idx, 'approverRole', v === '__none__' ? '' : v)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {roles.map((role) => (
                            <SelectItem key={role.key} value={role.key}>
                              {role.name} ({role.key})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Action</Label>
                      <Select
                        value={step.requiredAction}
                        onValueChange={(v) => updateStep(idx, 'requiredAction', v)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="APPROVE">Approve</SelectItem>
                          <SelectItem value="REVIEW">Review</SelectItem>
                          <SelectItem value="SIGNOFF">Signoff</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">SLA Hours</Label>
                      <Input
                        value={step.slaHours}
                        onChange={(e) => updateStep(idx, 'slaHours', e.target.value)}
                        placeholder="Optional"
                        type="number"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving || !formKey || !formName}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editMode ? 'Save Changes' : '{t.common.create}'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
