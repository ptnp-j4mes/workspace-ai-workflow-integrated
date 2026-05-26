import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { executePrompt } from '@/lib/ai-service'

// POST /api/ai/bugs/root-cause-analysis - Generate AI root cause analysis
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { bugTitle, description, severity, actualResult, expectedResult, reproductionSteps } = body

    if (!bugTitle || !description) {
      return NextResponse.json(
        { error: 'bugTitle and description are required' },
        { status: 400 }
      )
    }

    const result = await executePrompt('bug.root_cause_analysis', {
      bugTitle,
      description,
      severity: severity || 'MEDIUM',
      actualResult: actualResult || 'Not specified',
      expectedResult: expectedResult || 'Not specified',
      reproductionSteps: reproductionSteps || 'Not provided',
    })

    return NextResponse.json({
      analysis: result.parsedOutput || result.output,
      runId: result.runId,
      latencyMs: result.latencyMs,
    })
  } catch (error: any) {
    console.error('Root cause analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate root cause analysis' },
      { status: 500 }
    )
  }
}
