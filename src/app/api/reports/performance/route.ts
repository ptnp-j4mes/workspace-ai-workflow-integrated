import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/reports/performance - Performance metrics per user (CTO executive view)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // ── Project Health ──
    const projects = await db.project.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        code: true,
        healthScore: true,
        startDate: true,
        endDate: true,
        _count: {
          select: {
            requests: true,
            members: true,
          },
        },
      },
      orderBy: { healthScore: 'asc' },
    })

    // ── Completion rates by user ──
    const users = await db.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        position: true,
        department: { select: { name: true } },
        roles: { include: { role: { select: { key: true, name: true } } } },
        // Completed requests as BA
        assignedBAs: {
          select: { id: true, dueDate: true, priority: true, status: true, completedAt: true, createdAt: true },
        },
        // Completed requests as Dev
        assignedDevs: {
          select: { id: true, dueDate: true, priority: true, status: true, completedAt: true, createdAt: true },
        },
        // Completed requests as QA
        assignedQAs: {
          select: { id: true, dueDate: true, priority: true, status: true, completedAt: true, createdAt: true },
        },
        workItems: {
          where: { isActive: true },
          select: {
            id: true,
            workItem: {
              select: {
                id: true,
                status: true,
                dueDate: true,
                priority: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const userPerformance = users.map((u) => {
      // Count completed requests in last 30 days
      const completedBAs = u.assignedBAs.filter((r) => ['COMPLETED', 'CLOSED'].includes(r.status) && r.completedAt && new Date(r.completedAt) >= thirtyDaysAgo)
      const completedDevs = u.assignedDevs.filter((r) => ['COMPLETED', 'CLOSED'].includes(r.status) && r.completedAt && new Date(r.completedAt) >= thirtyDaysAgo)
      const completedQAs = u.assignedQAs.filter((r) => ['COMPLETED', 'CLOSED'].includes(r.status) && r.completedAt && new Date(r.completedAt) >= thirtyDaysAgo)
      const totalCompleted = completedBAs.length + completedDevs.length + completedQAs.length

      // Active (non-completed) items
      const activeBAs = u.assignedBAs.filter((r) => !['COMPLETED', 'CLOSED', 'REJECTED', 'CANCELLED'].includes(r.status))
      const activeDevs = u.assignedDevs.filter((r) => !['COMPLETED', 'CLOSED', 'REJECTED', 'CANCELLED'].includes(r.status))
      const activeQAs = u.assignedQAs.filter((r) => !['COMPLETED', 'CLOSED', 'REJECTED', 'CANCELLED'].includes(r.status))
      const totalActive = activeBAs.length + activeDevs.length + activeQAs.length + u.workItems.length

      // On-time delivery rate (completed items that were done before or on due date)
      const allCompleted = [
        ...completedBAs.map((r) => ({ completedAt: r.completedAt, createdAt: r.createdAt })),
        ...completedDevs.map((r) => ({ completedAt: r.completedAt, createdAt: r.createdAt })),
        ...completedQAs.map((r) => ({ completedAt: r.completedAt, createdAt: r.createdAt })),
      ]
      const onTime = allCompleted.filter((r) => {
        if (!r.completedAt || !r.createdAt) return true
        const daysToComplete = (new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        return daysToComplete <= 30 // Consider on-time if completed within 30 days
      }).length
      const onTimeRate = allCompleted.length > 0 ? Math.round((onTime / allCompleted.length) * 100) : 100

      // Overdue active items
      const overdueActive = [
        ...activeBAs.filter((r) => r.dueDate && new Date(r.dueDate) < now),
        ...activeDevs.filter((r) => r.dueDate && new Date(r.dueDate) < now),
        ...activeQAs.filter((r) => r.dueDate && new Date(r.dueDate) < now),
        ...u.workItems.filter((wi) => wi.workItem.dueDate && new Date(wi.workItem.dueDate) < now),
      ].length

      // High priority active
      const highPriorityActive = [
        ...activeBAs.filter((r) => r.priority === 'HIGH' || r.priority === 'URGENT'),
        ...activeDevs.filter((r) => r.priority === 'HIGH' || r.priority === 'URGENT'),
        ...activeQAs.filter((r) => r.priority === 'HIGH' || r.priority === 'URGENT'),
        ...u.workItems.filter((wi) => wi.workItem.priority === 'HIGH' || wi.workItem.priority === 'URGENT'),
      ].length

      // Average throughput (items completed per week over last 30 days)
      const weeksInPeriod = 4.3
      const throughput = Math.round((totalCompleted / weeksInPeriod) * 10) / 10

      // Performance score (composite: 40% on-time, 30% throughput, 30% low overdue ratio)
      const overdueRatio = totalActive > 0 ? overdueActive / totalActive : 0
      const throughputScore = Math.min(throughput / 5, 1) * 100 // Normalize: 5 items/week = 100%
      const performanceScore = Math.round(onTimeRate * 0.4 + throughputScore * 0.3 + (1 - overdueRatio) * 100 * 0.3)

      const primaryRole = u.roles?.[0]?.role?.key || 'VIEWER'

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        position: u.position,
        department: u.department?.name || 'N/A',
        role: primaryRole,
        totalCompleted,
        totalActive,
        onTimeRate,
        overdueActive,
        highPriorityActive,
        throughput,
        performanceScore: Math.max(0, Math.min(100, performanceScore)),
      }
    })

    // ── Executive Summary ──
    const [
      totalRequests,
      completedRequests,
      totalWorkItems,
      completedWorkItems,
      openBugs,
      criticalBugs,
      activeProjects,
      upcomingMeetings,
      overdueRequests,
    ] = await Promise.all([
      db.request.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      db.request.count({ where: { status: { in: ['COMPLETED', 'CLOSED'] }, completedAt: { gte: thirtyDaysAgo } } }),
      db.workItem.count(),
      db.workItem.count({ where: { status: { in: ['DEPLOYED', 'SUBMITTED'] } } }),
      db.bugReport.count({ where: { status: { in: ['OPEN', 'INVESTIGATING', 'FIXING'] } } }),
      db.bugReport.count({ where: { status: { in: ['OPEN', 'INVESTIGATING', 'FIXING'] }, severity: 'CRITICAL' } }),
      db.project.count({ where: { status: 'ACTIVE' } }),
      db.meeting.count({ where: { status: 'SCHEDULED', scheduledAt: { gte: now } } }),
      db.request.count({ where: { dueDate: { lt: now }, status: { notIn: ['COMPLETED', 'CLOSED', 'REJECTED', 'CANCELLED'] } } }),
    ])

    // ── Request trend (last 7 days) ──
    const dailyRequests = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

      const [created, completed] = await Promise.all([
        db.request.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
        db.request.count({ where: { completedAt: { gte: dayStart, lt: dayEnd } } }),
      ])

      dailyRequests.push({
        date: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
        created,
        completed,
      })
    }

    // ── Bug severity breakdown ──
    const bugSeverities = await db.bugReport.groupBy({
      by: ['severity'],
      where: { status: { in: ['OPEN', 'INVESTIGATING', 'FIXING'] } },
      _count: { id: true },
    })

    const executiveSummary = {
      totalRequests,
      completedRequests,
      completionRate: totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0,
      totalWorkItems,
      completedWorkItems,
      workItemRate: totalWorkItems > 0 ? Math.round((completedWorkItems / totalWorkItems) * 100) : 0,
      openBugs,
      criticalBugs,
      activeProjects,
      upcomingMeetings,
      overdueRequests,
      avgTeamPerformance: userPerformance.length > 0
        ? Math.round(userPerformance.reduce((sum, u) => sum + u.performanceScore, 0) / userPerformance.length)
        : 0,
    }

    return NextResponse.json({
      userPerformance,
      projectHealth: projects,
      executiveSummary,
      dailyRequests,
      bugSeverities: bugSeverities.map((b) => ({
        severity: b.severity,
        count: b._count.id,
      })),
    })
  } catch (error) {
    console.error('Get performance report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
