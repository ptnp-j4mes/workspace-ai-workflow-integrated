// ============================================================
// POST /api/ai/request-intake/classify - Classify a user message
// Uses the 'request.intake.classify' prompt to classify a user message
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { executePrompt } from '@/lib/ai-service'

interface ClassificationResult {
  requestType: string
  priority: string
  affectedSystem: string
  confidence: number
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
    const { message, projectContext } = body

    if (!message) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      )
    }

    const variables: Record<string, string> = {
      message,
      projectContext: projectContext || 'Not specified',
    }

    const result = await executePrompt('request.intake.classify', variables, {
      runById: user.id,
    })

    // Parse the classification result
    let classification: ClassificationResult
    try {
      if (result.parsedOutput && typeof result.parsedOutput === 'object') {
        classification = result.parsedOutput as ClassificationResult
      } else {
        // Try to extract JSON from the output
        const jsonMatch = result.output.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          classification = JSON.parse(jsonMatch[0]) as ClassificationResult
        } else {
          classification = {
            requestType: 'UNKNOWN',
            priority: 'MEDIUM',
            affectedSystem: 'UNKNOWN',
            confidence: 0,
            missingFields: [],
            followUpQuestions: ['Could not parse classification result'],
          }
        }
      }
    } catch {
      classification = {
        requestType: 'UNKNOWN',
        priority: 'MEDIUM',
        affectedSystem: 'UNKNOWN',
        confidence: 0,
        missingFields: [],
        followUpQuestions: ['Could not parse classification result'],
      }
    }

    return NextResponse.json({
      classification,
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
    console.error('Error classifying request:', error)
    const message = error instanceof Error ? error.message : 'Failed to classify request'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
