import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// GET /api/admin/notification-rules - List notification rules
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    const rules = await db.notificationRule.findMany({
      where,
      orderBy: { eventKey: 'asc' },
    })

    return NextResponse.json({ data: rules })
  } catch (error) {
    console.error('List notification rules error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/notification-rules - Update notification rules (bulk)
export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = authUser.roles.includes('ADMIN') || authUser.roles.includes('IT_MANAGER')
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin permission required' }, { status: 403 })
    }

    const body = await request.json()
    const { rules } = body as { rules: Array<{ eventKey: string; isActive: boolean; channels?: string }> }

    if (!Array.isArray(rules) || rules.length === 0) {
      return NextResponse.json({ error: 'Rules array is required' }, { status: 400 })
    }

    const results = []
    for (const rule of rules) {
      if (!rule.eventKey) continue

      const existing = await db.notificationRule.findUnique({
        where: { eventKey: rule.eventKey },
      })

      if (!existing) continue

      const updateData: Record<string, unknown> = { isActive: rule.isActive }
      if (rule.channels !== undefined) {
        updateData.channels = rule.channels
      }

      const updated = await db.notificationRule.update({
        where: { eventKey: rule.eventKey },
        data: updateData,
      })

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_NOTIFICATION_RULE',
        entity: 'NotificationRule',
        entityId: updated.id,
        oldValue: { eventKey: existing.eventKey, isActive: existing.isActive, channels: existing.channels },
        newValue: { eventKey: updated.eventKey, isActive: updated.isActive, channels: updated.channels },
      })

      results.push(updated)
    }

    return NextResponse.json({ data: results })
  } catch (error) {
    console.error('Update notification rules error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
