import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { createApprovalInstance } from '@/lib/services/approval-service'

// POST /api/approval-instances - Create approval instance
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workflowKey, entityType, entityId, aitNo } = body

    if (!workflowKey || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'workflowKey, entityType, and entityId are required' },
        { status: 400 }
      )
    }

    const instance = await createApprovalInstance({
      workflowKey,
      entityType,
      entityId,
      requestedById: authUser.id,
      aitNo,
    })

    return NextResponse.json({ data: instance }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Create approval instance error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
