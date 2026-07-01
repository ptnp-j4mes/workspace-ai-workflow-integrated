import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'
import { createApprovalInstance, getApprovalTimeline, approveStep, addComment, rejectInstance } from '../lib/services/approval-service'

export const approvalInstancesRoutes = new Elysia({ prefix: '/api/approval-instances' })
  // POST /api/approval-instances - Create approval instance
  .post('/', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { workflowKey, entityType, entityId, aitNo } = body

      if (!workflowKey || !entityType || !entityId) {
        set.status = 400
        return { error: 'workflowKey, entityType, and entityId are required' }
      }

      const instance = await createApprovalInstance({
        workflowKey,
        entityType,
        entityId,
        requestedById: authUser.id,
        aitNo,
      })

      set.status = 201
      return { data: instance }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      console.error('Create approval instance error:', error)
      set.status = 500
      return { error: message }
    }
  })
  // GET /api/approval-instances/:id - Get approval instance with timeline
  .get('/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const instance = await db.approvalInstance.findUnique({
        where: { id },
        include: {
          workflow: {
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
          },
          actions: {
            include: {
              actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
              step: { select: { stepName: true, stepOrder: true, requiredAction: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!instance) {
        set.status = 404
        return { error: 'Approval instance not found' }
      }

      const timeline = await getApprovalTimeline(id)

      return {
        data: {
          ...instance,
          timeline,
        },
      }
    } catch (error) {
      console.error('Get approval instance error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/approval-instances/:id/approve - Approve current step
  .post('/:id/approve', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { comment } = body

      // Get the current step for this instance
      const instance = await db.approvalInstance.findUnique({
        where: { id },
        select: { currentStepId: true, status: true },
      })

      if (!instance) {
        set.status = 404
        return { error: 'Approval instance not found' }
      }

      if (instance.status !== 'PENDING') {
        set.status = 400
        return { error: `Cannot approve instance with status: ${instance.status}` }
      }

      if (!instance.currentStepId) {
        set.status = 400
        return { error: 'No current step to approve' }
      }

      const updated = await approveStep(id, instance.currentStepId, authUser.id, comment)

      return { data: updated }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      console.error('Approve step error:', error)
      set.status = 500
      return { error: message }
    }
  })
  // POST /api/approval-instances/:id/comment - Add comment to approval
  .post('/:id/comment', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { comment } = body

      if (!comment) {
        set.status = 400
        return { error: 'comment is required' }
      }

      const action = await addComment(id, authUser.id, comment)

      set.status = 201
      return { data: action }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      console.error('Add approval comment error:', error)
      set.status = 500
      return { error: message }
    }
  })
  // POST /api/approval-instances/:id/reject - Reject approval
  .post('/:id/reject', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { comment } = body

      if (!comment) {
        set.status = 400
        return { error: 'comment is required when rejecting' }
      }

      // Get the current step for this instance
      const instance = await db.approvalInstance.findUnique({
        where: { id },
        select: { currentStepId: true, status: true },
      })

      if (!instance) {
        set.status = 404
        return { error: 'Approval instance not found' }
      }

      if (instance.status !== 'PENDING') {
        set.status = 400
        return { error: `Cannot reject instance with status: ${instance.status}` }
      }

      if (!instance.currentStepId) {
        set.status = 400
        return { error: 'No current step to reject' }
      }

      const updated = await rejectInstance(id, instance.currentStepId, authUser.id, comment)

      return { data: updated }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      console.error('Reject approval error:', error)
      set.status = 500
      return { error: message }
    }
  })
