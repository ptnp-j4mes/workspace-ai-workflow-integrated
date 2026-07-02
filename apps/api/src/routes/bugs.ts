import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'

export const bugsRoutes = new Elysia({ prefix: '/api/bugs' })
  // GET /api/bugs - List bugs with filters
  .get('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status') || undefined
      const severity = searchParams.get('severity') || undefined
      const requestId = searchParams.get('requestId') || undefined
      const projectId = searchParams.get('projectId') || undefined

      const where: any = {}
      if (status) where.status = status
      if (severity) where.severity = severity
      if (requestId) where.requestId = requestId
      if (projectId) where.projectId = projectId

      const bugs = await db.bugReport.findMany({
        where,
        include: {
          request: {
            select: { id: true, title: true, code: true },
          },
          reportedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return { bugs }
    } catch (error) {
      console.error('List bugs error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/bugs - Create bug report
  .post('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const {
        requestId,
        projectId,
        title,
        description,
        severity,
        actualResult,
        expectedResult,
        reproductionSteps,
      } = body

      if (!title || !description) {
        set.status = 400
        return { error: 'Title and description are required' }
      }

      const bug = await db.bugReport.create({
        data: {
          requestId: requestId || null,
          projectId: projectId || null,
          title,
          description,
          severity: severity || 'MEDIUM',
          actualResult: actualResult || null,
          expectedResult: expectedResult || null,
          reproductionSteps: reproductionSteps || null,
          reportedById: user.id,
          status: 'OPEN',
        },
        include: {
          request: {
            select: { id: true, title: true, code: true },
          },
          reportedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      set.status = 201
      return { bug }
    } catch (error) {
      console.error('Create bug error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/bugs/:id - Get single bug by ID with related data
  .get('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const bug = await db.bugReport.findUnique({
        where: { id },
        include: {
          request: {
            select: { id: true, title: true, code: true },
          },
          reportedBy: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      })

      if (!bug) {
        set.status = 404
        return { error: 'Bug not found' }
      }

      return { bug }
    } catch (error) {
      console.error('Get bug error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // PATCH /api/bugs/:id - Update bug
  .patch('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()

      const existing = await db.bugReport.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Bug not found' }
      }

      const allowedFields = [
        'title',
        'description',
        'severity',
        'status',
        'actualResult',
        'expectedResult',
        'reproductionSteps',
        'resolution',
      ]

      const data: Record<string, unknown> = {}
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          data[field] = body[field]
        }
      }

      const updated = await db.bugReport.update({
        where: { id },
        data,
        include: {
          request: {
            select: { id: true, title: true, code: true },
          },
          reportedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      return { bug: updated }
    } catch (error) {
      console.error('Update bug error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // DELETE /api/bugs/:id - Delete bug by ID
  .delete('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const existing = await db.bugReport.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Bug not found' }
      }

      await db.bugReport.delete({ where: { id } })

      return { message: 'Bug deleted successfully' }
    } catch (error) {
      console.error('Delete bug error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
