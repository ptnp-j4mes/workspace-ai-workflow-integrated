import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/requests/[id] - Get request detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const req = await db.request.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true, code: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignedBA: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignedDev: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignedQA: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        workItems: {
          include: {
            assignments: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
      },
    })

    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    return NextResponse.json({ request: req })
  } catch (error) {
    console.error('Get request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/requests/[id] - Update request (only if DRAFT or user is ADMIN)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const existing = await db.request.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Only allow updates if DRAFT or user is ADMIN
    const isAdmin = user.roles.includes('ADMIN')
    if (existing.status !== 'DRAFT' && !isAdmin) {
      return NextResponse.json(
        { error: 'Cannot update request that is not in DRAFT status' },
        { status: 403 }
      )
    }

    const allowedFields = [
      'title',
      'description',
      'type',
      'priority',
      'projectId',
      'affectedSystem',
      'businessImpact',
      'acceptanceCriteria',
      'dueDate',
    ]

    const data: any = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'dueDate') {
          data[field] = body[field] ? new Date(body[field]) : null
        } else if (field === 'projectId') {
          data[field] = body[field] || null
        } else {
          data[field] = body[field]
        }
      }
    }

    const updated = await db.request.update({
      where: { id },
      data,
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

    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error('Update request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/requests/[id] - Soft delete (set status to CANCELLED)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existing = await db.request.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const updated = await db.request.update({
      where: { id },
      data: { status: 'CANCELLED' },
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

    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error('Delete request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
