import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/admin/email-logs - List email delivery logs with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const templateKey = searchParams.get('templateKey') || undefined
    const toEmail = searchParams.get('toEmail') || undefined
    const aitNo = searchParams.get('aitNo') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (templateKey) where.templateKey = templateKey
    if (toEmail) where.toEmail = { contains: toEmail }
    if (aitNo) where.aitNo = aitNo

    const [logs, total] = await Promise.all([
      db.emailDeliveryLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.emailDeliveryLog.count({ where }),
    ])

    return NextResponse.json({
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List email logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
