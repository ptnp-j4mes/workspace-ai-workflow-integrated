import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// ============================================================
// GET /api/menus/user - Get menus for the current user based on role permissions
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = authUser.roles.includes('ADMIN') || authUser.roles.includes('IT_MANAGER')

    // Get all visible menus with their permissions
    const menus = await db.menu.findMany({
      where: { isVisible: true },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      include: {
        children: {
          where: { isVisible: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            menuPermissions: {
              include: { role: { select: { key: true } } },
            },
          },
        },
        menuPermissions: {
          include: { role: { select: { key: true } } },
        },
      },
    })

    // Filter menus based on user roles and permissions
    const filterMenu = (menu: typeof menus[number]) => {
      // If no permission required, visible to all
      if (!menu.requiredPermission) {
        return true
      }

      // Admin can see everything
      if (isAdmin) {
        return true
      }

      // Check if menu has explicit role permissions and user has matching role
      if (menu.menuPermissions.length > 0) {
        const menuRoleKeys = menu.menuPermissions.map((mp) => mp.role.key)
        return authUser.roles.some((userRole) => menuRoleKeys.includes(userRole))
      }

      // If requiredPermission is set but no explicit menuPermissions,
      // check if the requiredPermission matches a known permission key
      if (menu.requiredPermission === 'admin') {
        return isAdmin
      }

      // Default: allow
      return true
    }

    // Build tree with filtered results
    const tree = menus
      .filter((m) => m.level === 1)
      .filter(filterMenu)
      .map((parent) => ({
        id: parent.id,
        key: parent.key,
        label: parent.label,
        labelTh: parent.labelTh,
        icon: parent.icon,
        view: parent.view,
        level: parent.level,
        sortOrder: parent.sortOrder,
        isVisible: parent.isVisible,
        isExpanded: parent.isExpanded,
        requiredPermission: parent.requiredPermission,
        badge: parent.badge,
        badgeVariant: parent.badgeVariant,
        children: parent.children.filter(filterMenu).map((child) => ({
          id: child.id,
          key: child.key,
          label: child.label,
          labelTh: child.labelTh,
          icon: child.icon,
          view: child.view,
          level: child.level,
          sortOrder: child.sortOrder,
          isVisible: child.isVisible,
          isExpanded: child.isExpanded,
          requiredPermission: child.requiredPermission,
          badge: child.badge,
          badgeVariant: child.badgeVariant,
          parentId: child.parentId,
        })),
      }))

    return NextResponse.json({ data: tree })
  } catch (error) {
    console.error('Get user menus error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
