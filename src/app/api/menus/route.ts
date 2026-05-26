import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// ============================================================
// GET /api/menus - List all menus as tree
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const menus = await db.menu.findMany({
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
          include: {
            menuPermissions: {
              include: { role: { select: { id: true, key: true, name: true } } },
            },
          },
        },
        menuPermissions: {
          include: { role: { select: { id: true, key: true, name: true } } },
        },
      },
    })

    // Build tree: only top-level menus with their children
    const tree = menus
      .filter((m) => m.level === 1)
      .map((parent) => ({
        ...parent,
        children: parent.children.map((child) => ({
          ...child,
          roles: child.menuPermissions.map((mp) => mp.role),
          menuPermissions: undefined,
        })),
        roles: parent.menuPermissions.map((mp) => mp.role),
        menuPermissions: undefined,
      }))

    return NextResponse.json({ data: tree })
  } catch (error) {
    console.error('List menus error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// POST /api/menus - Create a new menu
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!authUser.roles.includes('ADMIN') && !authUser.roles.includes('IT_MANAGER')) {
      return NextResponse.json({ error: 'Forbidden: admin permission required' }, { status: 403 })
    }

    const body = await request.json()
    const {
      key,
      label,
      labelTh,
      icon,
      view,
      parentId,
      level,
      sortOrder,
      isVisible,
      isExpanded,
      requiredPermission,
      badge,
      badgeVariant,
    } = body

    if (!key || !label || !icon || !view) {
      return NextResponse.json(
        { error: 'Key, label, icon, and view are required' },
        { status: 400 }
      )
    }

    // Check for duplicate key
    const existing = await db.menu.findUnique({ where: { key } })
    if (existing) {
      return NextResponse.json({ error: 'Menu key already exists' }, { status: 400 })
    }

    const menu = await db.menu.create({
      data: {
        key,
        label,
        labelTh: labelTh ?? null,
        icon,
        view,
        parentId: parentId ?? null,
        level: level ?? 1,
        sortOrder: sortOrder ?? 0,
        isVisible: isVisible ?? true,
        isExpanded: isExpanded ?? false,
        requiredPermission: requiredPermission ?? null,
        badge: badge ?? null,
        badgeVariant: badgeVariant ?? 'default',
      },
      include: {
        parent: { select: { id: true, key: true, label: true } },
        children: true,
      },
    })

    return NextResponse.json({ data: menu }, { status: 201 })
  } catch (error) {
    console.error('Create menu error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
