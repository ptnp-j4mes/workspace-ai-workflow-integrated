import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/me/notification-preferences - Get current user's notification preferences
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preferences = await db.notificationPreference.findMany({
      where: { userId: authUser.id },
      orderBy: { eventKey: 'asc' },
    })

    return NextResponse.json({ data: preferences })
  } catch (error) {
    console.error('Get notification preferences error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/me/notification-preferences - Update notification preferences
export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { preferences } = body as {
      preferences: Array<{ eventKey: string; inAppEnabled: boolean; emailEnabled: boolean }>
    }

    if (!Array.isArray(preferences)) {
      return NextResponse.json(
        { error: 'preferences must be an array of { eventKey, inAppEnabled, emailEnabled }' },
        { status: 400 }
      )
    }

    const results = []

    for (const pref of preferences) {
      if (!pref.eventKey) continue

      const upserted = await db.notificationPreference.upsert({
        where: {
          userId_eventKey: {
            userId: authUser.id,
            eventKey: pref.eventKey,
          },
        },
        create: {
          userId: authUser.id,
          eventKey: pref.eventKey,
          inAppEnabled: pref.inAppEnabled ?? true,
          emailEnabled: pref.emailEnabled ?? true,
        },
        update: {
          inAppEnabled: pref.inAppEnabled ?? true,
          emailEnabled: pref.emailEnabled ?? true,
        },
      })

      results.push(upserted)
    }

    return NextResponse.json({ data: results })
  } catch (error) {
    console.error('Update notification preferences error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
