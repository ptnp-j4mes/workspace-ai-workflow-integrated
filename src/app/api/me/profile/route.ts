import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// GET /api/me/profile - Get current user's profile
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: authUser.id },
      include: {
        department: { select: { id: true, name: true, code: true, type: true, description: true, parent: { select: { id: true, name: true, code: true } } } },
        roles: {
          include: {
            role: {
              select: { id: true, key: true, name: true, permissions: { include: { permission: { select: { key: true, name: true, module: true } } } } },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { password: _, ...profile } = user

    return NextResponse.json({
      data: {
        ...profile,
        roleKeys: user.roles.map(ur => ur.role.key),
      },
    })
  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/me/profile - Update current user's profile
export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const allowedFields = ['name', 'phone', 'position', 'timezone', 'locale', 'themePreference', 'avatarUrl']

    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field]
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id: authUser.id },
      data,
      include: {
        department: { select: { id: true, name: true, code: true, type: true, description: true, parent: { select: { id: true, name: true, code: true } } } },
        roles: {
          include: {
            role: { select: { id: true, key: true, name: true } },
          },
        },
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'UPDATE_PROFILE',
      entity: 'User',
      entityId: authUser.id,
      newValue: data,
    })

    const { password: _, ...profile } = updated

    return NextResponse.json({
      data: {
        ...profile,
        roleKeys: updated.roles.map(ur => ur.role.key),
      },
    })
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
