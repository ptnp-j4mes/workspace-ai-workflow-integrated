import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getActionInbox } from '@/lib/services/action-inbox-service'

// GET /api/me/action-inbox - Get action inbox items for current user
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const type = searchParams.get('type') || undefined

    const { items, total } = await getActionInbox(authUser.id, { page, limit })

    // Filter by type if provided
    const filteredItems = type
      ? items.filter(item => item.type === type)
      : items

    const filteredTotal = type ? filteredItems.length : total

    return NextResponse.json({
      data: filteredItems,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        totalPages: Math.ceil(filteredTotal / limit),
      },
    })
  } catch (error) {
    console.error('Get action inbox error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
