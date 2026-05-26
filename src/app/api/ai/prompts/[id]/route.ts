// ============================================================
// GET /api/ai/prompts/[id] - Get prompt detail with versions
// PATCH /api/ai/prompts/[id] - Update prompt metadata
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

    const prompt = await db.aiPrompt.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
        testCases: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { runs: true },
        },
      },
    })

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ prompt })
  } catch (error) {
    console.error('Error getting prompt:', error)
    return NextResponse.json(
      { error: 'Failed to get prompt' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    const { title, description, category } = body

    // Check if prompt exists
    const existing = await db.aiPrompt.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      )
    }

    const prompt = await db.aiPrompt.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
      },
    })

    return NextResponse.json({ prompt })
  } catch (error) {
    console.error('Error updating prompt:', error)
    return NextResponse.json(
      { error: 'Failed to update prompt' },
      { status: 500 }
    )
  }
}
