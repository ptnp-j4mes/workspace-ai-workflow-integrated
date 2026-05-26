import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, generateAccessToken, type RefreshTokenPayload } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refreshToken } = body

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      )
    }

    // Look up the refresh token in DB
    const storedToken = await db.refreshToken.findUnique({
      where: { token: refreshToken },
    })

    if (!storedToken) {
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      )
    }

    // Check if token is revoked
    if (storedToken.revokedAt) {
      return NextResponse.json(
        { error: 'Refresh token has been revoked' },
        { status: 401 }
      )
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Refresh token has expired' },
        { status: 401 }
      )
    }

    // Verify JWT signature
    let payload: RefreshTokenPayload
    try {
      payload = await verifyToken<RefreshTokenPayload>(refreshToken)
    } catch {
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      )
    }

    if (payload.type !== 'refresh') {
      return NextResponse.json(
        { error: 'Invalid token type' },
        { status: 401 }
      )
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
      return NextResponse.json(
        { error: 'User not found or deactivated' },
        { status: 401 }
      )
    }

    const roles = user.roles.map((ur) => ur.role.key)

    // Generate new access token
    const accessToken = await generateAccessToken({
      id: user.id,
      email: user.email,
      roles,
    })

    return NextResponse.json({ accessToken })
  } catch (error) {
    console.error('Refresh token error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
