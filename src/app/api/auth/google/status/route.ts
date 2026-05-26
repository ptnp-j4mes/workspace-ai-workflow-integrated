import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/auth/google/status - Returns the Google OAuth connection status for the current user
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const oauthToken = await db.googleOAuthToken.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
      include: {
        botAccount: {
          select: { id: true, name: true, email: true, status: true },
        },
      },
    })

    if (!oauthToken) {
      return NextResponse.json({
        connected: false,
        email: null,
        purpose: null,
        scopes: [],
        botAccount: null,
      })
    }

    const scopes = oauthToken.scope ? oauthToken.scope.split(' ').filter(Boolean) : []

    return NextResponse.json({
      connected: true,
      email: oauthToken.googleEmail,
      purpose: oauthToken.purpose,
      scopes,
      botAccount: oauthToken.botAccount
        ? {
            id: oauthToken.botAccount.id,
            name: oauthToken.botAccount.name,
            email: oauthToken.botAccount.email,
            status: oauthToken.botAccount.status,
          }
        : null,
      connectedAt: oauthToken.createdAt,
      lastRefreshedAt: oauthToken.lastRefreshedAt,
    })
  } catch (error) {
    console.error('Google status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
