import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { executePrompt } from '@/lib/ai-service'

// POST /api/ai/uat/generate-test-cases - Generate AI test cases
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { requirementTitle, requirementDescription, acceptanceCriteria, requestType } = body

    if (!requirementTitle || !requirementDescription) {
      return NextResponse.json(
        { error: 'requirementTitle and requirementDescription are required' },
        { status: 400 }
      )
    }

    const result = await executePrompt('uat.generate_test_cases', {
      requirementTitle,
      requirementDescription,
      acceptanceCriteria: acceptanceCriteria || 'Not specified',
      requestType: requestType || 'FEATURE',
    })

    return NextResponse.json({
      testCases: result.parsedOutput || result.output,
      runId: result.runId,
      latencyMs: result.latencyMs,
    })
  } catch (error: any) {
    console.error('Generate test cases error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate test cases' },
      { status: 500 }
    )
  }
}
