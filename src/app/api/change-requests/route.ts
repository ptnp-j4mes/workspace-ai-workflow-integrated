import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// GET /api/change-requests - List change requests
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const category = searchParams.get('category') || undefined
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (category) where.category = category
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const [items, total] = await Promise.all([
      db.changeRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.changeRequest.count({ where }),
    ])

    return NextResponse.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List change requests error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/change-requests - Create change request
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, category, impactLevel, requestId, projectId } = body

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
    }

    const changeRequest = await db.changeRequest.create({
      data: {
        title,
        description,
        category: category ?? null,
        impactLevel: impactLevel ?? 'MEDIUM',
        requestId: requestId ?? null,
        projectId: projectId ?? null,
        status: 'DRAFT',
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'CREATE_CHANGE_REQUEST',
      entity: 'ChangeRequest',
      entityId: changeRequest.id,
      newValue: { title, category, impactLevel },
    })

    return NextResponse.json({ data: changeRequest }, { status: 201 })
  } catch (error) {
    console.error('Create change request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
