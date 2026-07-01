'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  Loader2,
  Users,
  FolderKanban,
  Plus,
  LayoutList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface TimelineAssignee {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface TimelineItem {
  id: string
  title: string
  phase: string
  phaseLabel: string
  phaseColor: string
  startDate: string
  endDate: string
  status: string
  priority: string
  assignees: TimelineAssignee[]
  type: string
  aitNo: string
  progress: number
}

interface TimelinePhase {
  key: string
  label: string
  color: string
  order: number
  items: TimelineItem[]
}

interface MemberGroup {
  memberId: string
  memberName: string
  memberEmail: string
  memberAvatarUrl: string | null
  items: TimelineItem[]
}

interface TimelineData {
  phases: TimelinePhase[]
  memberGroups: MemberGroup[]
  timelineStart: string
  timelineEnd: string
  totalItems: number
  projectStartDate: string
  projectEndDate: string
}

interface ProjectTimelineProps {
  projectId: string
}

// ============================================================
// Constants
// ============================================================

const PHASE_COLORS: Record<string, string> = {
  BA: '#8b5cf6',   // purple
  DEV: '#06b6d4',  // cyan
  QA: '#f59e0b',   // amber
  UAT: '#10b981',  // emerald
  MA: '#f43f5e',   // rose
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  ON_HOLD: { label: 'On Hold', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: 'Critical', color: 'bg-red-500' },
  HIGH: { label: 'High', color: 'bg-orange-500' },
  MEDIUM: { label: 'Medium', color: 'bg-yellow-500' },
  LOW: { label: 'Low', color: 'bg-green-500' },
}

const MONTH_WIDTH = 220
const ROW_HEIGHT = 44
const LEFT_PANEL_WIDTH = 'w-64'

// ============================================================
// Utility Functions
// ============================================================

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr)
}

