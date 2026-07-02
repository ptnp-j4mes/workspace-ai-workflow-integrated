// ============================================================
// Approval Service - Multi-step Approval Workflow Management
// ============================================================

import { db } from '@/lib/db'
import { generateDocumentNo } from './document-number-service'
import { sendNotification } from './notification-service'
import { logAudit } from './audit-service'

interface CreateApprovalInstanceData {
  workflowKey: string
  entityType: string
  entityId: string
  requestedById: string
  aitNo?: string
}

/**
 * Create a new approval instance for an entity.
 * Generates AIT Approval Number if not provided, creates the instance
 * with the first step as currentStepId, and notifies approvers.
 */
export async function createApprovalInstance(
  data: CreateApprovalInstanceData
) {
  try {
    // Find the workflow by key
    const workflow = await db.approvalWorkflow.findUnique({
      where: { workflowKey: data.workflowKey },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    })

    if (!workflow) {
      throw new Error(`Approval workflow "${data.workflowKey}" not found`)
    }

    if (!workflow.isActive) {
      throw new Error(`Approval workflow "${data.workflowKey}" is not active`)
    }

    if (workflow.steps.length === 0) {
      throw new Error(`Approval workflow "${data.workflowKey}" has no steps defined`)
    }

    const firstStep = workflow.steps[0]

    // Generate AIT number if not provided
    const aitNo = data.aitNo ?? await generateDocumentNo(
      'APPROVAL',
      data.entityType,
      data.entityId,
      data.requestedById
    )

    // Create the approval instance
    const instance = await db.approvalInstance.create({
      data: {
        aitNo,
        workflowId: workflow.id,
        entityType: data.entityType,
        entityId: data.entityId,
        currentStepId: firstStep.id,
        status: 'PENDING',
        requestedById: data.requestedById,
        requestedAt: new Date(),
      },
    })

    // Audit log
    await logAudit({
      userId: data.requestedById,
      action: 'CREATE_APPROVAL_INSTANCE',
      entity: 'ApprovalInstance',
      entityId: instance.id,
      aitNo,
      entityType: data.entityType,
      newValue: {
        workflowKey: data.workflowKey,
        currentStep: firstStep.stepName,
        status: 'PENDING',
      },
    })

    // Notify approvers for the first step
    await notifyStepApprovers(instance.id, firstStep, data.requestedById, aitNo)

    return instance
  } catch (error) {
    console.error('[ApprovalService] Error creating approval instance:', error)
    throw error
  }
}

/**
 * Notify approvers for a given step.
 */
