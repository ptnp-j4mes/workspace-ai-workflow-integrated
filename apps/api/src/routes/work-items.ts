import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'
import { executePrompt } from '../lib/ai-service'
import { acceptMit, assignMit, deployMit, rejectMit, returnMit, submitMit } from '../lib/services/mit-assignment-service'

export const workItemsRoutes = new Elysia({ prefix: '/api/work-items' })
  // GET /api/work-items - List work items with filters
  .get('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status') || undefined
      const priority = searchParams.get('priority') || undefined
      const requestId = searchParams.get('requestId') || undefined
      const projectId = searchParams.get('projectId') || undefined
      const assignedToMe = searchParams.get('assignedToMe') === 'true'

      const where: any = {}
      if (status) where.status = status
      if (priority) where.priority = priority
      if (requestId) where.requestId = requestId
      if (projectId) where.projectId = projectId
      if (assignedToMe) {
        where.assignments = {
          some: { userId: user.id, isActive: true },
        }
      }

      const workItems = await db.workItem.findMany({
        where,
        include: {
          request: {
            select: { id: true, title: true, code: true, status: true },
          },
          assignments: {
            where: { isActive: true },
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return { workItems }
    } catch (error) {
      console.error('List work items error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/work-items - Create work item
  .post('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { title, description, requestId, projectId, priority, dueDate } = body

      if (!title) {
        set.status = 400
        return { error: 'Title is required' }
      }

      const workItem = await db.workItem.create({
        data: {
          title,
          description: description || null,
          requestId: requestId || null,
          projectId: projectId || null,
          priority: priority || 'MEDIUM',
          dueDate: dueDate ? new Date(dueDate) : null,
          status: 'CREATED',
        },
        include: {
          request: {
            select: { id: true, title: true, code: true },
          },
          assignments: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      })

      // Create initial status history
      await db.workItemStatusHistory.create({
        data: {
          workItemId: workItem.id,
          fromStatus: null,
          toStatus: 'CREATED',
          comment: 'Work item created',
          changedById: user.id,
        },
      })

      set.status = 201
      return { workItem }
    } catch (error) {
      console.error('Create work item error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/work-items/:id/accept - Accept work item assignment
  .post('/:id/accept', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const workItem = await db.workItem.findUnique({
        where: { id },
        include: {
          assignments: {
            where: { userId: user.id, isActive: true },
          },
        },
      })

      if (!workItem) {
        set.status = 404
        return { error: 'Work item not found' }
      }

      if (workItem.assignments.length === 0) {
        set.status = 403
        return { error: 'You are not assigned to this work item' }
      }

      // Mark assignment as accepted
      await db.workItemAssignment.updateMany({
        where: { workItemId: id, userId: user.id, isActive: true },
        data: { acceptedAt: new Date() },
      })

      // Update work item status to ACCEPTED
      if (workItem.status === 'ASSIGNED') {
        await db.workItem.update({
          where: { id },
          data: { status: 'ACCEPTED' },
        })

        await db.workItemStatusHistory.create({
          data: {
            workItemId: id,
            fromStatus: 'ASSIGNED',
            toStatus: 'ACCEPTED',
            comment: `Assignment accepted by ${user.email}`,
            changedById: user.id,
          },
        })
      }

      const updated = await db.workItem.findUnique({
        where: { id },
        include: {
          assignments: {
            where: { isActive: true },
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      })

      return { workItem: updated }
    } catch (error) {
      console.error('Accept work item error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/work-items/:id/assign - Assign work item
  .post('/:id/assign', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { userId, role } = body

      if (!userId || !role) {
        set.status = 400
        return { error: 'userId and role are required' }
      }

      const workItem = await db.workItem.findUnique({ where: { id } })
      if (!workItem) {
        set.status = 404
        return { error: 'Work item not found' }
      }

      // Verify user exists
      const targetUser = await db.user.findUnique({ where: { id: userId } })
      if (!targetUser) {
        set.status = 404
        return { error: 'User not found' }
      }

      // Deactivate existing assignments for this role
      await db.workItemAssignment.updateMany({
        where: { workItemId: id, role, isActive: true },
        data: { isActive: false },
      })

      // Create new assignment
      const assignment = await db.workItemAssignment.create({
        data: {
          workItemId: id,
          userId,
          role,
          isActive: true,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      })

      // Update work item status to ASSIGNED if it was CREATED
      if (workItem.status === 'CREATED') {
        await db.workItem.update({
          where: { id },
          data: { status: 'ASSIGNED' },
        })

        await db.workItemStatusHistory.create({
          data: {
            workItemId: id,
            fromStatus: 'CREATED',
            toStatus: 'ASSIGNED',
            comment: `Assigned to ${targetUser.name} as ${role}`,
            changedById: user.id,
          },
        })
      }

      set.status = 201
      return { assignment }
    } catch (error) {
      console.error('Assign work item error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/work-items/:id/generate-handoff-note - Generate AI handoff note
  .post('/:id/generate-handoff-note', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { fromRole, toRole, toUserId, workDone, blockers, nextStep } = body

      if (!fromRole || !toRole || !workDone) {
        set.status = 400
        return { error: 'fromRole, toRole, and workDone are required' }
      }

      const workItem = await db.workItem.findUnique({
        where: { id },
        include: {
          request: {
            select: { id: true, title: true, description: true, code: true },
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
      })

      if (!workItem) {
        set.status = 404
        return { error: 'Work item not found' }
      }

      const result = await executePrompt('handoff.generate_note', {
        workItemTitle: workItem.title,
        workItemDescription: workItem.description || 'N/A',
        requestTitle: workItem.request?.title || 'N/A',
        requestDescription: workItem.request?.description || 'N/A',
        fromRole,
        toRole,
        workDone,
        blockers: blockers || 'None',
        nextStep: nextStep || 'Not specified',
        currentAssignments: JSON.stringify(
          workItem.assignments.map((a) => ({
            role: a.role,
            name: a.user.name,
          }))
        ),
      })

      // Create handoff record
      const handoff = await db.workItemHandoff.create({
        data: {
          workItemId: id,
          fromUserId: user.id,
          toUserId: toUserId || null,
          fromRole,
          toRole,
          aiGeneratedNote: result.parsedOutput ? JSON.stringify(result.parsedOutput) : result.output,
          status: 'PENDING',
        },
      })

      return {
        handoff,
        note: result.parsedOutput || result.output,
        runId: result.runId,
        latencyMs: result.latencyMs,
      }
    } catch (error: any) {
      console.error('Generate handoff note error:', error)
      set.status = 500
      return { error: error.message || 'Failed to generate handoff note' }
    }
  })
  // POST /api/work-items/:id/mit-accept - Accept MIT assignment
  .post('/:id/mit-accept', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      // Find the active MIT assignment for this work item where the user is the assignee
      const assignment = await db.mitStepAssignment.findFirst({
        where: {
          workItemId: id,
          assigneeId: authUser.id,
          status: { in: ['ASSIGNED', 'PENDING'] },
        },
      })

      if (!assignment) {
        set.status = 404
        return { error: 'No pending MIT assignment found for you on this work item' }
      }

      await acceptMit(assignment.id, authUser.id)

      return { data: { message: 'MIT assignment accepted' } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      console.error('MIT accept error:', error)
      set.status = 500
      return { error: message }
    }
  })
  // POST /api/work-items/:id/mit-assign - Assign MIT step
  .post('/:id/mit-assign', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { step, assigneeId } = body

      if (!step || !assigneeId) {
        set.status = 400
        return { error: 'step and assigneeId are required' }
      }

      const assignment = await assignMit(id, step, assigneeId, authUser.id)

      set.status = 201
      return { data: assignment }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      console.error('MIT assign error:', error)
      set.status = 500
      return { error: message }
    }
  })
  // POST /api/work-items/:id/mit-deploy - Deploy MIT step
  .post('/:id/mit-deploy', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const assignment = await db.mitStepAssignment.findFirst({
        where: {
          workItemId: id,
          assigneeId: authUser.id,
          status: 'SUBMITTED',
        },
      })

      if (!assignment) {
        set.status = 404
        return { error: 'No submitted MIT assignment found for you on this work item' }
      }

      await deployMit(assignment.id, authUser.id)

      return { data: { message: 'MIT step deployed' } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      console.error('MIT deploy error:', error)
      set.status = 500
      return { error: message }
    }
  })
  // POST /api/work-items/:id/mit-reject - Reject MIT assignment
  .post('/:id/mit-reject', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { reason } = body

      if (!reason) {
        set.status = 400
        return { error: 'reason is required when rejecting' }
      }

      const assignment = await db.mitStepAssignment.findFirst({
        where: {
          workItemId: id,
          assigneeId: authUser.id,
          status: { in: ['ASSIGNED', 'PENDING'] },
        },
      })

      if (!assignment) {
        set.status = 404
        return { error: 'No pending MIT assignment found for you on this work item' }
      }

      await rejectMit(assignment.id, authUser.id, reason)

      return { data: { message: 'MIT assignment rejected' } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      console.error('MIT reject error:', error)
      set.status = 500
      return { error: message }
    }
  })
  // POST /api/work-items/:id/mit-return - Return MIT assignment
  .post('/:id/mit-return', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { reason } = body

      if (!reason) {
        set.status = 400
        return { error: 'reason is required when returning' }
      }

      const assignment = await db.mitStepAssignment.findFirst({
        where: {
          workItemId: id,
          assigneeId: authUser.id,
          status: { in: ['ASSIGNED', 'ACCEPTED'] },
        },
      })

      if (!assignment) {
        set.status = 404
        return { error: 'No active MIT assignment found for you on this work item' }
      }

      await returnMit(assignment.id, authUser.id, reason)

      return { data: { message: 'MIT assignment returned' } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      console.error('MIT return error:', error)
      set.status = 500
      return { error: message }
    }
  })
  // POST /api/work-items/:id/mit-submit - Submit MIT step
  .post('/:id/mit-submit', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const assignment = await db.mitStepAssignment.findFirst({
        where: {
          workItemId: id,
          assigneeId: authUser.id,
          status: { in: ['ASSIGNED', 'ACCEPTED'] },
        },
      })

      if (!assignment) {
        set.status = 404
        return { error: 'No active MIT assignment found for you on this work item' }
      }

      await submitMit(assignment.id, authUser.id)

      return { data: { message: 'MIT step submitted' } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      console.error('MIT submit error:', error)
      set.status = 500
      return { error: message }
    }
  })
  // POST /api/work-items/:id/submit - Submit work item for review
  .post('/:id/submit', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const workItem = await db.workItem.findUnique({
        where: { id },
        include: {
          assignments: {
            where: { userId: user.id, isActive: true },
          },
        },
      })

      if (!workItem) {
        set.status = 404
        return { error: 'Work item not found' }
      }

      if (workItem.status !== 'ACCEPTED' && workItem.status !== 'IN_PROGRESS' && workItem.status !== 'RETURNED') {
        set.status = 400
        return { error: `Cannot submit work item with status ${workItem.status}` }
      }

      const previousStatus = workItem.status

      const updated = await db.workItem.update({
        where: { id },
        data: { status: 'SUBMITTED' },
        include: {
          assignments: {
            where: { isActive: true },
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      })

      await db.workItemStatusHistory.create({
        data: {
          workItemId: id,
          fromStatus: previousStatus,
          toStatus: 'SUBMITTED',
          comment: 'Work item submitted for review',
          changedById: user.id,
        },
      })

      return { workItem: updated }
    } catch (error) {
      console.error('Submit work item error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