function daysBetween(start: Date, end: Date): number {
  const msPerDay = 86400000
  return (end.getTime() - start.getTime()) / msPerDay
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getPhaseIcon(phase: string): string {
  const icons: Record<string, string> = {
    BA: 'UX',
    DEV: 'DV',
    QA: 'QA',
    UAT: 'UT',
    MA: 'GO',
  }
  return icons[phase] || phase.slice(0, 2)
}

// ============================================================
// Sub-Components
// ============================================================

/** The horizontal time grid with month columns and optional today line */
function GanttTimeGrid({
  months,
  totalWidth,
  viewStart,
  viewEnd,
}: {
  months: Date[]
  totalWidth: number
  viewStart: Date
  viewEnd: Date
}) {
  const today = new Date()
  const todayTime = today.getTime()
  const viewStartTime = viewStart.getTime()
  const viewEndTime = viewEnd.getTime()

  // Calculate today line position
  const todayOffset =
    viewStartTime < todayTime && todayTime < viewEndTime
      ? ((todayTime - viewStartTime) / (viewEndTime - viewStartTime)) * totalWidth
      : null

  return (
    <div className="relative h-full" style={{ width: totalWidth }}>
      {/* Month columns */}
      <div className="flex h-full">
        {months.map((month, i) => {
          const isLast = i === months.length - 1
          return (
            <div
              key={getMonthKey(month)}
              className="relative border-r border-b border-border/50"
              style={{ width: MONTH_WIDTH }}
            >
              {/* Month header */}
              <div className="sticky top-0 z-10 border-b border-border/50 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                {formatMonth(month)}
              </div>
              {/* Week grid lines */}
              {(() => {
                const lines: React.ReactNode[] = []
                const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
                for (let d = 7; d < daysInMonth; d += 7) {
                  const pct = (d / daysInMonth) * 100
                  lines.push(
                    <div
                      key={`w${d}`}
                      className="absolute top-0 bottom-0 border-l border-border/20"
                      style={{ left: `${pct}%` }}
                    />
                  )
                }
                return lines
              })()}
            </div>
          )
        })}
      </div>

      {/* Today indicator */}
      {todayOffset !== null && (
        <div
          className="absolute top-0 bottom-0 z-20 w-0.5 bg-blue-500"
          style={{ left: todayOffset }}
        >
          <div className="absolute -top-0 left-1/2 -translate-x-1/2 rounded-b bg-blue-500 px-1.5 py-0.5 text-[9px] font-semibold text-white whitespace-nowrap">
            Today
          </div>
        </div>
      )}
    </div>
  )
}

/** A single task bar on the Gantt chart */
function GanttBar({
  item,
  viewStart,
  viewEnd,
  totalWidth,
  rowIndex,
}: {
  item: TimelineItem
  viewStart: Date
  viewEnd: Date
  totalWidth: number
  rowIndex: number
}) {
  const itemStart = parseDate(item.startDate)
  const itemEnd = parseDate(item.endDate)

  const viewStartTime = viewStart.getTime()
  const viewEndTime = viewEnd.getTime()
  const totalMs = viewEndTime - viewStartTime

  // Clamp to visible range
  const clampedStart = Math.max(itemStart.getTime(), viewStartTime)
  const clampedEnd = Math.min(itemEnd.getTime(), viewEndTime)

  const leftPct = ((clampedStart - viewStartTime) / totalMs) * totalWidth
  const widthPct = ((clampedEnd - clampedStart) / totalMs) * totalWidth

  const barColor = item.phaseColor || PHASE_COLORS[item.phase] || '#6b7280'
  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING

  const topOffset = rowIndex * ROW_HEIGHT + 8
  const barHeight = ROW_HEIGHT - 16

  // Format dates for tooltip
  const startDateStr = itemStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endDateStr = itemEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const durationDays = Math.ceil(daysBetween(itemStart, itemEnd))

  const tooltipContent = (
    <div className="space-y-1.5">
      <div className="font-semibold text-sm">{item.title}</div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{item.aitNo}</span>
        <span className="text-border">|</span>
        <span>{startDateStr} – {endDateStr}</span>
        <span className="text-border">|</span>
        <span>{durationDays}d</span>
      </div>
      {item.assignees.length > 0 && (
        <div className="flex items-center gap-1 text-xs">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span>{item.assignees.map(a => a.name).join(', ')}</span>
        </div>
      )}
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="outline" className="h-4 px-1 text-[10px]">
          {status.label}
        </Badge>
        {item.progress > 0 && (
          <span className="text-muted-foreground">{item.progress}% complete</span>
        )}
      </div>
    </div>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="absolute z-10 cursor-pointer rounded-md shadow-sm transition-all hover:shadow-md hover:z-20"
          style={{
            left: leftPct,
            width: Math.max(widthPct, 24),
            top: topOffset,
            height: barHeight,
          }}
        >
          {/* Background bar */}
          <div
            className="absolute inset-0 rounded-md opacity-20"
            style={{ backgroundColor: barColor }}
          />
          {/* Progress fill */}
          {item.progress > 0 && (
            <div
              className="absolute inset-y-0 left-0 rounded-md opacity-50"
              style={{
                backgroundColor: barColor,
                width: `${item.progress}%`,
                borderRadius: widthPct < 24 ? '4px' : undefined,
              }}
            />
          )}
          {/* Left border accent */}
          <div
            className="absolute inset-y-0 left-0 w-1 rounded-l-md"
            style={{ backgroundColor: barColor }}
          />
          {/* Title text */}
          <div className="relative flex h-full items-center px-2.5 overflow-hidden">
            <span className="truncate text-[11px] font-medium text-foreground">
              {item.title}
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function ProjectTimeline({ projectId }: ProjectTimelineProps) {
  // State
  const [data, setData] = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'task' | 'member'>('task')
  const [viewMode] = useState<'monthly'>('monthly')
  const [currentViewDate, setCurrentViewDate] = useState(new Date())
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const leftPanelRef = useRef<HTMLDivElement>(null)

  // Fetch timeline data
  const fetchTimeline = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ data: TimelineData }>(`/api/projects/${projectId}/timeline`)
      setData(res.data)
    } catch (err) {
      console.error('Failed to fetch timeline:', err)
      setError('Failed to load timeline data')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchTimeline()
  }, [fetchTimeline])

  // Calculate visible date range (3 months centered on currentViewDate)
  const { months, viewStart, viewEnd, totalWidth } = useMemo(() => {
    const year = currentViewDate.getFullYear()
    const month = currentViewDate.getMonth()

    // Show 3 months: previous, current, next
    const monthList: Date[] = []
    for (let offset = -1; offset <= 1; offset++) {
      const d = new Date(year, month + offset, 1)
      monthList.push(d)
    }

    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month + 2, 0, 23, 59, 59, 999) // last day of next month

    return {
      months: monthList,
      viewStart: start,
      viewEnd: end,
      totalWidth: MONTH_WIDTH * 3,
    }
  }, [currentViewDate])

  // Navigation handlers
  const goPrev = () => {
    setCurrentViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goNext = () => {
    setCurrentViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const goToday = () => {
    setCurrentViewDate(new Date())
  }

  // Sync left panel scroll with right panel
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current && leftPanelRef.current) {
      leftPanelRef.current.scrollTop = scrollContainerRef.current.scrollTop
    }
  }, [])

  // Group items
  const groups = useMemo(() => {
    if (!data) return []

    // Apply status filter
    const filterItems = (items: TimelineItem[]) => {
      if (statusFilter === 'all') return items
      return items.filter(item => item.status === statusFilter)
    }

    if (groupBy === 'task') {
      return data.phases
        .sort((a, b) => a.order - b.order)
        .map(phase => ({
          key: phase.key,
          label: phase.label,
          color: phase.color,
          items: filterItems(phase.items),
        }))
        .filter(g => g.items.length > 0)
    } else {
      return data.memberGroups.map(mg => ({
        key: mg.memberId,
        label: mg.memberName,
        color: '#6366f1',
        avatarUrl: mg.memberAvatarUrl,
        items: filterItems(mg.items),
      })).filter(g => g.items.length > 0)
    }
  }, [data, groupBy, statusFilter])

  // Total rows for height calculation
  const totalRows = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.items.length, 0)
  }, [groups])

  // Unique statuses for filter
  const uniqueStatuses = useMemo(() => {
    if (!data) return []
    const statuses = new Set<string>()
    data.phases.forEach(p => p.items.forEach(i => statuses.add(i.status)))
    return Array.from(statuses)
  }, [data])

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="flex gap-0">
          <Skeleton className="h-[400px] w-64 shrink-0" />
          <Skeleton className="h-[400px] flex-1" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <Calendar className="h-6 w-6 text-destructive" />
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={fetchTimeline}>
          Retry
        </Button>
      </div>
    )
  }

  // Empty state
  if (!data || data.totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-3 mb-4">
          <LayoutList className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium">No timeline items</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Add work items with start and end dates to see the project timeline.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ============ Toolbar ============ */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Group by toggle */}
        <div className="flex items-center rounded-md border border-border bg-muted/50 p-0.5">
          <button
            className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
              groupBy === 'task'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setGroupBy('task')}
          >
            <FolderKanban className="h-3.5 w-3.5" />
            Group by task
          </button>
          <button
            className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
              groupBy === 'member'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setGroupBy('member')}
          >
            <Users className="h-3.5 w-3.5" />
            Group by member
          </button>
        </div>

        {/* View mode indicator */}
        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
          {viewMode}
        </Badge>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={goPrev}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={goToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={goNext}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Current range label */}
        <span className="text-xs font-medium text-muted-foreground">
          {formatMonth(months[0])} – {formatMonth(months[2])}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="h-7 w-[140px] text-xs">
            <Filter className="mr-1 h-3 w-3" />
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {uniqueStatuses.map(status => {
              const cfg = STATUS_CONFIG[status]
              return (
                <SelectItem key={status} value={status}>
                  {cfg?.label || status}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {/* ============ Gantt Chart ============ */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex">
          {/* ---- Left Panel: Phase/Member groups ---- */}
          <div
            className={`${LEFT_PANEL_WIDTH} shrink-0 border-r border-border bg-muted/20`}
            ref={leftPanelRef}
            style={{ maxHeight: 500, overflowY: 'hidden' }}
          >
            {/* Header row to align with month headers */}
            <div className="sticky top-0 z-10 border-b border-border bg-muted/40 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">
                {groupBy === 'task' ? 'Phases' : 'Members'}
              </span>
            </div>

            {/* Group rows */}
            {groups.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-xs text-muted-foreground">No items match the filter</p>
              </div>
            ) : (
              groups.map(group => (
                <div key={group.key}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5 bg-muted/30">
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold text-white shrink-0"
                      style={{ backgroundColor: group.color }}
                    >
                      {groupBy === 'task' ? getPhaseIcon(group.key) : group.label.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate text-xs font-semibold">{group.label}</span>
                    <Badge variant="secondary" className="ml-auto h-4 px-1 text-[10px]">
                      {group.items.length}
                    </Badge>
                  </div>

                  {/* Item rows */}
                  {group.items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 border-b border-border/30 px-3 pl-9 hover:bg-muted/20 transition-colors"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {/* Priority dot */}
                      <div
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          PRIORITY_CONFIG[item.priority]?.color || 'bg-gray-400'
                        }`}
                      />
                      <span className="truncate text-[11px] text-foreground">{item.title}</span>
                      {item.status === 'IN_PROGRESS' && (
                        <span className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                      )}
                    </div>
                  ))}

                  {/* Add task row */}
                  <div className="flex items-center gap-2 border-b border-border/30 px-3 pl-9 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <Plus className="h-3 w-3" />
                    <span className="text-[11px]">Add task</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ---- Right Panel: Timeline grid + bars ---- */}
          <div
            className="flex-1 overflow-x-auto overflow-y-auto"
            ref={scrollContainerRef}
            onScroll={handleScroll}
            style={{ maxHeight: 500 }}
          >
            {/* Time grid */}
            <div className="relative" style={{ height: Math.max(totalRows * ROW_HEIGHT + groups.length * 60, 200) }}>
              <GanttTimeGrid
                months={months}
                totalWidth={totalWidth}
                viewStart={viewStart}
                viewEnd={viewEnd}
              />

              {/* Task bars */}
              <div className="absolute inset-0 top-[33px]">
                {groups.map(group => {
                  let rowIndex = 0
                  return (
                    <React.Fragment key={group.key}>
                      {/* Group header spacer */}
                      <div style={{ height: 28 }} />
                      {/* Item bars */}
                      {group.items.map((item, i) => {
                        const currentRow = rowIndex++
                        return (
                          <GanttBar
                            key={item.id}
                            item={item}
                            viewStart={viewStart}
                            viewEnd={viewEnd}
                            totalWidth={totalWidth}
                            rowIndex={currentRow}
                          />
                        )
                      })}
                      {/* Add task spacer */}
                      <div style={{ height: ROW_HEIGHT }} />
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ Legend ============ */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Phases:</span>
        {Object.entries(PHASE_COLORS).map(([key, color]) => {
          const phaseData = data?.phases.find(p => p.key === key)
          if (!phaseData) return null
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-[11px] text-muted-foreground">{phaseData.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
