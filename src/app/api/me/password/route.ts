import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { verifyPassword, hashPassword } from '@/lib/auth'
import { logAudit } from '@/lib/services/audit-service'

// PATCH /api/me/password - Change password
export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'currentPassword and newPassword are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, password: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isValid = await verifyPassword(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(newPassword)
    await db.user.update({
      where: { id: authUser.id },
      data: { password: hashedPassword },
    })

    await logAudit({
      userId: authUser.id,
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: authUser.id,
    })

    return NextResponse.json({ data: { message: 'Password changed successfully' } })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
