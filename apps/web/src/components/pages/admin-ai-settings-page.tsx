'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState } from 'react'
import {
  Activity,
  RefreshCw,
  Loader2,
  Pencil,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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

interface AiProviderConfig {
  id: string
  provider: string
  name: string
  apiKeyEnc: string | null
  baseUrl: string | null
  models: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ============================================================
// Component
// ============================================================

export default function AdminAiSettingsPage() {
  const { t } = useI18n()
  const [configs, setConfigs] = useState<AiProviderConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<AiProviderConfig | null>(null)
  const [saving, setSaving] = useState(false)

  // Form
  const [formName, setFormName] = useState('')
  const [formApiKey, setFormApiKey] = useState('')
  const [formBaseUrl, setFormBaseUrl] = useState('')
  const [formModels, setFormModels] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)

  const fetchConfigs = async () => {
    setLoading(true)
    setError(null)
    try {
      // Use system settings to get AI provider config
      const data = await api.get<{ data: AiProviderConfig[] }>('/api/admin/ai-settings')
      setConfigs(data.data ?? [])
    } catch {
      // Fallback: try reading from general system settings
      try {
        const settingsData = await api.get<{ data: Array<{ key: string; value: string; category: string }> }>(
          '/api/admin/system-settings?category=AI'
        )
        const aiSettings = (settingsData.data ?? []).filter((s) => s.category === 'AI')
        if (aiSettings.length > 0) {
          setConfigs([
            {
              id: 'ai-default',
              provider: 'default',
              name: aiSettings.find((s) => s.key === 'AI_PROVIDER_NAME')?.value || 'Default AI Provider',
              apiKeyEnc: aiSettings.find((s) => s.key === 'AI_API_KEY')?.value || null,
              baseUrl: aiSettings.find((s) => s.key === 'AI_BASE_URL')?.value || null,
              models: aiSettings.find((s) => s.key === 'AI_MODELS')?.value || null,
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ])
        } else {
          setConfigs([])
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load AI settings')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(() => fetchConfigs())()
  }, [])

  const openEditDialog = (config: AiProviderConfig) => {
    setSelectedConfig(config)
    setFormName(config.name)
    setFormApiKey('')
    setFormBaseUrl(config.baseUrl ?? '')
    setFormModels(config.models ?? '')
    setFormIsActive(config.isActive)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!selectedConfig) return
    setSaving(true)
    try {
      // Update via system settings
      const settings: Array<{ key: string; value: string }> = []
      if (formName) settings.push({ key: 'AI_PROVIDER_NAME', value: formName })
      if (formApiKey) settings.push({ key: 'AI_API_KEY', value: formApiKey })
      if (formBaseUrl) settings.push({ key: 'AI_BASE_URL', value: formBaseUrl })
      if (formModels) settings.push({ key: 'AI_MODELS', value: formModels })

      if (settings.length > 0) {
        await api.patch('/api/admin/system-settings', { settings })
      }

      setDialogOpen(false)
      fetchConfigs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save AI settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchConfigs} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40">
          <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.admin.aiSettings}</h1>
          <p className="text-sm text-muted-foreground">{t.admin.aiSettings}</p>
        </div>
      </div>

      {/* Provider Cards */}
      {configs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t.common.noData}
          </CardContent>
        </Card>
      ) : (
        configs.map((config) => (
          <Card key={config.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{config.name}</CardTitle>
                  <CardDescription>Provider: {config.provider}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      config.isActive
                        ? 'text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'text-[10px] bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                    }
                  >
                    {config.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => openEditDialog(config)}
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Base URL</p>
                  <p className="text-sm font-mono mt-0.5">{config.baseUrl || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">API Key</p>
                  <p className="text-sm font-mono mt-0.5">
                    {config.apiKeyEnc ? '••••••••••••' : '—'}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Models</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {config.models ? (
                      (() => {
                        try {
                          const models = JSON.parse(config.models)
                          if (Array.isArray(models)) {
                            return models.map((m: string) => (
                              <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                            ))
                          }
                        } catch {
                          // Not JSON
                        }
                        return <span className="text-sm">{config.models}</span>
                      })()
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.common.edit}</DialogTitle>
            <DialogDescription>{t.common.edit}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provider Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. OpenAI" />
            </div>
            <div className="space-y-2">
              <Label>API Key (leave empty to keep current)</Label>
              <Input value={formApiKey} onChange={(e) => setFormApiKey(e.target.value)} type="password" placeholder="sk-..." />
            </div>
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input value={formBaseUrl} onChange={(e) => setFormBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
            </div>
            <div className="space-y-2">
              <Label>Models (JSON array or comma-separated)</Label>
              <Input value={formModels} onChange={(e) => setFormModels(e.target.value)} placeholder='["gpt-4", "gpt-3.5-turbo"]' />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
