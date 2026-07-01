import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'
import { executePrompt, executePromptWithVersion } from '../lib/ai-service'

interface TestResult {
  testCaseId: string
  testCaseName: string
  passed: boolean
  output?: string
  errors: string[]
  latencyMs?: number
}

interface ClassificationResult {
  requestType: string
  priority: string
  affectedSystem: string
  confidence: number
  missingFields: string[]
  followUpQuestions: string[]
}

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

export const aiRoutes = new Elysia({ prefix: '/api/ai' })
  // POST /api/ai/bugs/root-cause-analysis - Generate AI root cause analysis
  .post('/bugs/root-cause-analysis', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { bugTitle, description, severity, actualResult, expectedResult, reproductionSteps } = body

      if (!bugTitle || !description) {
        set.status = 400
        return { error: 'bugTitle and description are required' }
      }

      const result = await executePrompt('bug.root_cause_analysis', {
        bugTitle,
        description,
        severity: severity || 'MEDIUM',
        actualResult: actualResult || 'Not specified',
        expectedResult: expectedResult || 'Not specified',
        reproductionSteps: reproductionSteps || 'Not provided',
      })

      return {
        analysis: result.parsedOutput || result.output,
        runId: result.runId,
        latencyMs: result.latencyMs,
      }
    } catch (error: any) {
      console.error('Root cause analysis error:', error)
      set.status = 500
      return { error: error.message || 'Failed to generate root cause analysis' }
    }
  })

  // POST /api/ai/dashboard/workload-insight - Generate AI workload insight
  .post('/dashboard/workload-insight', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      // Fetch real data from DB
      const now = new Date()

      const [users, activeRequests, activeWorkItems, overdueRequests, overdueWorkItems] =
        await Promise.all([
          db.user.findMany({
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              _count: {
                select: {
                  assignedBAs: { where: { status: { in: ['ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT'] } } },
                  assignedDevs: { where: { status: { in: ['ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT'] } } },
                  assignedQAs: { where: { status: { in: ['ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT'] } } },
                },
              },
            },
          }),
          db.request.findMany({
            where: { status: { in: ['ASSIGNED', 'IN_DEVELOPMENT', 'QA', 'UAT'] } },
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              type: true,
              dueDate: true,
              assignedBA: { select: { name: true } },
              assignedDev: { select: { name: true } },
              assignedQA: { select: { name: true } },
            },
          }),
          db.workItem.findMany({
            where: { status: { in: ['CREATED', 'ASSIGNED', 'ACCEPTED'] } },
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
            },
          }),
          db.request.count({
            where: {
              dueDate: { lt: now },
              status: { notIn: ['COMPLETED', 'CLOSED', 'REJECTED'] },
            },
          }),
          db.workItem.count({
            where: {
              dueDate: { lt: now },
              status: { notIn: ['DEPLOYED', 'SUBMITTED', 'REJECTED'] },
            },
          }),
        ])

      const userWorkloadData = users.map((u) => ({
        name: u.name,
        activeRequests: u._count.assignedBAs + u._count.assignedDevs + u._count.assignedQAs,
      }))

      const requestData = activeRequests.map((r) => ({
        title: r.title,
        status: r.status,
        priority: r.priority,
        type: r.type,
        dueDate: r.dueDate?.toISOString() || 'N/A',
        assignedBA: r.assignedBA?.name || 'None',
        assignedDev: r.assignedDev?.name || 'None',
        assignedQA: r.assignedQA?.name || 'None',
      }))

      const result = await executePrompt('dashboard.workload_insight', {
        userWorkload: JSON.stringify(userWorkloadData),
        activeRequests: JSON.stringify(requestData),
        activeWorkItemCount: String(activeWorkItems.length),
        overdueRequestCount: String(overdueRequests),
        overdueWorkItemCount: String(overdueWorkItems),
      })

      return {
        insight: result.parsedOutput || result.output,
        runId: result.runId,
        latencyMs: result.latencyMs,
      }
    } catch (error: any) {
      console.error('Workload insight error:', error)
      set.status = 500
      return { error: error.message || 'Failed to generate workload insight' }
    }
  })

  // GET /api/ai/prompt-runs/:id - Get a specific run detail
  .get('/prompt-runs/:id', async ({ request, params, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const { id } = params

      const run = await db.aiPromptRun.findUnique({
        where: { id },
        include: {
          prompt: {
            select: {
              id: true,
              promptKey: true,
              title: true,
              category: true,
            },
          },
          promptVersion: {
            select: {
              id: true,
              version: true,
              systemPrompt: true,
              userPromptTemplate: true,
              temperature: true,
              maxTokens: true,
              status: true,
            },
          },
          runBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      if (!run) {
        set.status = 404
        return { error: 'Run not found' }
      }

      return { run }
    } catch (error) {
      console.error('Error getting prompt run:', error)
      set.status = 500
      return { error: 'Failed to get prompt run' }
    }
  })

  // GET /api/ai/prompt-runs - List prompt execution logs (with pagination)
  .get('/prompt-runs', async ({ request, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const { searchParams } = new URL(request.url)
      const page = parseInt(searchParams.get('page') || '1', 10)
      const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)
      const promptId = searchParams.get('promptId')

      const skip = (page - 1) * pageSize

      const where = promptId ? { promptId } : {}

      const [runs, total] = await Promise.all([
        db.aiPromptRun.findMany({
          where,
          include: {
            prompt: {
              select: {
                id: true,
                promptKey: true,
                title: true,
                category: true,
              },
            },
            promptVersion: {
              select: {
                id: true,
                version: true,
                status: true,
              },
            },
            runBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
        db.aiPromptRun.count({ where }),
      ])

      return {
        runs,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      }
    } catch (error) {
      console.error('Error listing prompt runs:', error)
      set.status = 500
      return { error: 'Failed to list prompt runs' }
    }
  })

  // POST /api/ai/prompts/:id/activate - Activate a specific version
  .post('/prompts/:id/activate', async ({ request, params, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const { id } = params
      const body = await request.json()
      const { versionId } = body

      if (!versionId) {
        set.status = 400
        return { error: 'versionId is required' }
      }

      // Check if prompt exists
      const prompt = await db.aiPrompt.findUnique({ where: { id } })
      if (!prompt) {
        set.status = 404
        return { error: 'Prompt not found' }
      }

      // Check if the specified version exists and belongs to this prompt
      const version = await db.aiPromptVersion.findFirst({
        where: { id: versionId, promptId: id },
      })

      if (!version) {
        set.status = 404
        return { error: 'Version not found for this prompt' }
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

      return { version: updatedVersion }
    } catch (error) {
      console.error('Error activating prompt version:', error)
      set.status = 500
      return { error: 'Failed to activate prompt version' }
    }
  })

  // GET /api/ai/prompts/:id/active - Get the active version of a prompt by key
  // The :id dynamic segment is used as promptKey here
  .get('/prompts/:id/active', async ({ request, params, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const { id: promptKey } = params

      // Find prompt by promptKey (unique column)
      const prompt = await db.aiPrompt.findUnique({
        where: { promptKey },
        include: {
          versions: {
            where: { status: 'ACTIVE' },
            take: 1,
          },
        },
      })

      if (!prompt) {
        set.status = 404
        return { error: 'Prompt not found' }
      }

      if (prompt.versions.length === 0) {
        set.status = 404
        return { error: 'No active version found for this prompt' }
      }

      return {
        prompt: {
          id: prompt.id,
          promptKey: prompt.promptKey,
          title: prompt.title,
          description: prompt.description,
          category: prompt.category,
          provider: prompt.provider,
          model: prompt.model,
          status: prompt.status,
        },
        version: prompt.versions[0],
      }
    } catch (error) {
      console.error('Error getting active prompt version:', error)
      set.status = 500
      return { error: 'Failed to get active prompt version' }
    }
  })

  // POST /api/ai/prompts/:id/create-version - Create a new version of a prompt
  .post('/prompts/:id/create-version', async ({ request, params, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const { id } = params
      const body = await request.json()
      const { systemPrompt, userPromptTemplate, inputSchema, outputSchema, temperature, maxTokens, changeLog } = body

      if (systemPrompt === undefined || userPromptTemplate === undefined) {
        set.status = 400
        return { error: 'systemPrompt and userPromptTemplate are required' }
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
        set.status = 404
        return { error: 'Prompt not found' }
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

      set.status = 201
      return { version }
    } catch (error) {
      console.error('Error creating prompt version:', error)
      set.status = 500
      return { error: 'Failed to create prompt version' }
    }
  })

  // POST /api/ai/prompts/:id/deprecate - Deprecate a version
  .post('/prompts/:id/deprecate', async ({ request, params, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const { id } = params
      const body = await request.json()
      const { versionId } = body

      if (!versionId) {
        set.status = 400
        return { error: 'versionId is required' }
      }

      // Check if prompt exists
      const prompt = await db.aiPrompt.findUnique({ where: { id } })
      if (!prompt) {
        set.status = 404
        return { error: 'Prompt not found' }
      }

      // Check if the specified version exists and belongs to this prompt
      const version = await db.aiPromptVersion.findFirst({
        where: { id: versionId, promptId: id },
      })

      if (!version) {
        set.status = 404
        return { error: 'Version not found for this prompt' }
      }

      if (version.status === 'DEPRECATED') {
        set.status = 400
        return { error: 'Version is already deprecated' }
      }

      // Deprecate the version
      const updatedVersion = await db.aiPromptVersion.update({
        where: { id: versionId },
        data: { status: 'DEPRECATED' },
      })

      // Check if the deprecated version was the active one
      // If so, update the prompt status accordingly
      if (version.status === 'ACTIVE') {
        const hasActiveVersion = await db.aiPromptVersion.findFirst({
          where: { promptId: id, status: 'ACTIVE' },
        })

        if (!hasActiveVersion) {
          await db.aiPrompt.update({
            where: { id },
            data: { status: 'DEPRECATED' },
          })
        }
      }

      return { version: updatedVersion }
    } catch (error) {
      console.error('Error deprecating prompt version:', error)
      set.status = 500
      return { error: 'Failed to deprecate prompt version' }
    }
  })

  // GET /api/ai/prompts/:id - Get prompt detail with versions
  .get('/prompts/:id', async ({ request, params, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const { id } = params

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
        set.status = 404
        return { error: 'Prompt not found' }
      }

      return { prompt }
    } catch (error) {
      console.error('Error getting prompt:', error)
      set.status = 500
      return { error: 'Failed to get prompt' }
    }
  })

  // PATCH /api/ai/prompts/:id - Update prompt metadata
  .patch('/prompts/:id', async ({ request, params, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const { id } = params
      const body = await request.json()
      const { title, description, category } = body

      // Check if prompt exists
      const existing = await db.aiPrompt.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Prompt not found' }
      }

      const prompt = await db.aiPrompt.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(category !== undefined && { category }),
        },
      })

      return { prompt }
    } catch (error) {
      console.error('Error updating prompt:', error)
      set.status = 500
      return { error: 'Failed to update prompt' }
    }
  })

  // POST /api/ai/prompts/:id/run-tests - Run all test cases for a prompt
  .post('/prompts/:id/run-tests', async ({ request, params, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const { id } = params

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
        set.status = 404
        return { error: 'Prompt not found' }
      }

      if (prompt.versions.length === 0) {
        set.status = 400
        return { error: 'No active version found for this prompt' }
      }

      if (prompt.testCases.length === 0) {
        set.status = 400
        return { error: 'No test cases found for this prompt' }
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

      return {
        summary: {
          total: results.length,
          passed: totalPassed,
          failed: totalFailed,
        },
        results,
      }
    } catch (error) {
      console.error('Error running tests:', error)
      set.status = 500
      return { error: 'Failed to run tests' }
    }
  })

  // POST /api/ai/prompts/:id/run - Execute a prompt with variables
  .post('/prompts/:id/run', async ({ request, params, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const { id } = params
      const body = await request.json()
      const { versionId, variables } = body

      if (!variables || typeof variables !== 'object') {
        set.status = 400
        return { error: 'variables is required and must be an object' }
      }

      let result

      if (versionId) {
        // Execute a specific version
        result = await executePromptWithVersion(versionId, variables, {
          runById: user.id,
        })
      } else {
        // Execute the active version using the prompt key
        // The id in the URL is the prompt ID, but we need the promptKey for executePrompt
        // So we use executePromptWithVersion approach - first find the active version
        const { db } = await import('../lib/db')
        const prompt = await db.aiPrompt.findUnique({
          where: { id },
          include: {
            versions: {
              where: { status: 'ACTIVE' },
              take: 1,
            },
          },
        })

        if (!prompt) {
          set.status = 404
          return { error: 'Prompt not found' }
        }

        if (prompt.versions.length === 0) {
          set.status = 400
          return { error: 'No active version found for this prompt' }
        }

        result = await executePromptWithVersion(prompt.versions[0].id, variables, {
          runById: user.id,
        })
      }

      return { result }
    } catch (error) {
      console.error('Error executing prompt:', error)
      const message = error instanceof Error ? error.message : 'Failed to execute prompt'
      set.status = 500
      return { error: message }
    }
  })

  // GET /api/ai/prompts/:id/test-cases - List test cases for a prompt
  .get('/prompts/:id/test-cases', async ({ request, params, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const { id } = params

      const prompt = await db.aiPrompt.findUnique({ where: { id } })
      if (!prompt) {
        set.status = 404
        return { error: 'Prompt not found' }
      }

      const testCases = await db.aiPromptTestCase.findMany({
        where: { promptId: id },
        orderBy: { createdAt: 'desc' },
      })

      return { testCases }
    } catch (error) {
      console.error('Error listing test cases:', error)
      set.status = 500
      return { error: 'Failed to list test cases' }
    }
  })

  // POST /api/ai/prompts/:id/test-cases - Create a test case
  .post('/prompts/:id/test-cases', async ({ request, params, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const { id } = params
      const body = await request.json()
      const { name, inputVars, expectedOutput, expectedContains, description } = body

      if (!name || !inputVars) {
        set.status = 400
        return { error: 'name and inputVars are required' }
      }

      // Check if prompt exists
      const prompt = await db.aiPrompt.findUnique({ where: { id } })
      if (!prompt) {
        set.status = 404
        return { error: 'Prompt not found' }
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

      set.status = 201
      return { testCase }
    } catch (error) {
      console.error('Error creating test case:', error)
      set.status = 500
      return { error: 'Failed to create test case' }
    }
  })

  // GET /api/ai/prompts - List all prompts (with optional ?category= filter)
  .get('/prompts', async ({ request, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
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

      return { prompts }
    } catch (error) {
      console.error('Error listing prompts:', error)
      set.status = 500
      return { error: 'Failed to list prompts' }
    }
  })

  // POST /api/ai/prompts - Create a new prompt
  .post('/prompts', async ({ request, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const body = await request.json()
      const { promptKey, title, description, category, provider, model, systemPrompt, userPromptTemplate, inputSchema, outputSchema, temperature, maxTokens, changeLog } = body

      if (!promptKey || !title || !category) {
        set.status = 400
        return { error: 'promptKey, title, and category are required' }
      }

      // Check if promptKey already exists
      const existing = await db.aiPrompt.findUnique({
        where: { promptKey },
      })

      if (existing) {
        set.status = 400
        return { error: 'A prompt with this key already exists' }
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

      set.status = 201
      return { prompt }
    } catch (error) {
      console.error('Error creating prompt:', error)
      set.status = 500
      return { error: 'Failed to create prompt' }
    }
  })

  // POST /api/ai/request-intake/classify - Classify a user message
  // Uses the 'request.intake.classify' prompt to classify a user message
  .post('/request-intake/classify', async ({ request, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const body = await request.json()
      const { message, projectContext } = body

      if (!message) {
        set.status = 400
        return { error: 'message is required' }
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

      return {
        classification,
        metadata: {
          promptVersionId: result.promptVersionId,
          promptId: result.promptId,
          latencyMs: result.latencyMs,
          tokenUsage: result.tokenUsage,
          isValid: result.isValid,
          validationErrors: result.validationErrors,
        },
      }
    } catch (error) {
      console.error('Error classifying request:', error)
      const message = error instanceof Error ? error.message : 'Failed to classify request'
      set.status = 500
      return { error: message }
    }
  })

  // POST /api/ai/request-intake/generate-draft - Generate a request draft
  // Uses the 'request.intake.generate_draft' prompt
  .post('/request-intake/generate-draft', async ({ request, set }) => {
    const user = await getAuthUser(request)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    try {
      const body = await request.json()
      const { message, projectContext, requestType } = body

      if (!message) {
        set.status = 400
        return { error: 'message is required' }
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

      return {
        draft,
        metadata: {
          promptVersionId: result.promptVersionId,
          promptId: result.promptId,
          latencyMs: result.latencyMs,
          tokenUsage: result.tokenUsage,
          isValid: result.isValid,
          validationErrors: result.validationErrors,
        },
      }
    } catch (error) {
      console.error('Error generating draft:', error)
      const message = error instanceof Error ? error.message : 'Failed to generate draft'
      set.status = 500
      return { error: message }
    }
  })

  // POST /api/ai/uat/generate-test-cases - Generate AI test cases
  .post('/uat/generate-test-cases', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { requirementTitle, requirementDescription, acceptanceCriteria, requestType } = body

      if (!requirementTitle || !requirementDescription) {
        set.status = 400
        return { error: 'requirementTitle and requirementDescription are required' }
      }

      const result = await executePrompt('uat.generate_test_cases', {
        requirementTitle,
        requirementDescription,
        acceptanceCriteria: acceptanceCriteria || 'Not specified',
        requestType: requestType || 'FEATURE',
      })

      return {
        testCases: result.parsedOutput || result.output,
        runId: result.runId,
        latencyMs: result.latencyMs,
      }
    } catch (error: any) {
      console.error('Generate test cases error:', error)
      set.status = 500
      return { error: error.message || 'Failed to generate test cases' }
    }
  })
