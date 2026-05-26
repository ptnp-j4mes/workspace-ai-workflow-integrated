import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/admin/ai-settings - Get AI provider configuration
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = authUser.roles.includes('ADMIN') || authUser.roles.includes('IT_MANAGER')
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin permission required' }, { status: 403 })
    }

    const configs = await db.aiProviderConfig.findMany({
      orderBy: { provider: 'asc' },
    })

    // Mask API keys
    const masked = configs.map((c) => ({
      ...c,
      apiKeyEnc: c.apiKeyEnc ? '***' : null,
    }))

    return NextResponse.json({ data: masked })
  } catch (error) {
    console.error('Get AI settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
