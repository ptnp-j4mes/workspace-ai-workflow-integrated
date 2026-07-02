import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'
import { hashPassword } from '../lib/auth'
import { logAudit } from '../lib/services/audit-service'
import { renderTemplate } from '../lib/services/smtp-service'

function isAdminRole(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

function hasDocumentNumberPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

function hasIntegrationsPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

function hasSettingsPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

function hasUserWritePermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER') || roles.includes('HR_MANAGER')
}

function hasManageRolesPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

export const adminRoutes = new Elysia({ prefix: '/api/admin' })
  // GET /api/admin/ai-settings - Get AI provider configuration
  .get('/ai-settings', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const isAdmin = authUser.roles.includes('ADMIN') || authUser.roles.includes('IT_MANAGER')
      if (!isAdmin) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const configs = await db.aiProviderConfig.findMany({
        orderBy: { provider: 'asc' },
      })

      // Mask API keys
      const masked = configs.map((c) => ({
        ...c,
        apiKeyEnc: c.apiKeyEnc ? '***' : null,
      }))

      return { data: masked }
    } catch (error) {
      console.error('Get AI settings error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/approval-workflows - List approval workflows
  .get('/approval-workflows', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const entityType = searchParams.get('entityType') || undefined
      const isActive = searchParams.get('isActive')

      const where: Record<string, unknown> = {}
      if (entityType) where.entityType = entityType
      if (isActive !== null && isActive !== undefined) {
        where.isActive = isActive === 'true'
      }

      const workflows = await db.approvalWorkflow.findMany({
        where,
        orderBy: { workflowKey: 'asc' },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      })

      return { data: workflows }
    } catch (error) {
      console.error('List approval workflows error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/admin/approval-workflows - Create approval workflow
  .post('/approval-workflows', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!isAdminRole(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const body = await request.json()
      const { workflowKey, entityType, name, description, isActive, steps } = body

      if (!workflowKey || !entityType || !name) {
        set.status = 400
        return { error: 'workflowKey, entityType, and name are required' }
      }

      // Check for duplicate key
      const existing = await db.approvalWorkflow.findUnique({ where: { workflowKey } })
      if (existing) {
        set.status = 400
        return { error: 'Workflow key already exists' }
      }

      const workflow = await db.approvalWorkflow.create({
        data: {
          workflowKey,
          entityType,
          name,
          description: description ?? null,
          isActive: isActive ?? true,
          steps: steps && Array.isArray(steps) && steps.length > 0
            ? {
                create: steps.map((step: Record<string, unknown>, index: number) => ({
                  stepOrder: (step.stepOrder as number) ?? index + 1,
                  stepName: step.stepName as string,
                  approverRole: (step.approverRole as string) ?? null,
                  approverUserId: (step.approverUserId as string) ?? null,
                  requiredAction: (step.requiredAction as string) ?? 'APPROVE',
                  isRequired: (step.isRequired as boolean) ?? true,
                  slaHours: (step.slaHours as number) ?? null,
                })),
              }
            : undefined,
        },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CREATE_APPROVAL_WORKFLOW',
        entity: 'ApprovalWorkflow',
        entityId: workflow.id,
        newValue: { workflowKey, entityType, name, stepCount: workflow.steps.length },
      })

      set.status = 201
      return { data: workflow }
    } catch (error) {
      console.error('Create approval workflow error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/admin/approval-workflows/:id - Update approval workflow
  .patch('/approval-workflows/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!isAdminRole(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const { id } = params
      const body = await request.json()

      const existing = await db.approvalWorkflow.findUnique({
        where: { id },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      })

      if (!existing) {
        set.status = 404
        return { error: 'Approval workflow not found' }
      }

      // Update workflow fields
      const updateData: Record<string, unknown> = {}
      const allowedFields = ['name', 'description', 'entityType', 'isActive']
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field]
        }
      }

      // Handle steps update if provided
      if (body.steps && Array.isArray(body.steps)) {
        // Delete existing steps and recreate
        await db.approvalStep.deleteMany({ where: { workflowId: id } })

        updateData.steps = {
          create: body.steps.map((step: Record<string, unknown>, index: number) => ({
            stepOrder: (step.stepOrder as number) ?? index + 1,
            stepName: step.stepName as string,
            approverRole: (step.approverRole as string) ?? null,
            approverUserId: (step.approverUserId as string) ?? null,
            requiredAction: (step.requiredAction as string) ?? 'APPROVE',
            isRequired: (step.isRequired as boolean) ?? true,
            slaHours: (step.slaHours as number) ?? null,
          })),
        }
      }

      const updated = await db.approvalWorkflow.update({
        where: { id },
        data: updateData,
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_APPROVAL_WORKFLOW',
        entity: 'ApprovalWorkflow',
        entityId: id,
        oldValue: { name: existing.name, workflowKey: existing.workflowKey, stepCount: existing.steps.length },
        newValue: { name: updated.name, workflowKey: updated.workflowKey, stepCount: updated.steps.length },
      })

      return { data: updated }
    } catch (error) {
      console.error('Update approval workflow error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/audit-logs - List audit logs with pagination and filters
  .get('/audit-logs', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const isAdmin = authUser.roles.includes('ADMIN') || authUser.roles.includes('IT_MANAGER')
      if (!isAdmin) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const { searchParams } = new URL(request.url)
      const userId = searchParams.get('userId') || undefined
      const entity = searchParams.get('entity') || undefined
      const action = searchParams.get('action') || undefined
      const aitNo = searchParams.get('aitNo') || undefined
      const startDate = searchParams.get('startDate') || undefined
      const endDate = searchParams.get('endDate') || undefined
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const skip = (page - 1) * limit

      const where: Record<string, unknown> = {}
      if (userId) where.userId = userId
      if (entity) where.entity = entity
      if (action) where.action = action
      if (aitNo) where.aitNo = aitNo

      if (startDate || endDate) {
        const createdAtFilter: Record<string, Date> = {}
        if (startDate) createdAtFilter.gte = new Date(startDate)
        if (endDate) createdAtFilter.lte = new Date(endDate)
        where.createdAt = createdAtFilter
      }

      const [logs, total] = await Promise.all([
        db.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
        db.auditLog.count({ where }),
      ])

      return {
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      console.error('List audit logs error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/departments - List departments with hierarchy
  .get('/departments', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      // Fetch all departments with their parent info
      const departments = await db.department.findMany({
        orderBy: [{ type: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          parent: {
            select: { id: true, name: true, code: true },
          },
          children: {
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            include: {
              _count: { select: { users: true } },
            },
          },
          _count: {
            select: { users: true, children: true, jobPositions: true },
          },
        },
      })

      const formatted = departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        type: d.type,
        description: d.description,
        parentId: d.parentId,
        sortOrder: d.sortOrder,
        isActive: d.isActive,
        parent: d.parent,
        userCount: d._count.users,
        childCount: d._count.children,
        jobPositionCount: d._count.jobPositions,
        children: d.children.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          type: c.type,
          description: c.description,
          parentId: c.parentId,
          sortOrder: c.sortOrder,
          isActive: c.isActive,
          userCount: c._count.users,
        })),
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }))

      return { data: formatted }
    } catch (error) {
      console.error('List departments error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/admin/departments - Create department
  .post('/departments', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!isAdminRole(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const body = await request.json()
      const { name, code, type, description, parentId, sortOrder } = body

      if (!name || !code) {
        set.status = 400
        return { error: 'Name and code are required' }
      }

      // Validate type
      const deptType = type || 'SECTION'
      if (!['DIVISION', 'SECTION'].includes(deptType)) {
        set.status = 400
        return { error: 'Type must be DIVISION or SECTION' }
      }

      // Validate: SECTION must have a parent (division)
      if (deptType === 'SECTION' && !parentId) {
        set.status = 400
        return { error: 'Section must belong to a Division (parentId required)' }
      }

      // Check for duplicate code
      const existing = await db.department.findUnique({ where: { code } })
      if (existing) {
        set.status = 400
        return { error: 'Department code already exists' }
      }

      // Check for duplicate name
      const existingName = await db.department.findUnique({ where: { name } })
      if (existingName) {
        set.status = 400
        return { error: 'Department name already exists' }
      }

      const department = await db.department.create({
        data: {
          name,
          code,
          type: deptType,
          description: description || null,
          parentId: parentId ?? null,
          sortOrder: sortOrder ?? 0,
        },
        include: {
          parent: {
            select: { id: true, name: true, code: true },
          },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CREATE_DEPARTMENT',
        entity: 'Department',
        entityId: department.id,
        newValue: { name, code, type: deptType, description, parentId: parentId ?? null },
      })

      set.status = 201
      return { data: department }
    } catch (error) {
      console.error('Create department error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/admin/departments - Update department
  .patch('/departments', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!isAdminRole(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const body = await request.json()
      const { id, name, code, type, description, parentId, sortOrder, isActive } = body

      if (!id) {
        set.status = 400
        return { error: 'Department ID is required' }
      }

      const existing = await db.department.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Department not found' }
      }

      // If changing to SECTION, ensure parentId is set
      if (type === 'SECTION' && !parentId && !existing.parentId) {
        set.status = 400
        return { error: 'Section must belong to a Division' }
      }

      // Check duplicate code if changed
      if (code && code !== existing.code) {
        const dupCode = await db.department.findUnique({ where: { code } })
        if (dupCode) {
          set.status = 400
          return { error: 'Department code already exists' }
        }
      }

      // Check duplicate name if changed
      if (name && name !== existing.name) {
        const dupName = await db.department.findUnique({ where: { name } })
        if (dupName) {
          set.status = 400
          return { error: 'Department name already exists' }
        }
      }

      // Prevent circular parent reference
      if (parentId && parentId === id) {
        set.status = 400
        return { error: 'Department cannot be its own parent' }
      }

      const department = await db.department.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(code !== undefined && { code }),
          ...(type !== undefined && { type }),
          ...(description !== undefined && { description: description || null }),
          ...(parentId !== undefined && { parentId: parentId || null }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(isActive !== undefined && { isActive }),
        },
        include: {
          parent: {
            select: { id: true, name: true, code: true },
          },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_DEPARTMENT',
        entity: 'Department',
        entityId: department.id,
        oldValue: { name: existing.name, code: existing.code },
        newValue: { name, code, type, description, parentId, sortOrder, isActive },
      })

      return { data: department }
    } catch (error) {
      console.error('Update department error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // DELETE /api/admin/departments - Delete department
  .delete('/departments', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!isAdminRole(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')

      if (!id) {
        set.status = 400
        return { error: 'Department ID is required' }
      }

      const existing = await db.department.findUnique({
        where: { id },
        include: {
          _count: { select: { users: true, children: true } },
        },
      })
      if (!existing) {
        set.status = 404
        return { error: 'Department not found' }
      }

      // Check for dependencies
      if (existing._count.users > 0) {
        set.status = 400
        return { error: `Cannot delete: ${existing._count.users} user(s) assigned to this department` }
      }
      if (existing._count.children > 0) {
        set.status = 400
        return { error: `Cannot delete: ${existing._count.children} child department(s) exist. Delete children first.` }
      }

      await db.department.delete({ where: { id } })

      await logAudit({
        userId: authUser.id,
        action: 'DELETE_DEPARTMENT',
        entity: 'Department',
        entityId: id,
        oldValue: { name: existing.name, code: existing.code },
      })

      return { success: true }
    } catch (error) {
      console.error('Delete department error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/document-number-sequences - List document number sequences
  .get('/document-number-sequences', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasDocumentNumberPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:document_number permission required' }
      }

      const sequences = await db.documentNumberSequence.findMany({
        orderBy: { documentType: 'asc' },
      })

      return { data: sequences }
    } catch (error) {
      console.error('List document number sequences error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/admin/document-number-sequences - Create new sequence
  .post('/document-number-sequences', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasDocumentNumberPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:document_number permission required' }
      }

      const body = await request.json()
      const { documentType, prefix, year, paddingLength, formatTemplate, resetPolicy, isActive } = body

      if (!documentType || !prefix) {
        set.status = 400
        return { error: 'documentType and prefix are required' }
      }

      // Check for duplicate documentType
      const existing = await db.documentNumberSequence.findUnique({ where: { documentType } })
      if (existing) {
        set.status = 400
        return { error: 'Sequence for this document type already exists' }
      }

      const sequence = await db.documentNumberSequence.create({
        data: {
          documentType,
          prefix,
          year: year ?? new Date().getFullYear(),
          currentNumber: 0,
          paddingLength: paddingLength ?? 6,
          formatTemplate: formatTemplate ?? 'AIT-{PREFIX}-{YEAR}-{NUMBER}',
          resetPolicy: resetPolicy ?? 'YEARLY',
          isActive: isActive ?? true,
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CREATE_DOCUMENT_NUMBER_SEQUENCE',
        entity: 'DocumentNumberSequence',
        entityId: sequence.id,
        newValue: { documentType, prefix, year: sequence.year },
      })

      set.status = 201
      return { data: sequence }
    } catch (error) {
      console.error('Create document number sequence error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/admin/document-number-sequences/:id - Update sequence
  .patch('/document-number-sequences/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasDocumentNumberPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:document_number permission required' }
      }

      const { id } = params
      const body = await request.json()

      const existing = await db.documentNumberSequence.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Document number sequence not found' }
      }

      const updateData: Record<string, unknown> = {}
      const allowedFields = ['prefix', 'year', 'paddingLength', 'formatTemplate', 'resetPolicy', 'isActive']
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field]
        }
      }

      const updated = await db.documentNumberSequence.update({
        where: { id },
        data: updateData,
      })

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_DOCUMENT_NUMBER_SEQUENCE',
        entity: 'DocumentNumberSequence',
        entityId: id,
        oldValue: { documentType: existing.documentType, prefix: existing.prefix, year: existing.year },
        newValue: { documentType: updated.documentType, prefix: updated.prefix, year: updated.year },
      })

      return { data: updated }
    } catch (error) {
      console.error('Update document number sequence error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/admin/document-number-sequences/:id/reset - Reset sequence running number
  .post('/document-number-sequences/:id/reset', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasDocumentNumberPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:document_number permission required' }
      }

      const { id } = params

      const existing = await db.documentNumberSequence.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Document number sequence not found' }
      }

      const body = await request.json().catch(() => ({}))
      const newNumber = body.newNumber ?? 0
      const newYear = body.newYear ?? new Date().getFullYear()

      const updated = await db.documentNumberSequence.update({
        where: { id },
        data: {
          currentNumber: newNumber,
          year: newYear,
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'RESET_DOCUMENT_NUMBER_SEQUENCE',
        entity: 'DocumentNumberSequence',
        entityId: id,
        oldValue: { documentType: existing.documentType, currentNumber: existing.currentNumber, year: existing.year },
        newValue: { documentType: updated.documentType, currentNumber: updated.currentNumber, year: updated.year },
      })

      return { data: updated }
    } catch (error) {
      console.error('Reset document number sequence error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/email-logs - List email delivery logs with pagination and filters
  .get('/email-logs', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status') || undefined
      const templateKey = searchParams.get('templateKey') || undefined
      const toEmail = searchParams.get('toEmail') || undefined
      const aitNo = searchParams.get('aitNo') || undefined
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const skip = (page - 1) * limit

      const where: Record<string, unknown> = {}
      if (status) where.status = status
      if (templateKey) where.templateKey = templateKey
      if (toEmail) where.toEmail = { contains: toEmail }
      if (aitNo) where.aitNo = aitNo

      const [logs, total] = await Promise.all([
        db.emailDeliveryLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db.emailDeliveryLog.count({ where }),
      ])

      return {
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      console.error('List email logs error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/email-templates - List email templates
  .get('/email-templates', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const isActive = searchParams.get('isActive')
      const category = searchParams.get('category') || undefined

      const where: Record<string, unknown> = {}
      if (isActive !== null && isActive !== undefined) {
        where.isActive = isActive === 'true'
      }
      if (category) {
        where.templateKey = { contains: category }
      }

      const templates = await db.emailTemplate.findMany({
        where,
        orderBy: { templateKey: 'asc' },
      })

      return { data: templates }
    } catch (error) {
      console.error('List email templates error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/admin/email-templates - Create email template
  .post('/email-templates', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasIntegrationsPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:integrations permission required' }
      }

      const body = await request.json()
      const { templateKey, name, subjectTemplate, bodyHtmlTemplate, bodyTextTemplate, variablesJson, isActive } = body

      if (!templateKey || !name || !subjectTemplate || !bodyHtmlTemplate) {
        set.status = 400
        return { error: 'templateKey, name, subjectTemplate, and bodyHtmlTemplate are required' }
      }

      // Check for duplicate key
      const existing = await db.emailTemplate.findUnique({ where: { templateKey } })
      if (existing) {
        set.status = 400
        return { error: 'Template key already exists' }
      }

      const template = await db.emailTemplate.create({
        data: {
          templateKey,
          name,
          subjectTemplate,
          bodyHtmlTemplate,
          bodyTextTemplate: bodyTextTemplate ?? null,
          variablesJson: variablesJson ?? null,
          isActive: isActive ?? true,
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CREATE_EMAIL_TEMPLATE',
        entity: 'EmailTemplate',
        entityId: template.id,
        newValue: { templateKey, name },
      })

      set.status = 201
      return { data: template }
    } catch (error) {
      console.error('Create email template error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/admin/email-templates/:id - Update email template
  .patch('/email-templates/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasIntegrationsPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:integrations permission required' }
      }

      const { id } = params
      const body = await request.json()

      const existing = await db.emailTemplate.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Email template not found' }
      }

      const updateData: Record<string, unknown> = {}
      const allowedFields = ['name', 'subjectTemplate', 'bodyHtmlTemplate', 'bodyTextTemplate', 'variablesJson', 'isActive']
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field]
        }
      }

      const updated = await db.emailTemplate.update({
        where: { id },
        data: updateData,
      })

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_EMAIL_TEMPLATE',
        entity: 'EmailTemplate',
        entityId: id,
        oldValue: { name: existing.name, templateKey: existing.templateKey },
        newValue: { name: updated.name, templateKey: updated.templateKey },
      })

      return { data: updated }
    } catch (error) {
      console.error('Update email template error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/admin/email-templates/:id/preview - Preview email template with variables
  .post('/email-templates/:id/preview', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasIntegrationsPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:integrations permission required' }
      }

      const { id } = params
      const body = await request.json()
      const { variables } = body as { variables?: Record<string, string> }

      const template = await db.emailTemplate.findUnique({ where: { id } })
      if (!template) {
        set.status = 404
        return { error: 'Email template not found' }
      }

      // If template has a key, use the renderTemplate service; otherwise manual substitution
      const vars = variables ?? {}

      const replaceVars = (str: string): string => {
        return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
          if (vars[varName] !== undefined) {
            return vars[varName]
          }
          return match
        })
      }

      const preview = {
        subject: replaceVars(template.subjectTemplate),
        html: replaceVars(template.bodyHtmlTemplate),
        text: template.bodyTextTemplate ? replaceVars(template.bodyTextTemplate) : null,
        templateKey: template.templateKey,
        name: template.name,
      }

      return { data: preview }
    } catch (error) {
      console.error('Preview email template error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/github/connections - List GitHub connections (mask tokens)
  .get('/github/connections', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const connections = await db.githubConnection.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
          repositories: {
            select: {
              id: true,
              fullName: true,
              defaultBranch: true,
              visibility: true,
              lastSyncedAt: true,
            },
          },
        },
      })

      // Mask tokens
      const masked = connections.map((c) => ({
        ...c,
        tokenEncrypted: '***',
      }))

      return { data: masked }
    } catch (error) {
      console.error('List GitHub connections error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/admin/github/connections - Create GitHub connection
  .post('/github/connections', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasIntegrationsPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:integrations permission required' }
      }

      const body = await request.json()
      const { connectionName, authType, tokenEncrypted, owner, isActive } = body

      if (!connectionName || !owner) {
        set.status = 400
        return { error: 'connectionName and owner are required' }
      }

      const connection = await db.githubConnection.create({
        data: {
          connectionName,
          authType: authType ?? 'TOKEN',
          tokenEncrypted: tokenEncrypted ?? null,
          owner,
          isActive: isActive ?? true,
          createdById: authUser.id,
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CREATE_GITHUB_CONNECTION',
        entity: 'GithubConnection',
        entityId: connection.id,
        newValue: { connectionName, authType: connection.authType, owner, tokenEncrypted: '***' },
      })

      set.status = 201
      return { data: { ...connection, tokenEncrypted: '***' } }
    } catch (error) {
      console.error('Create GitHub connection error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/admin/github/connections/:id - Update GitHub connection
  .patch('/github/connections/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasIntegrationsPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:integrations permission required' }
      }

      const { id } = params
      const body = await request.json()

      const existing = await db.githubConnection.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'GitHub connection not found' }
      }

      const updateData: Record<string, unknown> = {}
      const allowedFields = ['connectionName', 'authType', 'tokenEncrypted', 'owner', 'isActive']
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field]
        }
      }

      const updated = await db.githubConnection.update({
        where: { id },
        data: updateData,
      })

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_GITHUB_CONNECTION',
        entity: 'GithubConnection',
        entityId: id,
        oldValue: { ...existing, tokenEncrypted: '***' },
        newValue: { ...updated, tokenEncrypted: '***' },
      })

      return { data: { ...updated, tokenEncrypted: '***' } }
    } catch (error) {
      console.error('Update GitHub connection error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // DELETE /api/admin/github/connections/:id - Delete GitHub connection
  .delete('/github/connections/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasIntegrationsPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:integrations permission required' }
      }

      const { id } = params

      const existing = await db.githubConnection.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'GitHub connection not found' }
      }

      await db.githubConnection.delete({ where: { id } })

      await logAudit({
        userId: authUser.id,
        action: 'DELETE_GITHUB_CONNECTION',
        entity: 'GithubConnection',
        entityId: id,
        oldValue: { connectionName: existing.connectionName, owner: existing.owner, tokenEncrypted: '***' },
      })

      return { data: { deleted: true } }
    } catch (error) {
      console.error('Delete GitHub connection error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/job-runs - List job run history with filters
  .get('/job-runs', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const isAdmin = authUser.roles.includes('ADMIN') || authUser.roles.includes('IT_MANAGER')
      if (!isAdmin) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const { searchParams } = new URL(request.url)
      const jobKey = searchParams.get('jobKey') || undefined
      const status = searchParams.get('status') || undefined
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const skip = (page - 1) * limit

      const where: Record<string, unknown> = {}
      if (jobKey) where.jobKey = jobKey
      if (status) where.status = status

      const [runs, total] = await Promise.all([
        db.backgroundJobRun.findMany({
          where,
          orderBy: { startedAt: 'desc' },
          skip,
          take: limit,
          include: {
            job: {
              select: { name: true, jobKey: true },
            },
          },
        }),
        db.backgroundJobRun.count({ where }),
      ])

      return {
        data: runs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      console.error('List job runs error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/jobs - List background jobs with status
  .get('/jobs', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const isAdmin = authUser.roles.includes('ADMIN') || authUser.roles.includes('IT_MANAGER')
      if (!isAdmin) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const jobs = await db.backgroundJob.findMany({
        orderBy: { jobKey: 'asc' },
        include: {
          runs: {
            take: 1,
            orderBy: { startedAt: 'desc' },
          },
        },
      })

      const formatted = jobs.map((job) => ({
        ...job,
        lastRun: job.runs[0] ?? null,
        runs: undefined,
      }))

      return { data: formatted }
    } catch (error) {
      console.error('List background jobs error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/admin/jobs/:jobKey - Enable/disable job
  .patch('/jobs/:jobKey', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const isAdmin = authUser.roles.includes('ADMIN') || authUser.roles.includes('IT_MANAGER')
      if (!isAdmin) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const { jobKey } = params
      const body = await request.json()
      const { isEnabled } = body

      if (isEnabled === undefined) {
        set.status = 400
        return { error: 'isEnabled is required' }
      }

      const existing = await db.backgroundJob.findUnique({ where: { jobKey } })
      if (!existing) {
        set.status = 404
        return { error: 'Background job not found' }
      }

      const updated = await db.backgroundJob.update({
        where: { jobKey },
        data: { isEnabled },
      })

      await logAudit({
        userId: authUser.id,
        action: isEnabled ? 'ENABLE_BACKGROUND_JOB' : 'DISABLE_BACKGROUND_JOB',
        entity: 'BackgroundJob',
        entityId: jobKey,
        oldValue: { isEnabled: existing.isEnabled },
        newValue: { isEnabled: updated.isEnabled },
      })

      return { data: updated }
    } catch (error) {
      console.error('Update background job error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/admin/jobs/:jobKey/run - Trigger manual run
  .post('/jobs/:jobKey/run', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const isAdmin = authUser.roles.includes('ADMIN') || authUser.roles.includes('IT_MANAGER')
      if (!isAdmin) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const { jobKey } = params

      const job = await db.backgroundJob.findUnique({ where: { jobKey } })
      if (!job) {
        set.status = 404
        return { error: 'Background job not found' }
      }

      if (!job.isEnabled) {
        set.status = 400
        return { error: 'Cannot run a disabled job' }
      }

      // Create a new job run record
      const jobRun = await db.backgroundJobRun.create({
        data: {
          jobKey,
          status: 'RUNNING',
          startedAt: new Date(),
        },
      })

      // Update the job's last run info
      await db.backgroundJob.update({
        where: { jobKey },
        data: {
          lastRunAt: new Date(),
          lastStatus: 'RUNNING',
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'TRIGGER_BACKGROUND_JOB',
        entity: 'BackgroundJob',
        entityId: jobKey,
        newValue: { jobRunId: jobRun.id, status: 'RUNNING' },
      })

      // In a real system, this would enqueue the job for execution.
      // For now, we simulate a quick completion after a brief delay.
      // The actual job execution logic would be in a separate worker process.

      // Simulate immediate completion for dev mode
      const isDevMode = process.env.NODE_ENV !== 'production'
      if (isDevMode) {
        await db.backgroundJobRun.update({
          where: { id: jobRun.id },
          data: {
            status: 'SUCCESS',
            finishedAt: new Date(),
            result: JSON.stringify({ message: 'Job completed (dev simulation)', triggeredBy: authUser.id }),
            durationMs: 100,
          },
        })

        await db.backgroundJob.update({
          where: { jobKey },
          data: {
            lastStatus: 'SUCCESS',
            nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
          },
        })
      }

      return {
        data: {
          jobRunId: jobRun.id,
          jobKey,
          status: isDevMode ? 'SUCCESS' : 'RUNNING',
          message: isDevMode ? 'Job completed (dev simulation)' : 'Job triggered successfully',
        },
      }
    } catch (error) {
      console.error('Trigger background job error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/notification-rules - List notification rules
  .get('/notification-rules', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const isActive = searchParams.get('isActive')

      const where: Record<string, unknown> = {}
      if (isActive !== null && isActive !== undefined) {
        where.isActive = isActive === 'true'
      }

      const rules = await db.notificationRule.findMany({
        where,
        orderBy: { eventKey: 'asc' },
      })

      return { data: rules }
    } catch (error) {
      console.error('List notification rules error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/admin/notification-rules - Update notification rules (bulk)
  .patch('/notification-rules', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const isAdmin = authUser.roles.includes('ADMIN') || authUser.roles.includes('IT_MANAGER')
      if (!isAdmin) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const body = await request.json()
      const { rules } = body as { rules: Array<{ eventKey: string; isActive: boolean; channels?: string }> }

      if (!Array.isArray(rules) || rules.length === 0) {
        set.status = 400
        return { error: 'Rules array is required' }
      }

      const results = []
      for (const rule of rules) {
        if (!rule.eventKey) continue

        const existing = await db.notificationRule.findUnique({
          where: { eventKey: rule.eventKey },
        })

        if (!existing) continue

        const updateData: Record<string, unknown> = { isActive: rule.isActive }
        if (rule.channels !== undefined) {
          updateData.channels = rule.channels
        }

        const updated = await db.notificationRule.update({
          where: { eventKey: rule.eventKey },
          data: updateData,
        })

        await logAudit({
          userId: authUser.id,
          action: 'UPDATE_NOTIFICATION_RULE',
          entity: 'NotificationRule',
          entityId: updated.id,
          oldValue: { eventKey: existing.eventKey, isActive: existing.isActive, channels: existing.channels },
          newValue: { eventKey: updated.eventKey, isActive: updated.isActive, channels: updated.channels },
        })

        results.push(updated)
      }

      return { data: results }
    } catch (error) {
      console.error('Update notification rules error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/permissions - List all available permissions grouped by module
  .get('/permissions', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const permissions = await db.permission.findMany({
        orderBy: [{ module: 'asc' }, { key: 'asc' }],
      })

      return { data: permissions }
    } catch (error) {
      console.error('List permissions error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/roles - List roles with permissions
  .get('/roles', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const roles = await db.role.findMany({
        orderBy: { key: 'asc' },
        include: {
          permissions: {
            include: {
              permission: {
                select: { id: true, key: true, name: true, module: true },
              },
            },
          },
          _count: {
            select: { users: true },
          },
        },
      })

      const formatted = roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        permissions: r.permissions.map((p) => p.permission),
        userCount: r._count.users,
      }))

      return { data: formatted }
    } catch (error) {
      console.error('List roles error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/admin/roles - Create a new role
  .post('/roles', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { key, name, description, permissionIds } = body

      if (!key || !name) {
        set.status = 400
        return { error: 'Key and name are required' }
      }

      // Check for duplicate key
      const existingKey = await db.role.findUnique({ where: { key } })
      if (existingKey) {
        set.status = 409
        return { error: 'Role key already exists' }
      }

      // Check for duplicate name
      const existingName = await db.role.findFirst({ where: { name } })
      if (existingName) {
        set.status = 409
        return { error: 'Role name already exists' }
      }

      // Create role with permissions
      const role = await db.role.create({
        data: {
          key,
          name,
          description: description || null,
          permissions: permissionIds && permissionIds.length > 0
            ? {
                createMany: {
                  data: permissionIds.map((pid: string) => ({ permissionId: pid })),
                  skipDuplicates: true,
                },
              }
            : undefined,
        },
        include: {
          permissions: {
            include: {
              permission: { select: { id: true, key: true, name: true, module: true } },
            },
          },
          _count: { select: { users: true } },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CREATE_ROLE',
        entity: 'Role',
        entityId: role.id,
        newValue: { key, name, description, permissionIds },
      })

      set.status = 201
      return {
        data: {
          id: role.id,
          key: role.key,
          name: role.name,
          description: role.description,
          permissions: role.permissions.map((p) => p.permission),
          userCount: role._count.users,
        },
      }
    } catch (error) {
      console.error('Create role error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/roles/:id - Get single role with full details
  .get('/roles/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const role = await db.role.findUnique({
        where: { id },
        include: {
          permissions: {
            include: {
              permission: { select: { id: true, key: true, name: true, module: true } },
            },
          },
          _count: { select: { users: true } },
        },
      })

      if (!role) {
        set.status = 404
        return { error: 'Role not found' }
      }

      return {
        data: {
          id: role.id,
          key: role.key,
          name: role.name,
          description: role.description,
          permissions: role.permissions.map((p) => p.permission),
          userCount: role._count.users,
        },
      }
    } catch (error) {
      console.error('Get role error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/admin/roles/:id - Update a role
  .patch('/roles/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { name, description, permissionIds } = body

      const existing = await db.role.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Role not found' }
      }

      // Prevent modifying system-critical roles
      if (existing.key === 'ADMIN') {
        set.status = 403
        return { error: 'Cannot modify ADMIN role' }
      }

      // Check for duplicate key/name if changing
      if (name && name !== existing.name) {
        const dup = await db.role.findFirst({ where: { name, id: { not: id } } })
        if (dup) {
          set.status = 409
          return { error: 'Role name already exists' }
        }
      }

      // Update basic fields
      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name
      if (description !== undefined) updateData.description = description || null

      if (Object.keys(updateData).length > 0) {
        await db.role.update({ where: { id }, data: updateData })
      }

      // Update permissions if provided
      if (permissionIds !== undefined) {
        // Delete existing permissions
        await db.rolePermission.deleteMany({ where: { roleId: id } })
        // Create new permissions
        if (permissionIds.length > 0) {
          await db.rolePermission.createMany({
            data: permissionIds.map((pid: string) => ({
              roleId: id,
              permissionId: pid,
            })),
            skipDuplicates: true,
          })
        }
      }

      // Fetch updated role
      const updated = await db.role.findUnique({
        where: { id },
        include: {
          permissions: {
            include: {
              permission: { select: { id: true, key: true, name: true, module: true } },
            },
          },
          _count: { select: { users: true } },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_ROLE',
        entity: 'Role',
        entityId: id,
        newValue: { name, description, permissionIds },
      })

      return {
        data: {
          id: updated!.id,
          key: updated!.key,
          name: updated!.name,
          description: updated!.description,
          permissions: updated!.permissions.map((p) => p.permission),
          userCount: updated!._count.users,
        },
      }
    } catch (error) {
      console.error('Update role error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // DELETE /api/admin/roles/:id - Delete a role
  .delete('/roles/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const existing = await db.role.findUnique({
        where: { id },
        include: { _count: { select: { users: true } } },
      })

      if (!existing) {
        set.status = 404
        return { error: 'Role not found' }
      }

      // Prevent deleting system-critical roles
      if (['ADMIN'].includes(existing.key)) {
        set.status = 403
        return { error: `Cannot delete system role: ${existing.key}` }
      }

      // Prevent deleting roles with users
      if (existing._count.users > 0) {
        set.status = 409
        return { error: `Cannot delete role with ${existing._count.users} assigned user(s). Remove users first.` }
      }

      await db.role.delete({ where: { id } })

      await logAudit({
        userId: authUser.id,
        action: 'DELETE_ROLE',
        entity: 'Role',
        entityId: id,
        oldValue: { key: existing.key, name: existing.name },
      })

      return { data: { success: true } }
    } catch (error) {
      console.error('Delete role error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/smtp - List SMTP settings (mask passwords)
  .get('/smtp', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasIntegrationsPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:integrations permission required' }
      }

      const settings = await db.smtpSetting.findMany({
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      })

      // Mask passwords
      const masked = settings.map((s) => ({
        ...s,
        passwordEncrypted: '***',
      }))

      return { data: masked }
    } catch (error) {
      console.error('List SMTP settings error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/admin/smtp - Create SMTP setting
  .post('/smtp', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasIntegrationsPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:integrations permission required' }
      }

      const body = await request.json()
      const { name, host, port, secure, username, passwordEncrypted, fromEmail, fromName, isDefault, isActive } = body

      if (!name || !host || !username || !fromEmail) {
        set.status = 400
        return { error: 'Name, host, username, and fromEmail are required' }
      }

      const smtpSetting = await db.smtpSetting.create({
        data: {
          name,
          host,
          port: port ?? 587,
          secure: secure ?? false,
          username,
          passwordEncrypted: passwordEncrypted ?? null,
          fromEmail,
          fromName: fromName ?? null,
          isDefault: isDefault ?? false,
          isActive: isActive ?? true,
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CREATE_SMTP_SETTING',
        entity: 'SmtpSetting',
        entityId: smtpSetting.id,
        newValue: { name, host, port, fromEmail, passwordEncrypted: '***' },
      })

      set.status = 201
      return { data: { ...smtpSetting, passwordEncrypted: '***' } }
    } catch (error) {
      console.error('Create SMTP setting error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/admin/smtp/:id - Update SMTP setting
  .patch('/smtp/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasIntegrationsPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:integrations permission required' }
      }

      const { id } = params
      const body = await request.json()

      const existing = await db.smtpSetting.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'SMTP setting not found' }
      }

      const updateData: Record<string, unknown> = {}
      const allowedFields = ['name', 'host', 'port', 'secure', 'username', 'passwordEncrypted', 'fromEmail', 'fromName', 'isDefault', 'isActive']
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field]
        }
      }

      const updated = await db.smtpSetting.update({
        where: { id },
        data: updateData,
      })

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_SMTP_SETTING',
        entity: 'SmtpSetting',
        entityId: id,
        oldValue: { ...existing, passwordEncrypted: '***' },
        newValue: { ...updated, passwordEncrypted: '***' },
      })

      return { data: { ...updated, passwordEncrypted: '***' } }
    } catch (error) {
      console.error('Update SMTP setting error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/system-settings - Get all system settings
  .get('/system-settings', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasSettingsPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:settings permission required' }
      }

      const { searchParams } = new URL(request.url)
      const category = searchParams.get('category') || undefined

      const where: Record<string, unknown> = {}
      if (category) {
        where.category = category
      }

      const settings = await db.systemSetting.findMany({
        where,
        orderBy: [{ category: 'asc' }, { key: 'asc' }],
      })

      // Mask secret values
      const masked = settings.map((s) => ({
        ...s,
        value: s.isSecret ? '***' : s.value,
      }))

      return { data: masked }
    } catch (error) {
      console.error('Get system settings error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/admin/system-settings - Update system settings
  .patch('/system-settings', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasSettingsPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: admin:settings permission required' }
      }

      const body = await request.json()
      const { settings } = body as { settings: Array<{ key: string; value: string }> }

      if (!Array.isArray(settings) || settings.length === 0) {
        set.status = 400
        return { error: 'Settings array is required' }
      }

      const results = []
      for (const setting of settings) {
        if (!setting.key || setting.value === undefined) {
          continue
        }

        const existing = await db.systemSetting.findUnique({ where: { key: setting.key } })
        if (!existing) {
          continue
        }

        const oldValue = existing.isSecret ? '***' : existing.value
        const newValue = existing.isSecret ? '***' : setting.value

        const updated = await db.systemSetting.update({
          where: { key: setting.key },
          data: {
            value: setting.value,
            updatedById: authUser.id,
          },
        })

        await logAudit({
          userId: authUser.id,
          action: 'UPDATE_SETTING',
          entity: 'SystemSetting',
          entityId: setting.key,
          oldValue: { value: oldValue },
          newValue: { value: newValue },
        })

        results.push({
          ...updated,
          value: updated.isSecret ? '***' : updated.value,
        })
      }

      return { data: results }
    } catch (error) {
      console.error('Update system settings error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/admin/users - List users with roles and departments
  .get('/users', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const isAdmin = authUser.roles.includes('ADMIN') || authUser.roles.includes('IT_MANAGER')
      if (!isAdmin) {
        set.status = 403
        return { error: 'Forbidden: admin permission required' }
      }

      const { searchParams } = new URL(request.url)
      const isActive = searchParams.get('isActive')
      const departmentId = searchParams.get('departmentId') || undefined
      const roleKey = searchParams.get('role') || undefined
      const search = searchParams.get('search') || undefined
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const skip = (page - 1) * limit

      const where: Record<string, unknown> = {}
      if (isActive !== null && isActive !== undefined) {
        where.isActive = isActive === 'true'
      }
      if (departmentId) where.departmentId = departmentId
      if (roleKey) {
        where.roles = { some: { role: { key: roleKey } } }
      }
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
        ]
      }

      const [users, total] = await Promise.all([
        db.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            phone: true,
            position: true,
            departmentId: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
            department: {
              select: { id: true, name: true, code: true, type: true, parent: { select: { id: true, name: true, code: true } } },
            },
            roles: {
              include: {
                role: {
                  select: { id: true, key: true, name: true },
                },
              },
            },
          },
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
        db.user.count({ where }),
      ])

      const formatted = users.map((u) => ({
        ...u,
        password: undefined,
        roles: u.roles.map((r) => r.role),
      }))

      return {
        data: formatted,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      console.error('List admin users error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/admin/users - Create user
  .post('/users', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasUserWritePermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: user:write permission required' }
      }

      const body = await request.json()
      const { email, password, name, phone, position, departmentId, roleIds } = body

      if (!email || !password || !name) {
        set.status = 400
        return { error: 'Email, password, and name are required' }
      }

      // Check for duplicate email
      const existingUser = await db.user.findUnique({ where: { email } })
      if (existingUser) {
        set.status = 400
        return { error: 'Email already exists' }
      }

      const hashedPassword = await hashPassword(password)

      const newUser = await db.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          phone: phone ?? null,
          position: position ?? null,
          departmentId: departmentId ?? null,
          isActive: true,
          roles: roleIds && Array.isArray(roleIds) && roleIds.length > 0
            ? {
                create: roleIds.map((roleId: string) => ({ roleId })),
              }
            : undefined,
        },
        include: {
          department: {
            select: { id: true, name: true, code: true, type: true, parent: { select: { id: true, name: true, code: true } } },
          },
          roles: {
            include: {
              role: {
                select: { id: true, key: true, name: true },
              },
            },
          },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CREATE_USER',
        entity: 'User',
        entityId: newUser.id,
        newValue: { email, name, departmentId: departmentId ?? null },
      })

      const formatted = {
        ...newUser,
        password: undefined,
        roles: newUser.roles.map((r) => r.role),
      }

      set.status = 201
      return { data: formatted }
    } catch (error) {
      console.error('Create user error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/admin/users/:id - Update user
  .patch('/users/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasUserWritePermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: user:write permission required' }
      }

      const { id } = params
      const body = await request.json()

      const existing = await db.user.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'User not found' }
      }

      const updateData: Record<string, unknown> = {}
      const allowedFields = ['name', 'email', 'isActive', 'departmentId', 'phone', 'position']
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field]
        }
      }

      const updated = await db.user.update({
        where: { id },
        data: updateData,
        include: {
          department: {
            select: { id: true, name: true, code: true, type: true, parent: { select: { id: true, name: true, code: true } } },
          },
          roles: {
            include: {
              role: {
                select: { id: true, key: true, name: true },
              },
            },
          },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_USER',
        entity: 'User',
        entityId: id,
        oldValue: { name: existing.name, email: existing.email, isActive: existing.isActive, departmentId: existing.departmentId },
        newValue: { name: updated.name, email: updated.email, isActive: updated.isActive, departmentId: updated.departmentId },
      })

      const formatted = {
        ...updated,
        password: undefined,
        roles: updated.roles.map((r) => r.role),
      }

      return { data: formatted }
    } catch (error) {
      console.error('Update user error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // DELETE /api/admin/users/:id - Deactivate user (soft delete)
  .delete('/users/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasUserWritePermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: user:write permission required' }
      }

      const { id } = params

      const existing = await db.user.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'User not found' }
      }

      if (!existing.isActive) {
        set.status = 400
        return { error: 'User is already deactivated' }
      }

      // Soft delete: set isActive to false
      const updated = await db.user.update({
        where: { id },
        data: { isActive: false },
      })

      await logAudit({
        userId: authUser.id,
        action: 'DEACTIVATE_USER',
        entity: 'User',
        entityId: id,
        oldValue: { name: existing.name, email: existing.email, isActive: true },
        newValue: { name: updated.name, email: updated.email, isActive: false },
      })

      return { data: { id, isActive: false } }
    } catch (error) {
      console.error('Deactivate user error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PUT /api/admin/users/:id/roles - Replace user roles
  .put('/users/:id/roles', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      if (!hasManageRolesPermission(authUser.roles)) {
        set.status = 403
        return { error: 'Forbidden: user:manage_roles permission required' }
      }

      const { id } = params
      const body = await request.json()
      const { roleIds } = body as { roleIds: string[] }

      if (!Array.isArray(roleIds)) {
        set.status = 400
        return { error: 'roleIds must be an array' }
      }

      const existingUser = await db.user.findUnique({
        where: { id },
        include: {
          roles: {
            include: { role: { select: { id: true, key: true, name: true } } },
          },
        },
      })

      if (!existingUser) {
        set.status = 404
        return { error: 'User not found' }
      }

      // Validate all role IDs exist
      if (roleIds.length > 0) {
        const validRoles = await db.role.findMany({
          where: { id: { in: roleIds } },
          select: { id: true },
        })
        if (validRoles.length !== roleIds.length) {
          set.status = 400
          return { error: 'One or more role IDs are invalid' }
        }
      }

      const oldRoleKeys = existingUser.roles.map((r) => r.role.key)

      // Delete existing roles and create new ones
      await db.userRole.deleteMany({ where: { userId: id } })

      if (roleIds.length > 0) {
        await db.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId: id, roleId })),
        })
      }

      // Fetch updated user with new roles
      const updatedUser = await db.user.findUnique({
        where: { id },
        include: {
          roles: {
            include: { role: { select: { id: true, key: true, name: true } } },
          },
        },
      })

      const newRoleKeys = updatedUser?.roles.map((r) => r.role.key) ?? []

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_USER_ROLES',
        entity: 'User',
        entityId: id,
        oldValue: { roles: oldRoleKeys },
        newValue: { roles: newRoleKeys },
      })

      return {
        data: {
          userId: id,
          roles: updatedUser?.roles.map((r) => r.role) ?? [],
        },
      }
    } catch (error) {
      console.error('Update user roles error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
