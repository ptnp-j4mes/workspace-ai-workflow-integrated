import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_LOGIN_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

// GET /api/auth/google/login - Initiates Google OAuth login flow
export async function GET(req: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    // Demo mode: no real Google credentials configured
    if (!clientId || !clientSecret) {
      // Redirect to callback with demo mode flag
      const demoCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/auth/google/callback-login?demo=true`
      return NextResponse.redirect(demoCallbackUrl)
    }

    // Production mode: build real Google OAuth URL
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/auth/google/callback-login`
    const scope = GOOGLE_LOGIN_SCOPES.join(' ')

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      access_type: 'offline',
      prompt: 'consent',
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Google login initiate error:', error)
    return NextResponse.redirect(
      new URL('/?error=google_login_failed', req.url)
    )
  }
}
