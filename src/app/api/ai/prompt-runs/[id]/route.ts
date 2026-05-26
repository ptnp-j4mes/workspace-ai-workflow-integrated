// ============================================================
// GET /api/ai/prompt-runs/[id] - Get a specific run detail
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const run = await db.aiPromptRun.findUnique({
      where: { id },
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
            systemPrompt: true,
            userPromptTemplate: true,
            temperature: true,
            maxTokens: true,
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
    })

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ run })
  } catch (error) {
    console.error('Error getting prompt run:', error)
    return NextResponse.json(
      { error: 'Failed to get prompt run' },
      { status: 500 }
    )
  }
}
