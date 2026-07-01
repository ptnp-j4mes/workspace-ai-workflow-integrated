// ============================================================
// GitHub Service - Repository Sync & Commit Analysis
// ============================================================

import { db } from '@/lib/db'

/**
 * Sync commits from a GitHub repository.
 * In dev/test mode: creates mock commits.
 * Always creates a GithubSyncLog record.
 */
export async function syncCommits(
  connectionId: string,
  repositoryId: string,
  projectId?: string
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = []
  let synced = 0

  try {
    // Verify connection exists and is active
    const connection = await db.githubConnection.findUnique({
      where: { id: connectionId },
      include: {
        repositories: { where: { id: repositoryId } },
      },
    })

    if (!connection) {
      errors.push(`Connection "${connectionId}" not found`)
      return { synced: 0, errors }
    }

    if (!connection.isActive) {
      errors.push(`Connection "${connectionId}" is not active`)
      return { synced: 0, errors }
    }

    const repository = connection.repositories[0]
    if (!repository) {
      errors.push(`Repository "${repositoryId}" not found in connection`)
      return { synced: 0, errors }
    }

    const syncStartedAt = new Date()
    const isDevMode = process.env.NODE_ENV !== 'production'

    if (isDevMode) {
      // Create mock commits for dev/test
      const mockCommits = generateMockCommits(repository, projectId, 5)
      for (const commit of mockCommits) {
        try {
          // Check if commit already exists
          const existing = await db.githubCommit.findFirst({
            where: { sha: commit.sha, repositoryId },
          })
          if (!existing) {
            await db.githubCommit.create({ data: commit })
            synced++
          }
        } catch (err) {
          errors.push(`Failed to sync commit ${commit.sha}: ${err instanceof Error ? err.message : 'Unknown'}`)
        }
      }
    }

    // Update the repository last synced info
    await db.githubRepository.update({
      where: { id: repositoryId },
      data: { lastSyncedAt: new Date() },
    })

    // Update the connection last sync
    await db.githubConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date() },
    })

    // Create sync log
    await db.githubSyncLog.create({
      data: {
        connectionId,
        repositoryId,
        projectId: projectId ?? null,
        status: errors.length > 0 ? (synced > 0 ? 'PARTIAL' : 'FAILED') : 'SUCCESS',
        startedAt: syncStartedAt,
        finishedAt: new Date(),
        message: `Synced ${synced} commits`,
        errorMessage: errors.length > 0 ? errors.join('; ') : null,
        metadata: JSON.stringify({ synced, errors: errors.length, isDevMode }),
      },
    })

    return { synced, errors }
  } catch (error) {
    errors.push(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)

    // Try to create a failed sync log
    try {
      await db.githubSyncLog.create({
        data: {
          connectionId,
          repositoryId,
          projectId: projectId ?? null,
          status: 'FAILED',
          startedAt: new Date(),
          finishedAt: new Date(),
          errorMessage: errors.join('; '),
        },
      })
    } catch {
      // Silently fail
    }

    return { synced, errors }
  }
}

/**
 * Generate mock commit data for dev/test mode.
 */
function generateMockCommits(
  repository: { id: string; owner: string; repo: string; defaultBranch: string },
  projectId?: string,
  count: number = 5
) {
  const authors = ['John Doe', 'Jane Smith', 'Bob Wilson', 'Alice Chen', 'Tom Brown']
  const messages = [
    'feat: add user authentication module',
    'fix: resolve pagination bug in work items list',
    'refactor: extract notification service',
    'docs: update API documentation',
    'chore: update dependencies',
    'feat: implement approval workflow',
    'fix: handle null pointer in project health',
    'test: add unit tests for MIT assignment',
    'feat: add GitHub integration endpoints',
    'fix: correct document number generation',
  ]

  const commits = []
  const now = new Date()

  for (let i = 0; i < count; i++) {
    const authorDate = new Date(now.getTime() - i * 3600000) // 1 hour apart
    const sha = generateMockSha()
    const author = authors[Math.floor(Math.random() * authors.length)]

    commits.push({
      repositoryId: repository.id,
      projectId: projectId ?? null,
      sha,
      message: messages[Math.floor(Math.random() * messages.length)],
      authorName: author,
      authorEmail: `${author.toLowerCase().replace(' ', '.')}@enterprise.com`,
      authorDate,
      committerName: author,
      committerDate: authorDate,
      branch: repository.defaultBranch,
      additions: Math.floor(Math.random() * 200) + 1,
      deletions: Math.floor(Math.random() * 50),
      changedFiles: Math.floor(Math.random() * 10) + 1,
      url: `https://github.com/${repository.owner}/${repository.repo}/commit/${sha}`,
    })
  }

  return commits
}

