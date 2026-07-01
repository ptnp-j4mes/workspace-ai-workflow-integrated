import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'
import { verifyPassword, generateAccessToken, generateRefreshToken, verifyToken, hashPassword, type RefreshTokenPayload } from '../lib/auth'
import { logAudit } from '../lib/services/audit-service'

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/meetings.space.readonly',
]

const GOOGLE_LOGIN_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  // POST /api/auth/login
  .post('/login', async ({ request, set }) => {
    try {
      const body = await request.json()
      const { email, password } = body

      if (!email || !password) {
        set.status = 400
        return { error: 'Email and password are required' }
      }

      // Find user by email with roles and permissions
      const user = await db.user.findUnique({
        where: { email },
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

      if (!user) {
        set.status = 401
        return { error: 'Invalid email or password' }
      }

      if (!user.isActive) {
        set.status = 403
        return { error: 'Account is deactivated' }
      }

      // Verify password
      const isValid = await verifyPassword(password, user.password)
      if (!isValid) {
        set.status = 401
        return { error: 'Invalid email or password' }
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

      // Generate tokens
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

      // Update lastLoginAt
      await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })

      // Return user data (excluding password)
      const { password: _, ...userWithoutPassword } = user

      return {
        user: {
          ...userWithoutPassword,
          roles,
          permissions,
        },
        accessToken,
        refreshToken,
      }
    } catch (error) {
      console.error('Login error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/auth/logout
  .post('/logout', async ({ request, set }) => {
    try {
      const body = await request.json()
      const { refreshToken } = body

      if (!refreshToken) {
        set.status = 400
        return { error: 'Refresh token is required' }
      }

      // Find and revoke the refresh token
      const storedToken = await db.refreshToken.findUnique({
        where: { token: refreshToken },
      })

      if (storedToken && !storedToken.revokedAt) {
        await db.refreshToken.update({
          where: { id: storedToken.id },
          data: { revokedAt: new Date() },
        })
      }

      return { message: 'Logged out successfully' }
    } catch (error) {
      console.error('Logout error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/auth/me
  .get('/me', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)

      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      // Get full user details with roles and permissions
      const user = await db.user.findUnique({
        where: { id: authUser.id },
        include: {
          department: true,
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

      if (!user || !user.isActive) {
        set.status = 404
        return { error: 'User not found or deactivated' }
      }

      // Extract role and permission info
      const roles = user.roles.map((ur) => ({
        id: ur.role.id,
        key: ur.role.key,
        name: ur.role.name,
      }))

      const permissions = [
        ...new Set(
          user.roles.flatMap((ur) =>
            ur.role.permissions.map((rp) => rp.permission.key)
          )
        ),
      ]

      const { password: _, ...userWithoutPassword } = user

      return {
        user: {
          ...userWithoutPassword,
          roles,
          permissions,
        },
      }
    } catch (error) {
      console.error('Get current user error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/auth/refresh
  .post('/refresh', async ({ request, set }) => {
    try {
      const body = await request.json()
      const { refreshToken } = body

      if (!refreshToken) {
        set.status = 400
        return { error: 'Refresh token is required' }
      }

      // Look up the refresh token in DB
      const storedToken = await db.refreshToken.findUnique({
        where: { token: refreshToken },
      })

      if (!storedToken) {
        set.status = 401
        return { error: 'Invalid refresh token' }
      }

      // Check if token is revoked
      if (storedToken.revokedAt) {
        set.status = 401
        return { error: 'Refresh token has been revoked' }
      }

      // Check if token is expired
      if (storedToken.expiresAt < new Date()) {
        set.status = 401
        return { error: 'Refresh token has expired' }
      }

      // Verify JWT signature
      let payload: RefreshTokenPayload
      try {
        payload = await verifyToken<RefreshTokenPayload>(refreshToken)
      } catch {
        set.status = 401
        return { error: 'Invalid refresh token' }
      }

      if (payload.type !== 'refresh') {
        set.status = 401
        return { error: 'Invalid token type' }
      }

      // Get user with roles for the new access token
      const user = await db.user.findUnique({
        where: { id: payload.id },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      })

      if (!user || !user.isActive) {
        set.status = 401
        return { error: 'User not found or deactivated' }
      }

      const roles = user.roles.map((ur) => ur.role.key)

      // Generate new access token
      const accessToken = await generateAccessToken({
        id: user.id,
        email: user.email,
        roles,
      })

      return { accessToken }
    } catch (error) {
      console.error('Refresh token error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/auth/google/connect - Returns Google OAuth URL for the user to connect their Google account
  .get('/google/connect', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const clientId = process.env.GOOGLE_CLIENT_ID
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET

      // Demo mode: no real Google credentials configured
      if (!clientId || !clientSecret) {
        return {
          mode: 'demo',
          authUrl: `${process.env.API_PUBLIC_URL || ''}/api/auth/google/callback?demo=true&userId=${user.id}&email=${encodeURIComponent(user.email)}`,
          message: 'Google OAuth is running in demo mode. No real Google credentials are configured.',
          scopes: GOOGLE_SCOPES,
        }
      }

      // Production mode: build real Google OAuth URL
      const redirectUri = `${process.env.API_PUBLIC_URL || ''}/api/auth/google/callback`
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

      return {
        mode: 'production',
        authUrl,
        scopes: GOOGLE_SCOPES,
      }
    } catch (error) {
      console.error('Google connect error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // DELETE /api/auth/google/disconnect - Disconnects the Google account
  .delete('/google/disconnect', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const oauthToken = await db.googleOAuthToken.findFirst({
        where: {
          userId: user.id,
          isActive: true,
        },
      })

      if (!oauthToken) {
        set.status = 404
        return { error: 'No active Google connection found' }
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

      return {
        success: true,
        message: 'Google account disconnected successfully',
      }
    } catch (error) {
      console.error('Google disconnect error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/auth/google/status - Returns the Google OAuth connection status for the current user
  .get('/google/status', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
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
        return {
          connected: false,
          email: null,
          purpose: null,
          scopes: [],
          botAccount: null,
        }
      }

      const scopes = oauthToken.scope ? oauthToken.scope.split(' ').filter(Boolean) : []

      return {
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
      }
    } catch (error) {
      console.error('Google status error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/auth/google/login - Initiates Google OAuth login flow
  .get('/google/login', async ({ request }) => {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET

      // Demo mode: no real Google credentials configured
      if (!clientId || !clientSecret) {
        // Redirect to callback with demo mode flag
        const demoCallbackUrl = `${process.env.API_PUBLIC_URL || ''}/api/auth/google/callback-login?demo=true`
        return Response.redirect(demoCallbackUrl, 307)
      }

      // Production mode: build real Google OAuth URL
      const redirectUri = `${process.env.API_PUBLIC_URL || ''}/api/auth/google/callback-login`
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

      return Response.redirect(authUrl, 307)
    } catch (error) {
      console.error('Google login initiate error:', error)
      return Response.redirect(
        new URL('/?error=google_login_failed', process.env.FRONTEND_URL || '').toString(),
        307
      )
    }
  })
  // GET /api/auth/google/callback - Handles the OAuth callback
  .get('/google/callback', async ({ request }) => {
    try {
      const { searchParams } = new URL(request.url)
      const isDemo = searchParams.get('demo') === 'true'
      const code = searchParams.get('code')
      const state = searchParams.get('state')

      // Demo mode callback
      if (isDemo) {
        const userId = searchParams.get('userId')
        const email = searchParams.get('email') || 'demo@gmail.com'

        if (!userId) {
          return Response.redirect(
            new URL('/?error=missing_user_id', process.env.FRONTEND_URL || '').toString(),
            307
          )
        }

        // Check if already connected
        const existing = await db.googleOAuthToken.findFirst({
          where: { userId, isActive: true },
        })

        if (existing) {
          return Response.redirect(
            new URL('/?google=already_connected', process.env.FRONTEND_URL || '').toString(),
            307
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

        return Response.redirect(
          new URL('/?google=connected', process.env.FRONTEND_URL || '').toString(),
          307
        )
      }

      // Production mode callback
      if (!code || !state) {
        return Response.redirect(
          new URL('/?error=missing_params', process.env.FRONTEND_URL || '').toString(),
          307
        )
      }

      const clientId = process.env.GOOGLE_CLIENT_ID
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET

      if (!clientId || !clientSecret) {
        return Response.redirect(
          new URL('/?error=not_configured', process.env.FRONTEND_URL || '').toString(),
          307
        )
      }

      // Decode state to get userId
      let userId: string
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
        userId = stateData.userId
      } catch {
        return Response.redirect(
          new URL('/?error=invalid_state', process.env.FRONTEND_URL || '').toString(),
          307
        )
      }

      // Exchange code for tokens
      const redirectUri = `${process.env.API_PUBLIC_URL || ''}/api/auth/google/callback`
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
        return Response.redirect(
          new URL('/?error=token_exchange_failed', process.env.FRONTEND_URL || '').toString(),
          307
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

      return Response.redirect(
        new URL('/?google=connected', process.env.FRONTEND_URL || '').toString(),
        307
      )
    } catch (error) {
      console.error('Google callback error:', error)
      return Response.redirect(
        new URL('/?error=callback_failed', process.env.FRONTEND_URL || '').toString(),
        307
      )
    }
  })
  // GET /api/auth/google/callback-login - Handles the Google OAuth login callback
  .get('/google/callback-login', async ({ request }) => {
    try {
      const { searchParams } = new URL(request.url)
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
          return Response.redirect(
            new URL('/?error=missing_code', process.env.FRONTEND_URL || '').toString(),
            307
          )
        }

        const clientId = process.env.GOOGLE_CLIENT_ID
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET

        if (!clientId || !clientSecret) {
          return Response.redirect(
            new URL('/?error=not_configured', process.env.FRONTEND_URL || '').toString(),
            307
          )
        }

        // Exchange code for tokens
        const redirectUri = `${process.env.API_PUBLIC_URL || ''}/api/auth/google/callback-login`
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
          return Response.redirect(
            new URL('/?error=token_exchange_failed', process.env.FRONTEND_URL || '').toString(),
            307
          )
        }

        const tokenData = await tokenResponse.json()

        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })

        if (!userInfoResponse.ok) {
          console.error('User info fetch failed:', await userInfoResponse.text())
          return Response.redirect(
            new URL('/?error=userinfo_failed', process.env.FRONTEND_URL || '').toString(),
            307
          )
        }

        const userInfo = await userInfoResponse.json()
        googleEmail = userInfo.email
        googleName = userInfo.name || userInfo.given_name || googleEmail.split('@')[0]
        googlePicture = userInfo.picture || null
      }

      if (!googleEmail) {
        return Response.redirect(
          new URL('/?error=no_email', process.env.FRONTEND_URL || '').toString(),
          307
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
        return Response.redirect(
          new URL('/?error=account_deactivated', process.env.FRONTEND_URL || '').toString(),
          307
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
      const appUrl = process.env.FRONTEND_URL || ''
      const redirectUrl = `${appUrl}/?google_login=success&access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&user=${encodeURIComponent(JSON.stringify(userData))}`

      return Response.redirect(redirectUrl, 307)
    } catch (error) {
      console.error('Google login callback error:', error)
      return Response.redirect(
        new URL('/?error=google_login_failed', process.env.FRONTEND_URL || '').toString(),
        307
      )
    }
  })
