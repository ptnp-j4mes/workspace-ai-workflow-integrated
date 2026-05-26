import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/bugs - List bugs with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const severity = searchParams.get('severity') || undefined
    const requestId = searchParams.get('requestId') || undefined
    const projectId = searchParams.get('projectId') || undefined

    const where: any = {}
    if (status) where.status = status
    if (severity) where.severity = severity
    if (requestId) where.requestId = requestId
    if (projectId) where.projectId = projectId

    const bugs = await db.bugReport.findMany({
      where,
      include: {
        request: {
          select: { id: true, title: true, code: true },
        },
        reportedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ bugs })
  } catch (error) {
    console.error('List bugs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/bugs - Create bug report
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      requestId,
      projectId,
      title,
      description,
      severity,
      actualResult,
      expectedResult,
      reproductionSteps,
    } = body

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
    }

    const bug = await db.bugReport.create({
      data: {
        requestId: requestId || null,
        projectId: projectId || null,
        title,
        description,
        severity: severity || 'MEDIUM',
        actualResult: actualResult || null,
        expectedResult: expectedResult || null,
        reproductionSteps: reproductionSteps || null,
        reportedById: user.id,
        status: 'OPEN',
      },
      include: {
        request: {
          select: { id: true, title: true, code: true },
        },
        reportedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ bug }, { status: 201 })
  } catch (error) {
    console.error('Create bug error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
