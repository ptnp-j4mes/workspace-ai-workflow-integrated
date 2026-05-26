import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// Phase definitions with labels, colors, and sort order
const PHASE_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  BA: { label: 'UX/UI & Analysis', color: '#8b5cf6', order: 1 },
  DEV: { label: 'Development', color: '#06b6d4', order: 2 },
  QA: { label: 'Testing', color: '#f59e0b', order: 3 },
  UAT: { label: 'UAT', color: '#10b981', order: 4 },
  MA: { label: 'Go-Live & Maintenance', color: '#ef4444', order: 5 },
}

// GET /api/projects/[id]/timeline - Get timeline data for Gantt chart
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch work items with their MIT step assignments
    const workItems = await db.workItem.findMany({
      where: { projectId: id },
      include: {
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        mitStepAssignments: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
          orderBy: { step: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Fetch UAT cycles for the project
    const uatCycles = await db.uatCycle.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
    })

    // Fetch project members for grouping by member
    const members = await db.projectMember.findMany({
      where: { projectId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    })

    // Build timeline items from work items and their MIT steps
    type MitStepWithAssignee = {
      id: string
      step: string
      assigneeId: string | null
      status: string
      assignedAt: Date | null
      acceptedAt: Date | null
      submittedAt: Date | null
      deployedAt: Date | null
      estimatedManDays: number
      spentManDays: number
      assignee: { id: string; name: string; email: string; avatarUrl: string | null } | null
    }

    type WorkItemWithRelations = {
      id: string
      title: string
      description: string | null
      status: string
      currentStep: string | null
      priority: string
      aitNo: string | null
      dueDate: Date | null
      createdAt: Date
      assignments: {
        id: string
        userId: string
        role: string
        isActive: boolean
        user: { id: string; name: string; email: string; avatarUrl: string | null }
      }[]
      mitStepAssignments: MitStepWithAssignee[]
    }

    const timelineItems: Array<{
      id: string
      title: string
      phase: string
      phaseLabel: string
      phaseColor: string
      startDate: string | null
      endDate: string | null
      status: string
      priority: string
      assignees: Array<{ id: string; name: string; email: string; avatarUrl: string | null }>
      type: 'work_item' | 'uat_cycle'
      aitNo: string | null
      progress: number
    }> = []

    for (const wi of workItems as WorkItemWithRelations[]) {
      // Group MIT steps by phase
      const phases = new Set<string>()
      if (wi.mitStepAssignments.length > 0) {
        for (const msa of wi.mitStepAssignments) {
          phases.add(msa.step)
        }
      } else {
        if (wi.currentStep) phases.add(wi.currentStep)
      }

      // If no phases, default to the current step or BA
      if (phases.size === 0) phases.add('BA')

      for (const phase of phases) {
        const config = PHASE_CONFIG[phase] || { label: phase, color: '#6b7280', order: 99 }

        // Find the MIT step assignment for this phase to get dates
        const stepAssignment = wi.mitStepAssignments.find(msa => msa.step === phase)

        // Determine start date: assignedAt or createdAt
        let startDate: Date | null = null
        if (stepAssignment?.assignedAt) {
          startDate = stepAssignment.assignedAt
        } else if (stepAssignment?.acceptedAt) {
          startDate = stepAssignment.acceptedAt
        }

        // Determine end date: submittedAt, deployedAt, or dueDate
        let endDate: Date | null = null
        if (stepAssignment?.deployedAt) {
          endDate = stepAssignment.deployedAt
        } else if (stepAssignment?.submittedAt) {
          endDate = stepAssignment.submittedAt
        } else if (wi.dueDate) {
          endDate = wi.dueDate
        }

        // If we still don't have dates, estimate based on project dates or work item creation
        if (!startDate) {
          startDate = new Date(wi.createdAt)
        }
        if (!endDate) {
          // Default to 2 weeks after start date
          const estimated = new Date(startDate)
          estimated.setDate(estimated.getDate() + 14)
          endDate = estimated
        }

        // Ensure end date is after start date
        if (endDate <= startDate) {
          const adjusted = new Date(startDate)
          adjusted.setDate(adjusted.getDate() + 7)
          endDate = adjusted
        }

        // Calculate progress based on step assignment status
        let progress = 0
        if (stepAssignment) {
          const s = stepAssignment.status.toUpperCase()
          if (s === 'DEPLOYED') progress = 100
          else if (s === 'SUBMITTED') progress = 90
          else if (s === 'ACCEPTED') progress = 50
          else if (s === 'ASSIGNED') progress = 25
          else if (s === 'PENDING') progress = 5
        } else {
          // Use work item status
          const s = wi.status.toUpperCase()
          if (s === 'DEPLOYED') progress = 100
          else if (s === 'SUBMITTED') progress = 90
          else if (s === 'IN_PROGRESS') progress = 50
          else if (s === 'ASSIGNED') progress = 25
          else if (s === 'CREATED') progress = 5
        }

        // Get assignees for this phase
        const assignees = stepAssignment?.assignee
          ? [stepAssignment.assignee]
          : wi.assignments.map(a => a.user)

        timelineItems.push({
          id: `${wi.id}-${phase}`,
          title: wi.title,
          phase,
          phaseLabel: config.label,
          phaseColor: config.color,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          status: stepAssignment?.status || wi.status,
          priority: wi.priority,
          assignees,
          type: 'work_item',
          aitNo: wi.aitNo,
          progress,
        })
      }
    }

    // Add UAT cycles as timeline items
    for (const cycle of uatCycles) {
      const startDate = cycle.startDate ? new Date(cycle.startDate) : new Date(cycle.createdAt)
      let endDate: Date
      if (cycle.endDate) {
        endDate = new Date(cycle.endDate)
      } else {
        endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 14)
      }
      if (endDate <= startDate) {
        const adjusted = new Date(startDate)
        adjusted.setDate(adjusted.getDate() + 7)
        endDate = adjusted
      }

      let progress = 0
      const s = cycle.status.toUpperCase()
      if (s === 'COMPLETED') progress = 100
      else if (s === 'IN_PROGRESS') progress = 60
      else if (s === 'PLANNED') progress = 10
      else if (s === 'FAILED') progress = 80

      timelineItems.push({
        id: cycle.id,
        title: cycle.name,
        phase: 'UAT',
        phaseLabel: PHASE_CONFIG.UAT.label,
        phaseColor: PHASE_CONFIG.UAT.color,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: cycle.status,
        priority: 'MEDIUM',
        assignees: [],
        type: 'uat_cycle',
        aitNo: cycle.aitNo,
        progress,
      })
    }

    // Sort by phase order, then by start date
    timelineItems.sort((a, b) => {
      const orderA = PHASE_CONFIG[a.phase]?.order ?? 99
      const orderB = PHASE_CONFIG[b.phase]?.order ?? 99
      if (orderA !== orderB) return orderA - orderB
      return (a.startDate || '').localeCompare(b.startDate || '')
    })

    // Build phase groups
    const phases = Object.entries(PHASE_CONFIG).map(([key, config]) => {
      const items = timelineItems.filter(item => item.phase === key)
      return {
        key,
        label: config.label,
        color: config.color,
        order: config.order,
        items,
      }
    }).filter(phase => phase.items.length > 0)

    // Calculate overall date range for the timeline
    const allDates = timelineItems
      .flatMap(item => [item.startDate, item.endDate])
      .filter(Boolean) as string[]

    let timelineStart: string
    let timelineEnd: string

    if (allDates.length > 0) {
      const minDate = new Date(Math.min(...allDates.map(d => new Date(d).getTime())))
      const maxDate = new Date(Math.max(...allDates.map(d => new Date(d).getTime())))
      // Expand range: start from 1st of the month, end at last day of month
      const startOfMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
      const endOfMonth = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0)
      timelineStart = startOfMonth.toISOString()
      timelineEnd = endOfMonth.toISOString()
    } else {
      // Default: current month ± 2 months
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 3, 0)
      timelineStart = start.toISOString()
      timelineEnd = end.toISOString()
    }

    // Build member groups for "Group by member" view
    const memberGroups = members.map(pm => {
      const memberItems = timelineItems.filter(item =>
        item.assignees.some(a => a.id === pm.user.id)
      )
      return {
        userId: pm.user.id,
        name: pm.user.name,
        email: pm.user.email,
        avatarUrl: pm.user.avatarUrl,
        role: pm.role,
        items: memberItems,
      }
    }).filter(mg => mg.items.length > 0)

    return NextResponse.json({
      data: {
        phases,
        memberGroups,
        timelineStart,
        timelineEnd,
        totalItems: timelineItems.length,
        projectStartDate: project.startDate?.toISOString() ?? null,
        projectEndDate: project.endDate?.toISOString() ?? null,
      },
    })
  } catch (error) {
    console.error('Get project timeline error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
