'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dayjs from 'dayjs'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Video,
  FileText,
  Clock,
  AlertTriangle,
  Flag,
  Loader2,
  X,
  ArrowRight,
  Users,
  Link2,
  MapPin,
  RefreshCw,
  ExternalLink,
  Mail,
  Repeat,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api-client'
import { toast } from '@/lib/toast'

// ============================================================
// Types
// ============================================================

interface CalendarEvent {
  id: string
  title: string
  type: 'MEETING' | 'REQUEST_DEADLINE' | 'WORK_ITEM_DUE' | 'OVERDUE' | 'MILESTONE' | 'GOOGLE_CALENDAR'
  date: string // ISO date
  time?: string
  endDate?: string
  projectId?: string
  projectName?: string
  requestId?: string
  status?: string
  view?: string // navigation view
  viewParams?: Record<string, string>
  // Google Calendar specific
  meetingUrl?: string
  location?: string
  organizerEmail?: string
  attendees?: Array<{ email: string; name: string; responseStatus: string }>
  isRecurring?: boolean
  googleEventId?: string
  isGoogleCalendar?: boolean
}

// ============================================================
// Event type configuration
// ============================================================

const EVENT_TYPE_CONFIG: Record<CalendarEvent['type'], {
  label: string
  dotColor: string
  bgColor: string
  textColor: string
  borderColor: string
  icon: React.ElementType
}> = {
  MEETING: {
    label: 'Meeting',
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-200 dark:border-green-800',
    icon: Video,
  },
  GOOGLE_CALENDAR: {
    label: 'Google Calendar',
    dotColor: 'bg-cyan-500',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
    textColor: 'text-cyan-700 dark:text-cyan-300',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    icon: CalendarDays,
  },
  REQUEST_DEADLINE: {
    label: 'Request Deadline',
    dotColor: 'bg-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-200 dark:border-blue-800',
    icon: FileText,
  },
  WORK_ITEM_DUE: {
    label: 'Work Item Due',
    dotColor: 'bg-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    textColor: 'text-orange-700 dark:text-orange-300',
    borderColor: 'border-orange-200 dark:border-orange-800',
    icon: Clock,
  },
  OVERDUE: {
    label: 'Overdue',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    textColor: 'text-red-700 dark:text-red-300',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: AlertTriangle,
  },
  MILESTONE: {
    label: 'Milestone',
    dotColor: 'bg-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    textColor: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-200 dark:border-purple-800',
    icon: Flag,
  },
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ============================================================
// Component
// ============================================================

export default function CalendarPage() {
  const navigate = useAppStore((s) => s.navigate)
  const { t } = useI18n()

  const [currentMonth, setCurrentMonth] = useState(dayjs())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')
  const [currentDay, setCurrentDay] = useState(dayjs())

  // Google Calendar connection state
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [googleMode, setGoogleMode] = useState<string | null>(null)
  const [syncingGoogle, setSyncingGoogle] = useState(false)

  // ============================================================
  // Data Fetching
  // ============================================================

  const fetchEvents = useCallback(async (month: dayjs.Dayjs) => {
    setLoading(true)
    setError(null)
    try {
      const monthStr = month.format('YYYY-MM')
      const data = await api.get<{ events: CalendarEvent[]; googleConnected: boolean; googleEmail: string | null; googleMode: string | null }>(`/api/calendar/events?month=${monthStr}`)
      setEvents(data.events || [])
      setGoogleConnected(data.googleConnected || false)
      setGoogleEmail(data.googleEmail || null)
      setGoogleMode(data.googleMode || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar events')
      toast.error('Error', 'Failed to load calendar events')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents(currentMonth)
  }, [currentMonth, fetchEvents])

  // ============================================================
  // Google Calendar Actions (sync only; connect/disconnect via Google Settings page)
  // ============================================================

  const handleSyncGoogle = async () => {
    setSyncingGoogle(true)
    try {
      const data = await api.post<{ success: boolean; syncedCount: number; mode: string }>('/api/calendar/sync', {})
      if (data.success) {
        toast.success('Sync Complete', `Synced ${data.syncedCount} event${data.syncedCount !== 1 ? 's' : ''} from Google Calendar`)
        // Refresh events
        fetchEvents(currentMonth)
      }
    } catch (err) {
      toast.error('Sync Failed', 'Could not sync Google Calendar events')
    } finally {
      setSyncingGoogle(false)
    }
  }

  // ============================================================
  // Calendar Grid Computation
  // ============================================================

  const calendarDays = useMemo(() => {
    const startOfMonth = currentMonth.startOf('month')
    const endOfMonth = currentMonth.endOf('month')
    const startDayOfWeek = startOfMonth.day() // 0=Sun
    const totalDays = endOfMonth.date()

    const days: Array<{
      date: string
      day: number
      isCurrentMonth: boolean
      isToday: boolean
      isWeekend: boolean
    }> = []

    // Previous month padding
    const prevMonth = currentMonth.subtract(1, 'month')
    const prevMonthDays = prevMonth.daysInMonth()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      const dateStr = prevMonth.date(d).format('YYYY-MM-DD')
      const dayOfWeek = prevMonth.date(d).day()
      days.push({
        date: dateStr,
        day: d,
        isCurrentMonth: false,
        isToday: dateStr === dayjs().format('YYYY-MM-DD'),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      })
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = currentMonth.date(d).format('YYYY-MM-DD')
      const dayOfWeek = currentMonth.date(d).day()
      days.push({
        date: dateStr,
        day: d,
        isCurrentMonth: true,
        isToday: dateStr === dayjs().format('YYYY-MM-DD'),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      })
    }

    // Next month padding
    const remaining = 42 - days.length // 6 rows × 7 cols
    const nextMonth = currentMonth.add(1, 'month')
    for (let d = 1; d <= remaining; d++) {
      const dateStr = nextMonth.date(d).format('YYYY-MM-DD')
      const dayOfWeek = nextMonth.date(d).day()
      days.push({
        date: dateStr,
        day: d,
        isCurrentMonth: false,
        isToday: dateStr === dayjs().format('YYYY-MM-DD'),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      })
    }

    return days
  }, [currentMonth])

  const weekDays = useMemo(() => {
    const startOfWeek = currentDay.startOf('week') // Sunday
    const days: Array<{ date: string; day: number; dayName: string; isToday: boolean; isWeekend: boolean }> = []
    for (let i = 0; i < 7; i++) {
      const d = startOfWeek.add(i, 'day')
      days.push({
        date: d.format('YYYY-MM-DD'),
        day: d.date(),
        dayName: d.format('ddd'),
        isToday: d.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD'),
        isWeekend: d.day() === 0 || d.day() === 6,
      })
    }
    return days
  }, [currentDay])

  // Sync currentMonth when navigating across month boundaries in week/day mode
  useEffect(() => {
    if (viewMode !== 'month') {
      const monthOfCurrentDay = currentDay.startOf('month')
      if (monthOfCurrentDay.format('YYYY-MM') !== currentMonth.format('YYYY-MM')) {
        setCurrentMonth(monthOfCurrentDay)
      }
    }
  }, [currentDay, viewMode, currentMonth])

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const event of events) {
      const dateKey = dayjs(event.date).format('YYYY-MM-DD')
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(event)
    }
    return map
  }, [events])

  // Events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return []
    return eventsByDate[selectedDate] || []
  }, [selectedDate, eventsByDate])

  // Upcoming events for sidebar (next 7 days)
  const upcomingEvents = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD')
    const sevenDaysLater = dayjs().add(7, 'day').format('YYYY-MM-DD')
    return events
      .filter((e) => {
        const dateKey = dayjs(e.date).format('YYYY-MM-DD')
        return dateKey >= today && dateKey <= sevenDaysLater
      })
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf())
  }, [events])

  // Stats
  const stats = useMemo(() => {
    const meetings = events.filter((e) => e.type === 'MEETING').length
    const googleEvents = events.filter((e) => e.type === 'GOOGLE_CALENDAR').length
    const deadlines = events.filter((e) => e.type === 'REQUEST_DEADLINE').length
    const workItems = events.filter((e) => e.type === 'WORK_ITEM_DUE').length
    const overdue = events.filter((e) => e.type === 'OVERDUE').length
    return { meetings, googleEvents, deadlines, workItems, overdue }
  }, [events])

  // ============================================================
  // Handlers
  // ============================================================

  const handlePrev = () => {
    if (viewMode === 'month') setCurrentMonth((prev) => prev.subtract(1, 'month'))
    else if (viewMode === 'week') setCurrentDay((prev) => prev.subtract(1, 'week'))
    else setCurrentDay((prev) => prev.subtract(1, 'day'))
  }
  const handleNext = () => {
    if (viewMode === 'month') setCurrentMonth((prev) => prev.add(1, 'month'))
    else if (viewMode === 'week') setCurrentDay((prev) => prev.add(1, 'week'))
    else setCurrentDay((prev) => prev.add(1, 'day'))
  }
  const handleToday = () => {
    setCurrentMonth(dayjs())
    setCurrentDay(dayjs())
    setSelectedDate(dayjs().format('YYYY-MM-DD'))
  }

  const handleViewModeChange = (mode: 'month' | 'week' | 'day') => {
    setViewMode(mode)
    if (mode === 'month') {
      setCurrentMonth(currentDay.startOf('month'))
    } else {
      setCurrentMonth(currentDay.startOf('month'))
    }
  }

  const handleDayClick = (date: string) => {
    setSelectedDate((prev) => (prev === date ? null : date))
  }

  const handleEventClick = (event: CalendarEvent) => {
    if (event.view) {
      navigate(event.view, event.viewParams || {})
    } else if (event.type === 'GOOGLE_CALENDAR' && event.meetingUrl) {
      window.open(event.meetingUrl, '_blank')
    } else if (event.type === 'MEETING') {
      navigate('meetings')
    } else if (event.type === 'REQUEST_DEADLINE' && event.requestId) {
      navigate('request-detail', { id: event.requestId })
    } else if (event.type === 'WORK_ITEM_DUE') {
      navigate('work-items')
    }
  }

  // Get unique event types for a date (for dot indicators)
  const getDateEventTypes = (date: string): CalendarEvent['type'][] => {
    const dayEvents = eventsByDate[date] || []
    const types = [...new Set(dayEvents.map((e) => e.type))]
    return types
  }

  // ============================================================
  // Render: Event item in day detail panel
  // ============================================================

  const renderEventItem = (event: CalendarEvent, compact = false) => {
    const config = EVENT_TYPE_CONFIG[event.type]
    const Icon = config.icon

    return (
      <motion.div
        key={event.id}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.15 }}
        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all hover:shadow-sm ${config.bgColor} ${config.borderColor}`}
        onClick={() => handleEventClick(event)}
      >
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${config.bgColor}`}>
          <Icon className={`h-4 w-4 ${config.textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{event.title}</span>
            {event.isRecurring && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />
                </TooltipTrigger>
                <TooltipContent>Recurring event</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {event.time && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {event.time}
              </span>
            )}
            {event.projectName && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <FolderIcon className="h-3 w-3" />
                {event.projectName}
              </span>
            )}
            {event.location && !compact && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[200px]">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{event.location}</span>
              </span>
            )}
          </div>
          {/* Google Meet link */}
          {event.meetingUrl && !compact && (
            <div className="mt-1.5">
              <a
                href={event.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors"
              >
                <Video className="h-3 w-3" />
                Join Google Meet
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          )}
          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && !compact && (
            <div className="mt-1.5 flex items-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground shrink-0" />
              <div className="flex -space-x-1.5">
                {event.attendees.slice(0, 4).map((att, idx) => (
                  <Tooltip key={idx}>
                    <TooltipTrigger asChild>
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted border border-background text-[9px] font-medium text-muted-foreground">
                        {att.name ? att.name[0].toUpperCase() : att.email[0].toUpperCase()}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">
                        <div className="font-medium">{att.name || att.email}</div>
                        <div className="text-muted-foreground">{att.responseStatus}</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {event.attendees.length > 4 && (
                  <span className="text-[10px] text-muted-foreground ml-2">
                    +{event.attendees.length - 4} more
                  </span>
                )}
              </div>
            </div>
          )}
          {/* Organizer */}
          {event.organizerEmail && !compact && (
            <div className="mt-1 flex items-center gap-1">
              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate">{event.organizerEmail}</span>
            </div>
          )}
          {!compact && event.status && !event.isGoogleCalendar && (
            <Badge variant="outline" className={`mt-1.5 text-[10px] ${config.textColor} ${config.borderColor}`}>
              {event.status}
            </Badge>
          )}
          {event.isGoogleCalendar && !compact && (
            <Badge variant="outline" className={`mt-1.5 text-[10px] ${config.textColor} ${config.borderColor}`}>
              Google Calendar
            </Badge>
          )}
        </div>
        {(event.view || event.meetingUrl) && (
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        )}
      </motion.div>
    )
  }

  // ============================================================
  // Render: Mini Calendar for Sidebar
  // ============================================================

  const renderMiniCalendar = () => {
    const startOfMonth = currentMonth.startOf('month')
    const endOfMonth = currentMonth.endOf('month')
    const startDayOfWeek = startOfMonth.day()
    const totalDays = endOfMonth.date()

    const miniDays: Array<{ day: number; dateStr: string; isCurrentMonth: boolean; isToday: boolean }> = []

    const prevMonth = currentMonth.subtract(1, 'month')
    const prevMonthDays = prevMonth.daysInMonth()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      const dateStr = prevMonth.date(d).format('YYYY-MM-DD')
      miniDays.push({ day: d, dateStr, isCurrentMonth: false, isToday: dateStr === dayjs().format('YYYY-MM-DD') })
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = currentMonth.date(d).format('YYYY-MM-DD')
      miniDays.push({ day: d, dateStr, isCurrentMonth: true, isToday: dateStr === dayjs().format('YYYY-MM-DD') })
    }

    const remaining = 42 - miniDays.length
    const nextMonth = currentMonth.add(1, 'month')
    for (let d = 1; d <= remaining; d++) {
      const dateStr = nextMonth.date(d).format('YYYY-MM-DD')
      miniDays.push({ day: d, dateStr, isCurrentMonth: false, isToday: dateStr === dayjs().format('YYYY-MM-DD') })
    }

    return (
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm font-semibold">{currentMonth.format('MMMM YYYY')}</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="grid grid-cols-7 gap-0">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-0.5">
                {d}
              </div>
            ))}
            {miniDays.map((d, i) => {
              const hasEvents = (eventsByDate[d.dateStr] || []).length > 0
              const isSelected = d.dateStr === selectedDate
              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(d.dateStr)}
                  className={`
                    relative flex items-center justify-center h-6 text-[11px] rounded transition-colors
                    ${!d.isCurrentMonth ? 'text-muted-foreground/40' : ''}
                    ${d.isToday && !isSelected ? 'font-bold text-primary' : ''}
                    ${isSelected ? 'bg-primary text-primary-foreground rounded' : 'hover:bg-muted'}
                  `}
                >
                  {d.day}
                  {hasEvents && !isSelected && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ============================================================
  // Render: Google Calendar Connection Panel
  // ============================================================

  const renderGoogleConnectionPanel = () => (
    <Card className={googleConnected ? 'border-cyan-200 dark:border-cyan-800' : ''}>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-cyan-500" />
          Google Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        {googleConnected ? (
          <>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-foreground font-medium">Connected</span>
              {googleMode === 'demo' && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-600 border-amber-300">
                  Demo
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{googleEmail}</p>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] flex-1 gap-1"
                onClick={handleSyncGoogle}
                disabled={syncingGoogle}
              >
                {syncingGoogle ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Sync
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={() => navigate('admin-google-settings')}
              >
                <Settings className="h-3 w-3" />
                Settings
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">
              Connect your Google Calendar to see events, meetings, and Google Meet links.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] w-full gap-1.5 border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-950/30"
              onClick={() => navigate('admin-google-settings')}
            >
              <Link2 className="h-3 w-3" />
              Google Settings
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )

  // ============================================================
  // Render: Upcoming Events in Sidebar
  // ============================================================

  const renderUpcomingEvents = () => (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-primary" />
          Upcoming 7 Days
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {upcomingEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No upcoming events</p>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {upcomingEvents.map((event) => {
                const config = EVENT_TYPE_CONFIG[event.type]
                const Icon = config.icon
                const eventDate = dayjs(event.date)
                return (
                  <button
                    key={event.id}
                    onClick={() => handleEventClick(event)}
                    className="flex items-start gap-2 w-full text-left hover:bg-muted/50 rounded p-1.5 transition-colors"
                  >
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${config.bgColor}`}>
                      <Icon className={`h-3 w-3 ${config.textColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{event.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {eventDate.format('ddd, MMM D')}
                        {event.time && ` · ${event.time}`}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )

  // ============================================================
  // FolderIcon helper
  // ============================================================

  const FolderIcon = ({ className }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className || 'h-3 w-3'}
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  )

  // ============================================================
  // Main Render
  // ============================================================

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t.calendar.title}</h1>
              <p className="text-sm text-muted-foreground">{t.calendar.subtitle}</p>
            </div>
          </div>

          {/* Navigation & View Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleToday}>
              Today
            </Button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold min-w-[140px] text-center">
                {viewMode === 'month' && currentMonth.format('MMMM YYYY')}
                {viewMode === 'week' && (() => {
                  const weekStart = currentDay.startOf('week')
                  const weekEnd = currentDay.endOf('week')
                  return `${weekStart.format('MMM D')} - ${weekEnd.format('MMM D, YYYY')}`
                })()}
                {viewMode === 'day' && currentDay.format('dddd, MMMM D, YYYY')}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* View Toggle */}
            <div className="flex items-center border rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'month' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-8 text-xs px-3"
                onClick={() => handleViewModeChange('month')}
              >
                Month
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-8 text-xs px-3"
                onClick={() => handleViewModeChange('week')}
              >
                Week
              </Button>
              <Button
                variant={viewMode === 'day' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-8 text-xs px-3"
                onClick={() => handleViewModeChange('day')}
              >
                Day
              </Button>
            </div>

            {/* Google Calendar quick sync */}
            {googleConnected && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-cyan-200 text-cyan-600 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-950/30"
                    onClick={handleSyncGoogle}
                    disabled={syncingGoogle}
                  >
                    {syncingGoogle ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sync Google Calendar</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <Video className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Meetings</p>
                <p className="text-lg font-bold">{stats.meetings}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-cyan-200 dark:border-cyan-800">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                <CalendarDays className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Google Cal</p>
                <p className="text-lg font-bold">{stats.googleEvents}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deadlines</p>
                <p className="text-lg font-bold">{stats.deadlines}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-200 dark:border-orange-800">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Work Items Due</p>
                <p className="text-lg font-bold">{stats.workItems}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Overdue</p>
                <p className="text-lg font-bold">{stats.overdue}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content: Calendar + Sidebar */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Calendar Grid */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardContent className="p-2 sm:p-4">
                {/* Loading / Error States */}
                {loading ? (
                  viewMode === 'month' ? (
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: 42 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 sm:h-24 rounded-md" />
                      ))}
                    </div>
                  ) : viewMode === 'week' ? (
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-[300px] rounded-lg" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 rounded-lg" />
                      ))}
                    </div>
                  )
                ) : error ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
                    <p className="text-sm text-destructive">{error}</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchEvents(currentMonth)}>
                      {t.common.retry}
                    </Button>
                  </div>
                ) : viewMode === 'month' ? (
                  <>
                    {/* Day Headers - Month view */}
                    <div className="grid grid-cols-7 mb-1">
                      {DAY_NAMES.map((name) => (
                        <div
                          key={name}
                          className="text-center text-xs font-semibold text-muted-foreground py-2"
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((dayInfo, idx) => {
                        const dayEvents = eventsByDate[dayInfo.date] || []
                        const eventTypes = getDateEventTypes(dayInfo.date)
                        const isSelected = selectedDate === dayInfo.date

                        return (
                          <motion.button
                            key={idx}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: Math.min(idx * 0.01, 0.3) }}
                            onClick={() => handleDayClick(dayInfo.date)}
                            className={`
                              relative flex flex-col items-start p-1 sm:p-2 rounded-lg min-h-[70px] sm:min-h-[90px]
                              transition-all duration-150 text-left
                              ${!dayInfo.isCurrentMonth ? 'opacity-40' : ''}
                              ${isSelected
                                ? 'bg-primary/10 ring-2 ring-primary shadow-sm'
                                : 'hover:bg-muted/80'
                              }
                              ${dayInfo.isToday && !isSelected ? 'ring-2 ring-primary/60' : ''}
                            `}
                          >
                            <span
                              className={`
                                text-xs sm:text-sm font-medium
                                ${dayInfo.isToday ? 'bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center' : ''}
                                ${dayInfo.isWeekend && dayInfo.isCurrentMonth && !dayInfo.isToday ? 'text-muted-foreground' : ''}
                              `}
                            >
                              {dayInfo.day}
                            </span>

                            {/* Event dots and chips */}
                            <div className="flex-1 w-full mt-1 space-y-0.5 overflow-hidden">
                              {dayEvents.slice(0, 2).map((event, evIdx) => {
                                const config = EVENT_TYPE_CONFIG[event.type]
                                return (
                                  <div
                                    key={evIdx}
                                    className={`hidden sm:flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-tight truncate ${config.bgColor} ${config.textColor}`}
                                  >
                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${config.dotColor}`} />
                                    <span className="truncate">{event.title}</span>
                                  </div>
                                )
                              })}
                              <div className="flex sm:hidden flex-wrap gap-0.5 mt-0.5">
                                {eventTypes.map((type) => {
                                  const config = EVENT_TYPE_CONFIG[type]
                                  return (
                                    <span
                                      key={type}
                                      className={`h-2 w-2 rounded-full ${config.dotColor}`}
                                    />
                                  )
                                })}
                              </div>
                              {dayEvents.length > 2 && (
                                <span className="hidden sm:block text-[10px] text-muted-foreground pl-1">
                                  +{dayEvents.length - 2} more
                                </span>
                              )}
                              {dayEvents.length > 0 && (
                                <div className="hidden sm:flex flex-wrap gap-0.5 mt-0.5">
                                  {eventTypes.map((type) => {
                                    const config = EVENT_TYPE_CONFIG[type]
                                    return (
                                      <span
                                        key={type}
                                        className={`h-1.5 w-1.5 rounded-full ${config.dotColor}`}
                                      />
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  </>
                ) : viewMode === 'week' ? (
                  <>
                    {/* Week View: 7 columns with events */}
                    <div className="grid grid-cols-7 gap-2">
                      {weekDays.map((dayInfo) => {
                        const dayEvents = eventsByDate[dayInfo.date] || []
                        const isSelected = selectedDate === dayInfo.date
                        return (
                          <div
                            key={dayInfo.date}
                            className={`flex flex-col rounded-lg border min-h-[300px] ${
                              dayInfo.isToday ? 'border-primary ring-1 ring-primary' : 'border-border'
                            } ${isSelected ? 'bg-primary/5' : ''}`}
                          >
                            <div className={`text-center py-2 border-b ${
                              dayInfo.isToday ? 'bg-primary text-primary-foreground' : 'bg-muted/50'
                            }`}>
                              <div className="text-xs font-medium">{dayInfo.dayName}</div>
                              <div className={`text-lg font-bold ${dayInfo.isToday ? '' : dayInfo.isWeekend ? 'text-muted-foreground' : ''}`}>
                                {dayInfo.day}
                              </div>
                            </div>
                            <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto max-h-[400px]">
                              {dayEvents.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground text-center py-4">No events</p>
                              ) : (
                                dayEvents.map((event) => {
                                  const config = EVENT_TYPE_CONFIG[event.type]
                                  const Icon = config.icon
                                  return (
                                    <button
                                      key={event.id}
                                      onClick={() => handleEventClick(event)}
                                      className={`w-full text-left rounded-md border p-1.5 transition-all hover:shadow-sm ${config.bgColor} ${config.borderColor}`}
                                    >
                                      <div className="flex items-center gap-1">
                                        <Icon className={`h-3 w-3 ${config.textColor}`} />
                                        <span className="text-[11px] font-medium text-foreground truncate">{event.title}</span>
                                      </div>
                                      {event.time && (
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                          <Clock className="h-2.5 w-2.5" />
                                          {event.time}
                                        </span>
                                      )}
                                    </button>
                                  )
                                })
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Day View: Timeline-style view for the selected/current day */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold">{currentDay.format('dddd')}</h3>
                          <p className="text-sm text-muted-foreground">{currentDay.format('MMMM D, YYYY')}</p>
                        </div>
                        {currentDay.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD') && (
                          <Badge>Today</Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        {(() => {
                          const dayEvents = eventsByDate[currentDay.format('YYYY-MM-DD')] || []
                          if (dayEvents.length === 0) {
                            return (
                              <div className="flex flex-col items-center justify-center py-16 text-center">
                                <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-3" />
                                <p className="text-sm font-medium text-muted-foreground">No events today</p>
                                <p className="text-xs text-muted-foreground/70 mt-1">Events will appear here when scheduled</p>
                              </div>
                            )
                          }
                          return dayEvents.map((event) => renderEventItem(event))
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: Google Connection + Mini Calendar + Upcoming Events */}
          <div className="hidden lg:flex flex-col gap-4 w-72 shrink-0">
            {renderGoogleConnectionPanel()}
            {renderMiniCalendar()}
            {renderUpcomingEvents()}

            {/* Legend */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm font-semibold">Legend</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="space-y-2">
                  {Object.entries(EVENT_TYPE_CONFIG).map(([type, config]) => (
                    <div key={type} className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${config.dotColor}`} />
                      <span className="text-xs text-muted-foreground">{config.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Mobile: Google Calendar Connection (below calendar grid) */}
        <div className="lg:hidden">
          {renderGoogleConnectionPanel()}
        </div>

        {/* Day Detail Panel (Dialog for mobile, inline for desktop) */}
        <AnimatePresence>
          {selectedDate && selectedDateEvents.length > 0 && (
            <>
              {/* Mobile: Dialog */}
              <div className="lg:hidden">
                <Dialog open={!!selectedDate && selectedDateEvents.length > 0} onOpenChange={(open) => { if (!open) setSelectedDate(null) }}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-primary" />
                        {dayjs(selectedDate).format('dddd, MMMM D, YYYY')}
                      </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh]">
                      <div className="space-y-2 pr-2">
                        {selectedDateEvents.map((event) => renderEventItem(event))}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Desktop: Inline panel */}
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="hidden lg:block"
              >
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <CalendarDays className="h-5 w-5 text-primary" />
                        {dayjs(selectedDate).format('dddd, MMMM D, YYYY')}
                        <Badge variant="secondary" className="text-xs">
                          {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''}
                        </Badge>
                      </CardTitle>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                      {selectedDateEvents.map((event) => renderEventItem(event))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Empty Day Detail (when selected date has no events) */}
        <AnimatePresence>
          {selectedDate && selectedDateEvents.length === 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardContent className="py-6 text-center">
                  <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No events on {dayjs(selectedDate).format('dddd, MMMM D')}
                  </p>
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSelectedDate(null)}>
                    Close
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  )
}
