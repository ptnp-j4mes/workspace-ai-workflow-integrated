import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// ============================================================
// GET /api/menus/[id] - Get a single menu
// ============================================================
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
    const menu = await db.menu.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, key: true, label: true } },
        children: { orderBy: { sortOrder: 'asc' } },
        menuPermissions: {
          include: { role: { select: { id: true, key: true, name: true } } },
        },
      },
    })

    if (!menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    return NextResponse.json({ data: menu })
  } catch (error) {
    console.error('Get menu error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// PATCH /api/menus/[id] - Update a menu
// ============================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!authUser.roles.includes('ADMIN') && !authUser.roles.includes('IT_MANAGER')) {
      return NextResponse.json({ error: 'Forbidden: admin permission required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Check menu exists
    const existing = await db.menu.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    // If key is being changed, check for duplicate
    if (body.key && body.key !== existing.key) {
      const duplicate = await db.menu.findUnique({ where: { key: body.key } })
      if (duplicate) {
        return NextResponse.json({ error: 'Menu key already exists' }, { status: 400 })
      }
    }

    // Validate parentId doesn't create circular reference
    if (body.parentId !== undefined) {
      if (body.parentId === id) {
        return NextResponse.json(
          { error: 'Menu cannot be its own parent' },
          { status: 400 }
        )
      }
      // Check for deeper circular reference
      if (body.parentId) {
        let currentParentId: string | null = body.parentId
        while (currentParentId) {
          if (currentParentId === id) {
            return NextResponse.json(
              { error: 'Circular reference detected' },
              { status: 400 }
            )
          }
          const parent = await db.menu.findUnique({
            where: { id: currentParentId },
            select: { parentId: true },
          })
          currentParentId = parent?.parentId ?? null
        }
      }
    }

    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'key', 'label', 'labelTh', 'icon', 'view', 'parentId', 'level',
      'sortOrder', 'isVisible', 'isExpanded', 'requiredPermission',
      'badge', 'badgeVariant',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const menu = await db.menu.update({
      where: { id },
      data: updateData,
      include: {
        parent: { select: { id: true, key: true, label: true } },
        children: { orderBy: { sortOrder: 'asc' } },
        menuPermissions: {
          include: { role: { select: { id: true, key: true, name: true } } },
        },
      },
    })

    return NextResponse.json({ data: menu })
  } catch (error) {
    console.error('Update menu error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// DELETE /api/menus/[id] - Delete a menu
// ============================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!authUser.roles.includes('ADMIN') && !authUser.roles.includes('IT_MANAGER')) {
      return NextResponse.json({ error: 'Forbidden: admin permission required' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.menu.findUnique({
      where: { id },
      include: { children: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    // Delete will cascade to children and menuPermissions
    await db.menu.delete({ where: { id } })

    return NextResponse.json({ data: { deleted: true, id } })
  } catch (error) {
    console.error('Delete menu error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
