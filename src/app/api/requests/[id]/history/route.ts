import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/requests/[id]/history - Get request status history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const req = await db.request.findUnique({ where: { id } })
    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const history = await db.requestStatusHistory.findMany({
      where: { requestId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ history })
  } catch (error) {
    console.error('Get request history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
