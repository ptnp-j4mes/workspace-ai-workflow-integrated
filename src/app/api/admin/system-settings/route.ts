import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// Helper: check if user has admin:settings permission
function hasSettingsPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

// GET /api/admin/system-settings - Get all system settings
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasSettingsPermission(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: admin:settings permission required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined

    const where: Record<string, unknown> = {}
    if (category) {
      where.category = category
    }

    const settings = await db.systemSetting.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })

    // Mask secret values
    const masked = settings.map((s) => ({
      ...s,
      value: s.isSecret ? '***' : s.value,
    }))

    return NextResponse.json({ data: masked })
  } catch (error) {
    console.error('Get system settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/system-settings - Update system settings
export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasSettingsPermission(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: admin:settings permission required' }, { status: 403 })
    }

    const body = await request.json()
    const { settings } = body as { settings: Array<{ key: string; value: string }> }

    if (!Array.isArray(settings) || settings.length === 0) {
      return NextResponse.json({ error: 'Settings array is required' }, { status: 400 })
    }

    const results = []
    for (const setting of settings) {
      if (!setting.key || setting.value === undefined) {
        continue
      }

      const existing = await db.systemSetting.findUnique({ where: { key: setting.key } })
      if (!existing) {
        continue
      }

      const oldValue = existing.isSecret ? '***' : existing.value
      const newValue = existing.isSecret ? '***' : setting.value

      const updated = await db.systemSetting.update({
        where: { key: setting.key },
        data: {
          value: setting.value,
          updatedById: authUser.id,
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_SETTING',
        entity: 'SystemSetting',
        entityId: setting.key,
        oldValue: { value: oldValue },
        newValue: { value: newValue },
      })

      results.push({
        ...updated,
        value: updated.isSecret ? '***' : updated.value,
      })
    }

    return NextResponse.json({ data: results })
  } catch (error) {
    console.error('Update system settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
