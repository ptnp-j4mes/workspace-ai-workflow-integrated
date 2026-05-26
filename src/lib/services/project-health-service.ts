// ============================================================
// Project Health Service - Health Score Calculation & Monitoring
// ============================================================

import { db } from '@/lib/db'
import { logAudit } from './audit-service'

/**
 * Calculate the health score for a project.
 * Score is based on:
 * - Overdue items (deductions for overdue work items)
 * - Pending approvals (deductions for long-pending approvals)
 * - Open defects (deductions for open/critical bugs)
 * - UAT fail rate (deductions for high failure rates)
 * - Stale activity (deductions for no recent activity)
 * - Blocked items (deductions for blocked work items)
 * - Pending handoffs (deductions for pending handoffs)
 *
 * Returns a score between 0 and 100.
 */
export async function calculateHealthScore(projectId: string): Promise<number> {
  try {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600000)

    let deductions = 0

    // 1. Overdue work items (up to 25 points deduction)
    const overdueWorkItems = await db.workItem.count({
      where: {
        projectId,
        dueDate: { lt: now },
        status: { notIn: ['COMPLETED', 'DEPLOYED', 'CLOSED'] },
      },
    })
    const overdueDeduction = Math.min(25, overdueWorkItems * 5)
    deductions += overdueDeduction

    // 2. Pending approvals (up to 15 points deduction)
    const pendingApprovals = await db.approvalInstance.count({
      where: {
        entityType: 'PROJECT',
        entityId: projectId,
        status: 'PENDING',
        requestedAt: { lt: sevenDaysAgo },
      },
    })
    const approvalDeduction = Math.min(15, pendingApprovals * 5)
    deductions += approvalDeduction

    // 3. Open defects / bug reports (up to 20 points deduction)
    const criticalBugs = await db.bugReport.count({
      where: {
        projectId,
        severity: 'CRITICAL',
        status: { in: ['OPEN', 'INVESTIGATING', 'FIXING'] },
      },
    })
    const highBugs = await db.bugReport.count({
      where: {
        projectId,
        severity: 'HIGH',
        status: { in: ['OPEN', 'INVESTIGATING', 'FIXING'] },
      },
    })
    const otherBugs = await db.bugReport.count({
      where: {
        projectId,
        severity: { in: ['MEDIUM', 'LOW'] },
        status: { in: ['OPEN', 'INVESTIGATING', 'FIXING'] },
      },
    })
    const bugDeduction = Math.min(20, criticalBugs * 10 + highBugs * 5 + otherBugs * 2)
    deductions += bugDeduction

    // 4. UAT fail rate (up to 15 points deduction)
    const totalTestResults = await db.uatTestResult.count({
      where: {
        testCase: {
          uatCycle: { projectId },
        },
      },
    })
    const failedTestResults = await db.uatTestResult.count({
      where: {
        status: 'FAILED',
        testCase: {
          uatCycle: { projectId },
        },
      },
    })

    if (totalTestResults > 0) {
      const failRate = failedTestResults / totalTestResults
      const uatDeduction = Math.min(15, Math.round(failRate * 30))
      deductions += uatDeduction
    }

    // 5. Stale activity - no work items updated in the last 7 days (up to 10 points)
    const recentWorkItems = await db.workItem.count({
      where: {
        projectId,
        updatedAt: { gte: sevenDaysAgo },
      },
    })
    const totalWorkItems = await db.workItem.count({
      where: { projectId },
    })

    if (totalWorkItems > 0 && recentWorkItems === 0) {
      // Check if there are any active items that should have been updated
      const activeWorkItems = await db.workItem.count({
        where: {
          projectId,
          status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
        },
      })
      if (activeWorkItems > 0) {
        deductions += 10
      }
    } else if (totalWorkItems > 0) {
      const activityRatio = recentWorkItems / totalWorkItems
      if (activityRatio < 0.1) {
        deductions += 5
      }
    }

    // 6. Blocked items (work items with RETURNED status, up to 10 points)
    const returnedWorkItems = await db.workItem.count({
      where: {
        projectId,
        status: 'RETURNED',
      },
    })
    const blockedDeduction = Math.min(10, returnedWorkItems * 3)
    deductions += blockedDeduction

    // 7. Pending handoffs (up to 5 points)
    const pendingHandoffs = await db.workItemHandoff.count({
      where: {
        workItem: { projectId },
        status: 'PENDING',
        createdAt: { lt: sevenDaysAgo },
      },
    })
    const handoffDeduction = Math.min(5, pendingHandoffs * 2)
    deductions += handoffDeduction

    // Calculate final score
    const score = Math.max(0, Math.min(100, 100 - deductions))
    return score
  } catch (error) {
    console.error('[ProjectHealthService] Error calculating health score:', error)
    return 50 // Default to middle score on error
  }
}

/**
 * Recalculate the health score for a project and persist it.
 */
export async function recalculateHealth(projectId: string): Promise<void> {
  try {
    const healthScore = await calculateHealthScore(projectId)

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { healthScore: true },
    })

    const oldScore = project?.healthScore ?? null

    await db.project.update({
      where: { id: projectId },
      data: { healthScore },
    })

    // Audit log for significant changes
    if (oldScore !== null && Math.abs(oldScore - healthScore) >= 10) {
      await logAudit({
        action: 'HEALTH_SCORE_CHANGE',
        entity: 'Project',
        entityId: projectId,
        oldValue: { healthScore: oldScore },
        newValue: { healthScore },
      })
    }
  } catch (error) {
    console.error('[ProjectHealthService] Error recalculating health:', error)
    throw error
  }
}
