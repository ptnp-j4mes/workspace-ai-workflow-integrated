'use client'

import { useI18n } from '@/i18n'

import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  Calendar,
  Bot,
  Mail,
  Link2,
  Unplug,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  Clock,
  AlertTriangle,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Cloud,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/store/app-store'
import { api } from '@/lib/api-client'
import { toast } from '@/lib/toast'

// ============================================================
// Types
// ============================================================

interface GoogleConnectionStatus {
  connected: boolean
  email: string | null
  purpose: string | null
  scopes: string[]
  botAccount: {
    id: string
    name: string
    email: string
    status: string
  } | null
  connectedAt: string | null
  lastRefreshedAt: string | null
}

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

interface CalendarSyncStatus {
  lastSyncedAt: string | null
  totalSyncedEvents: number
}

// ============================================================
// Component
// ============================================================

export default function GoogleSettingsPage() {
  const { t } = useI18n()
  const navigate = useAppStore((s) => s.navigate)

  // Google Connection state
  const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatus | null>(null)
  const [loadingGoogle, setLoadingGoogle] = useState(true)
  const [connectingGoogle, setConnectingGoogle] = useState(false)
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false)

  // Google Calendar sync state
  const [syncingCalendar, setSyncingCalendar] = useState(false)
  const [calendarSyncInfo, setCalendarSyncInfo] = useState<CalendarSyncStatus | null>(null)

  // SMTP state
  const [smtpSettings, setSmtpSettings] = useState<SmtpSetting[]>([])
  const [loadingSmtp, setLoadingSmtp] = useState(true)
  const [smtpDialogOpen, setSmtpDialogOpen] = useState(false)
  const [smtpEditMode, setSmtpEditMode] = useState(false)
  const [selectedSmtp, setSelectedSmtp] = useState<SmtpSetting | null>(null)
  const [savingSmtp, setSavingSmtp] = useState(false)
  const [testingSmtpId, setTestingSmtpId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  // SMTP form
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

  // ============================================================
  // Data Fetching
  // ============================================================

  const fetchGoogleStatus = useCallback(async () => {
    setLoadingGoogle(true)
    try {
      const data = await api.get<GoogleConnectionStatus>('/api/auth/google/status')
      setGoogleStatus(data)
    } catch {
      toast.error('Error', 'Failed to load Google connection status')
    } finally {
      setLoadingGoogle(false)
    }
  }, [])

  const fetchSmtpSettings = useCallback(async () => {
    setLoadingSmtp(true)
    try {
      const data = await api.get<{ data: SmtpSetting[] }>('/api/admin/smtp')
      setSmtpSettings(data.data ?? [])
    } catch {
      toast.error('Error', 'Failed to load SMTP settings')
    } finally {
      setLoadingSmtp(false)
    }
  }, [])

  const fetchCalendarSyncInfo = useCallback(async () => {
    try {
      const data = await api.get<{ events: unknown[]; googleConnected: boolean }>('/api/calendar/events?month=' + new Date().toISOString().slice(0, 7))
      setCalendarSyncInfo({
        lastSyncedAt: null,
        totalSyncedEvents: (data.events as unknown[])?.length || 0,
      })
    } catch {
      // Ignore
    }
  }, [])

  useEffect(() => {
    fetchGoogleStatus()
    fetchSmtpSettings()
    fetchCalendarSyncInfo()
  }, [fetchGoogleStatus, fetchSmtpSettings, fetchCalendarSyncInfo])

  // ============================================================
  // Google Actions
  // ============================================================

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true)
    try {
      const data = await api.get<{ mode: string; authUrl: string; message?: string }>('/api/auth/google/connect')
      if (data.authUrl) {
        window.open(data.authUrl, '_blank', 'width=600,height=700')
        let attempts = 0
        const pollInterval = setInterval(async () => {
          attempts++
          try {
            const status = await api.get<GoogleConnectionStatus>('/api/auth/google/status')
            if (status.connected) {
              clearInterval(pollInterval)
              setGoogleStatus(status)
              toast.success('Google Connected', `Connected as ${status.email}`)
            }
          } catch { /* ignore */ }
          if (attempts > 60) {
            clearInterval(pollInterval)
            toast.warning('Timeout', 'Google connection may take a moment. Refresh the page.')
          }
        }, 2000)
      }
    } catch {
      toast.error('Connection Failed', 'Could not initiate Google connection')
    } finally {
      setConnectingGoogle(false)
    }
  }

  const handleDisconnectGoogle = async () => {
    setDisconnectingGoogle(true)
    try {
      await api.delete('/api/auth/google/disconnect')
      setGoogleStatus({
        connected: false, email: null, purpose: null, scopes: [], botAccount: null, connectedAt: null, lastRefreshedAt: null,
      })
      toast.success('Disconnected', 'Google account has been disconnected')
    } catch {
      toast.error('Disconnection Failed', 'Could not disconnect Google account')
    } finally {
      setDisconnectingGoogle(false)
    }
  }

  const handleSyncCalendar = async () => {
    setSyncingCalendar(true)
    try {
      const data = await api.post<{ success: boolean; syncedCount: number; mode: string }>('/api/calendar/sync', {})
      if (data.success) {
        toast.success('Sync Complete', `Synced ${data.syncedCount} event${data.syncedCount !== 1 ? 's' : ''} from Google Calendar`)
        fetchCalendarSyncInfo()
      }
    } catch {
      toast.error('Sync Failed', 'Could not sync Google Calendar events')
    } finally {
      setSyncingCalendar(false)
    }
  }

  // ============================================================
  // SMTP Actions
  // ============================================================

  const openAddSmtp = () => {
    setSmtpEditMode(false)
    setSelectedSmtp(null)
    setFormName(''); setFormHost(''); setFormPort('587'); setFormSecure(false)
    setFormUsername(''); setFormPassword(''); setFormFromEmail(''); setFormFromName('')
    setFormIsDefault(false); setFormIsActive(true)
    setSmtpDialogOpen(true)
  }

  const openEditSmtp = (smtp: SmtpSetting) => {
    setSmtpEditMode(true)
    setSelectedSmtp(smtp)
    setFormName(smtp.name); setFormHost(smtp.host); setFormPort(smtp.port.toString())
    setFormSecure(smtp.secure); setFormUsername(smtp.username); setFormPassword('')
    setFormFromEmail(smtp.fromEmail); setFormFromName(smtp.fromName ?? '')
    setFormIsDefault(smtp.isDefault); setFormIsActive(smtp.isActive)
    setSmtpDialogOpen(true)
  }

  const handleSaveSmtp = async () => {
    if (!formName || !formHost || !formUsername || !formFromEmail) return
    setSavingSmtp(true)
    try {
      if (smtpEditMode && selectedSmtp) {
        const payload: Record<string, unknown> = {
          name: formName, host: formHost, port: parseInt(formPort) || 587, secure: formSecure,
          username: formUsername, fromEmail: formFromEmail, fromName: formFromName || null,
          isDefault: formIsDefault, isActive: formIsActive,
        }
        if (formPassword) payload.passwordEncrypted = formPassword
        await api.patch(`/api/admin/smtp/${selectedSmtp.id}`, payload)
      } else {
        await api.post('/api/admin/smtp', {
          name: formName, host: formHost, port: parseInt(formPort) || 587, secure: formSecure,
          username: formUsername, passwordEncrypted: formPassword, fromEmail: formFromEmail,
          fromName: formFromName || null, isDefault: formIsDefault, isActive: formIsActive,
        })
      }
      setSmtpDialogOpen(false)
      fetchSmtpSettings()
      toast.success('Saved', smtpEditMode ? 'SMTP configuration updated' : 'SMTP configuration created')
    } catch {
      toast.error('Save Failed', 'Could not save SMTP configuration')
    } finally {
      setSavingSmtp(false)
    }
  }

  const handleTestSmtp = async (smtp: SmtpSetting) => {
    setTestingSmtpId(smtp.id)
    setTestResult(null)
    try {
      const result = await api.post<{ data: { success: boolean; message: string } }>(`/api/admin/smtp/${smtp.id}/test`)
      setTestResult({ id: smtp.id, success: result.data.success, message: result.data.message })
    } catch (err) {
      setTestResult({ id: smtp.id, success: false, message: err instanceof Error ? err.message : 'Test failed' })
    } finally {
      setTestingSmtpId(null)
    }
  }

  // ============================================================
  // Render: Google Connection Card
  // ============================================================

  const renderGoogleConnectionCard = () => {
    const isConnected = googleStatus?.connected
    const isDemo = googleStatus?.email?.includes('demo') || googleStatus?.email?.includes('ait-demo')
    const scopes = googleStatus?.scopes || []

    return (
      <Card className={isConnected ? 'border-cyan-200 dark:border-cyan-800' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                <Cloud className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <CardTitle className="text-base">Google Account</CardTitle>
                <CardDescription className="text-xs">
                  Connect your Google account for Calendar, Meet & Bot
                </CardDescription>
              </div>
            </div>
            {isConnected && (
              <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingGoogle ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : isConnected ? (
            <>
              {/* Connected Info */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                    {(googleStatus?.email || 'G')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{googleStatus?.email}</p>
                    <div className="flex items-center gap-1.5">
                      {isDemo && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-600 border-amber-300">
                          Demo Mode
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        Purpose: {googleStatus?.purpose || 'PERSONAL'}
                      </span>
                    </div>
                  </div>
                </div>

                {googleStatus?.connectedAt && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Connected {new Date(googleStatus.connectedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                )}

                {googleStatus?.lastRefreshedAt && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <RefreshCw className="h-3 w-3" />
                    Last refreshed {new Date(googleStatus.lastRefreshedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                )}
              </div>

              {/* Scopes */}
              {scopes.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Permissions granted:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {scopes.map((scope, idx) => {
                      const scopeLabel = scope.includes('calendar') ? 'Calendar' : scope.includes('meetings') ? 'Meet' : scope.split('/').pop()?.replace(/\.readonly/, ' (read)') || scope
                      return (
                        <Badge key={idx} variant="secondary" className="text-[10px] gap-1">
                          <Shield className="h-2.5 w-2.5" />
                          {scopeLabel}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={handleDisconnectGoogle}
                  disabled={disconnectingGoogle}
                >
                  {disconnectingGoogle ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Not Connected */}
              <div className="rounded-lg border-2 border-dashed border-cyan-200 dark:border-cyan-800 p-6 text-center">
                <Cloud className="h-10 w-10 text-cyan-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">No Google Account Connected</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Connect your Google account to enable Calendar sync, Google Meet Bot, and more.
                </p>
                <Button
                  onClick={handleConnectGoogle}
                  disabled={connectingGoogle}
                  className="gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  {connectingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Connect Google Account
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // ============================================================
  // Render: Google Calendar Card
  // ============================================================

  const renderCalendarCard = () => {
    const isConnected = googleStatus?.connected

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                <Calendar className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <CardTitle className="text-base">Google Calendar</CardTitle>
                <CardDescription className="text-xs">
                  Sync and display your Google Calendar events
                </CardDescription>
              </div>
            </div>
            {isConnected && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate('calendar')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Calendar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isConnected ? (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Connect your Google account first to enable Calendar sync.
              </p>
            </div>
          ) : (
            <>
              {/* Sync Info */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                {calendarSyncInfo && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Events this month</span>
                    <span className="text-xs font-medium">{calendarSyncInfo.totalSyncedEvents} events</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t.common.status}</span>
                  <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                    Active
                  </Badge>
                </div>
              </div>

              {/* Sync Button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={handleSyncCalendar}
                disabled={syncingCalendar}
              >
                {syncingCalendar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Sync Now
              </Button>

              <p className="text-[11px] text-muted-foreground text-center">
                Syncing will fetch the latest events from your Google Calendar
              </p>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // ============================================================
  // Render: Google Meet Bot Card
  // ============================================================

  const renderMeetBotCard = () => {
    const isConnected = googleStatus?.connected
    const botAccount = googleStatus?.botAccount

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                <Bot className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <CardTitle className="text-base">Google Meet Bot</CardTitle>
                <CardDescription className="text-xs">
                  AI bot that joins meetings to record & transcribe
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isConnected ? (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Connect your Google account first to enable the Meet Bot.
              </p>
            </div>
          ) : botAccount ? (
            <>
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30 text-xs font-semibold text-violet-700 dark:text-violet-300">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{botAccount.name}</p>
                    <p className="text-[11px] text-muted-foreground">{botAccount.email}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Bot Status</span>
                  <Badge
                    variant="outline"
                    className={
                      botAccount.status === 'AVAILABLE'
                        ? 'text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                        : botAccount.status === 'BUSY'
                        ? 'text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                        : 'text-[10px] bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800'
                    }
                  >
                    {botAccount.status === 'AVAILABLE' ? '● Available' : botAccount.status === 'BUSY' ? '● Busy' : '● Offline'}
                  </Badge>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">Bot Capabilities</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Auto Join', enabled: true },
                    { label: 'Recording', enabled: true },
                    { label: 'Transcription', enabled: true },
                    { label: 'AI Summary', enabled: true },
                  ].map((cap) => (
                    <div key={cap.label} className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span className="text-[11px] text-muted-foreground">{cap.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => navigate('meetings')}
              >
                Go to Meetings
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                No bot account linked. The bot will be automatically created when you connect your Google account.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // ============================================================
  // Render: SMTP Section
  // ============================================================

  const renderSmtpSection = () => (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
            <Mail className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{t.admin.smtp}</h2>
            <p className="text-sm text-muted-foreground">{smtpSettings.length} configuration(s)</p>
          </div>
        </div>
        <Button onClick={openAddSmtp} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> {t.common.create}
        </Button>
      </div>

      {/* Test Result Banner */}
      <AnimatePresence>
        {testResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`flex items-center gap-2 rounded-lg border p-3 ${
              testResult.success
                ? 'border-green-500/50 bg-green-50 dark:bg-green-900/20'
                : 'border-red-500/50 bg-red-50 dark:bg-red-900/20'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <p className="text-sm flex-1">{testResult.message}</p>
            <Button variant="ghost" size="sm" onClick={() => setTestResult(null)}>
              Dismiss
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {loadingSmtp ? (
        <Card className="p-4">
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.common.name}</TableHead>
                <TableHead>Host</TableHead>
                <TableHead className="hidden md:table-cell">Port</TableHead>
                <TableHead className="hidden md:table-cell">Username</TableHead>
                <TableHead>From</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead className="w-[160px]">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {smtpSettings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    {t.common.noData}
                  </TableCell>
                </TableRow>
              ) : (
                smtpSettings.map((smtp) => (
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
                          onClick={() => handleTestSmtp(smtp)}
                          disabled={testingSmtpId === smtp.id}
                        >
                          {testingSmtpId === smtp.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          Test
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditSmtp(smtp)}
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
      )}
    </div>
  )

  // ============================================================
  // Main Render
  // ============================================================

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
            <Settings className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.admin.googleSettings}</h1>
            <p className="text-sm text-muted-foreground">Manage your Google account, Calendar, Meet Bot, and SMTP</p>
          </div>
        </div>

        {/* Tab-based layout */}
        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-auto lg:inline-grid lg:grid-cols-4">
            <TabsTrigger value="account" className="gap-1.5 text-xs sm:text-sm">
              <Cloud className="h-3.5 w-3.5 hidden sm:block" />
              Account
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5 text-xs sm:text-sm">
              <Calendar className="h-3.5 w-3.5 hidden sm:block" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="meetbot" className="gap-1.5 text-xs sm:text-sm">
              <Bot className="h-3.5 w-3.5 hidden sm:block" />
              Meet Bot
            </TabsTrigger>
            <TabsTrigger value="smtp" className="gap-1.5 text-xs sm:text-sm">
              <Mail className="h-3.5 w-3.5 hidden sm:block" />
              SMTP
            </TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {renderGoogleConnectionCard()}

              {/* Quick Links to other services */}
              {googleStatus?.connected && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate('calendar')}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                      <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Google Calendar</p>
                      <p className="text-[11px] text-muted-foreground">View and sync calendar events</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => navigate('meetings')}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                      <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Meet Bot</p>
                      <p className="text-[11px] text-muted-foreground">Manage meeting recordings</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {renderCalendarCard()}
            </motion.div>
          </TabsContent>

          {/* Meet Bot Tab */}
          <TabsContent value="meetbot">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {renderMeetBotCard()}
            </motion.div>
          </TabsContent>

          {/* SMTP Tab */}
          <TabsContent value="smtp">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {renderSmtpSection()}
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* SMTP Add/Edit Dialog */}
        <Dialog open={smtpDialogOpen} onOpenChange={setSmtpDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{smtpEditMode ? '{t.common.edit}' : '{t.common.create}'}</DialogTitle>
              <DialogDescription>
                {smtpEditMode ? '{t.common.edit}' : '{t.common.create}'}
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
                <Label>Password {smtpEditMode ? '(leave empty to keep current)' : '*'}</Label>
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
              <Button variant="outline" onClick={() => setSmtpDialogOpen(false)}>{t.common.cancel}</Button>
              <Button onClick={handleSaveSmtp} disabled={savingSmtp || !formName || !formHost || !formUsername || !formFromEmail}>
                {savingSmtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {smtpEditMode ? 'Save Changes' : '{t.common.create}'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
