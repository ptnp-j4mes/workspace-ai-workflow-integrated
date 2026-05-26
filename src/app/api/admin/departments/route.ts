import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

function isAdmin(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

// GET /api/admin/departments - List departments with hierarchy
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all departments with their parent info
    const departments = await db.department.findMany({
      orderBy: [{ type: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
        children: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            _count: { select: { users: true } },
          },
        },
        _count: {
          select: { users: true, children: true, jobPositions: true },
        },
      },
    })

    const formatted = departments.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      type: d.type,
      description: d.description,
      parentId: d.parentId,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
      parent: d.parent,
      userCount: d._count.users,
      childCount: d._count.children,
      jobPositionCount: d._count.jobPositions,
      children: d.children.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        type: c.type,
        description: c.description,
        parentId: c.parentId,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        userCount: c._count.users,
      })),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }))

    return NextResponse.json({ data: formatted })
  } catch (error) {
    console.error('List departments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/departments - Create department
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdmin(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: admin permission required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, code, type, description, parentId, sortOrder } = body

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      )
    }

    // Validate type
    const deptType = type || 'SECTION'
    if (!['DIVISION', 'SECTION'].includes(deptType)) {
      return NextResponse.json(
        { error: 'Type must be DIVISION or SECTION' },
        { status: 400 }
      )
    }

    // Validate: SECTION must have a parent (division)
    if (deptType === 'SECTION' && !parentId) {
      return NextResponse.json(
        { error: 'Section must belong to a Division (parentId required)' },
        { status: 400 }
      )
    }

    // Check for duplicate code
    const existing = await db.department.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: 'Department code already exists' }, { status: 400 })
    }

    // Check for duplicate name
    const existingName = await db.department.findUnique({ where: { name } })
    if (existingName) {
      return NextResponse.json({ error: 'Department name already exists' }, { status: 400 })
    }

    const department = await db.department.create({
      data: {
        name,
        code,
        type: deptType,
        description: description || null,
        parentId: parentId ?? null,
        sortOrder: sortOrder ?? 0,
      },
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'CREATE_DEPARTMENT',
      entity: 'Department',
      entityId: department.id,
      newValue: { name, code, type: deptType, description, parentId: parentId ?? null },
    })

    return NextResponse.json({ data: department }, { status: 201 })
  } catch (error) {
    console.error('Create department error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/departments - Update department
export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdmin(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: admin permission required' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, code, type, description, parentId, sortOrder, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 })
    }

    const existing = await db.department.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    // If changing to SECTION, ensure parentId is set
    if (type === 'SECTION' && !parentId && !existing.parentId) {
      return NextResponse.json(
        { error: 'Section must belong to a Division' },
        { status: 400 }
      )
    }

    // Check duplicate code if changed
    if (code && code !== existing.code) {
      const dupCode = await db.department.findUnique({ where: { code } })
      if (dupCode) {
        return NextResponse.json({ error: 'Department code already exists' }, { status: 400 })
      }
    }

    // Check duplicate name if changed
    if (name && name !== existing.name) {
      const dupName = await db.department.findUnique({ where: { name } })
      if (dupName) {
        return NextResponse.json({ error: 'Department name already exists' }, { status: 400 })
      }
    }

    // Prevent circular parent reference
    if (parentId && parentId === id) {
      return NextResponse.json({ error: 'Department cannot be its own parent' }, { status: 400 })
    }

    const department = await db.department.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description: description || null }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'UPDATE_DEPARTMENT',
      entity: 'Department',
      entityId: department.id,
      oldValue: { name: existing.name, code: existing.code },
      newValue: { name, code, type, description, parentId, sortOrder, isActive },
    })

    return NextResponse.json({ data: department })
  } catch (error) {
    console.error('Update department error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/departments - Delete department
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdmin(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: admin permission required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 })
    }

    const existing = await db.department.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, children: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    // Check for dependencies
    if (existing._count.users > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${existing._count.users} user(s) assigned to this department` },
        { status: 400 }
      )
    }
    if (existing._count.children > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${existing._count.children} child department(s) exist. Delete children first.` },
        { status: 400 }
      )
    }

    await db.department.delete({ where: { id } })

    await logAudit({
      userId: authUser.id,
      action: 'DELETE_DEPARTMENT',
      entity: 'Department',
      entityId: id,
      oldValue: { name: existing.name, code: existing.code },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete department error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
