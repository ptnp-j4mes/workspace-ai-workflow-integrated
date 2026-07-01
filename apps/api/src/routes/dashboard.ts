import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'

export const dashboardRoutes = new Elysia({ prefix: '/api/dashboard' })
  // GET /api/dashboard/overdue - Get overdue work items and requests
  .get('/overdue', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const now = new Date()

      // Overdue requests (due date passed, not completed)
      const overdueRequests = await db.request.findMany({
        where: {
          dueDate: { lt: now },
          status: { notIn: ['COMPLETED', 'CLOSED', 'REJECTED'] },
        },
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
          assignedBA: {
            select: { id: true, name: true, email: true },
          },
          assignedDev: {
            select: { id: true, name: true, email: true },
          },
          assignedQA: {
            select: { id: true, name: true, email: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { dueDate: 'asc' },
      })

      // Overdue work items (due date passed, not completed)
      const overdueWorkItems = await db.workItem.findMany({
        where: {
          dueDate: { lt: now },
          status: { notIn: ['DEPLOYED', 'SUBMITTED', 'REJECTED'] },
        },
        include: {
          request: {
            select: { id: true, title: true, code: true },
          },
          assignments: {
            where: { isActive: true },
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      })

      return {
        overdueRequests,
        overdueWorkItems,
        summary: {
          totalOverdueRequests: overdueRequests.length,
          totalOverdueWorkItems: overdueWorkItems.length,
        },
      }
    } catch (error) {
      console.error('Get overdue error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/dashboard/workload - Get workload data
  .get('/workload', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      // Workload by user - count active assignments
      const userWorkload = await db.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          _count: {
            select: {
              assignedBAs: { where: { status: { in: ['ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT'] } } },
              assignedDevs: { where: { status: { in: ['ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT'] } } },
              assignedQAs: { where: { status: { in: ['ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT'] } } },
              workItems: { where: { isActive: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      })

      const workloadByUser = userWorkload.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        totalActiveRequests:
          u._count.assignedBAs + u._count.assignedDevs + u._count.assignedQAs,
        activeWorkItems: u._count.workItems,
      }))

      // Workload by project
      const projectWorkload = await db.project.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          code: true,
          _count: {
            select: {
              requests: { where: { status: { in: ['ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT'] } } },
              meetings: { where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } },
              uatCycles: { where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } } },
            },
          },
        },
        orderBy: { name: 'asc' },
      })

      const workloadByProject = projectWorkload.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        activeRequests: p._count.requests,
        activeMeetings: p._count.meetings,
        activeUatCycles: p._count.uatCycles,
      }))

      // Overall stats
      const [
        totalRequests,
        activeRequests,
        totalWorkItems,
        activeWorkItems,
        openBugs,
        upcomingMeetings,
      ] = await Promise.all([
        db.request.count(),
        db.request.count({ where: { status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED', 'ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT'] } } }),
        db.workItem.count(),
        db.workItem.count({ where: { status: { in: ['CREATED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } } }),
        db.bugReport.count({ where: { status: { in: ['OPEN', 'INVESTIGATING', 'FIXING'] } } }),
        db.meeting.count({ where: { status: 'SCHEDULED', scheduledAt: { gte: new Date() } } }),
      ])

      return {
        workloadByUser,
        workloadByProject,
        stats: {
          totalRequests,
          activeRequests,
          totalWorkItems,
          activeWorkItems,
          openBugs,
          upcomingMeetings,
        },
      }
    } catch (error) {
      console.error('Get workload error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
