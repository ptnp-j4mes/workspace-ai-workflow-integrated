import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// GET /api/projects/[id]/decisions - List project decisions
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

    const decisions = await db.projectDecision.findMany({
      where: { projectId: id },
      include: {
        decidedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: decisions })
  } catch (error) {
    console.error('List project decisions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/decisions - Create project decision
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
    const { title, description, decision, rationale, alternatives, status, decidedById } = body

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const projectDecision = await db.projectDecision.create({
      data: {
        projectId: id,
        title,
        description: description ?? null,
        decision: decision ?? null,
        rationale: rationale ?? null,
        alternatives: alternatives ? JSON.stringify(alternatives) : null,
        status: status ?? 'PROPOSED',
        decidedById: decidedById ?? null,
        decidedAt: status === 'ACCEPTED' || status === 'REJECTED' ? new Date() : null,
      },
      include: {
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'CREATE_PROJECT_DECISION',
      entity: 'ProjectDecision',
      entityId: projectDecision.id,
      aitNo: project.aitNo ?? undefined,
      newValue: { title, status },
    })

    return NextResponse.json({ data: projectDecision }, { status: 201 })
  } catch (error) {
    console.error('Create project decision error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
