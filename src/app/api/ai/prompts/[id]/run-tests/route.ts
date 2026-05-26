// ============================================================
// POST /api/ai/prompts/[id]/run-tests - Run all test cases for a prompt
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { executePromptWithVersion } from '@/lib/ai-service'

interface TestResult {
  testCaseId: string
  testCaseName: string
  passed: boolean
  output?: string
  errors: string[]
  latencyMs?: number
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

    // Get prompt with active version and test cases
    const prompt = await db.aiPrompt.findUnique({
      where: { id },
      include: {
        versions: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
        testCases: true,
      },
    })

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      )
    }

    if (prompt.versions.length === 0) {
      return NextResponse.json(
        { error: 'No active version found for this prompt' },
        { status: 400 }
      )
    }

    if (prompt.testCases.length === 0) {
      return NextResponse.json(
        { error: 'No test cases found for this prompt' },
        { status: 400 }
      )
    }

    const activeVersion = prompt.versions[0]
    const results: TestResult[] = []

    // Execute each test case
    for (const testCase of prompt.testCases) {
      const testResult: TestResult = {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        passed: false,
        errors: [],
      }

      try {
        // Parse input variables from the test case
        let inputVars: Record<string, string> = {}
        try {
          inputVars = JSON.parse(testCase.inputVars)
        } catch {
          testResult.errors.push('Invalid inputVars JSON in test case')
          results.push(testResult)
          continue
        }

        // Execute the prompt with the test case variables
        const executionResult = await executePromptWithVersion(
          activeVersion.id,
          inputVars,
          {
            runById: user.id,
            isTestRun: true,
          }
        )

        testResult.output = executionResult.output
        testResult.latencyMs = executionResult.latencyMs

        // Validate the output
        const errors: string[] = []

        // Check expected output (exact match)
        if (testCase.expectedOutput) {
          if (executionResult.output.trim() !== testCase.expectedOutput.trim()) {
            errors.push('Output does not match expected output exactly')
          }
        }

        // Check expected contains (substring match)
        if (testCase.expectedContains) {
          try {
            const containsList: string[] = JSON.parse(testCase.expectedContains)
            for (const expected of containsList) {
              if (
                !executionResult.output.toLowerCase().includes(expected.toLowerCase())
              ) {
                errors.push(
                  `Output does not contain expected string: "${expected}"`
                )
              }
            }
          } catch {
            errors.push('Invalid expectedContains JSON in test case')
          }
        }

        // Check schema validation
        if (!executionResult.isValid && executionResult.validationErrors) {
          errors.push(`Schema validation failed: ${executionResult.validationErrors}`)
        }

        testResult.errors = errors
        testResult.passed = errors.length === 0

        // Update the prompt run with test result
        await db.aiPromptRun.updateMany({
          where: {
            promptVersionId: activeVersion.id,
            isTestRun: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          data: {
            testPassed: testResult.passed,
          },
        })
      } catch (error) {
        testResult.errors.push(
          error instanceof Error ? error.message : 'Unknown error during test execution'
        )
      }

      results.push(testResult)
    }

    const totalPassed = results.filter((r) => r.passed).length
    const totalFailed = results.filter((r) => !r.passed).length

    return NextResponse.json({
      summary: {
        total: results.length,
        passed: totalPassed,
        failed: totalFailed,
      },
      results,
    })
  } catch (error) {
    console.error('Error running tests:', error)
    return NextResponse.json(
      { error: 'Failed to run tests' },
      { status: 500 }
    )
  }
}
