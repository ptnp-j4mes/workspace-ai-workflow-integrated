// ============================================================
// GET /api/ai/prompts/[promptKey]/active - Get the active version of a prompt by key
// The [id] dynamic segment is used as promptKey here
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
    const { id: promptKey } = await params

    // Find prompt by promptKey (unique column)
    const prompt = await db.aiPrompt.findUnique({
      where: { promptKey },
      include: {
        versions: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
    })

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      )
    }

    if (prompt.versions.length === 0) {
      return NextResponse.json(
        { error: 'No active version found for this prompt' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      prompt: {
        id: prompt.id,
        promptKey: prompt.promptKey,
        title: prompt.title,
        description: prompt.description,
        category: prompt.category,
        provider: prompt.provider,
        model: prompt.model,
        status: prompt.status,
      },
      version: prompt.versions[0],
    })
  } catch (error) {
    console.error('Error getting active prompt version:', error)
    return NextResponse.json(
      { error: 'Failed to get active prompt version' },
      { status: 500 }
    )
  }
}
