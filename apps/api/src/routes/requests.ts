import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'
import { generateDocumentNo } from '../lib/services/document-number-service'
import { logAudit } from '../lib/services/audit-service'
import { sendNotification } from '../lib/services/notification-service'
import { executePrompt } from '../lib/ai-service'

// Valid workflow transitions with required roles
const VALID_TRANSITIONS: Record<string, Record<string, string[]>> = {
  DRAFT: { SUBMITTED: ['ADMIN', 'BUSINESS_ANALYST', 'REQUESTER'] },
  SUBMITTED: { APPROVED: ['ADMIN', 'APPROVER'], REJECTED: ['ADMIN', 'APPROVER'] },
  APPROVED: { ASSIGNED: ['ADMIN', 'PROJECT_MANAGER'] },
  ASSIGNED: { IN_DEVELOPMENT: ['ADMIN', 'PROJECT_MANAGER'] },
  IN_DEVELOPMENT: { QA: ['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER'] },
  QA: { UAT: ['ADMIN', 'PROJECT_MANAGER', 'QA'], IN_DEVELOPMENT: ['ADMIN', 'PROJECT_MANAGER'] },
  UAT: { COMPLETED: ['ADMIN', 'PROJECT_MANAGER'], IN_DEVELOPMENT: ['ADMIN', 'PROJECT_MANAGER'] },
  COMPLETED: { CLOSED: ['ADMIN', 'PROJECT_MANAGER'] },
  REJECTED: { DRAFT: ['ADMIN', 'REQUESTER'] },
}

