import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'

export const menusRoutes = new Elysia({ prefix: '/api/menus' })
  // ============================================================
  // GET /api/menus - List all menus as tree
  // ============================================================
  .get('/', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
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

      return { data: tree }
    } catch (error) {
      console.error('List menus error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // ============================================================
  // POST /api/menus - Create a new menu
  // ============================================================
  .post('/', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      if (!authUser.roles.includes('ADMIN') && !authUser.roles.includes('IT_MANAGER')) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
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
        set.status = 400
        return { error: 'Key, label, icon, and view are required' }
      }

      // Check for duplicate key
      const existing = await db.menu.findUnique({ where: { key } })
      if (existing) {
        set.status = 400
        return { error: 'Menu key already exists' }
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

      set.status = 201
      return { data: menu }
    } catch (error) {
      console.error('Create menu error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // ============================================================
  // GET /api/menus/user - Get menus for the current user based on role permissions
  // ============================================================
  .get('/user', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
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
      const filterMenu = (menu: (typeof menus)[number]) => {
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

      return { data: tree }
    } catch (error) {
      console.error('Get user menus error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // ============================================================
  // PATCH /api/menus/reorder - Bulk reorder menus with drag-and-drop positions
  // ============================================================
  .patch('/reorder', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      if (!authUser.roles.includes('ADMIN') && !authUser.roles.includes('IT_MANAGER')) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const body = await request.json()
      const { items } = body as { items: Array<{ id: string; sortOrder: number; parentId?: string | null }> }

      if (!items || !Array.isArray(items)) {
        set.status = 400
        return { error: 'Items array is required' }
      }

      // Update each menu's sortOrder (and optionally parentId) in a transaction
      await db.$transaction(
        items.map((item) =>
          db.menu.update({
            where: { id: item.id },
            data: {
              sortOrder: item.sortOrder,
              ...(item.parentId !== undefined ? { parentId: item.parentId } : {}),
            },
          })
        )
      )

      return { data: { updated: items.length } }
    } catch (error) {
      console.error('Reorder menus error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // ============================================================
  // GET /api/menus/:id - Get a single menu
  // ============================================================
  .get('/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
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
        set.status = 404
        return { error: 'Menu not found' }
      }

      return { data: menu }
    } catch (error) {
      console.error('Get menu error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // ============================================================
  // PATCH /api/menus/:id - Update a menu
  // ============================================================
  .patch('/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      if (!authUser.roles.includes('ADMIN') && !authUser.roles.includes('IT_MANAGER')) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const { id } = params
      const body = await request.json()

      // Check menu exists
      const existing = await db.menu.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Menu not found' }
      }

      // If key is being changed, check for duplicate
      if (body.key && body.key !== existing.key) {
        const duplicate = await db.menu.findUnique({ where: { key: body.key } })
        if (duplicate) {
          set.status = 400
          return { error: 'Menu key already exists' }
        }
      }

      // Validate parentId doesn't create circular reference
      if (body.parentId !== undefined) {
        if (body.parentId === id) {
          set.status = 400
          return { error: 'Menu cannot be its own parent' }
        }
        // Check for deeper circular reference
        if (body.parentId) {
          let currentParentId: string | null = body.parentId
          while (currentParentId) {
            if (currentParentId === id) {
              set.status = 400
              return { error: 'Circular reference detected' }
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

      return { data: menu }
    } catch (error) {
      console.error('Update menu error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // ============================================================
  // DELETE /api/menus/:id - Delete a menu
  // ============================================================
  .delete('/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      if (!authUser.roles.includes('ADMIN') && !authUser.roles.includes('IT_MANAGER')) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const { id } = params

      const existing = await db.menu.findUnique({
        where: { id },
        include: { children: true },
      })

      if (!existing) {
        set.status = 404
        return { error: 'Menu not found' }
      }

      // Delete will cascade to children and menuPermissions
      await db.menu.delete({ where: { id } })

      return { data: { deleted: true, id } }
    } catch (error) {
      console.error('Delete menu error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
