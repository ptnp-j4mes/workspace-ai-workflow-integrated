import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { calculateHealthScore, recalculateHealth } from '@/lib/services/project-health-service'

// GET /api/projects/[id]/health - Get project health score
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

    const project = await db.project.findUnique({
      where: { id },
      select: { id: true, name: true, healthScore: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        projectId: project.id,
        projectName: project.name,
        healthScore: project.healthScore,
      },
    })
  } catch (error) {
    console.error('Get project health error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/health - Recalculate project health score
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

    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    await recalculateHealth(id)

    const updated = await db.project.findUnique({
      where: { id },
      select: { healthScore: true },
    })

    const newScore = await calculateHealthScore(id)

    return NextResponse.json({
      data: {
        projectId: id,
        healthScore: updated?.healthScore ?? newScore,
      },
    })
  } catch (error) {
    console.error('Recalculate project health error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
