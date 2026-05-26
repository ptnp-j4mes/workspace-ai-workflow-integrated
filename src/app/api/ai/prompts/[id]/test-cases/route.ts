// ============================================================
// GET /api/ai/prompts/[id]/test-cases - List test cases for a prompt
// POST /api/ai/prompts/[id]/test-cases - Create a test case
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

    const prompt = await db.aiPrompt.findUnique({ where: { id } })
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      )
    }

    const testCases = await db.aiPromptTestCase.findMany({
      where: { promptId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ testCases })
  } catch (error) {
    console.error('Error listing test cases:', error)
    return NextResponse.json(
      { error: 'Failed to list test cases' },
      { status: 500 }
    )
  }
}

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
    const { name, inputVars, expectedOutput, expectedContains, description } = body

    if (!name || !inputVars) {
      return NextResponse.json(
        { error: 'name and inputVars are required' },
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

    const testCase = await db.aiPromptTestCase.create({
      data: {
        promptId: id,
        name,
        inputVars: typeof inputVars === 'string' ? inputVars : JSON.stringify(inputVars),
        expectedOutput: expectedOutput || null,
        expectedContains: expectedContains
          ? typeof expectedContains === 'string'
            ? expectedContains
            : JSON.stringify(expectedContains)
          : null,
        description: description || null,
      },
    })

    return NextResponse.json({ testCase }, { status: 201 })
  } catch (error) {
    console.error('Error creating test case:', error)
    return NextResponse.json(
      { error: 'Failed to create test case' },
      { status: 500 }
    )
  }
}
