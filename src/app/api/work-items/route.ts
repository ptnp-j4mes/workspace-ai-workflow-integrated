import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/work-items - List work items with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const priority = searchParams.get('priority') || undefined
    const requestId = searchParams.get('requestId') || undefined
    const projectId = searchParams.get('projectId') || undefined
    const assignedToMe = searchParams.get('assignedToMe') === 'true'

    const where: any = {}
    if (status) where.status = status
    if (priority) where.priority = priority
    if (requestId) where.requestId = requestId
    if (projectId) where.projectId = projectId
    if (assignedToMe) {
      where.assignments = {
        some: { userId: user.id, isActive: true },
      }
    }

    const workItems = await db.workItem.findMany({
      where,
      include: {
        request: {
          select: { id: true, title: true, code: true, status: true },
        },
        assignments: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ workItems })
  } catch (error) {
    console.error('List work items error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/work-items - Create work item
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, requestId, projectId, priority, dueDate } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    const workItem = await db.workItem.create({
      data: {
        title,
        description: description || null,
        requestId: requestId || null,
        projectId: projectId || null,
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'CREATED',
      },
      include: {
        request: {
          select: { id: true, title: true, code: true },
        },
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    })

    // Create initial status history
    await db.workItemStatusHistory.create({
      data: {
        workItemId: workItem.id,
        fromStatus: null,
        toStatus: 'CREATED',
        comment: 'Work item created',
        changedById: user.id,
      },
    })

    return NextResponse.json({ workItem }, { status: 201 })
  } catch (error) {
    console.error('Create work item error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