async function notifyStepApprovers(
  instanceId: string,
  step: { id: string; stepName: string; approverRole: string | null; approverUserId: string | null },
  requestedById: string,
  aitNo: string
): Promise<void> {
  try {
    let recipientUserIds: string[] = []

    if (step.approverUserId) {
      // Specific user assigned to this step
      recipientUserIds = [step.approverUserId]
    } else if (step.approverRole) {
      // Find users with the specified role(s)
      const roleKeys = step.approverRole.split(',').map(r => r.trim())
      const usersWithRole = await db.userRole.findMany({
        where: { role: { key: { in: roleKeys } } },
        select: { userId: true },
      })
      recipientUserIds = usersWithRole.map(ur => ur.userId)
    }

    // Check for active delegations
    const delegations = await db.approvalDelegation.findMany({
      where: {
        fromUserId: { in: recipientUserIds },
        isActive: true,
        startDate: { lte: new Date() },
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
    })

    for (const delegation of delegations) {
      if (!recipientUserIds.includes(delegation.toUserId)) {
        recipientUserIds.push(delegation.toUserId)
      }
    }

    for (const userId of recipientUserIds) {
      await sendNotification('APPROVAL_STEP_PENDING', {
        userId,
        entityType: 'ApprovalInstance',
        entityId: instanceId,
        aitNo,
        title: `Approval Required: ${step.stepName}`,
        message: `You have a pending approval for step "${step.stepName}" (AIT: ${aitNo})`,
        link: `/approvals/${instanceId}`,
        additionalUserIds: [],
      })
    }
  } catch (error) {
    console.error('[ApprovalService] Error notifying step approvers:', error)
  }
}

/**
 * Approve a step in an approval instance.
 * Moves to the next step or completes the approval if all steps done.
 */
export async function approveStep(
  instanceId: string,
  stepId: string,
  actorUserId: string,
  comment?: string
) {
  try {
    const instance = await db.approvalInstance.findUnique({
      where: { id: instanceId },
      include: {
        workflow: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
        actions: true,
      },
    })

    if (!instance) {
      throw new Error(`Approval instance "${instanceId}" not found`)
    }

    if (instance.status !== 'PENDING') {
      throw new Error(`Approval instance is not pending (status: ${instance.status})`)
    }

    // Create the approval action
    await db.approvalAction.create({
      data: {
        instanceId,
        stepId,
        actorUserId,
        action: 'APPROVE',
        comment: comment ?? null,
      },
    })

    const steps = instance.workflow.steps
    const currentStepIndex = steps.findIndex(s => s.id === stepId)

    if (currentStepIndex === -1) {
      throw new Error(`Step "${stepId}" not found in workflow`)
    }

    // Check if there are more steps
    const nextStepIndex = currentStepIndex + 1
    if (nextStepIndex < steps.length) {
      const nextStep = steps[nextStepIndex]

      // Move to the next step
      const updatedInstance = await db.approvalInstance.update({
        where: { id: instanceId },
        data: {
          currentStepId: nextStep.id,
        },
      })

      // Notify approvers for the next step
      await notifyStepApprovers(instanceId, nextStep, actorUserId, instance.aitNo ?? '')

      // Audit log
      await logAudit({
        userId: actorUserId,
        action: 'APPROVE_STEP',
        entity: 'ApprovalInstance',
        entityId: instanceId,
        aitNo: instance.aitNo ?? undefined,
        entityType: instance.entityType,
        newValue: {
          step: steps[currentStepIndex].stepName,
          nextStep: nextStep.stepName,
          comment,
        },
      })

      return updatedInstance
    }

    // All steps approved - complete the approval
    const completedInstance = await db.approvalInstance.update({
      where: { id: instanceId },
      data: {
        status: 'APPROVED',
        currentStepId: null,
        completedAt: new Date(),
      },
    })

    // Update the related entity status based on entity type
    await updateEntityStatus(instance.entityType, instance.entityId, 'APPROVED')

    // Notify the requester
    if (instance.requestedById) {
      await sendNotification('APPROVAL_COMPLETED', {
        userId: instance.requestedById,
        entityType: instance.entityType,
        entityId: instance.entityId,
        aitNo: instance.aitNo ?? undefined,
        title: `Approval Completed: ${instance.aitNo ?? instanceId}`,
        message: `Your approval request has been fully approved.`,
        link: `/approvals/${instanceId}`,
      })
    }

    // Audit log
    await logAudit({
      userId: actorUserId,
      action: 'APPROVAL_COMPLETED',
      entity: 'ApprovalInstance',
      entityId: instanceId,
      aitNo: instance.aitNo ?? undefined,
      entityType: instance.entityType,
      newValue: { status: 'APPROVED', comment },
    })

    return completedInstance
  } catch (error) {
    console.error('[ApprovalService] Error approving step:', error)
    throw error
  }
}

/**
 * Reject an approval instance at a specific step.
 */
export async function rejectInstance(
  instanceId: string,
  stepId: string,
  actorUserId: string,
  comment: string
) {
  try {
    const instance = await db.approvalInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance) {
      throw new Error(`Approval instance "${instanceId}" not found`)
    }

    if (instance.status !== 'PENDING') {
      throw new Error(`Approval instance is not pending (status: ${instance.status})`)
    }

    // Create the rejection action
    await db.approvalAction.create({
      data: {
        instanceId,
        stepId,
        actorUserId,
        action: 'REJECT',
        comment,
      },
    })

    // Update the instance status
    const updatedInstance = await db.approvalInstance.update({
      where: { id: instanceId },
      data: {
        status: 'REJECTED',
        currentStepId: null,
        completedAt: new Date(),
      },
    })

    // Update the related entity status
    await updateEntityStatus(instance.entityType, instance.entityId, 'REJECTED')

    // Notify the requester
    if (instance.requestedById) {
      await sendNotification('APPROVAL_REJECTED', {
        userId: instance.requestedById,
        entityType: instance.entityType,
        entityId: instance.entityId,
        aitNo: instance.aitNo ?? undefined,
        title: `Approval Rejected: ${instance.aitNo ?? instanceId}`,
        message: `Your approval request has been rejected. Reason: ${comment}`,
        link: `/approvals/${instanceId}`,
      })
    }

    // Audit log
    await logAudit({
      userId: actorUserId,
      action: 'APPROVAL_REJECTED',
      entity: 'ApprovalInstance',
      entityId: instanceId,
      aitNo: instance.aitNo ?? undefined,
      entityType: instance.entityType,
      newValue: { status: 'REJECTED', stepId, comment },
    })

    return updatedInstance
  } catch (error) {
    console.error('[ApprovalService] Error rejecting instance:', error)
    throw error
  }
}

