'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  Settings,
  RefreshCw,
  Loader2,
  Check,
  X,
  EyeOff,
  Eye,
  Search,
  Copy,
  CheckCircle2,
  FolderOpen,
  FolderClosed,
  ChevronRight,
  ChevronDown,
  FileJson,
  Terminal,
  Braces,
  Key,
  ShieldCheck,
  BracesIcon,
  Hash,
  Type,
  ToggleLeft,
  FileCode,
  Regex,
  ArrowRight,
  Server,
  Cloud,
  Upload,
  HardDrive,
  Wifi,
  WifiOff,
  Save,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface SystemSetting {
  id: string
  key: string
  value: string
  valueType: string | null
  category: string | null
  isSecret: boolean
  description: string | null
  updatedAt?: string | null
  updatedById?: string | null
}

interface CategoryNode {
  name: string
  count: number
  icon: React.ElementType
}

// ============================================================
// Category icon mapping
// ============================================================

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  EMAIL: FileCode,
  SMTP: FileCode,
  AUTH: ShieldCheck,
  SECURITY: ShieldCheck,
  GENERAL: Braces,
  API: Terminal,
  INTEGRATION: BracesIcon,
  AI: Braces,
  NOTIFICATION: FileCode,
  DATABASE: FileJson,
  STORAGE: FileJson,
  CACHE: FileJson,
}

function getCategoryIcon(category: string): React.ElementType {
  const upper = category.toUpperCase()
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (upper.includes(key)) return icon
  }
  return FileJson
}

// ============================================================
// Value type color & icon mapping
// ============================================================

function getValueTypeConfig(valueType: string | null, isSecret: boolean) {
  if (isSecret) return { color: 'text-red-400', bg: 'bg-red-500/10', icon: EyeOff, label: 'secret' }
  switch (valueType) {
    case 'NUMBER': return { color: 'text-sky-400', bg: 'bg-sky-500/10', icon: Hash, label: 'number' }
    case 'BOOLEAN': return { color: 'text-purple-400', bg: 'bg-purple-500/10', icon: ToggleLeft, label: 'boolean' }
    case 'JSON': return { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Braces, label: 'json' }
    default: return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: Type, label: 'string' }
  }
}

// ============================================================
// Syntax highlight for value display
// ============================================================

function SyntaxValue({ value, valueType, isSecret }: { value: string; valueType: string | null; isSecret: boolean }) {
  if (isSecret) {
    return <span className="text-red-400/70 font-mono">••••••••</span>
  }

  if (valueType === 'BOOLEAN') {
    return (
      <span className={value === 'true' ? 'text-purple-400' : 'text-purple-300/50'}>
        {value}
      </span>
    )
  }

  if (valueType === 'NUMBER') {
    return <span className="text-sky-400">{value}</span>
  }

  if (valueType === 'JSON') {
    let displayValue = value
    try {
      displayValue = JSON.stringify(JSON.parse(value))
    } catch {
      // fallback to raw string
    }
    return <span className="text-amber-300">{displayValue}</span>
  }

  // String - show with quotes
  return <span className="text-emerald-400">&quot;{value}&quot;</span>
}

// ============================================================
// Component
// ============================================================

