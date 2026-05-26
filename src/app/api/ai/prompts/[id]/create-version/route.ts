// ============================================================
// POST /api/ai/prompts/[id]/create-version - Create a new version of a prompt
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
    const { systemPrompt, userPromptTemplate, inputSchema, outputSchema, temperature, maxTokens, changeLog } = body

    if (systemPrompt === undefined || userPromptTemplate === undefined) {
      return NextResponse.json(
        { error: 'systemPrompt and userPromptTemplate are required' },
        { status: 400 }
      )
    }

    // Check if prompt exists
    const prompt = await db.aiPrompt.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
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

    // Calculate the next version number
    const latestVersion = prompt.versions[0]
    const nextVersion = latestVersion ? latestVersion.version + 1 : 1

    // Create the new version
    const version = await db.aiPromptVersion.create({
      data: {
        promptId: id,
        version: nextVersion,
        systemPrompt,
        userPromptTemplate,
        inputSchema: inputSchema || null,
        outputSchema: outputSchema || null,
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 4096,
        changeLog: changeLog || null,
        status: 'DRAFT',
      },
    })

    return NextResponse.json({ version }, { status: 201 })
  } catch (error) {
    console.error('Error creating prompt version:', error)
    return NextResponse.json(
      { error: 'Failed to create prompt version' },
      { status: 500 }
    )
  }
}
