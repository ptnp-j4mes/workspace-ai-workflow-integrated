// ============================================================
// GET /api/ai/prompt-runs - List prompt execution logs (with pagination)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)
    const promptId = searchParams.get('promptId')

    const skip = (page - 1) * pageSize

    const where = promptId ? { promptId } : {}

    const [runs, total] = await Promise.all([
      db.aiPromptRun.findMany({
        where,
        include: {
          prompt: {
            select: {
              id: true,
              promptKey: true,
              title: true,
              category: true,
            },
          },
          promptVersion: {
            select: {
              id: true,
              version: true,
              status: true,
            },
          },
          runBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      db.aiPromptRun.count({ where }),
    ])

    return NextResponse.json({
      runs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Error listing prompt runs:', error)
    return NextResponse.json(
      { error: 'Failed to list prompt runs' },
      { status: 500 }
    )
  }
}
