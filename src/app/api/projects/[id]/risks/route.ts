import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// GET /api/projects/[id]/risks - List project risks
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

    const risks = await db.projectRisk.findMany({
      where: { projectId: id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: risks })
  } catch (error) {
    console.error('List project risks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/risks - Create project risk
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
    const { title, description, probability, impact, mitigation, status, ownerId } = body

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const risk = await db.projectRisk.create({
      data: {
        projectId: id,
        title,
        description: description ?? null,
        probability: probability ?? 'MEDIUM',
        impact: impact ?? 'MEDIUM',
        mitigation: mitigation ?? null,
        status: status ?? 'IDENTIFIED',
        ownerId: ownerId ?? null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'CREATE_PROJECT_RISK',
      entity: 'ProjectRisk',
      entityId: risk.id,
      aitNo: project.aitNo ?? undefined,
      newValue: { title, probability, impact, status },
    })

    return NextResponse.json({ data: risk }, { status: 201 })
  } catch (error) {
    console.error('Create project risk error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
