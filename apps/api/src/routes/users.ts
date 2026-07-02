import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'

export const usersRoutes = new Elysia({ prefix: '/api/users' })
  // GET /api/users - List users (for dropdowns/assignment)
  .get('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const roleFilter = searchParams.get('role') || undefined
      const departmentId = searchParams.get('departmentId') || undefined
      const searchTerm = searchParams.get('search') || undefined

      const where: Record<string, unknown> = { isActive: true }
      if (departmentId) {
        (where as Record<string, unknown>).departmentId = departmentId
      }
      if (roleFilter) {
        (where as Record<string, unknown>).roles = {
          some: {
            role: { key: roleFilter },
          },
        }
      }
      if (searchTerm) {
        (where as Record<string, unknown>).OR = [
          { name: { contains: searchTerm } },
          { email: { contains: searchTerm } },
        ]
      }

      const users = await db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          departmentId: true,
          department: {
            select: { id: true, name: true, code: true },
          },
          roles: {
            include: {
              role: {
                select: { id: true, key: true, name: true },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      })

      const formattedUsers = users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        department: u.department,
        roles: u.roles.map((r) => r.role.key),
      }))

      return { users: formattedUsers }
    } catch (error) {
      console.error('List users error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
