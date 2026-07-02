// ============================================================
// AI Service Layer - Wraps z-ai-web-dev-sdk for prompt execution
// ============================================================

import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

// Singleton ZAI instance
let zaiInstance: ZAI | null = null

async function getZAI(): Promise<ZAI> {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

// ============================================================
// Sensitive Data Masking
// ============================================================

const SENSITIVE_PATTERNS = [
  /password['":\s]*['"]?[^'"}\s,]+['"]?/gi,
  /token['":\s]*['"]?[^'"}\s,]+['"]?/gi,
  /api[_-]?key['":\s]*['"]?[^'"}\s,]+['"]?/gi,
  /secret['":\s]*['"]?[^'"}\s,]+['"]?/gi,
  /bearer\s+\S+/gi,
  /Authorization['":\s]*['"]?[^'"}\s,]+['"]?/gi,
]

export function maskSensitiveData(text: string): string {
  let masked = text
  for (const pattern of SENSITIVE_PATTERNS) {
    masked = masked.replace(pattern, '***')
  }
  return masked
}

// ============================================================
// Template Variable Replacement
// ============================================================

export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    if (variables[varName] !== undefined) {
      return variables[varName]
    }
    return `[MISSING: ${varName}]`
  })
}

// ============================================================
// Output Validation
// ============================================================

function validateOutput(
  output: string,
  outputSchema?: string | null
): { isValid: boolean; validationErrors?: string } {
  if (!outputSchema) {
    return { isValid: true }
  }

  try {
    const schema = JSON.parse(outputSchema)

    // Try to parse the output as JSON
    let parsedOutput: unknown
    try {
      parsedOutput = JSON.parse(output)
    } catch {
      return {
        isValid: false,
        validationErrors: 'Output is not valid JSON, but outputSchema requires JSON validation',
      }
    }

    // Basic schema validation - check required fields
    if (schema.type === 'object' && schema.required && Array.isArray(schema.required)) {
      const missing = schema.required.filter(
        (field: string) =>
          parsedOutput === null ||
          typeof parsedOutput !== 'object' ||
          !(field in (parsedOutput as Record<string, unknown>))
      )
      if (missing.length > 0) {
        return {
          isValid: false,
          validationErrors: `Missing required fields: ${missing.join(', ')}`,
        }
      }
    }

    // Check property types if specified
    if (schema.type === 'object' && schema.properties) {
      const errors: string[] = []
      for (const [key, propSchema] of Object.entries(
        schema.properties as Record<string, { type?: string }>
      )) {
        const value = (parsedOutput as Record<string, unknown>)[key]
        if (value !== undefined && propSchema.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value
          if (actualType !== propSchema.type) {
            errors.push(`Field "${key}" should be ${propSchema.type}, got ${actualType}`)
          }
        }
      }
      if (errors.length > 0) {
        return { isValid: false, validationErrors: errors.join('; ') }
      }
    }

    return { isValid: true }
  } catch (e) {
    return {
      isValid: false,
      validationErrors: `Invalid output schema: ${e instanceof Error ? e.message : 'Unknown error'}`,
    }
  }
}

// ============================================================
// Prompt Execution Result
// ============================================================

export interface PromptExecutionResult {
  output: string
  parsedOutput?: unknown
  isValid: boolean
  validationErrors?: string
  latencyMs: number
  tokenUsage?: { input?: number; output?: number; total?: number }
  promptVersionId: string
  promptId: string
}

// ============================================================
// Execute Prompt by Key
// ============================================================

export async function executePrompt(
  promptKey: string,
  variables: Record<string, string>,
  options?: { runById?: string; isTestRun?: boolean }
): Promise<PromptExecutionResult> {
  const startTime = Date.now()

  // Find the active prompt by key
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
    throw new Error(`Prompt with key "${promptKey}" not found`)
  }

  if (prompt.versions.length === 0) {
    throw new Error(`No active version found for prompt "${promptKey}"`)
  }

  const activeVersion = prompt.versions[0]
  return executeVersion(prompt, activeVersion, variables, startTime, options)
}

// ============================================================
// Execute Prompt by Version ID
// ============================================================

