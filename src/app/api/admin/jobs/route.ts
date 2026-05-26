import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/admin/jobs - List background jobs with status
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

    const jobs = await db.backgroundJob.findMany({
      orderBy: { jobKey: 'asc' },
      include: {
        runs: {
          take: 1,
          orderBy: { startedAt: 'desc' },
        },
      },
    })

    const formatted = jobs.map((job) => ({
      ...job,
      lastRun: job.runs[0] ?? null,
      runs: undefined,
    }))

    return NextResponse.json({ data: formatted })
  } catch (error) {
    console.error('List background jobs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
