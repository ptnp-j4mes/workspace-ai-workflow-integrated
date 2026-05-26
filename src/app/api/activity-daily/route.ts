import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/activity-daily - List activity daily records with filtering
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    return NextResponse.json({
      records: parsedRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    })
  } catch (error) {
    console.error('Get activity daily list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/activity-daily - Create or update activity daily record (upsert)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      return NextResponse.json(
        { error: 'userId and date are required' },
        { status: 400 }
      )
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

    return NextResponse.json({ record: parsedRecord })
  } catch (error) {
    console.error('Create/update activity daily error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
