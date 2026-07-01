import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'

export const uatRoutes = new Elysia({ prefix: '/api/uat' })
  // GET /api/uat/cycles - List UAT cycles
  .get('/cycles', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const projectId = searchParams.get('projectId') || undefined
      const status = searchParams.get('status') || undefined

      const where: any = {}
      if (projectId) where.projectId = projectId
      if (status) where.status = status

      const cycles = await db.uatCycle.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: { testCases: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return { cycles }
    } catch (error) {
      console.error('List UAT cycles error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/uat/cycles - Create UAT cycle
  .post('/cycles', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { projectId, requestId, name, description, startDate, endDate } = body

      if (!projectId || !name) {
        set.status = 400
        return { error: 'projectId and name are required' }
      }

      // Verify project exists
      const project = await db.project.findUnique({ where: { id: projectId } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      const cycle = await db.uatCycle.create({
        data: {
          projectId,
          requestId: requestId || null,
          name,
          description: description || null,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          status: 'PLANNED',
        },
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: { testCases: true },
          },
        },
      })

      set.status = 201
      return { cycle }
    } catch (error) {
      console.error('Create UAT cycle error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/uat/cycles/:id - Get single UAT cycle with test cases
  .get('/cycles/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const cycle = await db.uatCycle.findUnique({
        where: { id },
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
          testCases: {
            include: {
              testResults: {
                include: {
                  tester: {
                    select: { id: true, name: true, email: true },
                  },
                },
                orderBy: { testedAt: 'desc' },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      if (!cycle) {
        set.status = 404
        return { error: 'UAT cycle not found' }
      }

      return { cycle }
    } catch (error) {
      console.error('Get UAT cycle error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // PATCH /api/uat/cycles/:id - Update UAT cycle
  .patch('/cycles/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()

      const existing = await db.uatCycle.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'UAT cycle not found' }
      }

      const allowedFields = ['name', 'description', 'status', 'startDate', 'endDate']

      const data: Record<string, unknown> = {}
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          if (field === 'startDate' || field === 'endDate') {
            data[field] = body[field] ? new Date(body[field]) : null
          } else {
            data[field] = body[field]
          }
        }
      }

      const updated = await db.uatCycle.update({
        where: { id },
        data,
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: { testCases: true },
          },
        },
      })

      return { cycle: updated }
    } catch (error) {
      console.error('Update UAT cycle error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // DELETE /api/uat/cycles/:id - Delete UAT cycle by ID (cascade delete test cases and results)
  .delete('/cycles/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const existing = await db.uatCycle.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'UAT cycle not found' }
      }

      // Cascade delete: test results -> test cases -> cycle
      // Prisma schema has onDelete: Cascade on UatTestCase -> UatCycle
      // and onDelete: Cascade on UatTestResult -> UatTestCase
      // So deleting the cycle will cascade delete test cases and their results
      await db.uatCycle.delete({ where: { id } })

      return { message: 'UAT cycle deleted successfully' }
    } catch (error) {
      console.error('Delete UAT cycle error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/uat/test-cases - List test cases with optional uatCycleId filter
  .get('/test-cases', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const uatCycleId = searchParams.get('uatCycleId') || undefined
      const priority = searchParams.get('priority') || undefined
      const type = searchParams.get('type') || undefined

      const where: any = {}
      if (uatCycleId) where.uatCycleId = uatCycleId
      if (priority) where.priority = priority
      if (type) where.type = type

      const testCases = await db.uatTestCase.findMany({
        where,
        include: {
          uatCycle: {
            select: { id: true, name: true, status: true },
          },
          _count: {
            select: { testResults: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return { testCases }
    } catch (error) {
      console.error('List test cases error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/uat/test-cases - Create test case
  .post('/test-cases', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { uatCycleId, title, precondition, steps, expectedResult, priority, type } = body

      if (!uatCycleId || !title || !steps || !expectedResult) {
        set.status = 400
        return { error: 'uatCycleId, title, steps, and expectedResult are required' }
      }

      // Verify UAT cycle exists
      const cycle = await db.uatCycle.findUnique({ where: { id: uatCycleId } })
      if (!cycle) {
        set.status = 404
        return { error: 'UAT cycle not found' }
      }

      const testCase = await db.uatTestCase.create({
        data: {
          uatCycleId,
          title,
          precondition: precondition || null,
          steps: typeof steps === 'string' ? steps : JSON.stringify(steps),
          expectedResult,
          priority: priority || 'MEDIUM',
          type: type || 'FUNCTIONAL',
          aiGenerated: false,
        },
        include: {
          uatCycle: {
            select: { id: true, name: true, status: true },
          },
        },
      })

      set.status = 201
      return { testCase }
    } catch (error) {
      console.error('Create test case error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
