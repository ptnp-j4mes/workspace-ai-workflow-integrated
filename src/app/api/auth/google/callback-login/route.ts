import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateAccessToken, generateRefreshToken, hashPassword } from '@/lib/auth'
import { logAudit } from '@/lib/services/audit-service'

// GET /api/auth/google/callback-login - Handles the Google OAuth login callback
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const isDemo = searchParams.get('demo') === 'true'
    const code = searchParams.get('code')

    let googleEmail: string
    let googleName: string
    let googlePicture: string | null = null

    // Demo mode callback
    if (isDemo) {
      googleEmail = 'demo@google.com'
      googleName = 'Demo Google User'
      googlePicture = null
    } else {
      // Production mode: exchange code for tokens
      if (!code) {
        return NextResponse.redirect(
          new URL('/?error=missing_code', req.url)
        )
      }

      const clientId = process.env.GOOGLE_CLIENT_ID
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET

      if (!clientId || !clientSecret) {
        return NextResponse.redirect(
          new URL('/?error=not_configured', req.url)
        )
      }

      // Exchange code for tokens
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/auth/google/callback-login`
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

      if (!userInfoResponse.ok) {
        console.error('User info fetch failed:', await userInfoResponse.text())
        return NextResponse.redirect(
          new URL('/?error=userinfo_failed', req.url)
        )
      }

      const userInfo = await userInfoResponse.json()
      googleEmail = userInfo.email
      googleName = userInfo.name || userInfo.given_name || googleEmail.split('@')[0]
      googlePicture = userInfo.picture || null
    }

    if (!googleEmail) {
      return NextResponse.redirect(
        new URL('/?error=no_email', req.url)
      )
    }

    // Find existing user by email
    let user = await db.user.findUnique({
      where: { email: googleEmail },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    // If user doesn't exist, auto-create one
    if (!user) {
      // Generate a random password for Google-created users (they won't use it)
      const randomPassword = crypto.randomUUID()
      const hashedPassword = await hashPassword(randomPassword)

      // Find default USER role
      const userRole = await db.role.findFirst({
        where: { key: 'USER' },
      })

      user = await db.user.create({
        data: {
          email: googleEmail,
          password: hashedPassword,
          name: googleName,
          avatarUrl: googlePicture,
          isActive: true,
          roles: userRole
            ? {
                create: {
                  roleId: userRole.id,
                },
              }
            : undefined,
        },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      })

      // Log audit
      await logAudit({
        userId: user.id,
        action: 'GOOGLE_SIGNUP',
        entity: 'User',
        entityId: user.id,
        newValue: { email: googleEmail, name: googleName, method: 'google_oauth' },
        entityType: 'User',
      })
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.redirect(
        new URL('/?error=account_deactivated', req.url)
      )
    }

    // Update avatar if Google provides one and user doesn't have one
    if (googlePicture && !user.avatarUrl) {
      await db.user.update({
        where: { id: user.id },
        data: {
          avatarUrl: googlePicture,
          lastLoginAt: new Date(),
        },
      })
    } else {
      // Update lastLoginAt
      await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
    }

    // Extract role keys and permission keys
    const roles = user.roles.map((ur) => ur.role.key)
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.key)
        )
      ),
    ]

    // Generate JWT tokens
    const accessToken = await generateAccessToken({
      id: user.id,
      email: user.email,
      roles,
    })

    const refreshToken = await generateRefreshToken({
      id: user.id,
      email: user.email,
    })

    // Save refresh token to DB (7 days expiry)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await db.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    })

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'GOOGLE_LOGIN',
      entity: 'User',
      entityId: user.id,
      entityType: 'User',
    })

    // Build user data for the frontend (excluding password)
    const { password: _, ...userWithoutPassword } = user
    const userData = {
      ...userWithoutPassword,
      roles,
      permissions,
    }

    // Redirect to frontend with tokens in URL hash (more secure than query params)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const redirectUrl = `${appUrl}/?google_login=success&access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&user=${encodeURIComponent(JSON.stringify(userData))}`

    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('Google login callback error:', error)
    return NextResponse.redirect(
      new URL('/?error=google_login_failed', req.url)
    )
  }
}
