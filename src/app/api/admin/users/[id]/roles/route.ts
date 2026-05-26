import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

function hasManageRolesPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

// PUT /api/admin/users/[id]/roles - Replace user roles
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasManageRolesPermission(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: user:manage_roles permission required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { roleIds } = body as { roleIds: string[] }

    if (!Array.isArray(roleIds)) {
      return NextResponse.json({ error: 'roleIds must be an array' }, { status: 400 })
    }

    const existingUser = await db.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: { role: { select: { id: true, key: true, name: true } } },
        },
      },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Validate all role IDs exist
    if (roleIds.length > 0) {
      const validRoles = await db.role.findMany({
        where: { id: { in: roleIds } },
        select: { id: true },
      })
      if (validRoles.length !== roleIds.length) {
        return NextResponse.json({ error: 'One or more role IDs are invalid' }, { status: 400 })
      }
    }

    const oldRoleKeys = existingUser.roles.map((r) => r.role.key)

    // Delete existing roles and create new ones
    await db.userRole.deleteMany({ where: { userId: id } })

    if (roleIds.length > 0) {
      await db.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId })),
      })
    }

    // Fetch updated user with new roles
    const updatedUser = await db.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: { role: { select: { id: true, key: true, name: true } } },
        },
      },
    })

    const newRoleKeys = updatedUser?.roles.map((r) => r.role.key) ?? []

    await logAudit({
      userId: authUser.id,
      action: 'UPDATE_USER_ROLES',
      entity: 'User',
      entityId: id,
      oldValue: { roles: oldRoleKeys },
      newValue: { roles: newRoleKeys },
    })

    return NextResponse.json({
      data: {
        userId: id,
        roles: updatedUser?.roles.map((r) => r.role) ?? [],
      },
    })
  } catch (error) {
    console.error('Update user roles error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
