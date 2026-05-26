import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getProjectCommits } from '@/lib/services/github-service'

// GET /api/projects/[id]/github/commits - Get project commits with filters
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
    const { searchParams } = new URL(request.url)
    const branch = searchParams.get('branch') || undefined
    const since = searchParams.get('since') ? new Date(searchParams.get('since')!) : undefined
    const until = searchParams.get('until') ? new Date(searchParams.get('until')!) : undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const { items, total } = await getProjectCommits(id, {
      branch,
      since,
      until,
      page,
      limit,
    })

    return NextResponse.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get project commits error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
