// ============================================================
// MIT Assignment Service - Managed Item Tracking Step Assignments
// ============================================================

import { db } from '@/lib/db'
import { sendNotification } from './notification-service'
import { logAudit } from './audit-service'

/**
 * Role eligibility mapping for each MIT step.
 * BA step: BA, IT_MANAGER, FULLSTACK
 * DEV step: DEVELOPER, FULLSTACK
 * QA step: QA, FULLSTACK
 * UAT step: REQUESTER, APPROVER, QA, FULLSTACK
 * MA step: IT_MANAGER, DEVELOPER, FULLSTACK
 */
const STEP_ELIGIBLE_ROLES: Record<string, string[]> = {
  BA:  ['BA', 'IT_MANAGER', 'FULLSTACK'],
  DEV: ['DEVELOPER', 'FULLSTACK'],
  QA:  ['QA', 'FULLSTACK'],
  UAT: ['REQUESTER', 'APPROVER', 'QA', 'FULLSTACK'],
  MA:  ['IT_MANAGER', 'DEVELOPER', 'FULLSTACK'],
}

/**
 * Get the eligible roles for a given MIT step.
 */
export function getMitEligibleRoles(step: string): string[] {
  return STEP_ELIGIBLE_ROLES[step] ?? []
}

/**
 * Validate that a user has an eligible role for a given MIT step.
 */
async function validateRoleEligibility(
  userId: string,
  step: string
): Promise<boolean> {
  const eligibleRoles = getMitEligibleRoles(step)
  if (eligibleRoles.length === 0) return false

  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: { role: { select: { key: true } } },
  })

  return userRoles.some(ur => eligibleRoles.includes(ur.role.key))
}

/**
 * Assign a MIT step to a user.
 * Validates role eligibility, creates the MitStepAssignment,
 * updates the WorkItem status if needed, and sends notification.
 */
export async function assignMit(
  workItemId: string,
  step: string,
  assigneeId: string,
  assignedById: string
) {
  try {
    // Validate the step
    const validSteps = ['BA', 'DEV', 'QA', 'UAT', 'MA']
    if (!validSteps.includes(step)) {
      throw new Error(`Invalid MIT step: "${step}". Must be one of: ${validSteps.join(', ')}`)
    }

    // Validate role eligibility
    const isEligible = await validateRoleEligibility(assigneeId, step)
    if (!isEligible) {
      const eligibleRoles = getMitEligibleRoles(step)
      throw new Error(
        `User is not eligible for step "${step}". Required roles: ${eligibleRoles.join(', ')}`
      )
    }

    // Check if the work item exists
    const workItem = await db.workItem.findUnique({
      where: { id: workItemId },
    })
    if (!workItem) {
      throw new Error(`Work item "${workItemId}" not found`)
    }

    // Check if there's an existing assignment for this step
    const existingAssignment = await db.mitStepAssignment.findFirst({
      where: { workItemId, step, status: { in: ['PENDING', 'ASSIGNED', 'ACCEPTED'] } },
    })
    if (existingAssignment) {
      throw new Error(
        `Step "${step}" already has an active assignment for work item "${workItemId}"`
      )
    }

    // Create the MIT step assignment
    const assignment = await db.mitStepAssignment.create({
      data: {
        workItemId,
        step,
        assigneeId,
        status: 'ASSIGNED',
        assignedById,
        assignedAt: new Date(),
      },
    })

    // Update the work item status and current step if needed
    const updateData: Record<string, unknown> = {
      currentStep: step,
    }

    if (workItem.status === 'CREATED' || workItem.status === 'ASSIGNED') {
      updateData.status = 'ASSIGNED'
    }

    await db.workItem.update({
      where: { id: workItemId },
      data: updateData,
    })

    // Send notification with AIT No
    await sendNotification('MIT_ASSIGNED', {
      userId: assigneeId,
      entityType: 'MIT',
      entityId: workItemId,
      aitNo: workItem.aitNo ?? undefined,
      title: `MIT Assignment: ${step} Step`,
      message: `You have been assigned to the ${step} step of work item "${workItem.title}"${workItem.aitNo ? ` (AIT: ${workItem.aitNo})` : ''}`,
      link: `/work-items/${workItemId}`,
      additionalUserIds: [],
    })

    // Audit log
    await logAudit({
      userId: assignedById,
      action: 'ASSIGN_MIT',
      entity: 'MitStepAssignment',
      entityId: assignment.id,
      aitNo: workItem.aitNo ?? undefined,
      entityType: 'MIT',
      newValue: {
        step,
        assigneeId,
        workItemId,
        workItemTitle: workItem.title,
      },
    })

    return assignment
  } catch (error) {
    console.error('[MITAssignmentService] Error assigning MIT:', error)
    throw error
  }
}

