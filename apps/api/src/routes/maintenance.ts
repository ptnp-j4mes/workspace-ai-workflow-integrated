import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'

export const maintenanceRoutes = new Elysia({ prefix: '/api/maintenance' })
  // GET /api/maintenance - List maintenance agreements
  .get('/', async ({ request, set }) => {
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

      const agreements = await db.maintenanceAgreement.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return { agreements }
    } catch (error) {
      console.error('List maintenance agreements error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/maintenance - Create maintenance agreement
  .post('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { projectId, type, startDate, endDate, coverage, slaDetails } = body

      if (!projectId || !startDate || !endDate) {
        set.status = 400
        return { error: 'projectId, startDate, and endDate are required' }
      }

      // Verify project exists
      const project = await db.project.findUnique({ where: { id: projectId } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      const agreement = await db.maintenanceAgreement.create({
        data: {
          projectId,
          type: type || 'STANDARD',
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: 'ACTIVE',
          coverage: coverage || null,
          slaDetails: slaDetails ? (typeof slaDetails === 'string' ? slaDetails : JSON.stringify(slaDetails)) : null,
        },
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
        },
      })

      set.status = 201
      return { agreement }
    } catch (error) {
      console.error('Create maintenance agreement error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