export async function executePromptWithVersion(
  promptVersionId: string,
  variables: Record<string, string>,
  options?: { runById?: string; isTestRun?: boolean }
): Promise<PromptExecutionResult> {
  const startTime = Date.now()

  const version = await db.aiPromptVersion.findUnique({
    where: { id: promptVersionId },
    include: { prompt: true },
  })

  if (!version) {
    throw new Error(`Prompt version "${promptVersionId}" not found`)
  }

  return executeVersion(version.prompt, version, variables, startTime, options)
}

// ============================================================
// Core Execution Logic
// ============================================================

async function executeVersion(
  prompt: { id: string; promptKey: string },
  version: {
    id: string
    systemPrompt: string
    userPromptTemplate: string
    outputSchema?: string | null
    temperature: number
    maxTokens: number
  },
  variables: Record<string, string>,
  startTime: number,
  options?: { runById?: string; isTestRun?: boolean }
): Promise<PromptExecutionResult> {
  try {
    const zai = await getZAI()

    // Replace template variables in user prompt
    const userPrompt = replaceTemplateVariables(
      version.userPromptTemplate,
      variables
    )

    // Call the AI API
    // Note: z-ai-web-dev-sdk uses 'assistant' role for system prompts
    const response = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: version.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const latencyMs = Date.now() - startTime

    // Extract the output
    const output =
      response?.choices?.[0]?.message?.content ||
      (typeof response === 'string' ? response : JSON.stringify(response))

    // Extract token usage if available
    const tokenUsage = response?.usage
      ? {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
          total: response.usage.total_tokens,
        }
      : undefined

    // Validate output against schema
    const { isValid, validationErrors } = validateOutput(
      output,
      version.outputSchema
    )

    // Try to parse as JSON for parsedOutput
    let parsedOutput: unknown = undefined
    try {
      parsedOutput = JSON.parse(output)
    } catch {
      // Not JSON, that's fine
    }

    // Log the execution
    await db.aiPromptRun.create({
      data: {
        promptId: prompt.id,
        promptVersionId: version.id,
        inputVars: JSON.stringify(maskSensitiveVariables(variables)),
        rawOutput: maskSensitiveData(output),
        parsedOutput: parsedOutput ? JSON.stringify(maskSensitiveData(JSON.stringify(parsedOutput))) : null,
        isValid,
        validationErrors,
        isTestRun: options?.isTestRun ?? false,
        tokenUsage: tokenUsage ? JSON.stringify(tokenUsage) : null,
        latencyMs,
        runById: options?.runById ?? null,
      },
    })

    return {
      output,
      parsedOutput,
      isValid,
      validationErrors,
      latencyMs,
      tokenUsage,
      promptVersionId: version.id,
      promptId: prompt.id,
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'

    // Log the error to ai_prompt_runs
    try {
      await db.aiPromptRun.create({
        data: {
          promptId: prompt.id,
          promptVersionId: version.id,
          inputVars: JSON.stringify(maskSensitiveVariables(variables)),
          isValid: false,
          validationErrors: null,
          isTestRun: options?.isTestRun ?? false,
          latencyMs,
          error: maskSensitiveData(errorMessage),
          runById: options?.runById ?? null,
        },
      })
    } catch {
      // Silently fail if logging also fails
    }

    throw error
  }
}

// ============================================================
// Generic AI Text Generation (no stored prompt required)
// ============================================================

export interface GenerateTextOptions {
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
}

export interface GenerateTextResult {
  output: string
  latencyMs: number
  tokenUsage?: { input?: number; output?: number; total?: number }
}

export const aiService = {
  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const startTime = Date.now()

    const zai = await getZAI()

    const response = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const latencyMs = Date.now() - startTime

    const output =
      response?.choices?.[0]?.message?.content ||
      (typeof response === 'string' ? response : JSON.stringify(response))

    const tokenUsage = response?.usage
      ? {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
          total: response.usage.total_tokens,
        }
      : undefined

    return { output, latencyMs, tokenUsage }
  },
}

// ============================================================
// Mask sensitive variables
// ============================================================

function maskSensitiveVariables(
  variables: Record<string, string>
): Record<string, string> {
  const masked: Record<string, string> = {}
  for (const [key, value] of Object.entries(variables)) {
    const maskedValue = maskSensitiveData(value)
    masked[key] = maskedValue
  }
  return masked
}
