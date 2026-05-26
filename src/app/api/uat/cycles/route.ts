import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/uat/cycles - List UAT cycles
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId') || undefined
    const status = searchParams.get('status') || undefined

    const where: any = {}
    if (projectId) where.projectId = projectId
    if (status) where.status = status

    const cycles = await db.uatCycle.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { testCases: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ cycles })
  } catch (error) {
    console.error('List UAT cycles error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/uat/cycles - Create UAT cycle
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, requestId, name, description, startDate, endDate } = body

    if (!projectId || !name) {
      return NextResponse.json(
        { error: 'projectId and name are required' },
        { status: 400 }
      )
    }

    // Verify project exists
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const cycle = await db.uatCycle.create({
      data: {
        projectId,
        requestId: requestId || null,
        name,
        description: description || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: 'PLANNED',
      },
      include: {
        project: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { testCases: true },
        },
      },
    })

    return NextResponse.json({ cycle }, { status: 201 })
  } catch (error) {
    console.error('Create UAT cycle error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
