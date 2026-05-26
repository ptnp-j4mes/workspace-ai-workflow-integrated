// ============================================================
// POST /api/ai/prompts/[id]/run - Execute a prompt with variables
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { executePrompt, executePromptWithVersion } from '@/lib/ai-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { versionId, variables } = body

    if (!variables || typeof variables !== 'object') {
      return NextResponse.json(
        { error: 'variables is required and must be an object' },
        { status: 400 }
      )
    }

    let result

    if (versionId) {
      // Execute a specific version
      result = await executePromptWithVersion(versionId, variables, {
        runById: user.id,
      })
    } else {
      // Execute the active version using the prompt key
      // The id in the URL is the prompt ID, but we need the promptKey for executePrompt
      // So we use executePromptWithVersion approach - first find the active version
      const { db } = await import('@/lib/db')
      const prompt = await db.aiPrompt.findUnique({
        where: { id },
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
          { status: 400 }
        )
      }

      result = await executePromptWithVersion(prompt.versions[0].id, variables, {
        runById: user.id,
      })
    }

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Error executing prompt:', error)
    const message = error instanceof Error ? error.message : 'Failed to execute prompt'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
