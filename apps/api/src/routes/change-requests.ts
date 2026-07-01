import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'
import { logAudit } from '../lib/services/audit-service'

export const changeRequestsRoutes = new Elysia({ prefix: '/api/change-requests' })
  // GET /api/change-requests - List change requests
  .get('/', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status') || undefined
      const category = searchParams.get('category') || undefined
      const search = searchParams.get('search') || undefined
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const skip = (page - 1) * limit

      const where: Record<string, unknown> = {}
      if (status) where.status = status
      if (category) where.category = category
      if (search) {
        where.OR = [
          { title: { contains: search } },
          { description: { contains: search } },
        ]
      }

      const [items, total] = await Promise.all([
        db.changeRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db.changeRequest.count({ where }),
      ])

      return {
        data: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      console.error('List change requests error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/change-requests - Create change request
  .post('/', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { title, description, category, impactLevel, requestId, projectId } = body

      if (!title || !description) {
        set.status = 400
        return { error: 'Title and description are required' }
      }

      const changeRequest = await db.changeRequest.create({
        data: {
          title,
          description,
          category: category ?? null,
          impactLevel: impactLevel ?? 'MEDIUM',
          requestId: requestId ?? null,
          projectId: projectId ?? null,
          status: 'DRAFT',
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CREATE_CHANGE_REQUEST',
        entity: 'ChangeRequest',
        entityId: changeRequest.id,
        newValue: { title, category, impactLevel },
      })

      set.status = 201
      return { data: changeRequest }
    } catch (error) {
      console.error('Create change request error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
