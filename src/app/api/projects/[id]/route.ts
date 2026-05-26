import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// GET /api/projects/[id] - Get project detail
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

    const project = await db.project.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: {
            requests: true,
            meetings: true,
            uatCycles: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Get project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/projects/[id] - Update project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if code is being changed and if it conflicts
    if (body.code && body.code !== existing.code) {
      const duplicate = await db.project.findUnique({ where: { code: body.code } })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Project code already exists' },
          { status: 409 }
        )
      }
    }

    const data: Record<string, unknown> = {}
    const allowedFields = ['code', 'name', 'description', 'status', 'startDate', 'endDate']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'startDate' || field === 'endDate') {
          data[field] = body[field] ? new Date(body[field]) : null
        } else {
          data[field] = body[field]
        }
      }
    }

    const project = await db.project.update({
      where: { id },
      data,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            members: true,
            requests: true,
          },
        },
      },
    })

    // --- Auto-create version snapshot ---
    // Determine which tracked fields changed by comparing old vs new values
    const trackedFields = ['name', 'description', 'status', 'startDate', 'endDate', 'aitNo', 'healthScore'] as const
    const changedFields: string[] = []

    for (const field of trackedFields) {
      const oldValue = existing[field as keyof typeof existing]
      const newValue = project[field as keyof typeof project]
      const oldStr = oldValue instanceof Date ? oldValue.toISOString() : String(oldValue ?? '')
      const newStr = newValue instanceof Date ? newValue.toISOString() : String(newValue ?? '')
      if (oldStr !== newStr) {
        changedFields.push(field)
      }
    }

    if (changedFields.length > 0) {
      const newVersion = project.currentVersion + 1

      // Determine change type
      const statusChanged = changedFields.includes('status')
      const changeType = statusChanged ? 'STATUS_CHANGE' : 'UPDATE'

      // Auto-generate changeLog
      const changeLog = `Updated ${changedFields.join(', ')}`

      // Build snapshot of ALL project fields AFTER the update
      const snapshot = JSON.stringify({
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.startDate?.toISOString() ?? null,
        endDate: project.endDate?.toISOString() ?? null,
        aitNo: project.aitNo,
        healthScore: project.healthScore,
      })

      await db.projectVersion.create({
        data: {
          projectId: id,
          version: newVersion,
          name: project.name,
          description: project.description,
          status: project.status,
          startDate: project.startDate,
          endDate: project.endDate,
          aitNo: project.aitNo,
          healthScore: project.healthScore,
          changeLog,
          changeType,
          snapshot,
          createdById: authUser.id,
        },
      })

      // Update project.currentVersion to the new version number
      await db.project.update({
        where: { id },
        data: { currentVersion: newVersion },
      })

      // Log audit for the auto-version
      await logAudit({
        userId: authUser.id,
        action: 'AUTO_VERSION',
        entity: 'ProjectVersion',
        entityId: id,
        aitNo: project.aitNo ?? undefined,
        oldValue: { version: project.currentVersion },
        newValue: { version: newVersion, changeType, changeLog, changedFields },
        entityType: 'Project',
      })
    }

    // Return the updated project with currentVersion
    const updatedProject = await db.project.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            members: true,
            requests: true,
          },
        },
      },
    })

    return NextResponse.json({ project: updatedProject })
  } catch (error) {
    console.error('Update project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
