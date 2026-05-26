import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/activity-daily/[id] - Get single activity daily record by ID
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

    const record = await db.activityDaily.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            department: { select: { id: true, name: true } },
          },
        },
        approvedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!record) {
      return NextResponse.json(
        { error: 'Activity daily record not found' },
        { status: 404 }
      )
    }

    // Parse projectEntries JSON
    const parsedRecord = {
      ...record,
      projectEntries: record.projectEntries ? JSON.parse(record.projectEntries) : [],
    }

    return NextResponse.json({ record: parsedRecord })
  } catch (error) {
    console.error('Get activity daily error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/activity-daily/[id] - Update activity daily record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const existing = await db.activityDaily.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Activity daily record not found' },
        { status: 404 }
      )
    }

    // Build update data
    const data: Record<string, unknown> = {}

    // Allow updating specific fields
    const allowedFields = [
      'totalWorkHours',
      'aiUsageHours',
      'summary',
      'commitSummary',
      'commitCount',
      'kpiTargetPercentage',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field]
      }
    }

    // Handle projectEntries (JSON stringification)
    if (body.projectEntries !== undefined) {
      data.projectEntries =
        typeof body.projectEntries === 'string'
          ? body.projectEntries
          : JSON.stringify(body.projectEntries)
    }

    // Handle status changes with approval logic
    if (body.status !== undefined) {
      data.status = body.status

      // If status is APPROVED, set approver info
      if (body.status === 'APPROVED') {
        data.approvedById = user.id
        data.approvedAt = new Date()
      }

      // If status is changed from APPROVED back to something else, clear approver
      if (existing.status === 'APPROVED' && body.status !== 'APPROVED') {
        data.approvedById = null
        data.approvedAt = null
      }
    }

    // Recalculate derived fields if work hours or AI hours changed
    const newWorkHours = (data.totalWorkHours as number) ?? existing.totalWorkHours
    const newAiHours = (data.aiUsageHours as number) ?? existing.aiUsageHours
    const newKpiTarget =
      (data.kpiTargetPercentage as number) ?? existing.kpiTargetPercentage

    data.aiUsagePercentage =
      newWorkHours > 0
        ? Math.round((newAiHours / newWorkHours) * 10000) / 100
        : 0
    data.kpiMet = (data.aiUsagePercentage as number) >= newKpiTarget

    // Recalculate commitCount from projectEntries if provided
    if (body.projectEntries !== undefined) {
      const entries =
        typeof body.projectEntries === 'string'
          ? JSON.parse(body.projectEntries)
          : body.projectEntries
      data.commitCount = entries.reduce(
        (sum: number, e: { commitCount?: number }) => sum + (e.commitCount || 0),
        0
      )
    }

    const updated = await db.activityDaily.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            department: { select: { id: true, name: true } },
          },
        },
        approvedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Parse projectEntries for response
    const parsedRecord = {
      ...updated,
      projectEntries: updated.projectEntries ? JSON.parse(updated.projectEntries) : [],
    }

    return NextResponse.json({ record: parsedRecord })
  } catch (error) {
    console.error('Update activity daily error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/activity-daily/[id] - Delete activity daily record
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existing = await db.activityDaily.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Activity daily record not found' },
        { status: 404 }
      )
    }

    await db.activityDaily.delete({ where: { id } })

    return NextResponse.json({ message: 'Activity daily record deleted successfully' })
  } catch (error) {
    console.error('Delete activity daily error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
