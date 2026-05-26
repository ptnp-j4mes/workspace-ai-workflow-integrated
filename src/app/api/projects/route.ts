import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { generateDocumentNo } from '@/lib/services/document-number-service'

// GET /api/projects - List projects with optional status filter
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined

    const where: any = {}
    if (status) where.status = status

    const projects = await db.project.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('List projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects - Create project
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code, name, description, startDate, endDate } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    // Auto-generate code if not provided
    let projectCode = code?.trim()
    if (!projectCode) {
      projectCode = await generateDocumentNo('PROJECT', 'PROJECT', undefined, user.id)
    } else {
      // Check for duplicate code if manually provided
      const existing = await db.project.findUnique({ where: { code: projectCode } })
      if (existing) {
        return NextResponse.json(
          { error: 'Project code already exists' },
          { status: 409 }
        )
      }
    }

    const project = await db.project.create({
      data: {
        code: projectCode,
        name,
        description: description || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        createdById: user.id,
        versions: {
          create: {
            version: 1,
            name,
            description: description || null,
            status: 'ACTIVE',
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            changeLog: 'Project created',
            changeType: 'CREATE',
            snapshot: JSON.stringify({
              name,
              description: description || null,
              status: 'ACTIVE',
              startDate: startDate || null,
              endDate: endDate || null,
              aitNo: null,
              healthScore: null,
            }),
            createdById: user.id,
          },
        },
      },
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

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
