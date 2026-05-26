// ============================================================
// POST /api/ai/request-intake/generate-draft - Generate a request draft
// Uses the 'request.intake.generate_draft' prompt
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { executePrompt } from '@/lib/ai-service'

interface DraftResult {
  title: string
  description: string
  priority: string
  affectedSystem: string
  businessImpact: string
  acceptanceCriteria: string[]
  missingFields: string[]
  followUpQuestions: string[]
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { message, projectContext, requestType } = body

    if (!message) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      )
    }

    const variables: Record<string, string> = {
      userInput: message,
      context: projectContext || 'Not specified',
    }

    if (requestType) {
      variables.context += `. Request type hint: ${requestType}`
    }

    const result = await executePrompt('request.intake.generate_draft', variables, {
      runById: user.id,
    })

    // Parse the draft result
    let draft: DraftResult
    try {
      if (result.parsedOutput && typeof result.parsedOutput === 'object') {
        draft = result.parsedOutput as DraftResult
      } else {
        // Try to extract JSON from the output
        const jsonMatch = result.output.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          draft = JSON.parse(jsonMatch[0]) as DraftResult
        } else {
          draft = {
            title: 'Untitled Request',
            description: result.output,
            priority: 'MEDIUM',
            affectedSystem: 'Unknown',
            businessImpact: 'Not determined',
            acceptanceCriteria: [],
            missingFields: [],
            followUpQuestions: ['Could not parse draft result'],
          }
        }
      }
    } catch {
      draft = {
        title: 'Untitled Request',
        description: result.output,
        priority: 'MEDIUM',
        affectedSystem: 'Unknown',
        businessImpact: 'Not determined',
        acceptanceCriteria: [],
        missingFields: [],
        followUpQuestions: ['Could not parse draft result'],
      }
    }

    return NextResponse.json({
      draft,
      metadata: {
        promptVersionId: result.promptVersionId,
        promptId: result.promptId,
        latencyMs: result.latencyMs,
        tokenUsage: result.tokenUsage,
        isValid: result.isValid,
        validationErrors: result.validationErrors,
      },
    })
  } catch (error) {
    console.error('Error generating draft:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate draft'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
