import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { hashPassword } from '@/lib/auth'
import { logAudit } from '@/lib/services/audit-service'

function hasUserWritePermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER') || roles.includes('HR_MANAGER')
}

// GET /api/admin/users - List users with roles and departments
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = authUser.roles.includes('ADMIN') || authUser.roles.includes('IT_MANAGER')
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin permission required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')
    const departmentId = searchParams.get('departmentId') || undefined
    const roleKey = searchParams.get('role') || undefined
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }
    if (departmentId) where.departmentId = departmentId
    if (roleKey) {
      where.roles = { some: { role: { key: roleKey } } }
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ]
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          phone: true,
          position: true,
          departmentId: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          department: {
            select: { id: true, name: true, code: true, type: true, parent: { select: { id: true, name: true, code: true } } },
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
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ])

    const formatted = users.map((u) => ({
      ...u,
      password: undefined,
      roles: u.roles.map((r) => r.role),
    }))

    return NextResponse.json({
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List admin users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/users - Create user
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasUserWritePermission(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: user:write permission required' }, { status: 403 })
    }

    const body = await request.json()
    const { email, password, name, phone, position, departmentId, roleIds } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }

    // Check for duplicate email
    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)

    const newUser = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone: phone ?? null,
        position: position ?? null,
        departmentId: departmentId ?? null,
        isActive: true,
        roles: roleIds && Array.isArray(roleIds) && roleIds.length > 0
          ? {
              create: roleIds.map((roleId: string) => ({ roleId })),
            }
          : undefined,
      },
      include: {
        department: {
          select: { id: true, name: true, code: true, type: true, parent: { select: { id: true, name: true, code: true } } },
        },
        roles: {
          include: {
            role: {
              select: { id: true, key: true, name: true },
            },
          },
        },
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'CREATE_USER',
      entity: 'User',
      entityId: newUser.id,
      newValue: { email, name, departmentId: departmentId ?? null },
    })

    const formatted = {
      ...newUser,
      password: undefined,
      roles: newUser.roles.map((r) => r.role),
    }

    return NextResponse.json({ data: formatted }, { status: 201 })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
