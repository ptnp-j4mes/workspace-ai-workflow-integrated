import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// PATCH /api/admin/jobs/[jobKey] - Enable/disable job
export async function PATCH(
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
    const body = await request.json()
    const { isEnabled } = body

    if (isEnabled === undefined) {
      return NextResponse.json({ error: 'isEnabled is required' }, { status: 400 })
    }

    const existing = await db.backgroundJob.findUnique({ where: { jobKey } })
    if (!existing) {
      return NextResponse.json({ error: 'Background job not found' }, { status: 404 })
    }

    const updated = await db.backgroundJob.update({
      where: { jobKey },
      data: { isEnabled },
    })

    await logAudit({
      userId: authUser.id,
      action: isEnabled ? 'ENABLE_BACKGROUND_JOB' : 'DISABLE_BACKGROUND_JOB',
      entity: 'BackgroundJob',
      entityId: jobKey,
      oldValue: { isEnabled: existing.isEnabled },
      newValue: { isEnabled: updated.isEnabled },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Update background job error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
