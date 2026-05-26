import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/activity-daily/git-summary - Auto-generate activity summary from git commits
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const dateStr = url.searchParams.get('date')

    if (!userId || !dateStr) {
      return NextResponse.json(
        { error: 'userId and date query parameters are required' },
        { status: 400 }
      )
    }

    // Look up the user's info for matching commit authors
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        githubConnections: {
          where: { isActive: true },
          select: {
            id: true,
            repositories: {
              select: {
                id: true,
                fullName: true,
                projectRepos: {
                  select: {
                    projectId: true,
                    project: {
                      select: { id: true, name: true, code: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Build date range for the given date (start of day to end of day)
    const targetDate = new Date(dateStr)
    const nextDay = new Date(targetDate)
    nextDay.setDate(nextDay.getDate() + 1)

    // Find GithubCommit records for that user on that date
    // Match by authorEmail or authorName
    const commits = await db.githubCommit.findMany({
      where: {
        OR: [
          { authorEmail: targetUser.email },
          { authorName: targetUser.name },
        ],
        authorDate: {
          gte: targetDate,
          lt: nextDay,
        },
      },
      include: {
        repository: {
          select: {
            id: true,
            fullName: true,
            projectRepos: {
              select: {
                projectId: true,
                project: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
          },
        },
      },
      orderBy: { authorDate: 'asc' },
    })

    if (commits.length === 0) {
      return NextResponse.json({
        commitCount: 0,
        commitSummary: '',
        projectEntries: [],
      })
    }

    // Build a map of repository -> project info
    const repoProjectMap = new Map<
      string,
      { projectId: string; projectName: string; projectCode: string } | null
    >()

    // Also include projects from user's github connections
    for (const conn of targetUser.githubConnections) {
      for (const repo of conn.repositories) {
        if (repo.projectRepos.length > 0) {
          const primaryRepo = repo.projectRepos[0]
          repoProjectMap.set(repo.id, {
            projectId: primaryRepo.project.id,
            projectName: primaryRepo.project.name,
            projectCode: primaryRepo.project.code,
          })
        }
      }
    }

    // Group commits by project
    const projectCommitMap = new Map<
      string,
      {
        projectId: string
        projectName: string
        projectCode: string
        commits: { sha: string; message: string }[]
      }
    >()

    for (const commit of commits) {
      // Find the project for this commit's repository
      let projectInfo = repoProjectMap.get(commit.repositoryId) || null

      // Also check the commit's repository's projectRepos directly
      if (!projectInfo && commit.repository.projectRepos.length > 0) {
        const primaryRepo = commit.repository.projectRepos[0]
        projectInfo = {
          projectId: primaryRepo.project.id,
          projectName: primaryRepo.project.name,
          projectCode: primaryRepo.project.code,
        }
      }

      const projectKey = projectInfo?.projectId || `repo-${commit.repositoryId}`
      const existing = projectCommitMap.get(projectKey)

      if (existing) {
        existing.commits.push({ sha: commit.sha, message: commit.message })
      } else {
        projectCommitMap.set(projectKey, {
          projectId: projectInfo?.projectId || '',
          projectName: projectInfo?.projectName || commit.repository.fullName,
          projectCode: projectInfo?.projectCode || '',
          commits: [{ sha: commit.sha, message: commit.message }],
        })
      }
    }

    // Build projectEntries
    const projectEntries = Array.from(projectCommitMap.values()).map((entry) => ({
      projectId: entry.projectId,
      projectName: entry.projectName,
      hours: 0, // User must fill this in manually
      aiHours: 0, // User must fill this in manually
      tasks: '', // User must fill this in manually
      commitCount: entry.commits.length,
      commitMessages: entry.commits.map((c) => {
        // Truncate long commit messages to first line
        const firstLine = c.message.split('\n')[0].trim()
        return firstLine.length > 100 ? firstLine.substring(0, 97) + '...' : firstLine
      }),
    }))

    // Build commit summary text
    const projectSummaries = Array.from(projectCommitMap.values()).map((entry) => {
      const messages = entry.commits
        .map((c) => c.message.split('\n')[0].trim())
        .join(', ')
      return `${entry.projectName} (${entry.commits.length} commit${entry.commits.length > 1 ? 's' : ''}: ${messages})`
    })

    const commitSummary = `${commits.length} commit${commits.length > 1 ? 's' : ''} across ${projectCommitMap.size} project${projectCommitMap.size > 1 ? 's' : ''}: ${projectSummaries.join(', ')}`

    return NextResponse.json({
      commitCount: commits.length,
      commitSummary,
      projectEntries,
    })
  } catch (error) {
    console.error('Get git summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
