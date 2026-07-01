import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'

export const masterRoutes = new Elysia({ prefix: '/api/master' })
  // GET /api/master/positions — List active job positions (with optional department filter)
  .get('/positions', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const departmentId = searchParams.get('departmentId')

      const where: Record<string, unknown> = { isActive: true }
      if (departmentId) {
        where.departmentId = departmentId
      }

      const positions = await db.jobPosition.findMany({
        where,
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        select: {
          id: true,
          name: true,
          code: true,
          level: true,
          category: true,
          departmentId: true,
          sortOrder: true,
          department: {
            select: { id: true, name: true, code: true },
          },
        },
      })

      return { data: positions }
    } catch (error) {
      console.error('Fetch positions error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
