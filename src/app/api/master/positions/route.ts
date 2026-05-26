import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/master/positions — List active job positions (with optional department filter)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')

    const where: Record<string, unknown> = { isActive: true }
    if (departmentId) {
      where.departmentId = departmentId
    }

    const positions = await db.jobPosition.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        category: true,
        departmentId: true,
        sortOrder: true,
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    })

    return NextResponse.json({ data: positions })
  } catch (error) {
    console.error('Fetch positions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
