// ============================================================
// GET /api/ai/prompts - List all prompts (with optional ?category= filter)
// POST /api/ai/prompts - Create a new prompt
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
    const category = searchParams.get('category')

    const where = category ? { category } : {}

    const prompts = await db.aiPrompt.findMany({
      where,
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
        _count: {
          select: { versions: true, testCases: true, runs: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ prompts })
  } catch (error) {
    console.error('Error listing prompts:', error)
    return NextResponse.json(
      { error: 'Failed to list prompts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { promptKey, title, description, category, provider, model, systemPrompt, userPromptTemplate, inputSchema, outputSchema, temperature, maxTokens, changeLog } = body

    if (!promptKey || !title || !category) {
      return NextResponse.json(
        { error: 'promptKey, title, and category are required' },
        { status: 400 }
      )
    }

    // Check if promptKey already exists
    const existing = await db.aiPrompt.findUnique({
      where: { promptKey },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A prompt with this key already exists' },
        { status: 400 }
      )
    }

    // Create the prompt with its first version
    const prompt = await db.aiPrompt.create({
      data: {
        promptKey,
        title,
        description: description || null,
        category,
        provider: provider || 'default',
        model: model || 'default',
        status: 'DRAFT',
        createdById: user.id,
        versions: {
          create: {
            version: 1,
            systemPrompt: systemPrompt || '',
            userPromptTemplate: userPromptTemplate || '',
            inputSchema: inputSchema || null,
            outputSchema: outputSchema || null,
            temperature: temperature ?? 0.7,
            maxTokens: maxTokens ?? 4096,
            changeLog: changeLog || 'Initial version',
            status: 'DRAFT',
          },
        },
      },
      include: {
        versions: true,
      },
    })

    return NextResponse.json({ prompt }, { status: 201 })
  } catch (error) {
    console.error('Error creating prompt:', error)
    return NextResponse.json(
      { error: 'Failed to create prompt' },
      { status: 500 }
    )
  }
}
