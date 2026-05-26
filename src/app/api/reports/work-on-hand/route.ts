import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/reports/work-on-hand - Work on hand by user (bar chart data)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const url = new URL(request.url)
    const myWorkOnly = url.searchParams.get('myWork') === 'true'

    // Build where clause
    const userWhere = myWorkOnly
      ? { id: user.id, isActive: true }
      : { isActive: true }

    // Get all active users with their work counts
    const users = await db.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        position: true,
        department: { select: { id: true, name: true } },
        roles: {
          include: {
            role: { select: { name: true, key: true } },
          },
        },
        workItems: {
          where: { isActive: true },
          select: {
            id: true,
            role: true,
            workItem: {
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                dueDate: true,
                projectId: true,
                estimatedManDays: true,
                spentManDays: true,
                currentStep: true,
                request: { select: { id: true, title: true, code: true, projectId: true } },
                mitStepAssignments: {
                  select: {
                    id: true,
                    step: true,
                    status: true,
                    estimatedManDays: true,
                    spentManDays: true,
                    assigneeId: true,
                  },
                },
              },
            },
          },
        },
        assignedBAs: {
          where: { status: { notIn: ['COMPLETED', 'CLOSED', 'REJECTED', 'CANCELLED'] } },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            type: true,
            dueDate: true,
            projectId: true,
            project: { select: { id: true, name: true, code: true } },
          },
        },
        assignedDevs: {
          where: { status: { notIn: ['COMPLETED', 'CLOSED', 'REJECTED', 'CANCELLED'] } },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            type: true,
            dueDate: true,
            projectId: true,
            project: { select: { id: true, name: true, code: true } },
          },
        },
        assignedQAs: {
          where: { status: { notIn: ['COMPLETED', 'CLOSED', 'REJECTED', 'CANCELLED'] } },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            type: true,
            dueDate: true,
            projectId: true,
            project: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const workOnHandByUser = users.map((u) => {
      const baItems = u.assignedBAs.length
      const devItems = u.assignedDevs.length
      const qaItems = u.assignedQAs.length
      const mitItems = u.workItems.length
      const totalActive = baItems + devItems + qaItems + mitItems

      const overdueBA = u.assignedBAs.filter((r) => r.dueDate && new Date(r.dueDate) < now).length
      const overdueDev = u.assignedDevs.filter((r) => r.dueDate && new Date(r.dueDate) < now).length
      const overdueQA = u.assignedQAs.filter((r) => r.dueDate && new Date(r.dueDate) < now).length
      const overdueMIT = u.workItems.filter((wi) => wi.workItem.dueDate && new Date(wi.workItem.dueDate) < now).length
      const totalOverdue = overdueBA + overdueDev + overdueQA + overdueMIT

      const highPriorityBA = u.assignedBAs.filter((r) => r.priority === 'HIGH' || r.priority === 'URGENT').length
      const highPriorityDev = u.assignedDevs.filter((r) => r.priority === 'HIGH' || r.priority === 'URGENT').length
      const highPriorityQA = u.assignedQAs.filter((r) => r.priority === 'HIGH' || r.priority === 'URGENT').length
      const highPriorityMIT = u.workItems.filter((wi) => wi.workItem.priority === 'HIGH' || wi.workItem.priority === 'URGENT').length
      const totalHighPriority = highPriorityBA + highPriorityDev + highPriorityQA + highPriorityMIT

      // Manday calculations
      const totalEstimatedManDays = u.workItems.reduce((sum, wi) => sum + (wi.workItem.estimatedManDays || 0), 0)
      const totalSpentManDays = u.workItems.reduce((sum, wi) => sum + (wi.workItem.spentManDays || 0), 0)

      const primaryRole = u.roles?.[0]?.role?.key || 'VIEWER'

      // Detail items for "My Work" view
      const detailItems = [
        ...u.assignedBAs.map((r) => ({
          id: r.id,
          title: r.title,
          type: 'BA' as const,
          status: r.status,
          priority: r.priority,
          dueDate: r.dueDate,
          projectName: r.project?.name || null,
          projectCode: r.project?.code || null,
        })),
        ...u.assignedDevs.map((r) => ({
          id: r.id,
          title: r.title,
          type: 'DEV' as const,
          status: r.status,
          priority: r.priority,
          dueDate: r.dueDate,
          projectName: r.project?.name || null,
          projectCode: r.project?.code || null,
        })),
        ...u.assignedQAs.map((r) => ({
          id: r.id,
          title: r.title,
          type: 'QA' as const,
          status: r.status,
          priority: r.priority,
          dueDate: r.dueDate,
          projectName: r.project?.name || null,
          projectCode: r.project?.code || null,
        })),
        ...u.workItems.map((wi) => ({
          id: wi.workItem.id,
          title: wi.workItem.title,
          type: 'MIT' as const,
          status: wi.workItem.status,
          priority: wi.workItem.priority,
          dueDate: wi.workItem.dueDate,
          projectName: null,
          projectCode: null,
          aitNo: wi.workItem.request?.code || null,
          estimatedManDays: wi.workItem.estimatedManDays || 0,
          spentManDays: wi.workItem.spentManDays || 0,
          currentStep: wi.workItem.currentStep || null,
          steps: wi.workItem.mitStepAssignments.map((s) => ({
            step: s.step,
            status: s.status,
            estimatedManDays: s.estimatedManDays || 0,
            spentManDays: s.spentManDays || 0,
          })),
        })),
      ]

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        position: u.position,
        department: u.department?.name || 'N/A',
        role: primaryRole,
        baItems,
        devItems,
        qaItems,
        mitItems,
        totalActive,
        overdue: totalOverdue,
        highPriority: totalHighPriority,
        totalEstimatedManDays: Math.round(totalEstimatedManDays * 10) / 10,
        totalSpentManDays: Math.round(totalSpentManDays * 10) / 10,
        detailItems,
      }
    })

    // Department summary
    const deptMap = new Map<string, { name: string; totalActive: number; totalOverdue: number; userCount: number; totalEstimatedManDays: number; totalSpentManDays: number }>()
    for (const u of workOnHandByUser) {
      const existing = deptMap.get(u.department) || { name: u.department, totalActive: 0, totalOverdue: 0, userCount: 0, totalEstimatedManDays: 0, totalSpentManDays: 0 }
      existing.totalActive += u.totalActive
      existing.totalOverdue += u.overdue
      existing.userCount += 1
      existing.totalEstimatedManDays += u.totalEstimatedManDays
      existing.totalSpentManDays += u.totalSpentManDays
      deptMap.set(u.department, existing)
    }
    const byDepartment = Array.from(deptMap.values())

    // Role summary
    const roleMap = new Map<string, { role: string; baItems: number; devItems: number; qaItems: number; mitItems: number; userCount: number; totalEstimatedManDays: number; totalSpentManDays: number }>()
    for (const u of workOnHandByUser) {
      const existing = roleMap.get(u.role) || { role: u.role, baItems: 0, devItems: 0, qaItems: 0, mitItems: 0, userCount: 0, totalEstimatedManDays: 0, totalSpentManDays: 0 }
      existing.baItems += u.baItems
      existing.devItems += u.devItems
      existing.qaItems += u.qaItems
      existing.mitItems += u.mitItems
      existing.userCount += 1
      existing.totalEstimatedManDays += u.totalEstimatedManDays
      existing.totalSpentManDays += u.totalSpentManDays
      roleMap.set(u.role, existing)
    }
    const byRole = Array.from(roleMap.values())

    return NextResponse.json({
      workOnHandByUser,
      byDepartment,
      byRole,
      summary: {
        totalUsers: users.length,
        totalActiveItems: workOnHandByUser.reduce((sum, u) => sum + u.totalActive, 0),
        totalOverdue: workOnHandByUser.reduce((sum, u) => sum + u.overdue, 0),
        totalHighPriority: workOnHandByUser.reduce((sum, u) => sum + u.highPriority, 0),
        totalEstimatedManDays: Math.round(workOnHandByUser.reduce((sum, u) => sum + u.totalEstimatedManDays, 0) * 10) / 10,
        totalSpentManDays: Math.round(workOnHandByUser.reduce((sum, u) => sum + u.totalSpentManDays, 0) * 10) / 10,
      },
    })
  } catch (error) {
    console.error('Get work-on-hand report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
