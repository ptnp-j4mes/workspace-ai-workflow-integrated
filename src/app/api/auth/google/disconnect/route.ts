import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// DELETE /api/auth/google/disconnect - Disconnects the Google account
export async function DELETE(req: NextRequest) {
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
    })

    if (!oauthToken) {
      return NextResponse.json({ error: 'No active Google connection found' }, { status: 404 })
    }

    // Deactivate the OAuth token
    await db.googleOAuthToken.update({
      where: { id: oauthToken.id },
      data: { isActive: false },
    })

    // Also set any linked bot account to OFFLINE
    if (oauthToken.purpose === 'PERSONAL') {
      const botAccount = await db.meetingBotAccount.findFirst({
        where: { googleOAuthTokenId: oauthToken.id },
      })
      if (botAccount) {
        await db.meetingBotAccount.update({
          where: { id: botAccount.id },
          data: { status: 'OFFLINE', googleOAuthTokenId: null },
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Google account disconnected successfully',
    })
  } catch (error) {
    console.error('Google disconnect error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
