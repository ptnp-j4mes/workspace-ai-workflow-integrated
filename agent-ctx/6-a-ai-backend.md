# Task 6-a: AI Prompt Management API and AI Service Layer

## Agent: AI Backend Developer
## Task ID: 6-a

## Work Summary

Implemented the complete AI Prompt Management API and AI Service Layer for the Enterprise AI Workflow Platform.

## Files Created

### 1. AI Service Layer
- `/home/z/my-project/src/lib/ai-service.ts` - Core AI service wrapping z-ai-web-dev-sdk
  - Singleton ZAI instance management
  - `executePrompt(promptKey, variables)` - Execute prompt by key (finds active version)
  - `executePromptWithVersion(promptVersionId, variables)` - Execute specific version
  - Template variable replacement (`{{variable}}` → value, or `[MISSING: variableName]`)
  - Output validation against JSON outputSchema
  - Sensitive data masking (passwords, tokens, api keys, secrets)
  - Execution logging to ai_prompt_runs table
  - Latency tracking and token usage extraction
  - Error handling with logging to ai_prompt_runs

### 2. Prompt Management API Routes
- `/home/z/my-project/src/app/api/ai/prompts/route.ts` - GET (list with category filter) / POST (create prompt with first version)
- `/home/z/my-project/src/app/api/ai/prompts/[id]/route.ts` - GET (detail with versions) / PATCH (update metadata)
- `/home/z/my-project/src/app/api/ai/prompts/[id]/create-version/route.ts` - POST (create new version with incremented version number, status DRAFT)
- `/home/z/my-project/src/app/api/ai/prompts/[id]/activate/route.ts` - POST (deprecate current active, set new active, update prompt status)
- `/home/z/my-project/src/app/api/ai/prompts/[id]/deprecate/route.ts` - POST (deprecate a version, update prompt status if no active version)
- `/home/z/my-project/src/app/api/ai/prompts/[id]/active/route.ts` - GET (find active version by promptKey)
- `/home/z/my-project/src/app/api/ai/prompts/[id]/run/route.ts` - POST (execute prompt with variables, optional versionId)
- `/home/z/my-project/src/app/api/ai/prompts/[id]/test-cases/route.ts` - GET (list) / POST (create test cases)
- `/home/z/my-project/src/app/api/ai/prompts/[id]/run-tests/route.ts` - POST (run all test cases with validation)

### 3. Prompt Runs API
- `/home/z/my-project/src/app/api/ai/prompt-runs/route.ts` - GET (paginated list with prompt/version/user details)
- `/home/z/my-project/src/app/api/ai/prompt-runs/[id]/route.ts` - GET (detailed run with prompt version details)

### 4. AI Request Intake API
- `/home/z/my-project/src/app/api/ai/request-intake/classify/route.ts` - POST (classify user message using 'request.intake.classify' prompt)
- `/home/z/my-project/src/app/api/ai/request-intake/generate-draft/route.ts` - POST (generate request draft using 'request.intake.generate_draft' prompt)

## Design Decisions

1. **Dynamic route params**: Used `const { id } = await params` pattern for Next.js 16 App Router where params is a Promise
2. **Active route by promptKey**: Placed at `[id]/active/route.ts` - the `id` param is treated as a `promptKey` in that handler since Next.js doesn't allow two dynamic segments at the same level
3. **Authentication**: All POST/PATCH routes require authentication via `getAuthUser`. GET routes also require authentication.
4. **Template variables**: Missing variables are replaced with `[MISSING: variableName]` instead of throwing errors
5. **Output validation**: Basic JSON schema validation checking required fields and property types
6. **Sensitive data masking**: Applied to both input variables and output before logging
7. **Error handling**: Errors during prompt execution are logged to ai_prompt_runs table before being re-thrown
8. **Test execution**: Each test case is executed sequentially against the active version, with results including expected output matching and substring contains checks

## Lint Status
✅ All files pass ESLint checks
