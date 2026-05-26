// ============================================================
// Action Inbox Service - Aggregated Actionable Items for Users
// ============================================================

import { db } from '@/lib/db'

interface ActionInboxItem {
  id: string
  type: string
  title: string
  description: string
  aitNo?: string | null
  link: string
  priority: string
  dueDate?: Date | null
  createdAt: Date
}

interface ActionInboxOptions {
  page?: number
  limit?: number
}

/**
 * Get the aggregated action inbox for a user.
 * Collects actionable items from:
 * - Pending approvals
 * - MIT items assigned but not yet accepted
 * - Work item handoffs pending
 * - Overdue work items
 * - UAT defects assigned to user
 */
export async function getActionInbox(
  userId: string,
  options: ActionInboxOptions = {}
): Promise<{ items: ActionInboxItem[]; total: number }> {
  const page = options.page ?? 1
  const limit = options.limit ?? 20

  try {
    const allItems: ActionInboxItem[] = []

    // 1. Pending approvals where the user can approve
    const pendingApprovals = await getPendingApprovalItems(userId)
    allItems.push(...pendingApprovals)

    // 2. MIT items assigned to user but not yet accepted
    const mitItems = await getMitPendingItems(userId)
    allItems.push(...mitItems)

    // 3. Work item handoffs pending for the user
    const handoffItems = await getPendingHandoffItems(userId)
    allItems.push(...handoffItems)

    // 4. Overdue work items assigned to user
    const overdueItems = await getOverdueWorkItems(userId)
    allItems.push(...overdueItems)

    // 5. UAT defects assigned to user (bug reports related to their work)
    const uatDefects = await getUatDefectItems(userId)
    allItems.push(...uatDefects)

    // Sort by priority and date
    const priorityOrder: Record<string, number> = {
      URGENT: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    }

    allItems.sort((a, b) => {
      const priorityA = priorityOrder[a.priority] ?? 3
      const priorityB = priorityOrder[b.priority] ?? 3
      if (priorityA !== priorityB) return priorityA - priorityB
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    // Paginate
    const total = allItems.length
    const start = (page - 1) * limit
    const items = allItems.slice(start, start + limit)

    return { items, total }
  } catch (error) {
    console.error('[ActionInboxService] Error getting action inbox:', error)
    return { items: [], total: 0 }
  }
}

/**
 * Dismiss an action item from the inbox.
 */
export async function dismissActionItem(
  itemId: string,
  itemType: string,
  userId: string
): Promise<void> {
  try {
    // Mark the notification as read for this item
    switch (itemType) {
      case 'APPROVAL_PENDING': {
        // Mark the approval notification as read
        await db.notification.updateMany({
          where: {
            userId,
            entityType: 'ApprovalInstance',
            entityId: itemId,
            isRead: false,
          },
          data: { isRead: true },
        })
        break
      }
      case 'MIT_PENDING': {
        await db.notification.updateMany({
          where: {
            userId,
            entityType: 'MIT',
            entityId: itemId,
            isRead: false,
          },
          data: { isRead: true },
        })
        break
      }
      case 'HANDOFF_PENDING': {
        await db.notification.updateMany({
          where: {
            userId,
            entityType: 'WorkItemHandoff',
            entityId: itemId,
            isRead: false,
          },
          data: { isRead: true },
        })
        break
      }
      case 'WORK_ITEM_OVERDUE': {
        await db.notification.updateMany({
          where: {
            userId,
            entityType: 'WorkItem',
            entityId: itemId,
            isRead: false,
          },
          data: { isRead: true },
        })
        break
      }
      case 'UAT_DEFECT': {
        await db.notification.updateMany({
          where: {
            userId,
            entityType: 'BugReport',
            entityId: itemId,
            isRead: false,
          },
          data: { isRead: true },
        })
        break
      }
      default:
        console.warn(`[ActionInboxService] Unknown item type for dismissal: ${itemType}`)
    }
  } catch (error) {
    console.error('[ActionInboxService] Error dismissing action item:', error)
  }
}

// ============================================================
// Helper functions to gather action items
// ============================================================

async function getPendingApprovalItems(userId: string): Promise<ActionInboxItem[]> {
  try {
    const userRoles = await db.userRole.findMany({
      where: { userId },
      select: { role: { select: { key: true } } },
    })
    const roleKeys = userRoles.map(ur => ur.role.key)

    const instances = await db.approvalInstance.findMany({
      where: {
        status: 'PENDING',
        OR: [
          { workflow: { steps: { some: { approverUserId: userId } } } },
          { workflow: { steps: { some: { approverRole: { in: roleKeys } } } } },
        ],
      },
      include: {
        workflow: { select: { name: true } },
      },
      take: 20,
    })

    return instances.map(instance => ({
      id: instance.id,
      type: 'APPROVAL_PENDING',
      title: `Approval Required: ${instance.workflow.name}`,
      description: `Entity ${instance.entityType} requires your approval${instance.aitNo ? ` (AIT: ${instance.aitNo})` : ''}`,
      aitNo: instance.aitNo,
      link: `/approvals/${instance.id}`,
      priority: 'HIGH',
      dueDate: null,
      createdAt: instance.requestedAt,
    }))
  } catch {
    return []
  }
}

async function getMitPendingItems(userId: string): Promise<ActionInboxItem[]> {
  try {
    const assignments = await db.mitStepAssignment.findMany({
      where: {
        assigneeId: userId,
        status: { in: ['ASSIGNED', 'PENDING'] },
      },
      include: {
        workItem: { select: { title: true, aitNo: true, dueDate: true, priority: true } },
      },
      take: 20,
    })

    return assignments.map(assignment => ({
      id: assignment.id,
      type: 'MIT_PENDING',
      title: `MIT ${assignment.step} Step: ${assignment.workItem.title}`,
      description: `You have been assigned to the ${assignment.step} step of this work item. Please accept or reject.`,
      aitNo: assignment.workItem.aitNo,
      link: `/work-items/${assignment.workItemId}`,
      priority: assignment.workItem.priority ?? 'MEDIUM',
      dueDate: assignment.workItem.dueDate,
      createdAt: assignment.assignedAt ?? assignment.createdAt,
    }))
  } catch {
    return []
  }
}

async function getPendingHandoffItems(userId: string): Promise<ActionInboxItem[]> {
  try {
    const handoffs = await db.workItemHandoff.findMany({
      where: {
        toUserId: userId,
        status: 'PENDING',
      },
      include: {
        workItem: { select: { title: true, aitNo: true, dueDate: true, priority: true } },
      },
      take: 20,
    })

    return handoffs.map(handoff => ({
      id: handoff.id,
      type: 'HANDOFF_PENDING',
      title: `Handoff: ${handoff.workItem.title}`,
      description: `${handoff.fromRole ?? 'Previous step'} → ${handoff.toRole ?? 'Next step'} handoff pending. ${handoff.handoffNote ?? ''}`,
      aitNo: handoff.workItem.aitNo,
      link: `/work-items/${handoff.workItemId}`,
      priority: handoff.workItem.priority ?? 'MEDIUM',
      dueDate: handoff.workItem.dueDate,
      createdAt: handoff.createdAt,
    }))
  } catch {
    return []
  }
}

async function getOverdueWorkItems(userId: string): Promise<ActionInboxItem[]> {
  try {
    const now = new Date()

    const assignments = await db.workItemAssignment.findMany({
      where: {
        userId,
        isActive: true,
        workItem: {
          dueDate: { lt: now },
          status: { notIn: ['COMPLETED', 'DEPLOYED', 'CLOSED'] },
        },
      },
      include: {
        workItem: { select: { id: true, title: true, aitNo: true, dueDate: true, priority: true } },
      },
      take: 20,
    })

    return assignments.map(assignment => ({
      id: assignment.workItem.id,
      type: 'WORK_ITEM_OVERDUE',
      title: `Overdue: ${assignment.workItem.title}`,
      description: `This work item is past its due date${assignment.workItem.aitNo ? ` (AIT: ${assignment.workItem.aitNo})` : ''}`,
      aitNo: assignment.workItem.aitNo,
      link: `/work-items/${assignment.workItem.id}`,
      priority: 'URGENT',
      dueDate: assignment.workItem.dueDate,
      createdAt: assignment.assignedAt,
    }))
  } catch {
    return []
  }
}

async function getUatDefectItems(userId: string): Promise<ActionInboxItem[]> {
  try {
    // Find bug reports from UAT cycles where the user is the assigned developer
    const workItems = await db.workItemAssignment.findMany({
      where: {
        userId,
        isActive: true,
        role: { in: ['DEVELOPER', 'FULLSTACK'] },
      },
      select: { workItemId: true },
    })

    const workItemIds = workItems.map(wi => wi.workItemId)

    if (workItemIds.length === 0) return []

    const bugs = await db.bugReport.findMany({
      where: {
        status: { in: ['OPEN', 'INVESTIGATING', 'FIXING'] },
        requestId: {
          in: (await db.workItem.findMany({
            where: { id: { in: workItemIds }, requestId: { not: null } },
            select: { requestId: true },
          })).map(wi => wi.requestId).filter((id): id is string => id !== null),
        },
      },
      take: 20,
    })

    return bugs.map(bug => ({
      id: bug.id,
      type: 'UAT_DEFECT',
      title: `UAT Defect: ${bug.title}`,
      description: `Severity: ${bug.severity}. ${bug.description.substring(0, 100)}${bug.aitNo ? ` (AIT: ${bug.aitNo})` : ''}`,
      aitNo: bug.aitNo,
      link: `/bugs/${bug.id}`,
      priority: bug.severity === 'CRITICAL' ? 'URGENT' : bug.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
      dueDate: null,
      createdAt: bug.createdAt,
    }))
  } catch {
    return []
  }
}
