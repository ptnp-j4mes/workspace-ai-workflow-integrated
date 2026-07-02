import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'

export const activityDailyRoutes = new Elysia({ prefix: '/api/activity-daily' })
  // GET /api/activity-daily - List activity daily records with filtering
  .get('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const url = new URL(request.url)
      const userId = url.searchParams.get('userId')
      const dateFrom = url.searchParams.get('dateFrom')
      const dateTo = url.searchParams.get('dateTo')
      const status = url.searchParams.get('status')
      const page = parseInt(url.searchParams.get('page') || '1', 10)
      const limit = parseInt(url.searchParams.get('limit') || '20', 10)

      // Build where clause
      const where: Record<string, unknown> = {}

      if (userId) {
        where.userId = userId
      }

      if (dateFrom || dateTo) {
        const dateFilter: Record<string, Date> = {}
        if (dateFrom) {
          dateFilter.gte = new Date(dateFrom)
        }
        if (dateTo) {
          // Use lt with the next day to include the entire end date
          const endDate = new Date(dateTo)
          endDate.setDate(endDate.getDate() + 1)
          dateFilter.lt = endDate
        }
        where.date = dateFilter
      }

      if (status) {
        where.status = status
      }

      const skip = (page - 1) * limit

      const [records, total] = await Promise.all([
        db.activityDaily.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                department: { select: { id: true, name: true } },
              },
            },
            approvedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          skip,
          take: limit,
        }),
        db.activityDaily.count({ where }),
      ])

      // Calculate summary stats for the filtered set
      const allFiltered = await db.activityDaily.findMany({
        where,
        select: {
          totalWorkHours: true,
          aiUsageHours: true,
          aiUsagePercentage: true,
          kpiMet: true,
          commitCount: true,
        },
      })

      const summary = {
        totalReports: allFiltered.length,
        totalWorkHours: allFiltered.reduce((sum, r) => sum + r.totalWorkHours, 0),
        totalAiHours: allFiltered.reduce((sum, r) => sum + r.aiUsageHours, 0),
        avgAiUsagePercentage:
          allFiltered.length > 0
            ? Math.round(
                (allFiltered.reduce((sum, r) => sum + r.aiUsagePercentage, 0) /
                  allFiltered.length) *
                  100
              ) / 100
            : 0,
        kpiMetCount: allFiltered.filter((r) => r.kpiMet).length,
        totalCommits: allFiltered.reduce((sum, r) => sum + r.commitCount, 0),
      }

      // Parse projectEntries JSON for each record
      const parsedRecords = records.map((record) => ({
        ...record,
        projectEntries: record.projectEntries ? JSON.parse(record.projectEntries) : [],
      }))

      return {
        records: parsedRecords,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        summary,
      }
    } catch (error) {
      console.error('Get activity daily list error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/activity-daily - Create or update activity daily record (upsert)
  .post('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const {
        userId,
        date,
        totalWorkHours,
        aiUsageHours,
        summary: summaryText,
        projectEntries,
        status,
      } = body

      if (!userId || !date) {
        set.status = 400
        return { error: 'userId and date are required' }
      }

      // Auto-calculate AI usage percentage
      const workHours = totalWorkHours ?? 8
      const aiHours = aiUsageHours ?? 0
      const aiUsagePercentage =
        workHours > 0 ? Math.round((aiHours / workHours) * 10000) / 100 : 0

      // KPI target default 25%
      const kpiTargetPercentage = body.kpiTargetPercentage ?? 25
      const kpiMet = aiUsagePercentage >= kpiTargetPercentage

      // Stringify projectEntries if it's an array/object
      const projectEntriesStr = projectEntries
        ? typeof projectEntries === 'string'
          ? projectEntries
          : JSON.stringify(projectEntries)
        : null

      // Count commits from projectEntries
      let commitCount = 0
      if (projectEntries) {
        const entries =
          typeof projectEntries === 'string'
            ? JSON.parse(projectEntries)
            : projectEntries
        commitCount = entries.reduce(
          (sum: number, e: { commitCount?: number }) => sum + (e.commitCount || 0),
          0
        )
      }

      // Upsert on (userId, date) unique constraint
      const dateObj = new Date(date)

      const record = await db.activityDaily.upsert({
        where: {
          userId_date: {
            userId,
            date: dateObj,
          },
        },
        update: {
          totalWorkHours: workHours,
          aiUsageHours: aiHours,
          aiUsagePercentage,
          kpiTargetPercentage,
          kpiMet,
          summary: summaryText ?? null,
          projectEntries: projectEntriesStr,
          commitCount,
          status: status ?? 'DRAFT',
        },
        create: {
          userId,
          date: dateObj,
          totalWorkHours: workHours,
          aiUsageHours: aiHours,
          aiUsagePercentage,
          kpiTargetPercentage,
          kpiMet,
          summary: summaryText ?? null,
          projectEntries: projectEntriesStr,
          commitCount,
          status: status ?? 'DRAFT',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              department: { select: { id: true, name: true } },
            },
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      // Parse projectEntries for response
      const parsedRecord = {
        ...record,
        projectEntries: record.projectEntries ? JSON.parse(record.projectEntries) : [],
      }

      return { record: parsedRecord }
    } catch (error) {
      console.error('Create/update activity daily error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/activity-daily/cto-report - CTO daily/weekly activity report
  .get('/cto-report', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const url = new URL(request.url)
      const dateFrom = url.searchParams.get('dateFrom')
      const dateTo = url.searchParams.get('dateTo')
      const department = url.searchParams.get('department')

      // Default to last 7 days if no date range provided
      const now = new Date()
      const defaultFrom = new Date(now)
      defaultFrom.setDate(defaultFrom.getDate() - 6)
      defaultFrom.setHours(0, 0, 0, 0)

      const fromDate = dateFrom ? new Date(dateFrom) : defaultFrom
      const toDate = dateTo ? new Date(dateTo) : now

      // Build where clause for ActivityDaily
      const dateFilter: Record<string, Date> = {
        gte: fromDate,
      }
      // Include the entire end date
      const toDateNext = new Date(toDate)
      toDateNext.setDate(toDateNext.getDate() + 1)
      dateFilter.lt = toDateNext

      const where: Record<string, unknown> = {
        date: dateFilter,
      }

      // If department filter, find users in that department first
      let departmentUserIds: string[] | null = null
      if (department) {
        const deptUsers = await db.user.findMany({
          where: {
            department: { name: department },
            isActive: true,
          },
          select: { id: true },
        })
        departmentUserIds = deptUsers.map((u) => u.id)
        where.userId = { in: departmentUserIds }
      }

      // Fetch all matching records with user info
      const records = await db.activityDaily.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              position: true,
              department: { select: { id: true, name: true } },
              roles: {
                include: {
                  role: { select: { key: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: [{ date: 'asc' }],
      })

      // ===== SUMMARY =====
      const totalReports = records.length
      const totalWorkHours = records.reduce((sum, r) => sum + r.totalWorkHours, 0)
      const totalAiHours = records.reduce((sum, r) => sum + r.aiUsageHours, 0)
      const avgAiUsagePercentage =
        totalReports > 0
          ? Math.round(
              (records.reduce((sum, r) => sum + r.aiUsagePercentage, 0) / totalReports) *
                100
            ) / 100
          : 0
      const kpiMetCount = records.filter((r) => r.kpiMet).length
      const kpiMetRate =
        totalReports > 0 ? Math.round((kpiMetCount / totalReports) * 10000) / 100 : 0
      const totalCommits = records.reduce((sum, r) => sum + r.commitCount, 0)

      const summary = {
        totalReports,
        totalWorkHours: Math.round(totalWorkHours * 100) / 100,
        totalAiHours: Math.round(totalAiHours * 100) / 100,
        avgAiUsagePercentage,
        kpiMetCount,
        kpiMetRate,
        totalCommits,
      }

      // ===== BY USER =====
      const userMap = new Map<
        string,
        {
          userId: string
          userName: string
          userEmail: string
          avatarUrl: string | null
          department: string
          role: string
          totalWorkHours: number
          totalAiHours: number
          kpiMetCount: number
          kpiNotMetCount: number
          totalCommits: number
          dailyEntries: {
            date: string
            totalWorkHours: number
            aiUsageHours: number
            aiUsagePercentage: number
            kpiMet: boolean
            commitCount: number
            summary: string | null
          }[]
        }
      >()

      for (const record of records) {
        const existing = userMap.get(record.userId)
        const primaryRole = record.user.roles?.[0]?.role?.key || 'VIEWER'
        const deptName = record.user.department?.name || 'N/A'
        const dateStr = record.date.toISOString().split('T')[0]

        const dailyEntry = {
          date: dateStr,
          totalWorkHours: record.totalWorkHours,
          aiUsageHours: record.aiUsageHours,
          aiUsagePercentage: record.aiUsagePercentage,
          kpiMet: record.kpiMet,
          commitCount: record.commitCount,
          summary: record.summary,
        }

        if (existing) {
          existing.totalWorkHours += record.totalWorkHours
          existing.totalAiHours += record.aiUsageHours
          existing.totalCommits += record.commitCount
          if (record.kpiMet) {
            existing.kpiMetCount += 1
          } else {
            existing.kpiNotMetCount += 1
          }
          existing.dailyEntries.push(dailyEntry)
        } else {
          userMap.set(record.userId, {
            userId: record.userId,
            userName: record.user.name,
            userEmail: record.user.email,
            avatarUrl: record.user.avatarUrl,
            department: deptName,
            role: primaryRole,
            totalWorkHours: record.totalWorkHours,
            totalAiHours: record.aiUsageHours,
            kpiMetCount: record.kpiMet ? 1 : 0,
            kpiNotMetCount: record.kpiMet ? 0 : 1,
            totalCommits: record.commitCount,
            dailyEntries: [dailyEntry],
          })
        }
      }

      const byUser = Array.from(userMap.values()).map((u) => ({
        ...u,
        totalWorkHours: Math.round(u.totalWorkHours * 100) / 100,
        totalAiHours: Math.round(u.totalAiHours * 100) / 100,
        avgAiUsagePercentage:
          u.totalWorkHours > 0
            ? Math.round((u.totalAiHours / u.totalWorkHours) * 10000) / 100
            : 0,
      }))

      // ===== BY DEPARTMENT =====
      const deptMap = new Map<
        string,
        {
          department: string
          userCount: number
          totalWorkHours: number
          totalAiHours: number
          kpiMetCount: number
          kpiNotMetCount: number
        }
      >()

      for (const record of records) {
        const deptName = record.user.department?.name || 'N/A'
        const existing = deptMap.get(deptName)

        if (existing) {
          existing.totalWorkHours += record.totalWorkHours
          existing.totalAiHours += record.aiUsageHours
          if (record.kpiMet) {
            existing.kpiMetCount += 1
          } else {
            existing.kpiNotMetCount += 1
          }
        } else {
          deptMap.set(deptName, {
            department: deptName,
            userCount: 0,
            totalWorkHours: record.totalWorkHours,
            totalAiHours: record.aiUsageHours,
            kpiMetCount: record.kpiMet ? 1 : 0,
            kpiNotMetCount: record.kpiMet ? 0 : 1,
          })
        }
      }

      const byDepartment = Array.from(deptMap.values()).map((d) => {
        // Count unique users in this department from the records
        const uniqueUsers = new Set(
          records
            .filter((r) => (r.user.department?.name || 'N/A') === d.department)
            .map((r) => r.userId)
        )
        const totalReportsInDept = d.kpiMetCount + d.kpiNotMetCount

        return {
          department: d.department,
          userCount: uniqueUsers.size,
          totalWorkHours: Math.round(d.totalWorkHours * 100) / 100,
          totalAiHours: Math.round(d.totalAiHours * 100) / 100,
          avgAiUsagePercentage:
            d.totalWorkHours > 0
              ? Math.round((d.totalAiHours / d.totalWorkHours) * 10000) / 100
              : 0,
          kpiMetRate:
            totalReportsInDept > 0
              ? Math.round((d.kpiMetCount / totalReportsInDept) * 10000) / 100
              : 0,
        }
      })

      // ===== DAILY TREND =====
      const dayMap = new Map<
        string,
        {
          date: string
          totalWorkHours: number
          totalAiHours: number
          kpiMetCount: number
          kpiNotMetCount: number
          commitCount: number
        }
      >()

      for (const record of records) {
        const dateStr = record.date.toISOString().split('T')[0]
        const existing = dayMap.get(dateStr)

        if (existing) {
          existing.totalWorkHours += record.totalWorkHours
          existing.totalAiHours += record.aiUsageHours
          existing.commitCount += record.commitCount
          if (record.kpiMet) {
            existing.kpiMetCount += 1
          } else {
            existing.kpiNotMetCount += 1
          }
        } else {
          dayMap.set(dateStr, {
            date: dateStr,
            totalWorkHours: record.totalWorkHours,
            totalAiHours: record.aiUsageHours,
            kpiMetCount: record.kpiMet ? 1 : 0,
            kpiNotMetCount: record.kpiMet ? 0 : 1,
            commitCount: record.commitCount,
          })
        }
      }

      const dailyTrend = Array.from(dayMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => {
          const totalReportsInDay = d.kpiMetCount + d.kpiNotMetCount
          return {
            date: d.date,
            totalWorkHours: Math.round(d.totalWorkHours * 100) / 100,
            totalAiHours: Math.round(d.totalAiHours * 100) / 100,
            avgAiUsagePercentage:
              d.totalWorkHours > 0
                ? Math.round((d.totalAiHours / d.totalWorkHours) * 10000) / 100
                : 0,
            kpiMetRate:
              totalReportsInDay > 0
                ? Math.round((d.kpiMetCount / totalReportsInDay) * 10000) / 100
                : 0,
            commitCount: d.commitCount,
          }
        })

      // ===== AI USAGE DISTRIBUTION =====
      const ranges = [
        { range: '0-10%', min: 0, max: 10 },
        { range: '11-20%', min: 11, max: 20 },
        { range: '21-30%', min: 21, max: 30 },
        { range: '31-40%', min: 31, max: 40 },
        { range: '41-50%', min: 41, max: 50 },
        { range: '51-60%', min: 51, max: 60 },
        { range: '61-70%', min: 61, max: 70 },
        { range: '71-80%', min: 71, max: 80 },
        { range: '81-90%', min: 81, max: 90 },
        { range: '91-100%', min: 91, max: 100 },
      ]

      const aiUsageDistribution = ranges.map((r) => ({
        range: r.range,
        count: records.filter(
          (rec) => rec.aiUsagePercentage >= r.min && rec.aiUsagePercentage <= r.max
        ).length,
      }))

      return {
        summary,
        byUser,
        byDepartment,
        dailyTrend,
        aiUsageDistribution,
      }
    } catch (error) {
      console.error('Get CTO report error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/activity-daily/git-summary - Auto-generate activity summary from git commits
  .get('/git-summary', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const url = new URL(request.url)
      const userId = url.searchParams.get('userId')
      const dateStr = url.searchParams.get('date')

      if (!userId || !dateStr) {
        set.status = 400
        return { error: 'userId and date query parameters are required' }
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
        set.status = 404
        return { error: 'User not found' }
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
        return {
          commitCount: 0,
          commitSummary: '',
          projectEntries: [],
        }
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

      return {
        commitCount: commits.length,
        commitSummary,
        projectEntries,
      }
    } catch (error) {
      console.error('Get git summary error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/activity-daily/:id - Get single activity daily record by ID
  .get('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const record = await db.activityDaily.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              department: { select: { id: true, name: true } },
            },
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      if (!record) {
        set.status = 404
        return { error: 'Activity daily record not found' }
      }

      // Parse projectEntries JSON
      const parsedRecord = {
        ...record,
        projectEntries: record.projectEntries ? JSON.parse(record.projectEntries) : [],
      }

      return { record: parsedRecord }
    } catch (error) {
      console.error('Get activity daily error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // PATCH /api/activity-daily/:id - Update activity daily record
  .patch('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()

      const existing = await db.activityDaily.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Activity daily record not found' }
      }

      // Build update data
      const data: Record<string, unknown> = {}

      // Allow updating specific fields
      const allowedFields = [
        'totalWorkHours',
        'aiUsageHours',
        'summary',
        'commitSummary',
        'commitCount',
        'kpiTargetPercentage',
      ]

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          data[field] = body[field]
        }
      }

      // Handle projectEntries (JSON stringification)
      if (body.projectEntries !== undefined) {
        data.projectEntries =
          typeof body.projectEntries === 'string'
            ? body.projectEntries
            : JSON.stringify(body.projectEntries)
      }

      // Handle status changes with approval logic
      if (body.status !== undefined) {
        data.status = body.status

        // If status is APPROVED, set approver info
        if (body.status === 'APPROVED') {
          data.approvedById = user.id
          data.approvedAt = new Date()
        }

        // If status is changed from APPROVED back to something else, clear approver
        if (existing.status === 'APPROVED' && body.status !== 'APPROVED') {
          data.approvedById = null
          data.approvedAt = null
        }
      }

      // Recalculate derived fields if work hours or AI hours changed
      const newWorkHours = (data.totalWorkHours as number) ?? existing.totalWorkHours
      const newAiHours = (data.aiUsageHours as number) ?? existing.aiUsageHours
      const newKpiTarget =
        (data.kpiTargetPercentage as number) ?? existing.kpiTargetPercentage

      data.aiUsagePercentage =
        newWorkHours > 0
          ? Math.round((newAiHours / newWorkHours) * 10000) / 100
          : 0
      data.kpiMet = (data.aiUsagePercentage as number) >= newKpiTarget

      // Recalculate commitCount from projectEntries if provided
      if (body.projectEntries !== undefined) {
        const entries =
          typeof body.projectEntries === 'string'
            ? JSON.parse(body.projectEntries)
            : body.projectEntries
        data.commitCount = entries.reduce(
          (sum: number, e: { commitCount?: number }) => sum + (e.commitCount || 0),
          0
        )
      }

      const updated = await db.activityDaily.update({
        where: { id },
        data,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              department: { select: { id: true, name: true } },
            },
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      // Parse projectEntries for response
      const parsedRecord = {
        ...updated,
        projectEntries: updated.projectEntries ? JSON.parse(updated.projectEntries) : [],
      }

      return { record: parsedRecord }
    } catch (error) {
      console.error('Update activity daily error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // DELETE /api/activity-daily/:id - Delete activity daily record
  .delete('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const existing = await db.activityDaily.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Activity daily record not found' }
      }

      await db.activityDaily.delete({ where: { id } })

      return { message: 'Activity daily record deleted successfully' }
    } catch (error) {
      console.error('Delete activity daily error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
