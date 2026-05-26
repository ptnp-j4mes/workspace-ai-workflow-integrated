import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// GET /api/admin/roles/[id] - Get single role with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const role = await db.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: { select: { id: true, key: true, name: true, module: true } },
          },
        },
        _count: { select: { users: true } },
      },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        permissions: role.permissions.map((p) => p.permission),
        userCount: role._count.users,
      },
    })
  } catch (error) {
    console.error('Get role error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/roles/[id] - Update a role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, description, permissionIds } = body

    const existing = await db.role.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Prevent modifying system-critical roles
    if (existing.key === 'ADMIN') {
      return NextResponse.json({ error: 'Cannot modify ADMIN role' }, { status: 403 })
    }

    // Check for duplicate key/name if changing
    if (name && name !== existing.name) {
      const dup = await db.role.findFirst({ where: { name, id: { not: id } } })
      if (dup) {
        return NextResponse.json({ error: 'Role name already exists' }, { status: 409 })
      }
    }

    // Update basic fields
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description || null

    if (Object.keys(updateData).length > 0) {
      await db.role.update({ where: { id }, data: updateData })
    }

    // Update permissions if provided
    if (permissionIds !== undefined) {
      // Delete existing permissions
      await db.rolePermission.deleteMany({ where: { roleId: id } })
      // Create new permissions
      if (permissionIds.length > 0) {
        await db.rolePermission.createMany({
          data: permissionIds.map((pid: string) => ({
            roleId: id,
            permissionId: pid,
          })),
          skipDuplicates: true,
        })
      }
    }

    // Fetch updated role
    const updated = await db.role.findUnique({
      where: { id },
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
      action: 'UPDATE_ROLE',
      entity: 'Role',
      entityId: id,
      newValue: { name, description, permissionIds },
    })

    return NextResponse.json({
      data: {
        id: updated!.id,
        key: updated!.key,
        name: updated!.name,
        description: updated!.description,
        permissions: updated!.permissions.map((p) => p.permission),
        userCount: updated!._count.users,
      },
    })
  } catch (error) {
    console.error('Update role error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/roles/[id] - Delete a role
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await db.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Prevent deleting system-critical roles
    if (['ADMIN'].includes(existing.key)) {
      return NextResponse.json(
        { error: `Cannot delete system role: ${existing.key}` },
        { status: 403 }
      )
    }

    // Prevent deleting roles with users
    if (existing._count.users > 0) {
      return NextResponse.json(
        { error: `Cannot delete role with ${existing._count.users} assigned user(s). Remove users first.` },
        { status: 409 }
      )
    }

    await db.role.delete({ where: { id } })

    await logAudit({
      userId: authUser.id,
      action: 'DELETE_ROLE',
      entity: 'Role',
      entityId: id,
      oldValue: { key: existing.key, name: existing.name },
    })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error('Delete role error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