/**
 * Add a comment to an approval instance.
 */
export async function addComment(
  instanceId: string,
  actorUserId: string,
  comment: string
) {
  try {
    const instance = await db.approvalInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance) {
      throw new Error(`Approval instance "${instanceId}" not found`)
    }

    const action = await db.approvalAction.create({
      data: {
        instanceId,
        stepId: instance.currentStepId ?? '',
        actorUserId,
        action: 'COMMENT',
        comment,
      },
    })

    return action
  } catch (error) {
    console.error('[ApprovalService] Error adding comment:', error)
    throw error
  }
}

/**
 * Get all pending approvals for a user.
 */
export async function getPendingApprovals(userId: string) {
  try {
    // Find steps where the user's role matches
    const userRoles = await db.userRole.findMany({
      where: { userId },
      select: { role: { select: { key: true } } },
    })
    const roleKeys = userRoles.map(ur => ur.role.key)

    // Find approval instances that are pending and where the current step
    // has a matching approverRole or approverUserId
    const instances = await db.approvalInstance.findMany({
      where: {
        status: 'PENDING',
        OR: [
          // Steps assigned to this specific user
          {
            workflow: {
              steps: {
                some: {
                  approverUserId: userId,
                },
              },
            },
          },
          // Steps assigned to this user's role
          {
            workflow: {
              steps: {
                some: {
                  approverRole: { in: roleKeys },
                },
              },
            },
          },
        ],
      },
      include: {
        workflow: { select: { name: true, workflowKey: true } },
        actions: {
          include: {
            actor: { select: { id: true, name: true, email: true } },
            step: { select: { stepName: true, stepOrder: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { requestedAt: 'desc' },
    })

    return instances
  } catch (error) {
    console.error('[ApprovalService] Error getting pending approvals:', error)
    return []
  }
}

/**
 * Get the full timeline of actions for an approval instance.
 */
export async function getApprovalTimeline(instanceId: string) {
  try {
    const instance = await db.approvalInstance.findUnique({
      where: { id: instanceId },
      include: {
        workflow: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
        actions: {
          include: {
            actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
            step: { select: { stepName: true, stepOrder: true, requiredAction: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!instance) return []

    return instance.actions.map(action => ({
      id: action.id,
      stepName: action.step?.stepName ?? 'Unknown Step',
      stepOrder: action.step?.stepOrder ?? 0,
      requiredAction: action.step?.requiredAction ?? 'APPROVE',
      actor: action.actor,
      action: action.action,
      comment: action.comment,
      createdAt: action.createdAt,
    }))
  } catch (error) {
    console.error('[ApprovalService] Error getting approval timeline:', error)
    return []
  }
}

/**
 * Update the status of an entity after an approval decision.
 */
async function updateEntityStatus(
  entityType: string,
  entityId: string,
  decision: string
): Promise<void> {
  try {
    const newStatus = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED'

    switch (entityType) {
      case 'REQUEST':
        await db.request.update({
          where: { id: entityId },
          data: { status: newStatus },
        })
        break
      case 'CHANGE':
        await db.changeRequest.update({
          where: { id: entityId },
          data: {
            status: decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
            isApproved: decision === 'APPROVED',
          },
        })
        break
      case 'UAT_SIGNOFF':
        await db.uatCycle.update({
          where: { id: entityId },
          data: { status: decision === 'APPROVED' ? 'COMPLETED' : 'FAILED' },
        })
        break
      default:
        console.warn(`[ApprovalService] Unknown entity type for status update: ${entityType}`)
    }
  } catch (error) {
    console.error('[ApprovalService] Error updating entity status:', error)
  }
}
