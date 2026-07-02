'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState } from 'react'
import {
  Mail,
  Plus,
  RefreshCw,
  Loader2,
  Pencil,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

interface SmtpSetting {
  id: string
  name: string
  host: string
  port: number
  secure: boolean
  username: string
  passwordEncrypted: string
  fromEmail: string
  fromName: string | null
  isDefault: boolean
  isActive: boolean
  createdAt: string
}

// ============================================================
// Component
// ============================================================

export default function AdminSmtpPage() {
  const { t } = useI18n()
  const [settings, setSettings] = useState<SmtpSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedSmtp, setSelectedSmtp] = useState<SmtpSetting | null>(null)
  const [saving, setSaving] = useState(false)

  // Test connection state
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  // Form
  const [formName, setFormName] = useState('')
  const [formHost, setFormHost] = useState('')
  const [formPort, setFormPort] = useState('587')
  const [formSecure, setFormSecure] = useState(false)
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formFromEmail, setFormFromEmail] = useState('')
  const [formFromName, setFormFromName] = useState('')
  const [formIsDefault, setFormIsDefault] = useState(false)
  const [formIsActive, setFormIsActive] = useState(true)

  const fetchSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ data: SmtpSetting[] }>('/api/admin/smtp')
      setSettings(data.data ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load SMTP settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(() => fetchSettings())()
  }, [])

  const openAddDialog = () => {
    setEditMode(false)
    setSelectedSmtp(null)
    setFormName('')
    setFormHost('')
    setFormPort('587')
    setFormSecure(false)
    setFormUsername('')
    setFormPassword('')
    setFormFromEmail('')
    setFormFromName('')
    setFormIsDefault(false)
    setFormIsActive(true)
    setDialogOpen(true)
  }

  const openEditDialog = (smtp: SmtpSetting) => {
    setEditMode(true)
    setSelectedSmtp(smtp)
    setFormName(smtp.name)
    setFormHost(smtp.host)
    setFormPort(smtp.port.toString())
    setFormSecure(smtp.secure)
    setFormUsername(smtp.username)
    setFormPassword('')
    setFormFromEmail(smtp.fromEmail)
    setFormFromName(smtp.fromName ?? '')
    setFormIsDefault(smtp.isDefault)
    setFormIsActive(smtp.isActive)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName || !formHost || !formUsername || !formFromEmail) return
    setSaving(true)
    try {
      if (editMode && selectedSmtp) {
        const payload: Record<string, unknown> = {
          name: formName,
          host: formHost,
          port: parseInt(formPort) || 587,
          secure: formSecure,
          username: formUsername,
          fromEmail: formFromEmail,
          fromName: formFromName || null,
          isDefault: formIsDefault,
          isActive: formIsActive,
        }
        if (formPassword) payload.passwordEncrypted = formPassword
        await api.patch(`/api/admin/smtp/${selectedSmtp.id}`, payload)
      } else {
        await api.post('/api/admin/smtp', {
          name: formName,
          host: formHost,
          port: parseInt(formPort) || 587,
          secure: formSecure,
          username: formUsername,
          passwordEncrypted: formPassword,
          fromEmail: formFromEmail,
          fromName: formFromName || null,
          isDefault: formIsDefault,
          isActive: formIsActive,
        })
      }
      setDialogOpen(false)
      fetchSettings()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save SMTP setting')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async (smtp: SmtpSetting) => {
    setTestingId(smtp.id)
    setTestResult(null)
    try {
      const result = await api.post<{ data: { success: boolean; message: string } }>(
        `/api/admin/smtp/${smtp.id}/test`
      )
      setTestResult({ id: smtp.id, success: result.data.success, message: result.data.message })
    } catch (err: unknown) {
      setTestResult({
        id: smtp.id,
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      })
    } finally {
      setTestingId(null)
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
        <Button variant="outline" onClick={fetchSettings} className="gap-2">
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/40">
            <Mail className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.admin.smtp}</h1>
            <p className="text-sm text-muted-foreground">{settings.length} configuration(s)</p>
          </div>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="h-4 w-4" /> {t.common.create}
        </Button>
      </div>

      {/* Test Result Banner */}
      {testResult && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 ${
            testResult.success
              ? 'border-green-500/50 bg-green-50 dark:bg-green-900/20'
              : 'border-red-500/50 bg-red-50 dark:bg-red-900/20'
          }`}
        >
          {testResult.success ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <p className="text-sm flex-1">{testResult.message}</p>
          <Button variant="ghost" size="sm" onClick={() => setTestResult(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.name}</TableHead>
              <TableHead>Host</TableHead>
              <TableHead className="hidden md:table-cell">Port</TableHead>
              <TableHead className="hidden md:table-cell">Username</TableHead>
              <TableHead>{t.common.name}</TableHead>
              <TableHead>{t.common.status}</TableHead>
              <TableHead className="w-[160px]">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  {t.common.noData}
                </TableCell>
              </TableRow>
            ) : (
              settings.map((smtp) => (
                <TableRow key={smtp.id}>
                  <TableCell className="font-medium">
                    {smtp.name}
                    {smtp.isDefault && (
                      <Badge variant="outline" className="ml-2 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        Default
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-mono">{smtp.host}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{smtp.port}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{smtp.username}</TableCell>
                  <TableCell className="text-sm">{smtp.fromEmail}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        smtp.isActive
                          ? 'text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'text-[10px] bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                      }
                    >
                      {smtp.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => handleTestConnection(smtp)}
                        disabled={testingId === smtp.id}
                      >
                        {testingId === smtp.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle className="h-3 w-3" />
                        )}
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(smtp)}
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editMode ? '{t.common.edit}' : '{t.common.create}'}</DialogTitle>
            <DialogDescription>
              {editMode ? '{t.common.edit}' : '{t.common.create}'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Configuration name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Host *</Label>
                <Input value={formHost} onChange={(e) => setFormHost(e.target.value)} placeholder="smtp.example.com" />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input value={formPort} onChange={(e) => setFormPort(e.target.value)} type="number" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Username *</Label>
              <Input value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="SMTP username" />
            </div>
            <div className="space-y-2">
              <Label>Password {editMode ? '(leave empty to keep current)' : '*'}</Label>
              <Input value={formPassword} onChange={(e) => setFormPassword(e.target.value)} type="password" placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label>From Email *</Label>
              <Input value={formFromEmail} onChange={(e) => setFormFromEmail(e.target.value)} placeholder="noreply@example.com" type="email" />
            </div>
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input value={formFromName} onChange={(e) => setFormFromName(e.target.value)} placeholder="System Notification" />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <Switch checked={formSecure} onCheckedChange={setFormSecure} />
                <span className="text-sm">Use TLS</span>
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={formIsDefault} onCheckedChange={setFormIsDefault} />
                <span className="text-sm">{t.common.all}</span>
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
                <span className="text-sm">{t.common.active}</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving || !formName || !formHost || !formUsername || !formFromEmail}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editMode ? 'Save Changes' : '{t.common.create}'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
