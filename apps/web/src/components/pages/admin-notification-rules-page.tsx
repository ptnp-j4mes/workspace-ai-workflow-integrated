'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState } from 'react'
import {
  Bell,
  RefreshCw,
  Loader2,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface NotificationRule {
  id: string
  eventKey: string
  name: string
  description: string | null
  channels: string // JSON array
  recipientStrategy: string
  isActive: boolean
}

// ============================================================
// Component
// ============================================================

export default function AdminNotificationRulesPage() {
  const { t } = useI18n()
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedRule, setSelectedRule] = useState<NotificationRule | null>(null)
  const [editChannels, setEditChannels] = useState<string[]>([])

  const fetchRules = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ data: NotificationRule[] }>('/api/admin/notification-rules')
      setRules(data.data ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notification rules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(() => fetchRules())()
  }, [])

  const handleToggleActive = async (rule: NotificationRule) => {
    try {
      await api.patch('/api/admin/notification-rules', {
        rules: [{ eventKey: rule.eventKey, isActive: !rule.isActive }],
      })
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r))
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to toggle rule')
    }
  }

  const openEditDialog = (rule: NotificationRule) => {
    setSelectedRule(rule)
    let channels: string[] = []
    try {
      channels = JSON.parse(rule.channels)
    } catch {
      channels = ['IN_APP', 'EMAIL']
    }
    setEditChannels(channels)
    setEditDialogOpen(true)
  }

  const handleSaveChannels = async () => {
    if (!selectedRule) return
    setSaving(true)
    try {
      await api.patch('/api/admin/notification-rules', {
        rules: [
          {
            eventKey: selectedRule.eventKey,
            isActive: selectedRule.isActive,
            channels: JSON.stringify(editChannels),
          },
        ],
      })
      setRules((prev) =>
        prev.map((r) =>
          r.id === selectedRule.id
            ? { ...r, channels: JSON.stringify(editChannels) }
            : r
        )
      )
      setEditDialogOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update channels')
    } finally {
      setSaving(false)
    }
  }

  const parseChannels = (channelsStr: string): string[] => {
    try {
      return JSON.parse(channelsStr)
    } catch {
      return []
    }
  }

  const CHANNEL_COLORS: Record<string, string> = {
    IN_APP: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    EMAIL: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
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
        <Button variant="outline" onClick={fetchRules} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-900/40">
          <Bell className="h-5 w-5 text-pink-600 dark:text-pink-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.admin.notificationRules}</h1>
          <p className="text-sm text-muted-foreground">{rules.length} rules configured</p>
        </div>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event Key</TableHead>
              <TableHead>{t.common.name}</TableHead>
              <TableHead className="hidden md:table-cell">Channels</TableHead>
              <TableHead className="hidden md:table-cell">Strategy</TableHead>
              <TableHead>{t.common.status}</TableHead>
              <TableHead className="w-[120px]">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  {t.common.noData}
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => {
                const channels = parseChannels(rule.channels)
                return (
                  <TableRow key={rule.id}>
                    <TableCell className="font-mono text-xs">{rule.eventKey}</TableCell>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex gap-1">
                        {channels.map((ch) => (
                          <Badge
                            key={ch}
                            variant="outline"
                            className={`text-[10px] ${CHANNEL_COLORS[ch] || ''}`}
                          >
                            {ch}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {rule.recipientStrategy}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          rule.isActive
                            ? 'text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'text-[10px] bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                        }
                      >
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => handleToggleActive(rule)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => openEditDialog(rule)}
                        >
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Channels Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.common.edit}</DialogTitle>
            <DialogDescription>
              Configure channels for &quot;{selectedRule?.name}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>{t.common.type}</Label>
              <div className="space-y-2">
                {['IN_APP', 'EMAIL'].map((channel) => (
                  <label key={channel} className="flex items-center gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/50">
                    <Checkbox
                      checked={editChannels.includes(channel)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEditChannels((prev) => [...prev, channel])
                        } else {
                          setEditChannels((prev) => prev.filter((c) => c !== channel))
                        }
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium">{channel === 'IN_APP' ? 'In-App' : 'Email'}</p>
                      <p className="text-xs text-muted-foreground">
                        {channel === 'IN_APP'
                          ? 'Show notification in the application'
                          : 'Send notification via email'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSaveChannels} disabled={saving || editChannels.length === 0}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