/**
 * Accept a MIT step assignment.
 */
export async function acceptMit(
  assignmentId: string,
  userId: string
): Promise<void> {
  try {
    const assignment = await db.mitStepAssignment.findUnique({
      where: { id: assignmentId },
      include: { workItem: true },
    })

    if (!assignment) {
      throw new Error(`MIT assignment "${assignmentId}" not found`)
    }

    if (assignment.assigneeId !== userId) {
      throw new Error('Only the assignee can accept this assignment')
    }

    if (assignment.status !== 'ASSIGNED' && assignment.status !== 'PENDING') {
      throw new Error(`Assignment cannot be accepted (current status: ${assignment.status})`)
    }

    await db.mitStepAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    })

    // Update work item status to ACCEPTED or IN_PROGRESS
    if (assignment.workItem.status === 'ASSIGNED') {
      await db.workItem.update({
        where: { id: assignment.workItemId },
        data: { status: 'ACCEPTED' },
      })
    }

    // Audit log
    await logAudit({
      userId,
      action: 'ACCEPT_MIT',
      entity: 'MitStepAssignment',
      entityId: assignmentId,
      aitNo: assignment.workItem.aitNo ?? undefined,
      entityType: 'MIT',
      newValue: { step: assignment.step, status: 'ACCEPTED' },
    })
  } catch (error) {
    console.error('[MITAssignmentService] Error accepting MIT:', error)
    throw error
  }
}

/**
 * Reject a MIT step assignment.
 */
export async function rejectMit(
  assignmentId: string,
  userId: string,
  reason: string
): Promise<void> {
  try {
    const assignment = await db.mitStepAssignment.findUnique({
      where: { id: assignmentId },
      include: { workItem: true },
    })

    if (!assignment) {
      throw new Error(`MIT assignment "${assignmentId}" not found`)
    }

    if (assignment.assigneeId !== userId) {
      throw new Error('Only the assignee can reject this assignment')
    }

    if (assignment.status !== 'ASSIGNED' && assignment.status !== 'PENDING') {
      throw new Error(`Assignment cannot be rejected (current status: ${assignment.status})`)
    }

    await db.mitStepAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    })

    // Notify the assigner about the rejection
    if (assignment.assignedById) {
      await sendNotification('MIT_REJECTED', {
        userId: assignment.assignedById,
        entityType: 'MIT',
        entityId: assignment.workItemId,
        aitNo: assignment.workItem.aitNo ?? undefined,
        title: `MIT Assignment Rejected: ${assignment.step} Step`,
        message: `The ${assignment.step} step assignment for "${assignment.workItem.title}" has been rejected. Reason: ${reason}`,
        link: `/work-items/${assignment.workItemId}`,
      })
    }

    // Audit log
    await logAudit({
      userId,
      action: 'REJECT_MIT',
      entity: 'MitStepAssignment',
      entityId: assignmentId,
      aitNo: assignment.workItem.aitNo ?? undefined,
      entityType: 'MIT',
      newValue: { step: assignment.step, status: 'REJECTED', reason },
    })
  } catch (error) {
    console.error('[MITAssignmentService] Error rejecting MIT:', error)
    throw error
  }
}

/**
 * Return a MIT step assignment back to the previous step/assigner.
 */
export async function returnMit(
  assignmentId: string,
  userId: string,
  reason: string
): Promise<void> {
  try {
    const assignment = await db.mitStepAssignment.findUnique({
      where: { id: assignmentId },
      include: { workItem: true },
    })

    if (!assignment) {
      throw new Error(`MIT assignment "${assignmentId}" not found`)
    }

    if (assignment.assigneeId !== userId) {
      throw new Error('Only the assignee can return this assignment')
    }

    if (assignment.status !== 'ACCEPTED' && assignment.status !== 'ASSIGNED') {
      throw new Error(`Assignment cannot be returned (current status: ${assignment.status})`)
    }

    await db.mitStepAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'RETURNED',
        returnedAt: new Date(),
        returnReason: reason,
      },
    })

    // Update work item status to RETURNED
    await db.workItem.update({
      where: { id: assignment.workItemId },
      data: { status: 'RETURNED' },
    })

    // Notify the assigner
    if (assignment.assignedById) {
      await sendNotification('MIT_RETURNED', {
        userId: assignment.assignedById,
        entityType: 'MIT',
        entityId: assignment.workItemId,
        aitNo: assignment.workItem.aitNo ?? undefined,
        title: `MIT Assignment Returned: ${assignment.step} Step`,
        message: `The ${assignment.step} step for "${assignment.workItem.title}" has been returned. Reason: ${reason}`,
        link: `/work-items/${assignment.workItemId}`,
      })
    }

    // Audit log
    await logAudit({
      userId,
      action: 'RETURN_MIT',
      entity: 'MitStepAssignment',
      entityId: assignmentId,
      aitNo: assignment.workItem.aitNo ?? undefined,
      entityType: 'MIT',
      newValue: { step: assignment.step, status: 'RETURNED', reason },
    })
  } catch (error) {
    console.error('[MITAssignmentService] Error returning MIT:', error)
    throw error
  }
}

