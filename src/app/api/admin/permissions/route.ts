import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/admin/permissions - List all available permissions grouped by module
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = await db.permission.findMany({
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
    })

    return NextResponse.json({ data: permissions })
  } catch (error) {
    console.error('List permissions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