function generateMockSha(): string {
  const chars = '0123456789abcdef'
  let sha = ''
  for (let i = 0; i < 40; i++) {
    sha += chars[Math.floor(Math.random() * chars.length)]
  }
  return sha
}

/**
 * Generate a daily summary of commits for a project.
 * Uses AI if available, otherwise falls back to rule-based summary.
 */
export async function generateDailySummary(
  projectId: string,
  date: Date
) {
  try {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    // Get commits for the project on this date
    const commits = await db.githubCommit.findMany({
      where: {
        projectId,
        authorDate: { gte: startOfDay, lte: endOfDay },
      },
    })

    const totalCommits = commits.length
    const authorsSet = new Set(commits.map(c => c.authorName))
    const totalChangedFiles = commits.reduce((sum, c) => sum + (c.changedFiles ?? 0), 0)

    let aiSummaryMarkdown: string | null = null
    let riskNotesJson: string | null = null
    let generatedBy: string = 'RULE'

    // Try AI summary if commits exist
    if (totalCommits > 0) {
      try {
        const { executePrompt } = await import('@/lib/ai-service')
        const commitMessages = commits
          .map(c => `- [${c.authorName}] ${c.message} (+${c.additions ?? 0}/-${c.deletions ?? 0})`)
          .join('\n')

        const result = await executePrompt(
          'github_daily_summary',
          {
            project_id: projectId,
            date: date.toISOString().split('T')[0],
            commit_count: String(totalCommits),
            commit_messages: commitMessages,
          }
        )

        if (result.parsedOutput && typeof result.parsedOutput === 'object') {
          const parsed = result.parsedOutput as Record<string, unknown>
          aiSummaryMarkdown = (parsed.summaryMarkdown as string) ?? null
          riskNotesJson = parsed.riskNotes ? JSON.stringify(parsed.riskNotes) : null
          generatedBy = 'AI'
        } else {
          aiSummaryMarkdown = result.output ?? null
          generatedBy = 'AI'
        }
      } catch {
        // AI not available, fall back to rule-based
      }
    }

    // Rule-based summary if AI didn't work
    if (!aiSummaryMarkdown) {
      aiSummaryMarkdown = generateRuleBasedSummary(
        totalCommits,
        Array.from(authorsSet),
        totalChangedFiles,
        commits
      )
      generatedBy = 'RULE'
    }

    // Rule-based risk notes
    if (!riskNotesJson) {
      const riskNotes = generateRuleBasedRiskNotes(commits)
      riskNotesJson = riskNotes.length > 0 ? JSON.stringify(riskNotes) : null
    }

    // Find the repository ID for the project
    const projectRepo = await db.projectGithubRepository.findFirst({
      where: { projectId },
    })

    // Create or update the daily summary
    const existingSummary = await db.githubCommitDailySummary.findFirst({
      where: {
        projectId,
        repositoryId: projectRepo?.repositoryId ?? null,
        summaryDate: startOfDay,
      },
    })

    if (existingSummary) {
      return await db.githubCommitDailySummary.update({
        where: { id: existingSummary.id },
        data: {
          totalCommits,
          authorsJson: JSON.stringify(Array.from(authorsSet)),
          changedFilesCount: totalChangedFiles,
          aiSummaryMarkdown,
          riskNotesJson,
          generatedBy,
        },
      })
    }

    return await db.githubCommitDailySummary.create({
      data: {
        projectId,
        repositoryId: projectRepo?.repositoryId ?? null,
        summaryDate: startOfDay,
        totalCommits,
        authorsJson: JSON.stringify(Array.from(authorsSet)),
        changedFilesCount: totalChangedFiles,
        aiSummaryMarkdown,
        riskNotesJson,
        generatedBy,
      },
    })
  } catch (error) {
    console.error('[GitHubService] Error generating daily summary:', error)
    throw error
  }
}

