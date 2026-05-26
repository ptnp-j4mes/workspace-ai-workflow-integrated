import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// ============================================================
// PATCH /api/menus/reorder - Bulk reorder menus with drag-and-drop positions
// ============================================================
export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!authUser.roles.includes('ADMIN') && !authUser.roles.includes('IT_MANAGER')) {
      return NextResponse.json({ error: 'Forbidden: admin permission required' }, { status: 403 })
    }

    const body = await request.json()
    const { items } = body as { items: Array<{ id: string; sortOrder: number; parentId?: string | null }> }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items array is required' },
        { status: 400 }
      )
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

    return NextResponse.json({ data: { updated: items.length } })
  } catch (error) {
    console.error('Reorder menus error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
