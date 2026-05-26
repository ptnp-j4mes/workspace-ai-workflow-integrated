import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { addComment } from '@/lib/services/approval-service'

// POST /api/approval-instances/[id]/comment - Add comment to approval
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
    const { comment } = body

    if (!comment) {
      return NextResponse.json(
        { error: 'comment is required' },
        { status: 400 }
      )
    }

    const action = await addComment(id, authUser.id, comment)

    return NextResponse.json({ data: action }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Add approval comment error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
