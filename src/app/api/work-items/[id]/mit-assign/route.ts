import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { assignMit } from '@/lib/services/mit-assignment-service'

// POST /api/work-items/[id]/mit-assign - Assign MIT step
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { step, assigneeId } = body

    if (!step || !assigneeId) {
      return NextResponse.json(
        { error: 'step and assigneeId are required' },
        { status: 400 }
      )
    }

    const assignment = await assignMit(id, step, assigneeId, authUser.id)

    return NextResponse.json({ data: assignment }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('MIT assign error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
