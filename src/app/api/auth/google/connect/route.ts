import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/meetings.space.readonly',
]

// GET /api/auth/google/connect - Returns Google OAuth URL for the user to connect their Google account
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    // Demo mode: no real Google credentials configured
    if (!clientId || !clientSecret) {
      return NextResponse.json({
        mode: 'demo',
        authUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/auth/google/callback?demo=true&userId=${user.id}&email=${encodeURIComponent(user.email)}`,
        message: 'Google OAuth is running in demo mode. No real Google credentials are configured.',
        scopes: GOOGLE_SCOPES,
      })
    }

    // Production mode: build real Google OAuth URL
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/auth/google/callback`
    const scope = GOOGLE_SCOPES.join(' ')
    const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64')

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      access_type: 'offline',
      prompt: 'consent',
      state,
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return NextResponse.json({
      mode: 'production',
      authUrl,
      scopes: GOOGLE_SCOPES,
    })
  } catch (error) {
    console.error('Google connect error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
