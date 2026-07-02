'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Video,
  Plus,
  Calendar,
  Users,
  Bot,
  FileText,
  CheckSquare,
  Loader2,
  Cloud,
  CloudOff,
  RefreshCw,
  ExternalLink,
  Clock,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/store/app-store'
import { api } from '@/lib/api-client'
import { toast } from '@/lib/toast'
import { useI18n } from '@/i18n'

// ============================================================
// Types
// ============================================================

interface Meeting {
  id: string
  title: string
  description: string | null
  meetingUrl: string | null
  scheduledAt: string | null
  status: string
  botStatus: string | null
  recordingStatus: string | null
  projectId: string | null
  createdAt: string
  project?: {
    id: string
    name: string
    code: string
  } | null
  _count: {
    participants: number
    summaries: number
    actionItems: number
  }
}

interface CalendarEvent {
  id: string
  googleEventId: string
  title: string
  description: string | null
  meetingUrl: string | null
  location: string | null
  organizerEmail: string | null
  startAt: string
  endAt: string
  status: string
  attendees: string | null
  meetingId: string | null
  project?: {
    id: string
    name: string
  } | null
}

interface GoogleAuthStatus {
  connected: boolean
  email: string | null
  purpose: string | null
  scopes: string[]
}

const meetingStatusConfig: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: 'Scheduled', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
}

