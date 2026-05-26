import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { dismissActionItem } from '@/lib/services/action-inbox-service'

// POST /api/me/action-inbox/[itemId]/dismiss - Dismiss an action inbox item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { itemId } = await params

    const body = await request.json().catch(() => ({}))
    const itemType = body.type

    if (!itemType) {
      return NextResponse.json(
        { error: 'type is required in the request body (e.g. APPROVAL_PENDING, MIT_PENDING)' },
        { status: 400 }
      )
    }

    await dismissActionItem(itemId, itemType, authUser.id)

    return NextResponse.json({ data: { message: 'Action item dismissed' } })
  } catch (error) {
    console.error('Dismiss action item error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