export default function AdminSystemSettingsPage() {
  const { t } = useI18n()
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isRegexSearch, setIsRegexSearch] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showJsonPreview, setShowJsonPreview] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Storage settings state
  const [uploadMode, setUploadMode] = useState<string>('LOCAL')
  const [storageSettings, setStorageSettings] = useState<Record<string, SystemSetting>>({})
  const [testingApi, setTestingApi] = useState(false)
  const [apiTestResult, setApiTestResult] = useState<'success' | 'error' | null>(null)

  const fetchSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ data: SystemSetting[] }>('/api/admin/system-settings')
      setSettings(data.data ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  // Extract STORAGE category settings
  useEffect(() => {
    const storage = settings.filter(s => s.category === 'STORAGE')
    const map: Record<string, SystemSetting> = {}
    storage.forEach(s => { map[s.key] = s })
    setStorageSettings(map)
    if (map['UPLOAD_MODE']) setUploadMode(map['UPLOAD_MODE'].value)
  }, [settings])

  // Auto-focus edit input
  useEffect(() => {
    if (editingKey && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingKey])

  // Group by category
  const categories = useMemo((): CategoryNode[] => {
    const groups: Record<string, number> = {}
    settings.forEach((s) => {
      const category = s.category || 'General'
      groups[category] = (groups[category] || 0) + 1
    })
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({
        name,
        count,
        icon: getCategoryIcon(name),
      }))
  }, [settings])

  const groupedSettings = useMemo(() => {
    const groups: Record<string, SystemSetting[]> = {}
    settings.forEach((s) => {
      const category = s.category || 'General'
      if (!groups[category]) groups[category] = []
      groups[category].push(s)
    })
    return groups
  }, [settings])

  // Filter settings based on search and category
  const filteredSettings = useMemo(() => {
    let items = selectedCategory
      ? (groupedSettings[selectedCategory] || [])
      : settings

    if (searchQuery.trim()) {
      const query = searchQuery.trim()
      if (isRegexSearch) {
        try {
          const regex = new RegExp(query, 'i')
          items = items.filter(s => regex.test(s.key) || regex.test(s.value) || (s.description && regex.test(s.description)))
        } catch {
          // Invalid regex, fall back to simple search
          items = items.filter(s =>
            s.key.toLowerCase().includes(query.toLowerCase()) ||
            s.value.toLowerCase().includes(query.toLowerCase()) ||
            (s.description && s.description.toLowerCase().includes(query.toLowerCase()))
          )
        }
      } else {
        items = items.filter(s =>
          s.key.toLowerCase().includes(query.toLowerCase()) ||
          s.value.toLowerCase().includes(query.toLowerCase()) ||
          (s.description && s.description.toLowerCase().includes(query.toLowerCase()))
        )
      }
    }

    return items
  }, [settings, groupedSettings, selectedCategory, searchQuery, isRegexSearch])

  const startEdit = useCallback((setting: SystemSetting) => {
    setEditingKey(setting.key)
    setEditValue(setting.value)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingKey(null)
    setEditValue('')
  }, [])

  // Update a storage setting via API
  const updateStorageSetting = async (key: string, value: string) => {
    try {
      await api.patch('/api/admin/system-settings', {
        settings: [{ key, value }],
      })
      setStorageSettings(prev => ({
        ...prev,
        [key]: { ...prev[key], value },
      }))
      setSettings(prev =>
        prev.map(s => (s.key === key ? { ...s, value } : s))
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save setting')
    }
  }

  const testApiConnection = async () => {
    setTestingApi(true)
    setApiTestResult(null)
    try {
      const url = storageSettings['UPLOAD_API_URL']?.value || ''
      const apiKey = storageSettings['UPLOAD_API_KEY']?.value || ''
      const res = await fetch(url, {
        method: 'HEAD',
        headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
        signal: AbortSignal.timeout(5000),
      })
      setApiTestResult(res.ok ? 'success' : 'error')
    } catch {
      setApiTestResult('error')
    } finally {
      setTestingApi(false)
    }
  }

  const saveEdit = async (setting: SystemSetting) => {
    setSaving(true)
    try {
      await api.patch('/api/admin/system-settings', {
        settings: [{ key: setting.key, value: editValue }],
      })
      setSettings((prev) =>
        prev.map((s) => (s.key === setting.key ? { ...s, value: setting.isSecret ? '***' : editValue } : s))
      )
      setEditingKey(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save setting')
    } finally {
      setSaving(false)
    }
  }

  // JSON preview
  const jsonPreview = useMemo(() => {
    const obj: Record<string, unknown> = {}
    filteredSettings.forEach((s) => {
      if (s.isSecret) {
        obj[s.key] = '***'
      } else if (s.valueType === 'NUMBER') {
        obj[s.key] = Number(s.value)
      } else if (s.valueType === 'BOOLEAN') {
        obj[s.key] = s.value === 'true'
      } else if (s.valueType === 'JSON') {
        try { obj[s.key] = JSON.parse(s.value) } catch { obj[s.key] = s.value }
      } else {
        obj[s.key] = s.value
      }
    })
    return JSON.stringify(obj, null, 2)
  }, [filteredSettings])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonPreview)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingKey) {
        cancelEdit()
      }
      if (e.key === 'Enter' && editingKey && !saving) {
        const setting = settings.find(s => s.key === editingKey)
        if (setting) saveEdit(setting)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingKey, saving, settings, cancelEdit])

  // ============================================================
  // Loading state
  // ============================================================

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Card className="overflow-hidden border-border/50">
          <div className="bg-muted/30 border-b border-border/50 px-4 py-2.5 flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-4 w-40 ml-3" />
          </div>
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  // ============================================================
  // Error state
  // ============================================================

  if (error && settings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
          <Terminal className="h-8 w-8 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-mono text-red-400">$ error: {error}</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">exit code: 1</p>
        </div>
        <Button variant="outline" onClick={fetchSettings} className="gap-2 font-mono text-sm">
          <RefreshCw className="h-4 w-4" /> $ retry
        </Button>
      </div>
    )
  }

  // ============================================================
  // Main render
  // ============================================================

  return (
    <div className="space-y-4">
      {/* Header - Terminal style */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Braces className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground font-mono tracking-tight">
              {t.admin.systemSettings}
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              <span className="text-emerald-500">$</span> config --list <span className="text-muted-foreground/50">|</span> {settings.length} {t.systemSettings?.settingsCount || 'setting(s)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowJsonPreview(!showJsonPreview)}
                  className={`gap-2 font-mono text-xs ${showJsonPreview ? 'border-emerald-500/50 text-emerald-500' : ''}`}
                >
                  <FileJson className="h-3.5 w-3.5" />
                  JSON
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle JSON Preview</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" size="sm" onClick={fetchSettings} className="gap-2 font-mono text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            {t.common.refresh}
          </Button>
        </div>
      </div>

      {/* ===== Storage Configuration Panel ===== */}
      <Card className="overflow-hidden border-border/50">
        {/* Terminal-like header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-1.5 mr-2">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <HardDrive className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-mono text-muted-foreground">storage-config.tsx</span>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono ml-auto">
            STORAGE
          </Badge>
        </div>

        <div className="p-4 space-y-5">
          {/* Upload Mode Toggle */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-mono font-semibold text-foreground">Upload Mode</span>
              <span className="text-[10px] text-muted-foreground font-mono">{'// Select storage backend'}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setUploadMode('LOCAL'); updateStorageSetting('UPLOAD_MODE', 'LOCAL') }}
                className={`
                  flex items-center gap-2.5 px-4 py-2.5 rounded-lg border font-mono text-sm transition-all duration-300
                  ${uploadMode === 'LOCAL'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-sm shadow-emerald-500/10'
                    : 'border-border/50 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  {uploadMode === 'LOCAL' && <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                  <Server className="h-4 w-4" />
                </div>
                <span>Local Storage</span>
              </button>
              <button
                onClick={() => { setUploadMode('API'); updateStorageSetting('UPLOAD_MODE', 'API') }}
                className={`
                  flex items-center gap-2.5 px-4 py-2.5 rounded-lg border font-mono text-sm transition-all duration-300
                  ${uploadMode === 'API'
                    ? 'border-purple-500/50 bg-purple-500/10 text-purple-400 shadow-sm shadow-purple-500/10'
                    : 'border-border/50 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  {uploadMode === 'API' && <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />}
                  <Cloud className="h-4 w-4" />
                </div>
                <span>External API</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border/30" />

          {/* Mode-specific settings */}
          <div className="transition-all duration-300">
            {uploadMode === 'LOCAL' ? (
              /* Local Storage Settings */
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-mono font-semibold text-foreground">Local Storage Settings</span>
                </div>
                <div className="grid gap-3 pl-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-muted-foreground">
                      <span className="text-emerald-400">const</span> uploadPath
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground/50">=</span>
                      <Input
                        value={storageSettings['UPLOAD_LOCAL_PATH']?.value || './upload'}
                        onChange={(e) => {
                          setStorageSettings(prev => ({
                            ...prev,
                            UPLOAD_LOCAL_PATH: { ...prev['UPLOAD_LOCAL_PATH'], value: e.target.value },
                          }))
                        }}
                        onBlur={() => updateStorageSetting('UPLOAD_LOCAL_PATH', storageSettings['UPLOAD_LOCAL_PATH']?.value || './upload')}
                        className="h-8 text-xs font-mono bg-emerald-500/5 border-emerald-500/20 text-emerald-400 focus-visible:ring-emerald-500/30"
                        placeholder="./upload"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground/60">
                    <div className="flex items-center gap-1.5">
                      <FolderOpen className="h-3 w-3" />
                      <span>Files: <span className="text-foreground/60">--</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="h-3 w-3" />
                      <span>Total size: <span className="text-foreground/60">--</span></span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* API Settings */
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-mono font-semibold text-foreground">External API Settings</span>
                </div>
                <div className="grid gap-3 pl-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-muted-foreground">
                      <span className="text-purple-400">const</span> apiUrl
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground/50">=</span>
                      <Input
                        value={storageSettings['UPLOAD_API_URL']?.value || ''}
                        onChange={(e) => {
                          setStorageSettings(prev => ({
                            ...prev,
                            UPLOAD_API_URL: { ...prev['UPLOAD_API_URL'], value: e.target.value },
                          }))
                        }}
                        onBlur={() => updateStorageSetting('UPLOAD_API_URL', storageSettings['UPLOAD_API_URL']?.value || '')}
                        className="h-8 text-xs font-mono bg-purple-500/5 border-purple-500/20 text-purple-400 focus-visible:ring-purple-500/30"
                        placeholder="https://api.example.com/upload"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-muted-foreground">
                      <span className="text-purple-400">const</span> apiKey
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground/50">=</span>
                      <div className="relative flex-1">
                        <Input
                          type="password"
                          value={storageSettings['UPLOAD_API_KEY']?.value || ''}
                          onChange={(e) => {
                            setStorageSettings(prev => ({
                              ...prev,
                              UPLOAD_API_KEY: { ...prev['UPLOAD_API_KEY'], value: e.target.value },
                            }))
                          }}
                          onBlur={() => updateStorageSetting('UPLOAD_API_KEY', storageSettings['UPLOAD_API_KEY']?.value || '')}
                          className="h-8 text-xs font-mono bg-purple-500/5 border-purple-500/20 text-purple-400 focus-visible:ring-purple-500/30 pr-8"
                          placeholder="sk-••••••••"
                        />
                        <Key className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-purple-400/50" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testApiConnection}
                      disabled={testingApi || !storageSettings['UPLOAD_API_URL']?.value}
                      className="gap-2 font-mono text-xs"
                    >
                      {testingApi ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : apiTestResult === 'success' ? (
                        <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                      ) : apiTestResult === 'error' ? (
                        <WifiOff className="h-3.5 w-3.5 text-red-400" />
                      ) : (
                        <Wifi className="h-3.5 w-3.5" />
                      )}
                      {testingApi ? 'Testing...' : 'Test Connection'}
                    </Button>
                    {apiTestResult && (
                      <span className={`text-xs font-mono ${apiTestResult === 'success' ? 'text-emerald-500' : 'text-red-400'}`}>
                        {apiTestResult === 'success' ? '✓ Connection successful' : '✗ Connection failed'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border/30" />

          {/* General Settings (always visible) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-mono font-semibold text-foreground">General Upload Settings</span>
            </div>
            <div className="grid gap-4 pl-6">
              {/* Max file size slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-muted-foreground">
                    <span className="text-amber-400">const</span> maxFileSizeMB
                  </label>
                  <Badge variant="secondary" className="text-xs font-mono px-2 py-0.5">
                    {storageSettings['UPLOAD_MAX_SIZE_MB']?.value || '50'} MB
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-muted-foreground/50 w-8">1 MB</span>
                  <Slider
                    value={[Number(storageSettings['UPLOAD_MAX_SIZE_MB']?.value || 50)]}
                    min={1}
                    max={500}
                    step={1}
                    onValueChange={([val]) => {
                      setStorageSettings(prev => ({
                        ...prev,
                        UPLOAD_MAX_SIZE_MB: { ...prev['UPLOAD_MAX_SIZE_MB'], value: String(val) },
                      }))
                    }}
                    onValueCommit={([val]) => updateStorageSetting('UPLOAD_MAX_SIZE_MB', String(val))}
                    className="flex-1"
                  />
                  <span className="text-[10px] font-mono text-muted-foreground/50 w-10 text-right">500 MB</span>
                </div>
              </div>

              {/* Allowed file types */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-muted-foreground">
                    <span className="text-amber-400">const</span> allowedTypes
                  </label>
                  <span className="text-[10px] font-mono text-muted-foreground/40">comma-separated</span>
                </div>
                <Textarea
                  value={storageSettings['UPLOAD_ALLOWED_TYPES']?.value || ''}
                  onChange={(e) => {
                    setStorageSettings(prev => ({
                      ...prev,
                      UPLOAD_ALLOWED_TYPES: { ...prev['UPLOAD_ALLOWED_TYPES'], value: e.target.value },
                    }))
                  }}
                  onBlur={() => updateStorageSetting('UPLOAD_ALLOWED_TYPES', storageSettings['UPLOAD_ALLOWED_TYPES']?.value || '')}
                  className="min-h-16 text-xs font-mono bg-amber-500/5 border-amber-500/20 text-amber-400 focus-visible:ring-amber-500/30 resize-none"
                  placeholder=".jpg,.png,.pdf,.docx,.xlsx,.zip"
                />
                {storageSettings['UPLOAD_ALLOWED_TYPES']?.value && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {storageSettings['UPLOAD_ALLOWED_TYPES'].value.split(',').filter(Boolean).map((type, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-[9px] px-1.5 py-0 font-mono bg-amber-500/10 text-amber-400 border-0"
                      >
                        {type.trim()}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-3 px-4 py-1.5 border-t border-border/50 bg-muted/30 text-[10px] font-mono text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${uploadMode === 'LOCAL' ? 'bg-emerald-500' : 'bg-purple-500'}`} />
            <span>{uploadMode === 'LOCAL' ? 'Local' : 'API'} Mode</span>
          </div>
          <span className="text-muted-foreground/30">|</span>
          <span>Max: {storageSettings['UPLOAD_MAX_SIZE_MB']?.value || '50'}MB</span>
          <span className="text-muted-foreground/30">|</span>
          <span>{storageSettings['UPLOAD_ALLOWED_TYPES']?.value?.split(',').filter(Boolean).length || 0} type(s)</span>
          {apiTestResult && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span className={apiTestResult === 'success' ? 'text-emerald-500' : 'text-red-400'}>
                {apiTestResult === 'success' ? 'API Connected' : 'API Disconnected'}
              </span>
            </>
          )}
          <span className="ml-auto text-muted-foreground/50">
            <Save className="h-2.5 w-2.5 inline mr-1" />
            auto-save on blur
          </span>
        </div>
      </Card>

      {/* Main editor layout */}
      <div className="flex gap-0 rounded-lg overflow-hidden border border-border/50 shadow-sm">
        {/* ===== Sidebar: Category Explorer ===== */}
        {!sidebarCollapsed && (
          <div className="w-56 shrink-0 border-r border-border/50 bg-muted/20">
            {/* Sidebar header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/30">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Explorer
              </span>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono ml-auto">
                {categories.length}
              </Badge>
            </div>

            {/* All Settings item */}
            <div className="px-1 pt-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`
                  flex w-full items-center gap-2 px-2.5 py-1.5 rounded text-xs font-mono
                  transition-colors
                  ${!selectedCategory
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }
                `}
              >
                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1 text-left">All Settings</span>
                <Badge variant="secondary" className="text-[9px] px-1 py-0 font-mono">
                  {settings.length}
                </Badge>
              </button>
            </div>

            {/* Category list */}
            <ScrollArea className="max-h-[calc(100vh-320px)]">
              <div className="px-1 pb-1">
                {categories.map((cat) => {
                  const Icon = cat.icon
                  const isActive = selectedCategory === cat.name
                  return (
                    <button
                      key={cat.name}
                      onClick={() => setSelectedCategory(isActive ? null : cat.name)}
                      className={`
                        flex w-full items-center gap-2 px-2.5 py-1.5 rounded text-xs font-mono
                        transition-colors
                        ${isActive
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }
                      `}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate flex-1 text-left">{cat.name}</span>
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 font-mono">
                        {cat.count}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* ===== Main content: Code editor area ===== */}
        <div className="flex-1 min-w-0 bg-background">
          {/* Editor title bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 bg-muted/30">
            {/* Traffic light dots */}
            <div className="flex items-center gap-1.5 mr-2">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            </div>
            {/* Tab */}
            <div className="flex items-center gap-1.5 bg-background border border-border/50 rounded-t px-3 py-1 text-xs font-mono text-foreground -mb-[1px]">
              <FileJson className="h-3 w-3 text-emerald-500" />
              <span>{selectedCategory ? `${selectedCategory.toLowerCase()}.json` : 'system-settings.json'}</span>
            </div>

            {/* Search bar */}
            <div className="ml-auto flex items-center gap-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.systemSettings?.searchPlaceholder || 'Search... (regex supported)'}
                  className="h-7 w-48 pl-7 pr-1 text-xs font-mono bg-background border-border/50"
                />
                <button
                  onClick={() => setIsRegexSearch(!isRegexSearch)}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded text-[9px] font-mono font-bold
                    ${isRegexSearch ? 'text-emerald-500 bg-emerald-500/10' : 'text-muted-foreground hover:text-foreground'}
                  `}
                  title="Toggle regex search"
                >
                  .*
                </button>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    >
                      <Braces className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle sidebar</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Editor content area */}
          <ScrollArea className="max-h-[calc(100vh-350px)]">
            {showJsonPreview ? (
              /* ===== JSON Preview Mode ===== */
              <div className="relative">
                <div className="absolute top-2 right-2 z-10">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyToClipboard}
                    className="h-7 gap-1.5 font-mono text-xs"
                  >
                    {copied ? (
                      <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Copied!</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5" /> Copy</>
                    )}
                  </Button>
                </div>
                <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto">
                  <code>
                    <span className="text-muted-foreground/50">{`// ${selectedCategory || 'All'} Settings\n// Generated at ${new Date().toISOString()}\n\n`}</span>
                    <span className="text-amber-400">{'{'}</span>{'\n'}
                    {filteredSettings.map((setting, idx) => {
                      const isLast = idx === filteredSettings.length - 1
                      return (
                        <React.Fragment key={setting.id}>
                          {'  '}
                          <span className="text-sky-300">&quot;{setting.key}&quot;</span>
                          <span className="text-muted-foreground">: </span>
                          <SyntaxValue value={setting.value} valueType={setting.valueType} isSecret={setting.isSecret} />
                          {!isLast && <span className="text-muted-foreground">,</span>}
                          {'\n'}
                        </React.Fragment>
                      )
                    })}
                    <span className="text-amber-400">{'}'}</span>
                  </code>
                </pre>
              </div>
            ) : (
              /* ===== Settings List Mode ===== */
              <div className="divide-y divide-border/30">
                {filteredSettings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
                      <Search className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">
                      <span className="text-amber-400">$</span> {t.systemSettings?.noMatchingSettings || 'No settings match your search'}
                    </p>
                    {searchQuery && (
                      <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="font-mono text-xs">
                        Clear search
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredSettings.map((setting, idx) => {
                    const isEditing = editingKey === setting.key
                    const typeConfig = getValueTypeConfig(setting.valueType, setting.isSecret)

                    return (
                      <div
                        key={setting.id}
                        className={`
                          group flex items-start gap-3 px-4 py-2.5
                          hover:bg-muted/30 transition-colors
                          ${isEditing ? 'bg-muted/40' : ''}
                        `}
                      >
                        {/* Line number */}
                        <span className="text-[10px] text-muted-foreground/40 font-mono w-6 shrink-0 text-right pt-1 select-none">
                          {idx + 1}
                        </span>

                        {/* Key section */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-sky-300 bg-sky-500/5 px-1.5 py-0.5 rounded">
                              {setting.key}
                            </code>
                            {/* Type badge */}
                            <Badge className={`text-[9px] px-1.5 py-0 font-mono ${typeConfig.bg} ${typeConfig.color} border-0`}>
                              <typeConfig.icon className="h-2.5 w-2.5 mr-0.5" />
                              {typeConfig.label}
                            </Badge>
                          </div>
                          {setting.description && (
                            <p className="text-[11px] text-muted-foreground/60 font-mono mt-0.5 pl-1">
                              <span className="text-muted-foreground/30">{'// '}</span>{setting.description}
                            </p>
                          )}
                        </div>

                        {/* Value / Edit section */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isEditing ? (
                            <>
                              <span className="text-red-400 font-mono text-xs">-</span>
                              <code className="text-xs font-mono text-red-400/50 line-through bg-red-500/5 px-1.5 py-0.5 rounded">
                                {setting.isSecret ? '••••••••' : setting.value}
                              </code>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="text-emerald-400 font-mono text-xs">+</span>
                              <Input
                                ref={editInputRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-7 text-xs font-mono w-48 bg-emerald-500/5 border-emerald-500/30 text-emerald-400 focus-visible:ring-emerald-500/30"
                                type={setting.isSecret ? 'password' : 'text'}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => saveEdit(setting)}
                                disabled={saving}
                              >
                                {saving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={cancelEdit}
                              >
                                <X className="h-3.5 w-3.5 text-red-400" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <code className="text-xs font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded max-w-[240px] truncate inline-block">
                                <SyntaxValue value={setting.value} valueType={setting.valueType} isSecret={setting.isSecret} />
                              </code>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => startEdit(setting)}
                                    >
                                      <PencilIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit value</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </ScrollArea>

          {/* Status bar */}
          <div className="flex items-center gap-3 px-3 py-1 border-t border-border/50 bg-muted/30 text-[10px] font-mono text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Ready</span>
            </div>
            <span className="text-muted-foreground/30">|</span>
            <span>{filteredSettings.length} items</span>
            <span className="text-muted-foreground/30">|</span>
            <span>{selectedCategory || 'All Categories'}</span>
            <span className="text-muted-foreground/30">|</span>
            <span>UTF-8</span>
            <span className="text-muted-foreground/30">|</span>
            <span>JSON</span>
            {searchQuery && (
              <>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-amber-400">
                  <Search className="h-2.5 w-2.5 inline mr-0.5" />
                  {isRegexSearch ? 'regex' : 'text'}: &quot;{searchQuery}&quot;
                </span>
              </>
            )}
            <span className="ml-auto text-muted-foreground/50">
              esc to cancel · enter to save
            </span>
          </div>
        </div>
      </div>

      {/* JSON Preview Panel (toggleable) */}
      {showJsonPreview && (
        <Card className="overflow-hidden border-border/50">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-mono text-muted-foreground">JSON Output</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyToClipboard}
              className="h-6 gap-1.5 font-mono text-xs"
            >
              {copied ? (
                <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Copied!</>
              ) : (
                <><Copy className="h-3 w-3" /> Copy</>
              )}
            </Button>
          </div>
          <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto max-h-64 overflow-y-auto">
            <code>
              <span className="text-muted-foreground/50">{'// '}{selectedCategory || 'All'} Configuration</span>{'\n'}
              <span className="text-amber-400">{'{'}</span>{'\n'}
              {filteredSettings.map((setting, idx) => {
                const isLast = idx === filteredSettings.length - 1
                return (
                  <React.Fragment key={`preview-${setting.id}`}>
                    {'  '}
                    <span className="text-sky-300">&quot;{setting.key}&quot;</span>
                    <span className="text-muted-foreground">: </span>
                    <SyntaxValue value={setting.value} valueType={setting.valueType} isSecret={setting.isSecret} />
                    {!isLast && <span className="text-muted-foreground">,</span>}
                    {'\n'}
                  </React.Fragment>
                )
              })}
              <span className="text-amber-400">{'}'}</span>
            </code>
          </pre>
        </Card>
      )}
    </div>
  )
}

// Simple pencil icon to avoid naming conflict
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}
