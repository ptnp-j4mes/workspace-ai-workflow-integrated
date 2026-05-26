import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getDailySummaries, generateDailySummary } from '@/lib/services/github-service'

// GET /api/projects/[id]/github/daily-summaries - Get daily summaries
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since') ? new Date(searchParams.get('since')!) : undefined
    const until = searchParams.get('until') ? new Date(searchParams.get('until')!) : undefined

    const summaries = await getDailySummaries(id, { since, until })

    return NextResponse.json({ data: summaries })
  } catch (error) {
    console.error('Get daily summaries error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/github/daily-summaries - Generate daily summary for a specific date
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const dateStr = body.date

    if (!dateStr) {
      return NextResponse.json(
        { error: 'date is required (e.g. "2026-01-15")' },
        { status: 400 }
      )
    }

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    const summary = await generateDailySummary(id, date)

    return NextResponse.json({ data: summary }, { status: 201 })
  } catch (error) {
    console.error('Generate daily summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
