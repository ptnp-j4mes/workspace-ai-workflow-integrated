'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState } from 'react'
import {
  FileText,
  Plus,
  RefreshCw,
  Loader2,
  Pencil,
  Eye,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface EmailTemplate {
  id: string
  templateKey: string
  name: string
  subjectTemplate: string
  bodyHtmlTemplate: string
  bodyTextTemplate: string | null
  variablesJson: string | null
  isActive: boolean
}

// ============================================================
// Component
// ============================================================

export default function AdminEmailTemplatesPage() {
  const { t } = useI18n()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [saving, setSaving] = useState(false)

  // Form
  const [formKey, setFormKey] = useState('')
  const [formName, setFormName] = useState('')
  const [formSubject, setFormSubject] = useState('')
  const [formBodyHtml, setFormBodyHtml] = useState('')
  const [formBodyText, setFormBodyText] = useState('')
  const [formVariables, setFormVariables] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)

  // Preview
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSubject, setPreviewSubject] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  const fetchTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ data: EmailTemplate[] }>('/api/admin/email-templates')
      setTemplates(data.data ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load email templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(() => fetchTemplates())()
  }, [])

  const openAddDialog = () => {
    setEditMode(false)
    setSelectedTemplate(null)
    setFormKey('')
    setFormName('')
    setFormSubject('')
    setFormBodyHtml('')
    setFormBodyText('')
    setFormVariables('')
    setFormIsActive(true)
    setDialogOpen(true)
  }

  const openEditDialog = (tpl: EmailTemplate) => {
    setEditMode(true)
    setSelectedTemplate(tpl)
    setFormKey(tpl.templateKey)
    setFormName(tpl.name)
    setFormSubject(tpl.subjectTemplate)
    setFormBodyHtml(tpl.bodyHtmlTemplate)
    setFormBodyText(tpl.bodyTextTemplate ?? '')
    setFormVariables(tpl.variablesJson ?? '')
    setFormIsActive(tpl.isActive)
    setDialogOpen(true)
  }

  const openPreviewDialog = async (tpl: EmailTemplate) => {
    setSelectedTemplate(tpl)
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewHtml('')
    setPreviewSubject('')
    try {
      // Parse variables and create sample data
      let vars: Record<string, string> = {}
      try {
        const parsed = JSON.parse(tpl.variablesJson ?? '[]')
        if (Array.isArray(parsed)) {
          parsed.forEach((v: string) => { vars[v] = `sample_${v}` })
        } else if (typeof parsed === 'object') {
          vars = parsed
        }
      } catch {
        // Use empty vars
      }
      const result = await api.post<{ data: { subject: string; bodyHtml: string; bodyText: string } }>(
        `/api/admin/email-templates/${tpl.id}/preview`,
        { variables: vars }
      )
      setPreviewSubject(result.data.subject)
      setPreviewHtml(result.data.bodyHtml)
    } catch {
      setPreviewSubject(tpl.subjectTemplate)
      setPreviewHtml(tpl.bodyHtmlTemplate)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formKey || !formName || !formSubject || !formBodyHtml) return
    setSaving(true)
    try {
      if (editMode && selectedTemplate) {
        await api.patch(`/api/admin/email-templates/${selectedTemplate.id}`, {
          name: formName,
          subjectTemplate: formSubject,
          bodyHtmlTemplate: formBodyHtml,
          bodyTextTemplate: formBodyText || null,
          variablesJson: formVariables || null,
          isActive: formIsActive,
        })
      } else {
        await api.post('/api/admin/email-templates', {
          templateKey: formKey,
          name: formName,
          subjectTemplate: formSubject,
          bodyHtmlTemplate: formBodyHtml,
          bodyTextTemplate: formBodyText || null,
          variablesJson: formVariables || null,
          isActive: formIsActive,
        })
      }
      setDialogOpen(false)
      fetchTemplates()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Card className="p-4">
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
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
        <Button variant="outline" onClick={fetchTemplates} className="gap-2">
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40">
            <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.admin.emailTemplates}</h1>
            <p className="text-sm text-muted-foreground">{templates.length} template(s)</p>
          </div>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="h-4 w-4" /> {t.common.create}
        </Button>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>{t.common.name}</TableHead>
              <TableHead className="hidden md:table-cell">Subject</TableHead>
              <TableHead>{t.common.status}</TableHead>
              <TableHead className="w-[120px]">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  {t.common.noData}
                </TableCell>
              </TableRow>
            ) : (
              templates.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell className="font-mono text-xs">{tpl.templateKey}</TableCell>
                  <TableCell className="font-medium">{tpl.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[300px] truncate">
                    {tpl.subjectTemplate}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        tpl.isActive
                          ? 'text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'text-[10px] bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                      }
                    >
                      {tpl.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openPreviewDialog(tpl)}
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(tpl)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.common.viewDetails}</DialogTitle>
            <DialogDescription>{selectedTemplate?.name}</DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <p className="text-sm font-medium mt-1">{previewSubject}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">HTML Body</Label>
                <div
                  className="mt-1 rounded-lg border p-4 text-sm prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode ? '{t.common.edit}' : '{t.common.create}'}</DialogTitle>
            <DialogDescription>
              {editMode ? '{t.common.edit}' : '{t.common.create}'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Template Key *</Label>
                <Input value={formKey} onChange={(e) => setFormKey(e.target.value)} placeholder="e.g. request_submitted" disabled={editMode} />
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Template name" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subject Template *</Label>
              <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="e.g. New Request: {{title}}" />
            </div>
            <div className="space-y-2">
              <Label>HTML Body *</Label>
              <Textarea value={formBodyHtml} onChange={(e) => setFormBodyHtml(e.target.value)} rows={8} placeholder="<h1>Hello {{name}}</h1>..." />
            </div>
            <div className="space-y-2">
              <Label>Text Body</Label>
              <Textarea value={formBodyText} onChange={(e) => setFormBodyText(e.target.value)} rows={4} placeholder="Plain text version (optional)" />
            </div>
            <div className="space-y-2">
              <Label>Variables (JSON)</Label>
              <Textarea value={formVariables} onChange={(e) => setFormVariables(e.target.value)} rows={3} placeholder='["title", "name", "aitNo"]' />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={formIsActive} onChange={(e) => setFormIsActive(e.target.checked)} className="rounded" />
              <span className="text-sm">{t.common.active}</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving || !formKey || !formName || !formSubject || !formBodyHtml}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editMode ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
