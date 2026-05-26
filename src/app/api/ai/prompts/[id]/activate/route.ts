// ============================================================
// POST /api/ai/prompts/[id]/activate - Activate a specific version
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

    // Use a transaction to deactivate current active version and activate the new one
    await db.$transaction([
      // Deprecate any currently active versions
      db.aiPromptVersion.updateMany({
        where: { promptId: id, status: 'ACTIVE' },
        data: { status: 'DEPRECATED' },
      }),
      // Activate the specified version
      db.aiPromptVersion.update({
        where: { id: versionId },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
          activatedById: user.id,
        },
      }),
      // Update prompt status to ACTIVE
      db.aiPrompt.update({
        where: { id },
        data: { status: 'ACTIVE' },
      }),
    ])

    const updatedVersion = await db.aiPromptVersion.findUnique({
      where: { id: versionId },
    })

    return NextResponse.json({ version: updatedVersion })
  } catch (error) {
    console.error('Error activating prompt version:', error)
    return NextResponse.json(
      { error: 'Failed to activate prompt version' },
      { status: 500 }
    )
  }
}
