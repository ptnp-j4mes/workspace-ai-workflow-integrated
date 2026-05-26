import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/maintenance - List maintenance agreements
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

    const agreements = await db.maintenanceAgreement.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ agreements })
  } catch (error) {
    console.error('List maintenance agreements error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/maintenance - Create maintenance agreement
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, type, startDate, endDate, coverage, slaDetails } = body

    if (!projectId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'projectId, startDate, and endDate are required' },
        { status: 400 }
      )
    }

    // Verify project exists
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const agreement = await db.maintenanceAgreement.create({
      data: {
        projectId,
        type: type || 'STANDARD',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'ACTIVE',
        coverage: coverage || null,
        slaDetails: slaDetails ? (typeof slaDetails === 'string' ? slaDetails : JSON.stringify(slaDetails)) : null,
      },
      include: {
        project: {
          select: { id: true, name: true, code: true },
        },
      },
    })

    return NextResponse.json({ agreement }, { status: 201 })
  } catch (error) {
    console.error('Create maintenance agreement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
