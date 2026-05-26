import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// GET /api/admin/roles - List roles with permissions
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roles = await db.role.findMany({
      orderBy: { key: 'asc' },
      include: {
        permissions: {
          include: {
            permission: {
              select: { id: true, key: true, name: true, module: true },
            },
          },
        },
        _count: {
          select: { users: true },
        },
      },
    })

    const formatted = roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      permissions: r.permissions.map((p) => p.permission),
      userCount: r._count.users,
    }))

    return NextResponse.json({ data: formatted })
  } catch (error) {
    console.error('List roles error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/roles - Create a new role
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { key, name, description, permissionIds } = body

    if (!key || !name) {
      return NextResponse.json({ error: 'Key and name are required' }, { status: 400 })
    }

    // Check for duplicate key
    const existingKey = await db.role.findUnique({ where: { key } })
    if (existingKey) {
      return NextResponse.json({ error: 'Role key already exists' }, { status: 409 })
    }

    // Check for duplicate name
    const existingName = await db.role.findFirst({ where: { name } })
    if (existingName) {
      return NextResponse.json({ error: 'Role name already exists' }, { status: 409 })
    }

    // Create role with permissions
    const role = await db.role.create({
      data: {
        key,
        name,
        description: description || null,
        permissions: permissionIds && permissionIds.length > 0
          ? {
              createMany: {
                data: permissionIds.map((pid: string) => ({ permissionId: pid })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
      include: {
        permissions: {
          include: {
            permission: { select: { id: true, key: true, name: true, module: true } },
          },
        },
        _count: { select: { users: true } },
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'CREATE_ROLE',
      entity: 'Role',
      entityId: role.id,
      newValue: { key, name, description, permissionIds },
    })

    return NextResponse.json({
      data: {
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        permissions: role.permissions.map((p) => p.permission),
        userCount: role._count.users,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Create role error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
