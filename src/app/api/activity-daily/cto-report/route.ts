import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/activity-daily/cto-report - CTO daily/weekly activity report
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    return NextResponse.json({
      summary,
      byUser,
      byDepartment,
      dailyTrend,
      aiUsageDistribution,
    })
  } catch (error) {
    console.error('Get CTO report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
