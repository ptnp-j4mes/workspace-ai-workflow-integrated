// ============================================================
// POST /api/ai/prompts/[id]/deprecate - Deprecate a version
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

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
    const { versionId } = body

    if (!versionId) {
      return NextResponse.json(
        { error: 'versionId is required' },
        { status: 400 }
      )
    }

    // Check if prompt exists
    const prompt = await db.aiPrompt.findUnique({ where: { id } })
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      )
    }

    // Check if the specified version exists and belongs to this prompt
    const version = await db.aiPromptVersion.findFirst({
      where: { id: versionId, promptId: id },
    })

    if (!version) {
      return NextResponse.json(
        { error: 'Version not found for this prompt' },
        { status: 404 }
      )
    }

    if (version.status === 'DEPRECATED') {
      return NextResponse.json(
        { error: 'Version is already deprecated' },
        { status: 400 }
      )
    }

    // Deprecate the version
    const updatedVersion = await db.aiPromptVersion.update({
      where: { id: versionId },
      data: { status: 'DEPRECATED' },
    })

    // Check if the deprecated version was the active one
    // If so, update the prompt status accordingly
    if (version.status === 'ACTIVE') {
      const hasActiveVersion = await db.aiPromptVersion.findFirst({
        where: { promptId: id, status: 'ACTIVE' },
      })

      if (!hasActiveVersion) {
        await db.aiPrompt.update({
          where: { id },
          data: { status: 'DEPRECATED' },
        })
      }
    }

    return NextResponse.json({ version: updatedVersion })
  } catch (error) {
    console.error('Error deprecating prompt version:', error)
    return NextResponse.json(
      { error: 'Failed to deprecate prompt version' },
      { status: 500 }
    )
  }
}
