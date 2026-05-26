import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/admin/job-runs - List job run history with filters
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = authUser.roles.includes('ADMIN') || authUser.roles.includes('IT_MANAGER')
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin permission required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const jobKey = searchParams.get('jobKey') || undefined
    const status = searchParams.get('status') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (jobKey) where.jobKey = jobKey
    if (status) where.status = status

    const [runs, total] = await Promise.all([
      db.backgroundJobRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: {
          job: {
            select: { name: true, jobKey: true },
          },
        },
      }),
      db.backgroundJobRun.count({ where }),
    ])

    return NextResponse.json({
      data: runs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List job runs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
