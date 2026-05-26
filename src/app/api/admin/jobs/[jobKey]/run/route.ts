import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// POST /api/admin/jobs/[jobKey]/run - Trigger manual run
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobKey: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = authUser.roles.includes('ADMIN') || authUser.roles.includes('IT_MANAGER')
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin permission required' }, { status: 403 })
    }

    const { jobKey } = await params

    const job = await db.backgroundJob.findUnique({ where: { jobKey } })
    if (!job) {
      return NextResponse.json({ error: 'Background job not found' }, { status: 404 })
    }

    if (!job.isEnabled) {
      return NextResponse.json({ error: 'Cannot run a disabled job' }, { status: 400 })
    }

    // Create a new job run record
    const jobRun = await db.backgroundJobRun.create({
      data: {
        jobKey,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    })

    // Update the job's last run info
    await db.backgroundJob.update({
      where: { jobKey },
      data: {
        lastRunAt: new Date(),
        lastStatus: 'RUNNING',
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'TRIGGER_BACKGROUND_JOB',
      entity: 'BackgroundJob',
      entityId: jobKey,
      newValue: { jobRunId: jobRun.id, status: 'RUNNING' },
    })

    // In a real system, this would enqueue the job for execution.
    // For now, we simulate a quick completion after a brief delay.
    // The actual job execution logic would be in a separate worker process.

    // Simulate immediate completion for dev mode
    const isDevMode = process.env.NODE_ENV !== 'production'
    if (isDevMode) {
      await db.backgroundJobRun.update({
        where: { id: jobRun.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          result: JSON.stringify({ message: 'Job completed (dev simulation)', triggeredBy: authUser.id }),
          durationMs: 100,
        },
      })

      await db.backgroundJob.update({
        where: { jobKey },
        data: {
          lastStatus: 'SUCCESS',
          nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
        },
      })
    }

    return NextResponse.json({
      data: {
        jobRunId: jobRun.id,
        jobKey,
        status: isDevMode ? 'SUCCESS' : 'RUNNING',
        message: isDevMode ? 'Job completed (dev simulation)' : 'Job triggered successfully',
      },
    })
  } catch (error) {
    console.error('Trigger background job error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
