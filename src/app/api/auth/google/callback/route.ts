import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/auth/google/callback - Handles the OAuth callback
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const isDemo = searchParams.get('demo') === 'true'
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    // Demo mode callback
    if (isDemo) {
      const userId = searchParams.get('userId')
      const email = searchParams.get('email') || 'demo@gmail.com'

      if (!userId) {
        return NextResponse.redirect(
          new URL('/?error=missing_user_id', req.url)
        )
      }

      // Check if already connected
      const existing = await db.googleOAuthToken.findFirst({
        where: { userId, isActive: true },
      })

      if (existing) {
        return NextResponse.redirect(
          new URL('/?google=already_connected', req.url)
        )
      }

      // Create demo OAuth token
      const oauthToken = await db.googleOAuthToken.create({
        data: {
          userId,
          purpose: 'PERSONAL',
          googleEmail: email,
          accessToken: 'demo_access_token_' + Date.now(),
          refreshToken: 'demo_refresh_token_' + Date.now(),
          tokenExpiry: new Date(Date.now() + 3600 * 1000),
          scope: [
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/calendar.events.readonly',
            'https://www.googleapis.com/auth/meetings.space.readonly',
          ].join(' '),
          isActive: true,
          lastRefreshedAt: new Date(),
        },
      })

      // Also create a bot account linked to this OAuth token
      const botEmail = `ait-bot-${userId.slice(0, 8)}@ait-demo.com`
      await db.meetingBotAccount.upsert({
        where: { email: botEmail },
        update: {
          googleOAuthTokenId: oauthToken.id,
          status: 'AVAILABLE',
        },
        create: {
          email: botEmail,
          name: 'AIT Meeting Bot',
          status: 'AVAILABLE',
          googleOAuthTokenId: oauthToken.id,
        },
      })

      return NextResponse.redirect(
        new URL('/?google=connected', req.url)
      )
    }

    // Production mode callback
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/?error=missing_params', req.url)
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/?error=not_configured', req.url)
      )
    }

    // Decode state to get userId
    let userId: string
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      userId = stateData.userId
    } catch {
      return NextResponse.redirect(
        new URL('/?error=invalid_state', req.url)
      )
    }

    // Exchange code for tokens
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/auth/google/callback`
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text())
      return NextResponse.redirect(
        new URL('/?error=token_exchange_failed', req.url)
      )
    }

    const tokenData = await tokenResponse.json()

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const userInfo = await userInfoResponse.json()
    const googleEmail = userInfo.email || 'unknown@gmail.com'

    // Upsert the OAuth token
    await db.googleOAuthToken.upsert({
      where: {
        userId_googleEmail: { userId, googleEmail },
      },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || undefined,
        tokenExpiry: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000),
        scope: tokenData.scope || '',
        isActive: true,
        lastRefreshedAt: new Date(),
      },
      create: {
        userId,
        purpose: 'PERSONAL',
        googleEmail,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        tokenExpiry: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000),
        scope: tokenData.scope || '',
        isActive: true,
        lastRefreshedAt: new Date(),
      },
    })

    return NextResponse.redirect(
      new URL('/?google=connected', req.url)
    )
  } catch (error) {
    console.error('Google callback error:', error)
    return NextResponse.redirect(
      new URL('/?error=callback_failed', req.url)
    )
  }
}
