import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getPendingApprovals } from '@/lib/services/approval-service'

// GET /api/me/approvals - Get pending approvals for current user
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const approvals = await getPendingApprovals(authUser.id)

    return NextResponse.json({ data: approvals })
  } catch (error) {
    console.error('Get pending approvals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
