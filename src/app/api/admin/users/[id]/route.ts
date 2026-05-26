import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

function hasUserWritePermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER') || roles.includes('HR_MANAGER')
}

// PATCH /api/admin/users/[id] - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasUserWritePermission(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: user:write permission required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    const allowedFields = ['name', 'email', 'isActive', 'departmentId', 'phone', 'position']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
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
      action: 'UPDATE_USER',
      entity: 'User',
      entityId: id,
      oldValue: { name: existing.name, email: existing.email, isActive: existing.isActive, departmentId: existing.departmentId },
      newValue: { name: updated.name, email: updated.email, isActive: updated.isActive, departmentId: updated.departmentId },
    })

    const formatted = {
      ...updated,
      password: undefined,
      roles: updated.roles.map((r) => r.role),
    }

    return NextResponse.json({ data: formatted })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/users/[id] - Deactivate user (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasUserWritePermission(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: user:write permission required' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!existing.isActive) {
      return NextResponse.json({ error: 'User is already deactivated' }, { status: 400 })
    }

    // Soft delete: set isActive to false
    const updated = await db.user.update({
      where: { id },
      data: { isActive: false },
    })

    await logAudit({
      userId: authUser.id,
      action: 'DEACTIVATE_USER',
      entity: 'User',
      entityId: id,
      oldValue: { name: existing.name, email: existing.email, isActive: true },
      newValue: { name: updated.name, email: updated.email, isActive: false },
    })

    return NextResponse.json({ data: { id, isActive: false } })
  } catch (error) {
    console.error('Deactivate user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
