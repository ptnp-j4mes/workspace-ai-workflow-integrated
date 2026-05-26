import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/uat/test-cases - List test cases with optional uatCycleId filter
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const uatCycleId = searchParams.get('uatCycleId') || undefined
    const priority = searchParams.get('priority') || undefined
    const type = searchParams.get('type') || undefined

    const where: any = {}
    if (uatCycleId) where.uatCycleId = uatCycleId
    if (priority) where.priority = priority
    if (type) where.type = type

    const testCases = await db.uatTestCase.findMany({
      where,
      include: {
        uatCycle: {
          select: { id: true, name: true, status: true },
        },
        _count: {
          select: { testResults: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ testCases })
  } catch (error) {
    console.error('List test cases error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/uat/test-cases - Create test case
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { uatCycleId, title, precondition, steps, expectedResult, priority, type } = body

    if (!uatCycleId || !title || !steps || !expectedResult) {
      return NextResponse.json(
        { error: 'uatCycleId, title, steps, and expectedResult are required' },
        { status: 400 }
      )
    }

    // Verify UAT cycle exists
    const cycle = await db.uatCycle.findUnique({ where: { id: uatCycleId } })
    if (!cycle) {
      return NextResponse.json({ error: 'UAT cycle not found' }, { status: 404 })
    }

    const testCase = await db.uatTestCase.create({
      data: {
        uatCycleId,
        title,
        precondition: precondition || null,
        steps: typeof steps === 'string' ? steps : JSON.stringify(steps),
        expectedResult,
        priority: priority || 'MEDIUM',
        type: type || 'FUNCTIONAL',
        aiGenerated: false,
      },
      include: {
        uatCycle: {
          select: { id: true, name: true, status: true },
        },
      },
    })

    return NextResponse.json({ testCase }, { status: 201 })
  } catch (error) {
    console.error('Create test case error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
