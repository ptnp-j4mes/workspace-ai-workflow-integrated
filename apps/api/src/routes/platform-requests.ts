import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'
import { logAudit } from '../lib/services/audit-service'
import { generateDocumentNo } from '../lib/services/document-number-service'

export const platformRequestsRoutes = new Elysia({ prefix: '/api/platform-requests' })
  // GET /api/platform-requests - List platform requests with filters and pagination
  .get('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status') || undefined
      const mine = searchParams.get('mine') === 'true'
      const pendingApproval = searchParams.get('pendingApproval') === 'true'
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const skip = (page - 1) * limit

      const where: any = {}
      if (status) where.status = status

      if (mine) {
        where.requesterId = user.id
      }

      if (pendingApproval) {
        where.approvals = {
          some: {
            approverId: user.id,
            status: 'PENDING',
          },
        }
      }

      const include = {
        requester: {
          select: { id: true, name: true, email: true },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            parent: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        project: {
          select: { id: true, name: true, status: true },
        },
      }

      const [platformRequests, total] = await Promise.all([
        db.platformRequest.findMany({
          where,
          include,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db.platformRequest.count({ where }),
      ])

      return {
        data: platformRequests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      console.error('List platform requests error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/platform-requests - Create a new platform request
  .post('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { name, description, objective, targetUsers, expectedTimeline, priority } = body

      if (!name || !description) {
        set.status = 400
        return { error: 'Name and description are required' }
      }

      // Resolve requester's department
      const requester = await db.user.findUnique({
        where: { id: user.id },
        include: { department: { include: { parent: true } } },
      })

      let departmentId: string | null = null
      let divisionDepartmentId: string | null = null

      if (requester?.department) {
        departmentId = requester.department.id
        if (requester.department.type === 'SECTION' && requester.department.parentId) {
          // User is in a section — the division is the parent
          divisionDepartmentId = requester.department.parentId
        } else if (requester.department.type === 'DIVISION') {
          divisionDepartmentId = requester.department.id
        }
      }

      // Resolve division head
      let divisionHeadId: string | null = null
      if (divisionDepartmentId) {
        // Find a user in the division department with role DIVISION_MANAGER or similar
        const divisionManager = await db.user.findFirst({
          where: {
            departmentId: divisionDepartmentId,
            isActive: true,
            roles: {
              some: {
                role: {
                  key: {
                    in: ['DIVISION_MANAGER', 'DIVISION_HEAD', 'MANAGER'],
                  },
                },
              },
            },
          },
        })

        if (divisionManager) {
          divisionHeadId = divisionManager.id
        } else {
          // Fallback: find any admin/manager in the division department
          const fallbackManager = await db.user.findFirst({
            where: {
              departmentId: divisionDepartmentId,
              isActive: true,
              roles: {
                some: {
                  role: {
                    key: {
                      in: ['ADMIN', 'MANAGER'],
                    },
                  },
                },
              },
            },
          })
          if (fallbackManager) {
            divisionHeadId = fallbackManager.id
          }
        }
      }

      // Resolve SD Manager
      let sdManagerId: string | null = null
      const sdManager = await db.user.findFirst({
        where: {
          isActive: true,
          roles: {
            some: {
              role: {
                key: {
                  in: ['IT_MANAGER', 'SD_MANAGER'],
                },
              },
            },
          },
        },
      })

      if (sdManager) {
        sdManagerId = sdManager.id
      } else {
        // Fallback: find any admin user
        const adminUser = await db.user.findFirst({
          where: {
            isActive: true,
            roles: {
              some: {
                role: { key: 'ADMIN' },
              },
            },
          },
        })
        if (adminUser) {
          sdManagerId = adminUser.id
        }
      }

      // Create the platform request first (without requestNo)
      const platformRequest = await db.platformRequest.create({
        data: {
          requestNo: `TEMP-${Date.now()}`, // Temporary, will update after generating
          name,
          description,
          objective: objective || null,
          targetUsers: targetUsers || null,
          expectedTimeline: expectedTimeline || null,
          priority: priority || 'MEDIUM',
          status: 'PENDING',
          requesterId: user.id,
          departmentId,
          divisionHeadId,
          sdManagerId,
          approvals: {
            create: [
              {
                step: 'DIVISION_HEAD',
                status: 'PENDING',
                approverId: divisionHeadId || user.id, // Placeholder if no division head found
              },
              {
                step: 'SD_MANAGER',
                status: 'PENDING',
                approverId: sdManagerId || user.id, // Placeholder if no SD manager found
              },
            ],
          },
        },
      })

      // Generate the requestNo using document number service
      const requestNo = await generateDocumentNo(
        'PLATFORM',
        'PlatformRequest',
        platformRequest.id,
        user.id
      )

      // Update with the generated requestNo
      const updatedRequest = await db.platformRequest.update({
        where: { id: platformRequest.id },
        data: { requestNo },
        include: {
          requester: {
            select: { id: true, name: true, email: true },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
              parent: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          divisionHead: {
            select: { id: true, name: true, email: true },
          },
          sdManager: {
            select: { id: true, name: true, email: true },
          },
          project: {
            select: { id: true, name: true, status: true },
          },
          approvals: {
            include: {
              approver: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      })

      // Audit log
      await logAudit({
        userId: user.id,
        action: 'CREATE_PLATFORM_REQUEST',
        entity: 'PlatformRequest',
        entityId: platformRequest.id,
        newValue: {
          requestNo,
          name,
          priority: priority || 'MEDIUM',
          status: 'PENDING',
        },
      })

      set.status = 201
      return { data: updatedRequest }
    } catch (error) {
      console.error('Create platform request error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // GET /api/platform-requests/:id - Get single platform request with full details
  .get('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const platformRequest = await db.platformRequest.findUnique({
        where: { id },
        include: {
          requester: {
            select: { id: true, name: true, email: true },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
              description: true,
              parent: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          divisionHead: {
            select: { id: true, name: true, email: true },
          },
          sdManager: {
            select: { id: true, name: true, email: true },
          },
          project: {
            select: { id: true, name: true, status: true, code: true },
          },
          approvals: {
            include: {
              approver: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      if (!platformRequest) {
        set.status = 404
        return { error: 'Platform request not found' }
      }

      return { data: platformRequest }
    } catch (error) {
      console.error('Get platform request error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // PATCH /api/platform-requests/:id - Update platform request (only if PENDING and owner)
  .patch('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const existingRequest = await db.platformRequest.findUnique({
        where: { id },
      })

      if (!existingRequest) {
        set.status = 404
        return { error: 'Platform request not found' }
      }

      // Only the requester can update, and only when status is PENDING
      if (existingRequest.requesterId !== user.id) {
        set.status = 403
        return { error: 'Only the requester can update this platform request' }
      }

      if (existingRequest.status !== 'PENDING') {
        set.status = 400
        return { error: 'Can only update platform requests in PENDING status' }
      }

      const body = await request.json()
      const { name, description, objective, targetUsers, expectedTimeline, priority, status } = body

      // Only allow specific status change: CANCELLED
      if (status && status !== 'CANCELLED') {
        set.status = 400
        return { error: 'Only CANCELLED status is allowed via update' }
      }

      const updateData: any = {}
      if (name !== undefined) updateData.name = name
      if (description !== undefined) updateData.description = description
      if (objective !== undefined) updateData.objective = objective
      if (targetUsers !== undefined) updateData.targetUsers = targetUsers
      if (expectedTimeline !== undefined) updateData.expectedTimeline = expectedTimeline
      if (priority !== undefined) {
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
        if (!validPriorities.includes(priority)) {
          set.status = 400
          return { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` }
        }
        updateData.priority = priority
      }
      if (status === 'CANCELLED') updateData.status = 'CANCELLED'

      const updatedRequest = await db.platformRequest.update({
        where: { id },
        data: updateData,
        include: {
          requester: {
            select: { id: true, name: true, email: true },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
              parent: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          divisionHead: {
            select: { id: true, name: true, email: true },
          },
          sdManager: {
            select: { id: true, name: true, email: true },
          },
          project: {
            select: { id: true, name: true, status: true },
          },
          approvals: {
            include: {
              approver: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      // Audit log
      await logAudit({
        userId: user.id,
        action: status === 'CANCELLED' ? 'CANCEL_PLATFORM_REQUEST' : 'UPDATE_PLATFORM_REQUEST',
        entity: 'PlatformRequest',
        entityId: id,
        oldValue: {
          name: existingRequest.name,
          priority: existingRequest.priority,
          status: existingRequest.status,
        },
        newValue: updateData,
      })

      return { data: updatedRequest }
    } catch (error) {
      console.error('Update platform request error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
  // POST /api/platform-requests/:id/approve - Approve or reject a platform request
  .post('/:id/approve', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { action, comment } = body

      if (!action || !['APPROVE', 'REJECT'].includes(action)) {
        set.status = 400
        return { error: 'Action must be APPROVE or REJECT' }
      }

      // Fetch the platform request with approvals
      const platformRequest = await db.platformRequest.findUnique({
        where: { id },
        include: {
          approvals: {
            include: {
              approver: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          requester: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      if (!platformRequest) {
        set.status = 404
        return { error: 'Platform request not found' }
      }

      // Check if request is in an actionable status
      if (!['PENDING', 'DIVISION_APPROVED'].includes(platformRequest.status)) {
        set.status = 400
        return { error: `Cannot act on platform request with status ${platformRequest.status}` }
      }

      // Find the current pending approval for this user
      const pendingApproval = platformRequest.approvals.find(
        (a) => a.approverId === user.id && a.status === 'PENDING'
      )

      if (!pendingApproval) {
        set.status = 403
        return { error: 'You are not authorized to approve/reject this request, or there is no pending action for you' }
      }

      const now = new Date()

      if (action === 'REJECT') {
        // Mark the current step approval as REJECTED
        await db.platformRequestApproval.update({
          where: { id: pendingApproval.id },
          data: {
            status: 'REJECTED',
            comment: comment || null,
            actedAt: now,
          },
        })

        // Update PlatformRequest status to REJECTED
        const updatedRequest = await db.platformRequest.update({
          where: { id },
          data: {
            status: 'REJECTED',
            rejectionReason: comment || null,
          },
          include: {
            requester: {
              select: { id: true, name: true, email: true },
            },
            department: {
              select: {
                id: true,
                name: true,
                code: true,
                parent: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
            divisionHead: {
              select: { id: true, name: true, email: true },
            },
            sdManager: {
              select: { id: true, name: true, email: true },
            },
            project: {
              select: { id: true, name: true, status: true },
            },
            approvals: {
              include: {
                approver: {
                  select: { id: true, name: true, email: true },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        })

        // Audit log
        await logAudit({
          userId: user.id,
          action: 'REJECT_PLATFORM_REQUEST',
          entity: 'PlatformRequest',
          entityId: id,
          newValue: {
            step: pendingApproval.step,
            comment: comment || null,
            status: 'REJECTED',
          },
        })

        return { data: updatedRequest }
      }

      // action === 'APPROVE'
      if (pendingApproval.step === 'DIVISION_HEAD') {
        // Mark DIVISION_HEAD approval as APPROVED
        await db.platformRequestApproval.update({
          where: { id: pendingApproval.id },
          data: {
            status: 'APPROVED',
            comment: comment || null,
            actedAt: now,
          },
        })

        // Update PlatformRequest status to DIVISION_APPROVED
        const updatedRequest = await db.platformRequest.update({
          where: { id },
          data: {
            status: 'DIVISION_APPROVED',
          },
          include: {
            requester: {
              select: { id: true, name: true, email: true },
            },
            department: {
              select: {
                id: true,
                name: true,
                code: true,
                parent: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
            divisionHead: {
              select: { id: true, name: true, email: true },
            },
            sdManager: {
              select: { id: true, name: true, email: true },
            },
            project: {
              select: { id: true, name: true, status: true },
            },
            approvals: {
              include: {
                approver: {
                  select: { id: true, name: true, email: true },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        })

        // Audit log
        await logAudit({
          userId: user.id,
          action: 'APPROVE_PLATFORM_REQUEST_DIVISION',
          entity: 'PlatformRequest',
          entityId: id,
          newValue: {
            step: 'DIVISION_HEAD',
            comment: comment || null,
            newStatus: 'DIVISION_APPROVED',
          },
        })

        return { data: updatedRequest }
      }

      if (pendingApproval.step === 'SD_MANAGER') {
        // Mark SD_MANAGER approval as APPROVED
        await db.platformRequestApproval.update({
          where: { id: pendingApproval.id },
          data: {
            status: 'APPROVED',
            comment: comment || null,
            actedAt: now,
          },
        })

        // Auto-create a Project linked to this request
        const projectCode = await generateDocumentNo(
          'PROJECT',
          'Project',
          undefined,
          user.id
        )

        const project = await db.project.create({
          data: {
            code: projectCode,
            name: platformRequest.name,
            description: platformRequest.description,
            aitNo: platformRequest.requestNo,
            status: 'INITIATION',
            createdById: platformRequest.requesterId,
            members: {
              create: {
                userId: platformRequest.requesterId,
                role: 'PROJECT_MANAGER',
              },
            },
          },
        })

        // Update PlatformRequest: status APPROVED → LINKED, set approvedAt and projectId
        const updatedRequest = await db.platformRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedAt: now,
            projectId: project.id,
          },
        })

        // Now set status to LINKED after project is linked
        const finalRequest = await db.platformRequest.update({
          where: { id },
          data: { status: 'LINKED' },
          include: {
            requester: {
              select: { id: true, name: true, email: true },
            },
            department: {
              select: {
                id: true,
                name: true,
                code: true,
                parent: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
            divisionHead: {
              select: { id: true, name: true, email: true },
            },
            sdManager: {
              select: { id: true, name: true, email: true },
            },
            project: {
              select: { id: true, name: true, status: true, code: true },
            },
            approvals: {
              include: {
                approver: {
                  select: { id: true, name: true, email: true },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        })

        // Audit log
        await logAudit({
          userId: user.id,
          action: 'APPROVE_PLATFORM_REQUEST_SD',
          entity: 'PlatformRequest',
          entityId: id,
          newValue: {
            step: 'SD_MANAGER',
            comment: comment || null,
            status: 'LINKED',
            projectId: project.id,
            projectCode,
          },
        })

        return { data: finalRequest }
      }

      // Should not reach here
      set.status = 400
      return { error: 'Invalid approval step' }
    } catch (error) {
      console.error('Approve/reject platform request error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