export const requestsRoutes = new Elysia({ prefix: '/api/requests' })
  // POST /api/requests/:id/approve - Approve request (SUBMITTED → APPROVED)
  .post('/:id/approve', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { comment } = body

      const req = await db.request.findUnique({ where: { id } })
      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      if (req.status !== 'SUBMITTED') {
        set.status = 400
        return { error: `Cannot approve request with status ${req.status}. Must be in SUBMITTED status.` }
      }

      const updated = await db.request.update({
        where: { id },
        data: { status: 'APPROVED' },
      })

      // Create status history entry
      await db.requestStatusHistory.create({
        data: {
          requestId: id,
          fromStatus: 'SUBMITTED',
          toStatus: 'APPROVED',
          comment: comment || 'Request approved',
          changedById: user.id,
        },
      })

      return { request: updated }
    } catch (error) {
      console.error('Approve request error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/requests/:id/assign-ba - Assign BA (APPROVED → ASSIGNED)
  .post('/:id/assign-ba', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { userId: baUserId, comment } = body

      if (!baUserId) {
        set.status = 400
        return { error: 'userId is required' }
      }

      const req = await db.request.findUnique({ where: { id } })
      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      // Verify the BA user exists
      const baUser = await db.user.findUnique({ where: { id: baUserId } })
      if (!baUser) {
        set.status = 404
        return { error: 'User not found' }
      }

      const newStatus = req.status === 'APPROVED' ? 'ASSIGNED' : req.status
      const updated = await db.request.update({
        where: { id },
        data: {
          assignedBAId: baUserId,
          ...(req.status === 'APPROVED' ? { status: 'ASSIGNED' } : {}),
        },
        include: {
          assignedBA: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      // Create status history if status changed
      if (newStatus !== req.status) {
        await db.requestStatusHistory.create({
          data: {
            requestId: id,
            fromStatus: req.status,
            toStatus: newStatus,
            comment: comment || `BA assigned: ${baUser.name}`,
            changedById: user.id,
          },
        })
      }

      return { request: updated }
    } catch (error) {
      console.error('Assign BA error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/requests/:id/assign-dev - Assign Developer
  .post('/:id/assign-dev', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { userId: devUserId, comment } = body

      if (!devUserId) {
        set.status = 400
        return { error: 'userId is required' }
      }

      const req = await db.request.findUnique({ where: { id } })
      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      // Verify the dev user exists
      const devUser = await db.user.findUnique({ where: { id: devUserId } })
      if (!devUser) {
        set.status = 404
        return { error: 'User not found' }
      }

      // Transition to IN_DEVELOPMENT if currently ASSIGNED
      const newStatus = req.status === 'ASSIGNED' ? 'IN_DEVELOPMENT' : req.status
      const updated = await db.request.update({
        where: { id },
        data: {
          assignedDevId: devUserId,
          ...(req.status === 'ASSIGNED' ? { status: 'IN_DEVELOPMENT' } : {}),
        },
        include: {
          assignedDev: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      // Create status history if status changed
      if (newStatus !== req.status) {
        await db.requestStatusHistory.create({
          data: {
            requestId: id,
            fromStatus: req.status,
            toStatus: newStatus,
            comment: comment || `Developer assigned: ${devUser.name}`,
            changedById: user.id,
          },
        })
      }

      return { request: updated }
    } catch (error) {
      console.error('Assign Dev error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/requests/:id/assign-qa - Assign QA
  .post('/:id/assign-qa', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { userId: qaUserId, comment } = body

      if (!qaUserId) {
        set.status = 400
        return { error: 'userId is required' }
      }

      const req = await db.request.findUnique({ where: { id } })
      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      // Verify the QA user exists
      const qaUser = await db.user.findUnique({ where: { id: qaUserId } })
      if (!qaUser) {
        set.status = 404
        return { error: 'User not found' }
      }

      // Transition to QA if currently IN_DEVELOPMENT
      const newStatus = req.status === 'IN_DEVELOPMENT' ? 'QA' : req.status
      const updated = await db.request.update({
        where: { id },
        data: {
          assignedQAId: qaUserId,
          ...(req.status === 'IN_DEVELOPMENT' ? { status: 'QA' } : {}),
        },
        include: {
          assignedQA: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      // Create status history if status changed
      if (newStatus !== req.status) {
        await db.requestStatusHistory.create({
          data: {
            requestId: id,
            fromStatus: req.status,
            toStatus: newStatus,
            comment: comment || `QA assigned: ${qaUser.name}`,
            changedById: user.id,
          },
        })
      }

      return { request: updated }
    } catch (error) {
      console.error('Assign QA error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/requests/:id/comments - List comments for a request
  .get('/:id/comments', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const req = await db.request.findUnique({ where: { id } })
      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      const comments = await db.requestComment.findMany({
        where: { requestId: id },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      })

      return { comments }
    } catch (error) {
      console.error('List comments error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/requests/:id/comments - Add comment to request
  .post('/:id/comments', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { content } = body

      if (!content) {
        set.status = 400
        return { error: 'Comment content is required' }
      }

      const req = await db.request.findUnique({ where: { id } })
      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      const comment = await db.requestComment.create({
        data: {
          requestId: id,
          userId: user.id,
          content,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      })

      set.status = 201
      return { comment }
    } catch (error) {
      console.error('Add comment error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/requests/:id/create-mit - Create MIT/work item from a request
  .post('/:id/create-mit', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const req = await db.request.findUnique({ where: { id } })
      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      if (!['APPROVED', 'ASSIGNED', 'IN_DEVELOPMENT'].includes(req.status)) {
        set.status = 400
        return { error: 'Request must be approved or in progress to create a work item' }
      }

      const body = await request.json()
      const { title, description, priority, dueDate, currentStep } = body

      if (!title) {
        set.status = 400
        return { error: 'title is required' }
      }

      // Generate AIT MIT Number
      const aitNo = await generateDocumentNo('MIT', 'Request', id, authUser.id)

      const workItem = await db.workItem.create({
        data: {
          title,
          description: description ?? req.description,
          requestId: id,
          projectId: req.projectId,
          status: 'CREATED',
          currentStep: currentStep ?? 'BA',
          priority: priority ?? req.priority,
          aitNo,
          dueDate: dueDate ? new Date(dueDate) : req.dueDate,
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CREATE_MIT_FROM_REQUEST',
        entity: 'WorkItem',
        entityId: workItem.id,
        aitNo,
        newValue: { title, requestId: id, priority: workItem.priority },
      })

      // Notify the request creator
      await sendNotification('MIT_CREATED', {
        userId: req.createdById,
        entityType: 'MIT',
        entityId: workItem.id,
        aitNo,
        title: `Work Item Created: ${title}`,
        message: `A work item has been created from your request "${req.title}" (AIT: ${aitNo})`,
        link: `/work-items/${workItem.id}`,
      })

      set.status = 201
      return { data: workItem }
    } catch (error) {
      console.error('Create MIT from request error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/requests/:id/create-project - Create a project from an approved request
  .post('/:id/create-project', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const req = await db.request.findUnique({
        where: { id },
        include: {
          project: true,
        },
      })

      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      if (req.status !== 'APPROVED') {
        set.status = 400
        return { error: 'Only approved requests can be converted to projects' }
      }

      if (req.projectId) {
        set.status = 400
        return { error: 'Request already has an associated project' }
      }

      const body = await request.json()
      const { name, description, startDate, endDate } = body

      if (!name) {
        set.status = 400
        return { error: 'name is required' }
      }

      // Generate project code
      const projectCount = await db.project.count()
      const code = `PRJ-${String(projectCount + 1).padStart(4, '0')}`

      // Generate AIT Project Number
      const aitNo = await generateDocumentNo('PROJECT', 'Request', id, authUser.id)

      const project = await db.project.create({
        data: {
          code,
          name,
          description: description ?? req.description,
          status: 'ACTIVE',
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          aitNo,
          createdById: authUser.id,
        },
      })

      // Link request to project
      await db.request.update({
        where: { id },
        data: { projectId: project.id },
      })

      // Add the requester as a project member
      await db.projectMember.create({
        data: {
          projectId: project.id,
          userId: req.createdById,
          role: 'MEMBER',
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CREATE_PROJECT_FROM_REQUEST',
        entity: 'Project',
        entityId: project.id,
        aitNo,
        newValue: { name, code, requestId: id },
      })

      // Notify the request creator
      await sendNotification('PROJECT_CREATED', {
        userId: req.createdById,
        entityType: 'Project',
        entityId: project.id,
        aitNo,
        title: `Project Created: ${name}`,
        message: `A project has been created from your request "${req.title}" (AIT: ${aitNo})`,
        link: `/projects/${project.id}`,
      })

      set.status = 201
      return { data: project }
    } catch (error) {
      console.error('Create project from request error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/requests/:id/generate-document-no - Generate AIT Request No for a request
  .post('/:id/generate-document-no', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const req = await db.request.findUnique({ where: { id } })
      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      if (req.aitNo) {
        set.status = 400
        return { error: 'Request already has an AIT number', data: { aitNo: req.aitNo } }
      }

      const aitNo = await generateDocumentNo('REQUEST', 'Request', id, authUser.id)

      await db.request.update({
        where: { id },
        data: { aitNo },
      })

      await logAudit({
        userId: authUser.id,
        action: 'GENERATE_REQUEST_AIT_NO',
        entity: 'Request',
        entityId: id,
        aitNo,
        newValue: { aitNo },
      })

      set.status = 201
      return { data: { aitNo } }
    } catch (error) {
      console.error('Generate request document no error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/requests/:id/history - Get request status history
  .get('/:id/history', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const req = await db.request.findUnique({ where: { id } })
      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      const history = await db.requestStatusHistory.findMany({
        where: { requestId: id },
        orderBy: { createdAt: 'desc' },
      })

      return { history }
    } catch (error) {
      console.error('Get request history error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/requests/:id/reject - Reject request (SUBMITTED → REJECTED)
  .post('/:id/reject', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { comment } = body

      if (!comment) {
        set.status = 400
        return { error: 'Comment is required when rejecting a request' }
      }

      const req = await db.request.findUnique({ where: { id } })
      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      if (req.status !== 'SUBMITTED') {
        set.status = 400
        return { error: `Cannot reject request with status ${req.status}. Must be in SUBMITTED status.` }
      }

      const updated = await db.request.update({
        where: { id },
        data: { status: 'REJECTED' },
      })

      // Create status history entry
      await db.requestStatusHistory.create({
        data: {
          requestId: id,
          fromStatus: 'SUBMITTED',
          toStatus: 'REJECTED',
          comment,
          changedById: user.id,
        },
      })

      return { request: updated }
    } catch (error) {
      console.error('Reject request error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/requests/:id - Get request detail
  .get('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const req = await db.request.findUnique({
        where: { id },
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignedBA: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignedDev: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignedQA: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          comments: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          attachments: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
          },
          workItems: {
            include: {
              assignments: {
                include: {
                  user: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
            },
          },
        },
      })

      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      return { request: req }
    } catch (error) {
      console.error('Get request error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/requests/:id - Update request (only if DRAFT or user is ADMIN)
  .patch('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()

      const existing = await db.request.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Request not found' }
      }

      // Only allow updates if DRAFT or user is ADMIN
      const isAdmin = user.roles.includes('ADMIN')
      if (existing.status !== 'DRAFT' && !isAdmin) {
        set.status = 403
        return { error: 'Cannot update request that is not in DRAFT status' }
      }

      const allowedFields = [
        'title',
        'description',
        'type',
        'priority',
        'projectId',
        'affectedSystem',
        'businessImpact',
        'acceptanceCriteria',
        'dueDate',
      ]

      const data: any = {}
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          if (field === 'dueDate') {
            data[field] = body[field] ? new Date(body[field]) : null
          } else if (field === 'projectId') {
            data[field] = body[field] || null
          } else {
            data[field] = body[field]
          }
        }
      }

      const updated = await db.request.update({
        where: { id },
        data,
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
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
        },
      })

      return { request: updated }
    } catch (error) {
      console.error('Update request error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // DELETE /api/requests/:id - Soft delete (set status to CANCELLED)
  .delete('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const existing = await db.request.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Request not found' }
      }

      const updated = await db.request.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
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
        },
      })

      return { request: updated }
    } catch (error) {
      console.error('Delete request error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/requests/:id/submit - Submit request (DRAFT → SUBMITTED)
  .post('/:id/submit', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const req = await db.request.findUnique({ where: { id } })
      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      if (req.status !== 'DRAFT') {
        set.status = 400
        return { error: `Cannot submit request with status ${req.status}. Must be in DRAFT status.` }
      }

      const updated = await db.request.update({
        where: { id },
        data: { status: 'SUBMITTED' },
      })

      // Create status history entry
      await db.requestStatusHistory.create({
        data: {
          requestId: id,
          fromStatus: 'DRAFT',
          toStatus: 'SUBMITTED',
          comment: 'Request submitted for review',
          changedById: user.id,
        },
      })

      return { request: updated }
    } catch (error) {
      console.error('Submit request error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/requests/:id/workflow/next-action - Get AI recommendation for next action
  .post('/:id/workflow/next-action', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const req = await db.request.findUnique({
        where: { id },
        include: {
          project: { select: { name: true } },
          assignedBA: { select: { name: true } },
          assignedDev: { select: { name: true } },
          assignedQA: { select: { name: true } },
          createdBy: { select: { name: true } },
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      })

      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      const result = await executePrompt('workflow.next_action', {
        requestTitle: req.title,
        requestStatus: req.status,
        requestType: req.type,
        requestPriority: req.priority,
        requestDescription: req.description,
        projectName: req.project?.name || 'N/A',
        assignedBA: req.assignedBA?.name || 'None',
        assignedDev: req.assignedDev?.name || 'None',
        assignedQA: req.assignedQA?.name || 'None',
        statusHistory: JSON.stringify(req.statusHistory.map(h => ({
          from: h.fromStatus,
          to: h.toStatus,
          comment: h.comment,
          date: h.createdAt,
        }))),
        currentUserRoles: user.roles.join(', '),
      })

      return {
        recommendation: result.parsedOutput || result.output,
        runId: result.runId,
        latencyMs: result.latencyMs,
      }
    } catch (error: any) {
      console.error('Workflow next action error:', error)
      set.status = 500
      return { error: error.message || 'Failed to get AI recommendation' }
    }
  })

  // POST /api/requests/:id/workflow/transition - Transition request to a new status
  .post('/:id/workflow/transition', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { action, comment } = body

      if (!action) {
        set.status = 400
        return { error: 'Action is required' }
      }

      const req = await db.request.findUnique({ where: { id } })
      if (!req) {
        set.status = 404
        return { error: 'Request not found' }
      }

      // Map action to target status
      const actionToStatus: Record<string, string> = {
        submit: 'SUBMITTED',
        approve: 'APPROVED',
        reject: 'REJECTED',
        assign: 'ASSIGNED',
        start_development: 'IN_DEVELOPMENT',
        move_to_qa: 'QA',
        move_to_uat: 'UAT',
        complete: 'COMPLETED',
        close: 'CLOSED',
        reopen: 'DRAFT',
      }

      const targetStatus = actionToStatus[action]
      if (!targetStatus) {
        set.status = 400
        return { error: `Unknown action: ${action}` }
      }

      // Validate transition
      const currentTransitions = VALID_TRANSITIONS[req.status]
      if (!currentTransitions || !currentTransitions[targetStatus]) {
        set.status = 400
        return { error: `Transition from ${req.status} to ${targetStatus} is not allowed` }
      }

      // Check role permissions
      const allowedRoles = currentTransitions[targetStatus]
      const hasPermission = user.roles.some((role) => allowedRoles.includes(role))
      if (!hasPermission) {
        set.status = 403
        return { error: `You do not have permission to transition from ${req.status} to ${targetStatus}` }
      }

      const updated = await db.request.update({
        where: { id },
        data: {
          status: targetStatus,
          ...(targetStatus === 'COMPLETED' ? { completedAt: new Date() } : {}),
        },
      })

      // Create status history entry
      await db.requestStatusHistory.create({
        data: {
          requestId: id,
          fromStatus: req.status,
          toStatus: targetStatus,
          comment: comment || `Status changed via action: ${action}`,
          changedById: user.id,
        },
      })

      return { request: updated }
    } catch (error) {
      console.error('Workflow transition error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/requests - List requests with filters and pagination
  .get('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status') || undefined
      const type = searchParams.get('type') || undefined
      const priority = searchParams.get('priority') || undefined
      const projectId = searchParams.get('projectId') || undefined
      const assignedToMe = searchParams.get('assignedToMe') === 'true'
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const skip = (page - 1) * limit

      const where: any = {}
      if (status) where.status = status
      if (type) where.type = type
      if (priority) where.priority = priority
      if (projectId) where.projectId = projectId
      if (assignedToMe) {
        where.OR = [
          { assignedBAId: user.id },
          { assignedDevId: user.id },
          { assignedQAId: user.id },
          { createdById: user.id },
        ]
      }

      const [requests, total] = await Promise.all([
        db.request.findMany({
          where,
          include: {
            project: {
              select: { id: true, name: true, code: true },
            },
            createdBy: {
              select: { id: true, name: true, email: true },
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
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db.request.count({ where }),
      ])

      return {
        requests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      console.error('List requests error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/requests - Create request
  .post('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const {
        title,
        description,
        type,
        priority,
        projectId,
        affectedSystem,
        businessImpact,
        acceptanceCriteria,
        dueDate,
      } = body

      if (!title || !description || !type) {
        set.status = 400
        return { error: 'Title, description, and type are required' }
      }

      // Auto-generate request code: REQ-YYYY-NNNN
      const now = new Date()
      const year = now.getFullYear()
      const prefix = `REQ-${year}-`

      // Find the highest existing code for this year
      const lastRequest = await db.request.findFirst({
        where: { code: { startsWith: prefix } },
        orderBy: { code: 'desc' },
        select: { code: true },
      })

      let nextNum = 1
      if (lastRequest?.code) {
        const parts = lastRequest.code.split('-')
        const lastNum = parseInt(parts[2], 10)
        if (!isNaN(lastNum)) {
          nextNum = lastNum + 1
        }
      }

      const code = `${prefix}${nextNum.toString().padStart(4, '0')}`

      const newRequest = await db.request.create({
        data: {
          code,
          title,
          description,
          type,
          priority: priority || 'MEDIUM',
          projectId: projectId || null,
          affectedSystem: affectedSystem || null,
          businessImpact: businessImpact || null,
          acceptanceCriteria: acceptanceCriteria || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          createdById: user.id,
          status: 'DRAFT',
        },
        include: {
          project: {
            select: { id: true, name: true, code: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
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
        },
      })

      // Create initial status history entry
      await db.requestStatusHistory.create({
        data: {
          requestId: newRequest.id,
          fromStatus: null,
          toStatus: 'DRAFT',
          comment: 'Request created',
          changedById: user.id,
        },
      })

      set.status = 201
      return { request: newRequest }
    } catch (error) {
      console.error('Create request error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
