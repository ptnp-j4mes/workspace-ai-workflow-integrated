import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// GET /api/projects/[id]/versions - List all versions of a project
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

    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const versions = await db.projectVersion.findMany({
      where: { projectId: id },
      orderBy: { version: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ data: versions })
  } catch (error) {
    console.error('Get project versions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/versions - Create a manual version snapshot
export async function POST(
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

    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const newVersion = project.currentVersion + 1

    // Build snapshot of current project data
    const snapshot = JSON.stringify({
      name: project.name,
      description: project.description,
      status: project.status,
      startDate: project.startDate?.toISOString() ?? null,
      endDate: project.endDate?.toISOString() ?? null,
      aitNo: project.aitNo,
      healthScore: project.healthScore,
    })

    const version = await db.projectVersion.create({
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
        changeLog: body.changeLog ?? null,
        changeType: 'MANUAL',
        snapshot,
        createdById: authUser.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Update project currentVersion
    await db.project.update({
      where: { id },
      data: { currentVersion: newVersion },
    })

    // Log audit
    await logAudit({
      userId: authUser.id,
      action: 'CREATE_VERSION',
      entity: 'ProjectVersion',
      entityId: version.id,
      aitNo: project.aitNo ?? undefined,
      newValue: { version: newVersion, changeType: 'MANUAL', changeLog: body.changeLog },
      entityType: 'Project',
    })

    return NextResponse.json({ data: version }, { status: 201 })
  } catch (error) {
    console.error('Create project version error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
