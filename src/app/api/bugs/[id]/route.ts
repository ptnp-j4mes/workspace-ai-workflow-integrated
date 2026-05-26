import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/bugs/[id] - Get single bug by ID with related data
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

    const bug = await db.bugReport.findUnique({
      where: { id },
      include: {
        request: {
          select: { id: true, title: true, code: true },
        },
        reportedBy: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    })

    if (!bug) {
      return NextResponse.json({ error: 'Bug not found' }, { status: 404 })
    }

    return NextResponse.json({ bug })
  } catch (error) {
    console.error('Get bug error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/bugs/[id] - Update bug
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

    const existing = await db.bugReport.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Bug not found' }, { status: 404 })
    }

    const allowedFields = [
      'title',
      'description',
      'severity',
      'status',
      'actualResult',
      'expectedResult',
      'reproductionSteps',
      'resolution',
    ]

    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field]
      }
    }

    const updated = await db.bugReport.update({
      where: { id },
      data,
      include: {
        request: {
          select: { id: true, title: true, code: true },
        },
        reportedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ bug: updated })
  } catch (error) {
    console.error('Update bug error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/bugs/[id] - Delete bug by ID
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

    const existing = await db.bugReport.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Bug not found' }, { status: 404 })
    }

    await db.bugReport.delete({ where: { id } })

    return NextResponse.json({ message: 'Bug deleted successfully' })
  } catch (error) {
    console.error('Delete bug error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