const botStatusConfig: Record<string, { label: string; color: string }> = {
  IDLE: { label: 'Idle', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  JOINING: { label: 'Joining', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  LEAVING: { label: 'Leaving', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  ERROR: { label: 'Error', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

// ============================================================
// Component
// ============================================================

export default function MeetingsPage() {
  const navigate = useAppStore((s) => s.navigate)
  const { t } = useI18n()

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [activeTab, setActiveTab] = useState('meetings')

  // Calendar & Google Auth state
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthStatus | null>(null)
  const [googleConnecting, setGoogleConnecting] = useState(false)

  // Form
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formScheduledAt, setFormScheduledAt] = useState('')
  const [formProjectId, setFormProjectId] = useState('')

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ meetings: Meeting[] }>('/api/meetings')
      setMeetings(data.meetings || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchGoogleAuth = useCallback(async () => {
    try {
      const data = await api.get<GoogleAuthStatus>('/api/auth/google/status')
      setGoogleAuth(data)
    } catch {
      // Not connected
    }
  }, [])

  const fetchCalendarEvents = useCallback(async () => {
    setCalendarLoading(true)
    try {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()
      const data = await api.get<{ events: CalendarEvent[] }>(`/api/calendar/events?from=${from}&to=${to}`)
      setCalendarEvents(data.events || [])
    } catch {
      // No calendar events
    } finally {
      setCalendarLoading(false)
    }
  }, [])

  useEffect(() => {
    ;(() => {
      fetchMeetings()
      fetchGoogleAuth()
    })()
  }, [fetchMeetings, fetchGoogleAuth])

  useEffect(() => {
    if (activeTab === 'calendar') {
      ;(() => fetchCalendarEvents())()
    }
  }, [activeTab, fetchCalendarEvents])

  const handleCreate = async () => {
    if (!formTitle) {
      toast.warning('Validation Error', 'Title is required.')
      return
    }
    setCreating(true)
    try {
      await api.post('/api/meetings', {
        title: formTitle,
        description: formDescription,
        meetingUrl: formUrl || null,
        scheduledAt: formScheduledAt || null,
        projectId: formProjectId || null,
      })
      toast.success('Meeting created')
      setDialogOpen(false)
      setFormTitle('')
      setFormDescription('')
      setFormUrl('')
      setFormScheduledAt('')
      setFormProjectId('')
      fetchMeetings()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  const handleGoogleConnect = async () => {
    setGoogleConnecting(true)
    try {
      const data = await api.get<{ url: string; demo: boolean }>('/api/auth/google/connect')
      if (data.demo) {
        toast.info('Google Connected (Demo)', 'Google account connected in demo mode.')
        await fetchGoogleAuth()
        fetchCalendarEvents()
      } else if (data.url) {
        window.open(data.url, '_blank')
      }
    } catch (err) {
      toast.error('Connection Error', err instanceof Error ? err.message : 'Failed to connect Google')
    } finally {
      setGoogleConnecting(false)
    }
  }

  const handleGoogleDisconnect = async () => {
    try {
      await api.delete('/api/auth/google/disconnect')
      setGoogleAuth(null)
      setCalendarEvents([])
      toast.info('Google Disconnected', 'Your Google account has been disconnected.')
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to disconnect')
    }
  }

  const handleSyncCalendar = async () => {
    setSyncing(true)
    try {
      await api.post('/api/calendar/sync', {})
      toast.success('Calendar Synced', 'Google Calendar events have been synced.')
      fetchCalendarEvents()
      fetchMeetings()
    } catch (err) {
      toast.error('Sync Error', err instanceof Error ? err.message : 'Failed to sync calendar')
    } finally {
      setSyncing(false)
    }
  }

  const parseAttendees = (jsonStr: string | null): { email: string; name?: string }[] => {
    if (!jsonStr) return []
    try {
      return JSON.parse(jsonStr)
    } catch {
      return []
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Video className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.meetings.title}</h1>
            <p className="text-sm text-muted-foreground">{t.meetings.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Google Auth */}
          {googleAuth?.connected ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                <Cloud className="h-3 w-3" />
                {googleAuth.email}
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleGoogleDisconnect} className="text-xs text-destructive h-7">
                {t.common.cancel}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-1" onClick={handleGoogleConnect} disabled={googleConnecting}>
              {googleConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
              Connect Google
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {t.meetings.schedule}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.meetings.schedule}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>{t.common.name} *</Label>
                  <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Meeting title" />
                </div>
                <div className="space-y-2">
                  <Label>{t.common.description}</Label>
                  <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Meeting URL (Google Meet, Zoom, etc.)</Label>
                  <Input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://meet.google.com/..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Scheduled At</Label>
                    <Input type="datetime-local" value={formScheduledAt} onChange={(e) => setFormScheduledAt(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Project ID</Label>
                    <Input value={formProjectId} onChange={(e) => setFormProjectId(e.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {t.common.create}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Google Connection Info Banner */}
      {!googleAuth?.connected && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Cloud className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Connect Google Account</p>
                  <p className="text-xs text-muted-foreground">
                    Connect Google to enable the meeting bot to join Google Meet, monitor your calendar, and auto-sync meetings.
                  </p>
                </div>
                <Button size="sm" onClick={handleGoogleConnect} disabled={googleConnecting}>
                  {googleConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Cloud className="h-4 w-4 mr-1" />}
                  {t.common.create}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="meetings" className="gap-1.5">
            <Video className="h-4 w-4" />
            {t.meetings.allMeetings}
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            {t.meetings.schedule}
          </TabsTrigger>
        </TabsList>

        {/* Meetings Tab */}
        <TabsContent value="meetings" className="mt-4">
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

          {error && !loading && (
            <Card className="border-destructive/50">
              <CardContent className="p-6 text-center">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" onClick={fetchMeetings} className="mt-3">{t.common.retry}</Button>
              </CardContent>
            </Card>
          )}

          {!loading && !error && meetings.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <Video className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">{t.meetings.noMeetings}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.meetings.schedule}</p>
              <div className="flex items-center gap-2 mt-4">
                <Button className="gap-2" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t.meetings.schedule}
                </Button>
                {googleAuth?.connected && (
                  <Button variant="outline" className="gap-2" onClick={handleSyncCalendar}>
                    <RefreshCw className="h-4 w-4" />
                    {t.meetings.schedule}
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {!loading && !error && meetings.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {meetings.map((meeting, idx) => {
                const statusConf = meetingStatusConfig[meeting.status] || { label: meeting.status, color: '' }
                const botConf = meeting.botStatus ? botStatusConfig[meeting.botStatus] : null
                return (
                  <motion.div
                    key={meeting.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <Card
                      className="cursor-pointer transition-shadow hover:shadow-md"
                      onClick={() => navigate('meeting-detail', { id: meeting.id })}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base font-semibold line-clamp-1">{meeting.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className={statusConf.color}>
                            {statusConf.label}
                          </Badge>
                          {botConf && (
                            <Badge variant="outline" className={`text-xs ${botConf.color}`}>
                              <Bot className="h-3 w-3 mr-1" />
                              {botConf.label}
                            </Badge>
                          )}
                          {meeting.recordingStatus === 'RECORDING' && (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
                              🔴 Recording
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {meeting.scheduledAt && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(meeting.scheduledAt).toLocaleDateString()}</span>
                            </div>
                          )}
                          {meeting.project && (
                            <span>{meeting.project.name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{meeting._count.participants}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <CheckSquare className="h-3 w-3" />
                            <span>{meeting._count.actionItems} actions</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            <span>{meeting._count.summaries} summaries</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="mt-4 space-y-4">
          {/* Calendar Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Google Calendar</h2>
              <p className="text-sm text-muted-foreground">
                Monitor upcoming meetings from your Google Calendar
              </p>
            </div>
            <div className="flex items-center gap-2">
              {googleAuth?.connected && (
                <Button variant="outline" size="sm" onClick={handleSyncCalendar} disabled={syncing} className="gap-1">
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {t.meetings.schedule}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={fetchCalendarEvents} className="gap-1">
                <RefreshCw className="h-3.5 w-3.5" />
                {t.common.refresh}
              </Button>
            </div>
          </div>

          {/* Not Connected */}
          {!googleAuth?.connected && (
            <Card>
              <CardContent className="py-12 text-center">
                <CloudOff className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h4 className="font-semibold">Google Calendar Not Connected</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect your Google account to view and sync calendar events
                </p>
                <Button className="mt-4 gap-2" onClick={handleGoogleConnect} disabled={googleConnecting}>
                  {googleConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                  Connect Google
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Calendar Loading */}
          {googleAuth?.connected && calendarLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-5 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Calendar Events */}
          {googleAuth?.connected && !calendarLoading && calendarEvents.length > 0 && (
            <div className="space-y-3">
              {calendarEvents.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => {
                    if (event.meetingId) {
                      navigate('meeting-detail', { id: event.meetingId })
                    }
                  }}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center min-w-12 text-center">
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.startAt).toLocaleDateString('en-US', { weekday: 'short' })}
                          </span>
                          <span className="text-lg font-bold">
                            {new Date(event.startAt).getDate()}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.startAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm truncate">{event.title}</h4>
                            {event.meetingId ? (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 shrink-0">
                                Linked
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs shrink-0">
                                Not Linked
                              </Badge>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {event.meetingUrl && (
                              <div className="flex items-center gap-1 text-primary">
                                <ExternalLink className="h-3 w-3" />
                                <span className="truncate">Join</span>
                              </div>
                            )}
                            {event.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{event.location}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {new Date(event.startAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - 
                                {new Date(event.endAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              <span>{parseAttendees(event.attendees).length} attendees</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {/* Empty Calendar */}
          {googleAuth?.connected && !calendarLoading && calendarEvents.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h4 className="font-semibold">No Calendar Events</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Sync your Google Calendar to see upcoming meetings
                </p>
                <Button className="mt-4 gap-2" onClick={handleSyncCalendar} disabled={syncing}>
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {t.common.refresh}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