function generateRuleBasedSummary(
  totalCommits: number,
  authors: string[],
  changedFiles: number,
  commits: { message: string; additions?: number | null; deletions?: number | null }[]
): string {
  const totalAdditions = commits.reduce((sum, c) => sum + (c.additions ?? 0), 0)
  const totalDeletions = commits.reduce((sum, c) => sum + (c.deletions ?? 0), 0)

  const lines = [
    `## Daily Commit Summary`,
    ``,
    `- **Total commits:** ${totalCommits}`,
    `- **Contributors:** ${authors.join(', ')}`,
    `- **Files changed:** ${changedFiles}`,
    `- **Lines added:** +${totalAdditions}`,
    `- **Lines removed:** -${totalDeletions}`,
    ``,
  ]

  if (totalCommits > 10) {
    lines.push('> ⚠️ High commit activity detected. Consider reviewing for integration risks.')
  }

  return lines.join('\n')
}

function generateRuleBasedRiskNotes(
  commits: { message: string; additions?: number | null; deletions?: number | null }[]
): string[] {
  const notes: string[] = []

  for (const commit of commits) {
    const msg = commit.message.toLowerCase()
    if (msg.includes('fix') || msg.includes('hotfix') || msg.includes('patch')) {
      notes.push(`Bug fix commit detected: "${commit.message.substring(0, 80)}"`)
    }
    if ((commit.additions ?? 0) > 500) {
      notes.push(`Large addition in commit: "${commit.message.substring(0, 80)}" (+${commit.additions} lines)`)
    }
    if ((commit.deletions ?? 0) > 200) {
      notes.push(`Large deletion in commit: "${commit.message.substring(0, 80)}" (-${commit.deletions} lines)`)
    }
  }

  return notes
}

/**
 * Get commits for a project with filtering and pagination.
 */
export async function getProjectCommits(
  projectId: string,
  options: {
    branch?: string
    since?: Date
    until?: Date
    page?: number
    limit?: number
  } = {}
): Promise<{ items: unknown[]; total: number }> {
  const page = options.page ?? 1
  const limit = options.limit ?? 20
  const skip = (page - 1) * limit

  try {
    // Get repository IDs for the project
    const projectRepos = await db.projectGithubRepository.findMany({
      where: { projectId },
      select: { repositoryId: true },
    })

    const repositoryIds = projectRepos.map(pr => pr.repositoryId)
    if (repositoryIds.length === 0) {
      return { items: [], total: 0 }
    }

    const where = {
      repositoryId: { in: repositoryIds },
      ...(options.branch ? { branch: options.branch } : {}),
      ...(options.since || options.until
        ? {
            authorDate: {
              ...(options.since ? { gte: options.since } : {}),
              ...(options.until ? { lte: options.until } : {}),
            },
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      db.githubCommit.findMany({
        where,
        orderBy: { authorDate: 'desc' },
        skip,
        take: limit,
      }),
      db.githubCommit.count({ where }),
    ])

    return { items, total }
  } catch (error) {
    console.error('[GitHubService] Error getting project commits:', error)
    return { items: [], total: 0 }
  }
}

/**
 * Get daily summaries for a project.
 */
export async function getDailySummaries(
  projectId: string,
  options: { since?: Date; until?: Date } = {}
) {
  try {
    return await db.githubCommitDailySummary.findMany({
      where: {
        projectId,
        ...(options.since || options.until
          ? {
              summaryDate: {
                ...(options.since ? { gte: options.since } : {}),
                ...(options.until ? { lte: options.until } : {}),
              },
            }
          : {}),
      },
      orderBy: { summaryDate: 'desc' },
    })
  } catch (error) {
    console.error('[GitHubService] Error getting daily summaries:', error)
    return []
  }
}
