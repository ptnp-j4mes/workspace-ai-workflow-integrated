import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/users - List users (for dropdowns/assignment)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    return NextResponse.json({ users: formattedUsers })
  } catch (error) {
    console.error('List users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
