import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/requests - List requests with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const type = searchParams.get('type') || undefined
    const priority = searchParams.get('priority') || undefined
    const projectId = searchParams.get('projectId') || undefined
    const assignedToMe = searchParams.get('assignedToMe') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type
    if (priority) where.priority = priority
    if (projectId) where.projectId = projectId
    if (assignedToMe) {
      where.OR = [
        { assignedBAId: user.id },
        { assignedDevId: user.id },
        { assignedQAId: user.id },
        { createdById: user.id },
      ]
    }

    const [requests, total] = await Promise.all([
      db.request.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          assignedBA: {
            select: { id: true, name: true, email: true },
          },
          assignedDev: {
            select: { id: true, name: true, email: true },
          },
          assignedQA: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.request.count({ where }),
    ])

    return NextResponse.json({
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List requests error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/requests - Create request
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      type,
      priority,
      projectId,
      affectedSystem,
      businessImpact,
      acceptanceCriteria,
      dueDate,
    } = body

    if (!title || !description || !type) {
      return NextResponse.json(
        { error: 'Title, description, and type are required' },
        { status: 400 }
      )
    }

    // Auto-generate request code: REQ-YYYY-NNNN
    const now = new Date()
    const year = now.getFullYear()
    const prefix = `REQ-${year}-`

    // Find the highest existing code for this year
    const lastRequest = await db.request.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })

    let nextNum = 1
    if (lastRequest?.code) {
      const parts = lastRequest.code.split('-')
      const lastNum = parseInt(parts[2], 10)
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1
      }
    }

    const code = `${prefix}${nextNum.toString().padStart(4, '0')}`

    const newRequest = await db.request.create({
      data: {
        code,
        title,
        description,
        type,
        priority: priority || 'MEDIUM',
        projectId: projectId || null,
        affectedSystem: affectedSystem || null,
        businessImpact: businessImpact || null,
        acceptanceCriteria: acceptanceCriteria || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        createdById: user.id,
        status: 'DRAFT',
      },
      include: {
        project: {
          select: { id: true, name: true, code: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        assignedBA: {
          select: { id: true, name: true, email: true },
        },
        assignedDev: {
          select: { id: true, name: true, email: true },
        },
        assignedQA: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Create initial status history entry
    await db.requestStatusHistory.create({
      data: {
        requestId: newRequest.id,
        fromStatus: null,
        toStatus: 'DRAFT',
        comment: 'Request created',
        changedById: user.id,
      },
    })

    return NextResponse.json({ request: newRequest }, { status: 201 })
  } catch (error) {
    console.error('Create request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
