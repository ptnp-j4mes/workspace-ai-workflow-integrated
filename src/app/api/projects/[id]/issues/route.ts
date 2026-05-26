import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// GET /api/projects/[id]/issues - List project issues
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

    const issues = await db.projectIssue.findMany({
      where: { projectId: id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: issues })
  } catch (error) {
    console.error('List project issues error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/issues - Create project issue
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
    const { title, description, severity, status, resolution, ownerId } = body

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const issue = await db.projectIssue.create({
      data: {
        projectId: id,
        title,
        description: description ?? null,
        severity: severity ?? 'MEDIUM',
        status: status ?? 'OPEN',
        resolution: resolution ?? null,
        ownerId: ownerId ?? null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'CREATE_PROJECT_ISSUE',
      entity: 'ProjectIssue',
      entityId: issue.id,
      aitNo: project.aitNo ?? undefined,
      newValue: { title, severity, status },
    })

    return NextResponse.json({ data: issue }, { status: 201 })
  } catch (error) {
    console.error('Create project issue error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
