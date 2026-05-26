import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/dashboard/overdue - Get overdue work items and requests
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Overdue requests (due date passed, not completed)
    const overdueRequests = await db.request.findMany({
      where: {
        dueDate: { lt: now },
        status: { notIn: ['COMPLETED', 'CLOSED', 'REJECTED'] },
      },
      include: {
        project: {
          select: { id: true, name: true, code: true },
        },
        assignedBA: {
          select: { id: true, name: true, email: true },
        },
        assignedDev: {
          select: { id: true, name: true, email: true },
        },
        assignedQA: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    })

    // Overdue work items (due date passed, not completed)
    const overdueWorkItems = await db.workItem.findMany({
      where: {
        dueDate: { lt: now },
        status: { notIn: ['DEPLOYED', 'SUBMITTED', 'REJECTED'] },
      },
      include: {
        request: {
          select: { id: true, title: true, code: true },
        },
        assignments: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    })

    return NextResponse.json({
      overdueRequests,
      overdueWorkItems,
      summary: {
        totalOverdueRequests: overdueRequests.length,
        totalOverdueWorkItems: overdueWorkItems.length,
      },
    })
  } catch (error) {
    console.error('Get overdue error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
