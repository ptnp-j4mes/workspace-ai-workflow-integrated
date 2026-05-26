import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// GET /api/platform-requests/[id] - Get single platform request with full details
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

    const platformRequest = await db.platformRequest.findUnique({
      where: { id },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            description: true,
            parent: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        divisionHead: {
          select: { id: true, name: true, email: true },
        },
        sdManager: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true, status: true, code: true },
        },
        approvals: {
          include: {
            approver: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!platformRequest) {
      return NextResponse.json({ error: 'Platform request not found' }, { status: 404 })
    }

    return NextResponse.json({ data: platformRequest })
  } catch (error) {
    console.error('Get platform request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/platform-requests/[id] - Update platform request (only if PENDING and owner)
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

    const existingRequest = await db.platformRequest.findUnique({
      where: { id },
    })

    if (!existingRequest) {
      return NextResponse.json({ error: 'Platform request not found' }, { status: 404 })
    }

    // Only the requester can update, and only when status is PENDING
    if (existingRequest.requesterId !== user.id) {
      return NextResponse.json(
        { error: 'Only the requester can update this platform request' },
        { status: 403 }
      )
    }

    if (existingRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only update platform requests in PENDING status' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, description, objective, targetUsers, expectedTimeline, priority, status } = body

    // Only allow specific status change: CANCELLED
    if (status && status !== 'CANCELLED') {
      return NextResponse.json(
        { error: 'Only CANCELLED status is allowed via update' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (objective !== undefined) updateData.objective = objective
    if (targetUsers !== undefined) updateData.targetUsers = targetUsers
    if (expectedTimeline !== undefined) updateData.expectedTimeline = expectedTimeline
    if (priority !== undefined) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
      if (!validPriorities.includes(priority)) {
        return NextResponse.json(
          { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.priority = priority
    }
    if (status === 'CANCELLED') updateData.status = 'CANCELLED'

    const updatedRequest = await db.platformRequest.update({
      where: { id },
      data: updateData,
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            parent: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        divisionHead: {
          select: { id: true, name: true, email: true },
        },
        sdManager: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true, status: true },
        },
        approvals: {
          include: {
            approver: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    // Audit log
    await logAudit({
      userId: user.id,
      action: status === 'CANCELLED' ? 'CANCEL_PLATFORM_REQUEST' : 'UPDATE_PLATFORM_REQUEST',
      entity: 'PlatformRequest',
      entityId: id,
      oldValue: {
        name: existingRequest.name,
        priority: existingRequest.priority,
        status: existingRequest.status,
      },
      newValue: updateData,
    })

    return NextResponse.json({ data: updatedRequest })
  } catch (error) {
    console.error('Update platform request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
