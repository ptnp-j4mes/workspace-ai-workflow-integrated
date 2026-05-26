import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/uat/cycles/[id] - Get single UAT cycle with test cases
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

    const cycle = await db.uatCycle.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true, code: true },
        },
        testCases: {
          include: {
            testResults: {
              include: {
                tester: {
                  select: { id: true, name: true, email: true },
                },
              },
              orderBy: { testedAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!cycle) {
      return NextResponse.json({ error: 'UAT cycle not found' }, { status: 404 })
    }

    return NextResponse.json({ cycle })
  } catch (error) {
    console.error('Get UAT cycle error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/uat/cycles/[id] - Update UAT cycle
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

    const existing = await db.uatCycle.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'UAT cycle not found' }, { status: 404 })
    }

    const allowedFields = ['name', 'description', 'status', 'startDate', 'endDate']

    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'startDate' || field === 'endDate') {
          data[field] = body[field] ? new Date(body[field]) : null
        } else {
          data[field] = body[field]
        }
      }
    }

    const updated = await db.uatCycle.update({
      where: { id },
      data,
      include: {
        project: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { testCases: true },
        },
      },
    })

    return NextResponse.json({ cycle: updated })
  } catch (error) {
    console.error('Update UAT cycle error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/uat/cycles/[id] - Delete UAT cycle by ID (cascade delete test cases and results)
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

    const existing = await db.uatCycle.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'UAT cycle not found' }, { status: 404 })
    }

    // Cascade delete: test results -> test cases -> cycle
    // Prisma schema has onDelete: Cascade on UatTestCase -> UatCycle
    // and onDelete: Cascade on UatTestResult -> UatTestCase
    // So deleting the cycle will cascade delete test cases and their results
    await db.uatCycle.delete({ where: { id } })

    return NextResponse.json({ message: 'UAT cycle deleted successfully' })
  } catch (error) {
    console.error('Delete UAT cycle error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