/**
 * Submit a MIT step assignment (mark as completed by the assignee).
 */
export async function submitMit(
  assignmentId: string,
  userId: string
): Promise<void> {
  try {
    const assignment = await db.mitStepAssignment.findUnique({
      where: { id: assignmentId },
      include: { workItem: true },
    })

    if (!assignment) {
      throw new Error(`MIT assignment "${assignmentId}" not found`)
    }

    if (assignment.assigneeId !== userId) {
      throw new Error('Only the assignee can submit this assignment')
    }

    if (assignment.status !== 'ACCEPTED' && assignment.status !== 'ASSIGNED') {
      throw new Error(`Assignment cannot be submitted (current status: ${assignment.status})`)
    }

    await db.mitStepAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })

    // Update work item status to SUBMITTED
    await db.workItem.update({
      where: { id: assignment.workItemId },
      data: { status: 'SUBMITTED' },
    })

    // Notify the assigner or next step stakeholders
    if (assignment.assignedById) {
      await sendNotification('MIT_SUBMITTED', {
        userId: assignment.assignedById,
        entityType: 'MIT',
        entityId: assignment.workItemId,
        aitNo: assignment.workItem.aitNo ?? undefined,
        title: `MIT Step Submitted: ${assignment.step}`,
        message: `The ${assignment.step} step for "${assignment.workItem.title}" has been submitted.`,
        link: `/work-items/${assignment.workItemId}`,
      })
    }

    // Audit log
    await logAudit({
      userId,
      action: 'SUBMIT_MIT',
      entity: 'MitStepAssignment',
      entityId: assignmentId,
      aitNo: assignment.workItem.aitNo ?? undefined,
      entityType: 'MIT',
      newValue: { step: assignment.step, status: 'SUBMITTED' },
    })
  } catch (error) {
    console.error('[MITAssignmentService] Error submitting MIT:', error)
    throw error
  }
}

/**
 * Deploy a MIT step assignment (mark as deployed by the assignee or manager).
 */
export async function deployMit(
  assignmentId: string,
  userId: string
): Promise<void> {
  try {
    const assignment = await db.mitStepAssignment.findUnique({
      where: { id: assignmentId },
      include: { workItem: true },
    })

    if (!assignment) {
      throw new Error(`MIT assignment "${assignmentId}" not found`)
    }

    if (assignment.status !== 'SUBMITTED') {
      throw new Error(`Assignment must be submitted before deployment (current status: ${assignment.status})`)
    }

    await db.mitStepAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'DEPLOYED',
        deployedAt: new Date(),
      },
    })

    // Update work item status to DEPLOYED
    await db.workItem.update({
      where: { id: assignment.workItemId },
      data: { status: 'DEPLOYED' },
    })

    // Notify relevant parties
    if (assignment.assignedById) {
      await sendNotification('MIT_DEPLOYED', {
        userId: assignment.assignedById,
        entityType: 'MIT',
        entityId: assignment.workItemId,
        aitNo: assignment.workItem.aitNo ?? undefined,
        title: `MIT Step Deployed: ${assignment.step}`,
        message: `The ${assignment.step} step for "${assignment.workItem.title}" has been deployed.`,
        link: `/work-items/${assignment.workItemId}`,
      })
    }

    // Audit log
    await logAudit({
      userId,
      action: 'DEPLOY_MIT',
      entity: 'MitStepAssignment',
      entityId: assignmentId,
      aitNo: assignment.workItem.aitNo ?? undefined,
      entityType: 'MIT',
      newValue: { step: assignment.step, status: 'DEPLOYED' },
    })
  } catch (error) {
    console.error('[MITAssignmentService] Error deploying MIT:', error)
    throw error
  }
}
