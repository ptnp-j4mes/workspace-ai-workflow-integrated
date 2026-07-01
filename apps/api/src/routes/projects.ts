import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'
import { generateDocumentNo } from '../lib/services/document-number-service'
import { logAudit } from '../lib/services/audit-service'
import { getProjectCommits, getDailySummaries, generateDailySummary, syncCommits } from '../lib/services/github-service'
import { calculateHealthScore, recalculateHealth } from '../lib/services/project-health-service'
import { aiService } from '../lib/ai-service'

// ============================================================
// Wiki-link parser: extract [[NodeName]] patterns from content
// ============================================================

function parseWikiLinks(content: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g
  const links: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim())
  }
  return [...new Set(links)] // deduplicate
}

// ============================================================
// Synchronize wiki-links for a vault node
// ============================================================

async function syncWikiLinks(
  projectId: string,
  nodeId: string,
  content: string | null
): Promise<void> {
  // Delete all existing outgoing wiki-links for this node
  await db.vaultLink.deleteMany({
    where: {
      sourceId: nodeId,
      linkType: 'REFERENCE',
    },
  })

  if (!content) return

  const wikiLinkNames = parseWikiLinks(content)
  if (wikiLinkNames.length === 0) return

  // Find matching nodes by name in the same project
  const matchingNodes = await db.vaultNode.findMany({
    where: {
      projectId,
      name: { in: wikiLinkNames },
    },
    select: { id: true, name: true },
  })

  // Create links for each match
  for (const targetNode of matchingNodes) {
    if (targetNode.id === nodeId) continue // skip self-references
    try {
      await db.vaultLink.create({
        data: {
          sourceId: nodeId,
          targetId: targetNode.id,
          linkType: 'REFERENCE',
        },
      })
    } catch {
      // Unique constraint violation - link already exists, skip
    }
  }
}

// ============================================================
// Recursively collect all descendant node IDs for cascade delete
// ============================================================

async function collectDescendantIds(nodeId: string): Promise<string[]> {
  const children = await db.vaultNode.findMany({
    where: { parentId: nodeId },
    select: { id: true },
  })
  const ids: string[] = [nodeId]
  for (const child of children) {
    const childIds = await collectDescendantIds(child.id)
    ids.push(...childIds)
  }
  return ids
}

// ============================================================
// Phase definitions with labels, colors, and sort order (timeline)
// ============================================================

const PHASE_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  BA: { label: 'UX/UI & Analysis', color: '#8b5cf6', order: 1 },
  DEV: { label: 'Development', color: '#06b6d4', order: 2 },
  QA: { label: 'Testing', color: '#f59e0b', order: 3 },
  UAT: { label: 'UAT', color: '#10b981', order: 4 },
  MA: { label: 'Go-Live & Maintenance', color: '#ef4444', order: 5 },
}

// ============================================================
// AI System Prompt for vault structure generation
// ============================================================

const VAULT_GENERATION_SYSTEM_PROMPT = `You are an expert knowledge management architect who designs Obsidian-style vault structures for software projects. You analyze project requirements and generate a well-organized vault structure with folders and markdown notes.

Your output MUST be valid JSON with this exact schema:
{
  "nodes": [
    {
      "name": "FolderName or NoteName.md",
      "type": "FOLDER" or "NOTE",
      "parentId": null or index of parent node (0-based),
      "sortOrder": 0,
      "icon": "emoji or null",
      "color": "hex color or null",
      "frontmatter": { "key": "value" } or null,
      "content": "Markdown content with [[wiki-links]]" or null (null for folders),
      "tags": ["tag1", "tag2"] or null
    }
  ]
}

Rules:
1. Folders should use type "FOLDER", notes should use type "NOTE"
2. Note names should end with ".md"
3. Use parentId as the 0-based index of the parent node in the array, or null for root
4. Create a comprehensive vault structure following this pattern:
   - 00-Inbox/ (for unprocessed ideas)
   - 01-Requirements/ (functional & non-functional requirements)
   - 02-Architecture/ (system design, data models, API design)
   - 03-Implementation/ (sprint plans, technical decisions, coding standards)
   - 04-Testing/ (test strategy, test cases)
   - 05-Deployment/ (deployment plan, environment config)
   - README.md (project index with links to all sections)
5. Each note must have:
   - YAML frontmatter with: title, created (today's date), tags, status
   - Meaningful markdown content with [[wiki-links]] to related notes
   - At least 3-5 wiki-links per note to create a rich knowledge graph
6. Use Obsidian-style wiki-links like [[Functional Requirements]] to reference other notes
7. Generate content that is specific to the requirements provided, not generic
8. The README.md should be an index that links to all major sections
9. Sort folders with numeric prefixes (00-, 01-, etc.) for proper ordering
10. Each note should have 2-4 relevant tags

Return ONLY the JSON object, no markdown code fences, no explanation.`

export const projectsRoutes = new Elysia({ prefix: '/api/projects' })
  // GET /api/projects - List projects with optional status filter
  .get('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status') || undefined

      const where: any = {}
      if (status) where.status = status

      const projects = await db.project.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              members: true,
              requests: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return { projects }
    } catch (error) {
      console.error('List projects error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/projects - Create project
  .post('/', async ({ request, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { code, name, description, startDate, endDate } = body

      if (!name) {
        set.status = 400
        return { error: 'Project name is required' }
      }

      // Auto-generate code if not provided
      let projectCode = code?.trim()
      if (!projectCode) {
        projectCode = await generateDocumentNo('PROJECT', 'PROJECT', undefined, user.id)
      } else {
        // Check for duplicate code if manually provided
        const existing = await db.project.findUnique({ where: { code: projectCode } })
        if (existing) {
          set.status = 409
          return { error: 'Project code already exists' }
        }
      }

      const project = await db.project.create({
        data: {
          code: projectCode,
          name,
          description: description || null,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          createdById: user.id,
          versions: {
            create: {
              version: 1,
              name,
              description: description || null,
              status: 'ACTIVE',
              startDate: startDate ? new Date(startDate) : null,
              endDate: endDate ? new Date(endDate) : null,
              changeLog: 'Project created',
              changeType: 'CREATE',
              snapshot: JSON.stringify({
                name,
                description: description || null,
                status: 'ACTIVE',
                startDate: startDate || null,
                endDate: endDate || null,
                aitNo: null,
                healthScore: null,
              }),
              createdById: user.id,
            },
          },
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              members: true,
              requests: true,
            },
          },
        },
      })

      set.status = 201
      return { project }
    } catch (error) {
      console.error('Create project error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id - Get project detail
  .get('/:id', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const project = await db.project.findUnique({
        where: { id },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
          _count: {
            select: {
              requests: true,
              meetings: true,
              uatCycles: true,
            },
          },
        },
      })

      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      return { project }
    } catch (error) {
      console.error('Get project error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/projects/:id - Update project
  .patch('/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()

      const existing = await db.project.findUnique({ where: { id } })
      if (!existing) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Check if code is being changed and if it conflicts
      if (body.code && body.code !== existing.code) {
        const duplicate = await db.project.findUnique({ where: { code: body.code } })
        if (duplicate) {
          set.status = 409
          return { error: 'Project code already exists' }
        }
      }

      const data: Record<string, unknown> = {}
      const allowedFields = ['code', 'name', 'description', 'status', 'startDate', 'endDate']
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          if (field === 'startDate' || field === 'endDate') {
            data[field] = body[field] ? new Date(body[field]) : null
          } else {
            data[field] = body[field]
          }
        }
      }

      const project = await db.project.update({
        where: { id },
        data,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              members: true,
              requests: true,
            },
          },
        },
      })

      // --- Auto-create version snapshot ---
      // Determine which tracked fields changed by comparing old vs new values
      const trackedFields = ['name', 'description', 'status', 'startDate', 'endDate', 'aitNo', 'healthScore'] as const
      const changedFields: string[] = []

      for (const field of trackedFields) {
        const oldValue = existing[field as keyof typeof existing]
        const newValue = project[field as keyof typeof project]
        const oldStr = oldValue instanceof Date ? oldValue.toISOString() : String(oldValue ?? '')
        const newStr = newValue instanceof Date ? newValue.toISOString() : String(newValue ?? '')
        if (oldStr !== newStr) {
          changedFields.push(field)
        }
      }

      if (changedFields.length > 0) {
        const newVersion = project.currentVersion + 1

        // Determine change type
        const statusChanged = changedFields.includes('status')
        const changeType = statusChanged ? 'STATUS_CHANGE' : 'UPDATE'

        // Auto-generate changeLog
        const changeLog = `Updated ${changedFields.join(', ')}`

        // Build snapshot of ALL project fields AFTER the update
        const snapshot = JSON.stringify({
          name: project.name,
          description: project.description,
          status: project.status,
          startDate: project.startDate?.toISOString() ?? null,
          endDate: project.endDate?.toISOString() ?? null,
          aitNo: project.aitNo,
          healthScore: project.healthScore,
        })

        await db.projectVersion.create({
          data: {
            projectId: id,
            version: newVersion,
            name: project.name,
            description: project.description,
            status: project.status,
            startDate: project.startDate,
            endDate: project.endDate,
            aitNo: project.aitNo,
            healthScore: project.healthScore,
            changeLog,
            changeType,
            snapshot,
            createdById: authUser.id,
          },
        })

        // Update project.currentVersion to the new version number
        await db.project.update({
          where: { id },
          data: { currentVersion: newVersion },
        })

        // Log audit for the auto-version
        await logAudit({
          userId: authUser.id,
          action: 'AUTO_VERSION',
          entity: 'ProjectVersion',
          entityId: id,
          aitNo: project.aitNo ?? undefined,
          oldValue: { version: project.currentVersion },
          newValue: { version: newVersion, changeType, changeLog, changedFields },
          entityType: 'Project',
        })
      }

      // Return the updated project with currentVersion
      const updatedProject = await db.project.findUnique({
        where: { id },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              members: true,
              requests: true,
            },
          },
        },
      })

      return { project: updatedProject }
    } catch (error) {
      console.error('Update project error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id/action-items - Get project action items (pending items)
  .get('/:id/action-items', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Collect pending action items across the project
      const actionItems: Array<Record<string, unknown>> = []

      // Pending approvals
      const pendingApprovals = await db.approvalInstance.findMany({
        where: { entityType: 'PROJECT', entityId: id, status: 'PENDING' },
        select: {
          id: true,
          aitNo: true,
          entityType: true,
          requestedAt: true,
          workflow: { select: { name: true } },
        },
      })
      for (const pa of pendingApprovals) {
        actionItems.push({
          type: 'PENDING_APPROVAL',
          id: pa.id,
          aitNo: pa.aitNo,
          title: `Pending Approval: ${pa.workflow.name}`,
          createdAt: pa.requestedAt,
        })
      }

      // Overdue work items
      const overdueWorkItems = await db.workItem.findMany({
        where: {
          projectId: id,
          dueDate: { lt: new Date() },
          status: { notIn: ['DEPLOYED', 'COMPLETED', 'CLOSED'] },
        },
        select: { id: true, title: true, aitNo: true, dueDate: true, priority: true },
      })
      for (const wi of overdueWorkItems) {
        actionItems.push({
          type: 'OVERDUE_WORK_ITEM',
          id: wi.id,
          aitNo: wi.aitNo,
          title: `Overdue: ${wi.title}`,
          dueDate: wi.dueDate,
          priority: wi.priority,
          createdAt: wi.dueDate,
        })
      }

      // Pending MIT assignments
      const pendingMit = await db.mitStepAssignment.findMany({
        where: {
          workItem: { projectId: id },
          status: { in: ['PENDING', 'ASSIGNED'] },
        },
        include: {
          workItem: { select: { id: true, title: true, aitNo: true } },
          assignee: { select: { id: true, name: true } },
        },
      })
      for (const mit of pendingMit) {
        actionItems.push({
          type: 'PENDING_MIT',
          id: mit.id,
          aitNo: mit.workItem.aitNo,
          title: `MIT ${mit.step}: ${mit.workItem.title}`,
          assignee: mit.assignee?.name ?? 'Unassigned',
          createdAt: mit.createdAt,
        })
      }

      // Open issues
      const openIssues = await db.projectIssue.findMany({
        where: { projectId: id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        select: { id: true, title: true, severity: true, createdAt: true },
      })
      for (const issue of openIssues) {
        actionItems.push({
          type: 'OPEN_ISSUE',
          id: issue.id,
          title: issue.title,
          severity: issue.severity,
          createdAt: issue.createdAt,
        })
      }

      return { data: actionItems }
    } catch (error) {
      console.error('Get project action items error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id/activity - Get recent project activity
  .get('/:id/activity', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const { searchParams } = new URL(request.url)
      const limit = parseInt(searchParams.get('limit') || '50')

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Get audit logs related to this project
      const auditLogs = await db.auditLog.findMany({
        where: {
          OR: [
            { entityId: id, entity: 'Project' },
            { aitNo: project.aitNo ?? '' },
          ],
        },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      // Get recent status changes for requests in this project
      const requestStatusChanges = await db.requestStatusHistory.findMany({
        where: {
          request: { projectId: id },
        },
        include: {
          request: { select: { id: true, title: true, aitNo: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 20),
      })

      // Get recent work item status changes
      const workItemChanges = await db.workItemStatusHistory.findMany({
        where: {
          workItem: { projectId: id },
        },
        include: {
          workItem: { select: { id: true, title: true, aitNo: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 20),
      })

      const activities: Array<Record<string, unknown>> = []

      for (const log of auditLogs) {
        activities.push({
          type: 'AUDIT_LOG',
          action: log.action,
          entity: log.entity,
          entityId: log.entityId,
          aitNo: log.aitNo,
          user: log.user,
          oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
          newValue: log.newValue ? JSON.parse(log.newValue) : null,
          createdAt: log.createdAt,
        })
      }

      for (const change of requestStatusChanges) {
        activities.push({
          type: 'REQUEST_STATUS_CHANGE',
          requestId: change.requestId,
          requestTitle: change.request.title,
          requestAitNo: change.request.aitNo,
          fromStatus: change.fromStatus,
          toStatus: change.toStatus,
          comment: change.comment,
          createdAt: change.createdAt,
        })
      }

      for (const change of workItemChanges) {
        activities.push({
          type: 'WORK_ITEM_STATUS_CHANGE',
          workItemId: change.workItemId,
          workItemTitle: change.workItem.title,
          workItemAitNo: change.workItem.aitNo,
          fromStatus: change.fromStatus,
          toStatus: change.toStatus,
          comment: change.comment,
          createdAt: change.createdAt,
        })
      }

      // Sort all by createdAt descending
      activities.sort((a, b) =>
        new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
      )

      return {
        data: activities.slice(0, limit),
      }
    } catch (error) {
      console.error('Get project activity error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id/decisions - List project decisions
  .get('/:id/decisions', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      const decisions = await db.projectDecision.findMany({
        where: { projectId: id },
        include: {
          decidedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return { data: decisions }
    } catch (error) {
      console.error('List project decisions error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/projects/:id/decisions - Create project decision
  .post('/:id/decisions', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { title, description, decision, rationale, alternatives, status, decidedById } = body

      if (!title) {
        set.status = 400
        return { error: 'title is required' }
      }

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      const projectDecision = await db.projectDecision.create({
        data: {
          projectId: id,
          title,
          description: description ?? null,
          decision: decision ?? null,
          rationale: rationale ?? null,
          alternatives: alternatives ? JSON.stringify(alternatives) : null,
          status: status ?? 'PROPOSED',
          decidedById: decidedById ?? null,
          decidedAt: status === 'ACCEPTED' || status === 'REJECTED' ? new Date() : null,
        },
        include: {
          decidedBy: { select: { id: true, name: true, email: true } },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CREATE_PROJECT_DECISION',
        entity: 'ProjectDecision',
        entityId: projectDecision.id,
        aitNo: project.aitNo ?? undefined,
        newValue: { title, status },
      })

      set.status = 201
      return { data: projectDecision }
    } catch (error) {
      console.error('Create project decision error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/projects/:id/decisions/:decisionId - Update project decision
  .patch('/:id/decisions/:decisionId', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id, decisionId } = params
      const body = await request.json()

      const decision = await db.projectDecision.findFirst({
        where: { id: decisionId, projectId: id },
      })

      if (!decision) {
        set.status = 404
        return { error: 'Decision not found' }
      }

      const allowedFields = ['title', 'description', 'decision', 'rationale', 'alternatives', 'status', 'decidedById']
      const data: Record<string, unknown> = {}
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          if (field === 'alternatives') {
            data[field] = JSON.stringify(body[field])
          } else {
            data[field] = body[field]
          }
        }
      }

      // If status changed to ACCEPTED or REJECTED, set decidedAt
      if (body.status === 'ACCEPTED' || body.status === 'REJECTED') {
        data.decidedAt = new Date()
      }

      if (Object.keys(data).length === 0) {
        set.status = 400
        return { error: 'No valid fields to update' }
      }

      const updated = await db.projectDecision.update({
        where: { id: decisionId },
        data,
        include: {
          decidedBy: { select: { id: true, name: true, email: true } },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_PROJECT_DECISION',
        entity: 'ProjectDecision',
        entityId: decisionId,
        newValue: data,
      })

      return { data: updated }
    } catch (error) {
      console.error('Update project decision error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/projects/:id/generate-document-no - Generate AIT Project No for a project
  .post('/:id/generate-document-no', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      if (project.aitNo) {
        set.status = 400
        return { error: 'Project already has an AIT number', data: { aitNo: project.aitNo } }
      }

      const aitNo = await generateDocumentNo('PROJECT', 'Project', id, authUser.id)

      await db.project.update({
        where: { id },
        data: { aitNo },
      })

      await logAudit({
        userId: authUser.id,
        action: 'GENERATE_PROJECT_AIT_NO',
        entity: 'Project',
        entityId: id,
        aitNo,
        newValue: { aitNo },
      })

      set.status = 201
      return { data: { aitNo } }
    } catch (error) {
      console.error('Generate project document no error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id/github/commits - Get project commits with filters
  .get('/:id/github/commits', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const { searchParams } = new URL(request.url)
      const branch = searchParams.get('branch') || undefined
      const since = searchParams.get('since') ? new Date(searchParams.get('since')!) : undefined
      const until = searchParams.get('until') ? new Date(searchParams.get('until')!) : undefined
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')

      const { items, total } = await getProjectCommits(id, {
        branch,
        since,
        until,
        page,
        limit,
      })

      return {
        data: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      console.error('Get project commits error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id/github/daily-summaries - Get daily summaries
  .get('/:id/github/daily-summaries', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const { searchParams } = new URL(request.url)
      const since = searchParams.get('since') ? new Date(searchParams.get('since')!) : undefined
      const until = searchParams.get('until') ? new Date(searchParams.get('until')!) : undefined

      const summaries = await getDailySummaries(id, { since, until })

      return { data: summaries }
    } catch (error) {
      console.error('Get daily summaries error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/projects/:id/github/daily-summaries - Generate daily summary for a specific date
  .post('/:id/github/daily-summaries', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const dateStr = body.date

      if (!dateStr) {
        set.status = 400
        return { error: 'date is required (e.g. "2026-01-15")' }
      }

      const date = new Date(dateStr)
      if (isNaN(date.getTime())) {
        set.status = 400
        return { error: 'Invalid date format' }
      }

      const summary = await generateDailySummary(id, date)

      set.status = 201
      return { data: summary }
    } catch (error) {
      console.error('Generate daily summary error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/projects/:id/github/repositories - Link repository to project
  .post('/:id/github/repositories', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { repositoryId, branch, pathFilter, isPrimary } = body

      if (!repositoryId) {
        set.status = 400
        return { error: 'repositoryId is required' }
      }

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      const repository = await db.githubRepository.findUnique({ where: { id: repositoryId } })
      if (!repository) {
        set.status = 404
        return { error: 'Repository not found' }
      }

      // Check if already linked
      const existing = await db.projectGithubRepository.findUnique({
        where: { projectId_repositoryId: { projectId: id, repositoryId } },
      })

      if (existing) {
        set.status = 400
        return { error: 'Repository already linked to project' }
      }

      const link = await db.projectGithubRepository.create({
        data: {
          projectId: id,
          repositoryId,
          branch: branch ?? 'main',
          pathFilter: pathFilter ?? null,
          isPrimary: isPrimary ?? false,
        },
        include: {
          repository: true,
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'LINK_GITHUB_REPO',
        entity: 'Project',
        entityId: id,
        aitNo: project.aitNo ?? undefined,
        newValue: { repositoryId, branch, isPrimary },
      })

      set.status = 201
      return { data: link }
    } catch (error) {
      console.error('Link repository error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id/github/repositories - Get linked repositories
  .get('/:id/github/repositories', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      const repos = await db.projectGithubRepository.findMany({
        where: { projectId: id },
        include: {
          repository: {
            include: {
              connection: { select: { id: true, connectionName: true, owner: true } },
            },
          },
        },
      })

      return { data: repos }
    } catch (error) {
      console.error('Get linked repositories error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // DELETE /api/projects/:id/github/repositories/:repositoryId - Unlink repository from project
  .delete('/:id/github/repositories/:repositoryId', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id, repositoryId } = params

      const link = await db.projectGithubRepository.findFirst({
        where: { projectId: id, repositoryId },
      })

      if (!link) {
        set.status = 404
        return { error: 'Repository link not found' }
      }

      await db.projectGithubRepository.delete({
        where: { id: link.id },
      })

      await logAudit({
        userId: authUser.id,
        action: 'UNLINK_GITHUB_REPO',
        entity: 'Project',
        entityId: id,
        newValue: { repositoryId },
      })

      return { data: { message: 'Repository unlinked from project' } }
    } catch (error) {
      console.error('Unlink repository error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/projects/:id/github/sync-commits - Trigger commit sync
  .post('/:id/github/sync-commits', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Get linked repositories
      const linkedRepos = await db.projectGithubRepository.findMany({
        where: { projectId: id },
        include: {
          repository: {
            include: {
              connection: true,
            },
          },
        },
      })

      if (linkedRepos.length === 0) {
        set.status = 400
        return { error: 'No repositories linked to this project' }
      }

      const results = []
      for (const link of linkedRepos) {
        const result = await syncCommits(
          link.repository.connectionId,
          link.repositoryId,
          id
        )
        results.push({
          repositoryId: link.repositoryId,
          repositoryName: link.repository.fullName,
          synced: result.synced,
          errors: result.errors,
        })
      }

      await logAudit({
        userId: authUser.id,
        action: 'SYNC_GITHUB_COMMITS',
        entity: 'Project',
        entityId: id,
        aitNo: project.aitNo ?? undefined,
        newValue: { repositoriesSynced: results.length },
      })

      return { data: results }
    } catch (error) {
      console.error('Sync commits error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id/health - Get project health score
  .get('/:id/health', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const project = await db.project.findUnique({
        where: { id },
        select: { id: true, name: true, healthScore: true },
      })

      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      return {
        data: {
          projectId: project.id,
          projectName: project.name,
          healthScore: project.healthScore,
        },
      }
    } catch (error) {
      console.error('Get project health error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/projects/:id/health - Recalculate project health score
  .post('/:id/health', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      await recalculateHealth(id)

      const updated = await db.project.findUnique({
        where: { id },
        select: { healthScore: true },
      })

      const newScore = await calculateHealthScore(id)

      return {
        data: {
          projectId: id,
          healthScore: updated?.healthScore ?? newScore,
        },
      }
    } catch (error) {
      console.error('Recalculate project health error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id/issues - List project issues
  .get('/:id/issues', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      const issues = await db.projectIssue.findMany({
        where: { projectId: id },
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return { data: issues }
    } catch (error) {
      console.error('List project issues error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/projects/:id/issues - Create project issue
  .post('/:id/issues', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { title, description, severity, status, resolution, ownerId } = body

      if (!title) {
        set.status = 400
        return { error: 'title is required' }
      }

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      const issue = await db.projectIssue.create({
        data: {
          projectId: id,
          title,
          description: description ?? null,
          severity: severity ?? 'MEDIUM',
          status: status ?? 'OPEN',
          resolution: resolution ?? null,
          ownerId: ownerId ?? null,
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CREATE_PROJECT_ISSUE',
        entity: 'ProjectIssue',
        entityId: issue.id,
        aitNo: project.aitNo ?? undefined,
        newValue: { title, severity, status },
      })

      set.status = 201
      return { data: issue }
    } catch (error) {
      console.error('Create project issue error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/projects/:id/issues/:issueId - Update project issue
  .patch('/:id/issues/:issueId', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id, issueId } = params
      const body = await request.json()

      const issue = await db.projectIssue.findFirst({
        where: { id: issueId, projectId: id },
      })

      if (!issue) {
        set.status = 404
        return { error: 'Issue not found' }
      }

      const allowedFields = ['title', 'description', 'severity', 'status', 'resolution', 'ownerId']
      const data: Record<string, unknown> = {}
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          data[field] = body[field]
        }
      }

      if (Object.keys(data).length === 0) {
        set.status = 400
        return { error: 'No valid fields to update' }
      }

      const updated = await db.projectIssue.update({
        where: { id: issueId },
        data,
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_PROJECT_ISSUE',
        entity: 'ProjectIssue',
        entityId: issueId,
        newValue: data,
      })

      return { data: updated }
    } catch (error) {
      console.error('Update project issue error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/projects/:id/members - Add project member
  .post('/:id/members', async ({ request, params, set }) => {
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

      // Verify project exists
      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Verify user exists
      const targetUser = await db.user.findUnique({ where: { id: userId } })
      if (!targetUser) {
        set.status = 404
        return { error: 'User not found' }
      }

      // Check if already a member
      const existing = await db.projectMember.findUnique({
        where: { projectId_userId: { projectId: id, userId } },
      })
      if (existing) {
        set.status = 409
        return { error: 'User is already a member of this project' }
      }

      const member = await db.projectMember.create({
        data: {
          projectId: id,
          userId,
          role,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      })

      set.status = 201
      return { member }
    } catch (error) {
      console.error('Add project member error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // DELETE /api/projects/:id/members - Remove project member
  .delete('/:id/members', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { userId } = body

      if (!userId) {
        set.status = 400
        return { error: 'userId is required' }
      }

      // Verify membership exists
      const existing = await db.projectMember.findUnique({
        where: { projectId_userId: { projectId: id, userId } },
      })
      if (!existing) {
        set.status = 404
        return { error: 'User is not a member of this project' }
      }

      await db.projectMember.delete({
        where: { projectId_userId: { projectId: id, userId } },
      })

      return { message: 'Member removed successfully' }
    } catch (error) {
      console.error('Remove project member error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id/progress-summary - Get project progress summary
  .get('/:id/progress-summary', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const project = await db.project.findUnique({
        where: { id },
        select: { id: true, name: true, status: true },
      })

      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Aggregate metrics
      const [
        totalRequests,
        completedRequests,
        totalWorkItems,
        completedWorkItems,
        openBugs,
        criticalBugs,
        pendingApprovals,
        activeRisks,
        openIssues,
        pendingDecisions,
        totalUatCycles,
        completedUatCycles,
        totalMembers,
      ] = await Promise.all([
        db.request.count({ where: { projectId: id } }),
        db.request.count({ where: { projectId: id, status: { in: ['COMPLETED', 'CLOSED'] } } }),
        db.workItem.count({ where: { projectId: id } }),
        db.workItem.count({ where: { projectId: id, status: { in: ['DEPLOYED', 'COMPLETED'] } } }),
        db.bugReport.count({ where: { projectId: id, status: { in: ['OPEN', 'INVESTIGATING', 'FIXING'] } } }),
        db.bugReport.count({ where: { projectId: id, severity: 'CRITICAL', status: { in: ['OPEN', 'INVESTIGATING', 'FIXING'] } } }),
        db.approvalInstance.count({ where: { entityType: 'PROJECT', entityId: id, status: 'PENDING' } }),
        db.projectRisk.count({ where: { projectId: id, status: { notIn: ['RESOLVED', 'ACCEPTED'] } } }),
        db.projectIssue.count({ where: { projectId: id, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
        db.projectDecision.count({ where: { projectId: id, status: 'PROPOSED' } }),
        db.uatCycle.count({ where: { projectId: id } }),
        db.uatCycle.count({ where: { projectId: id, status: 'COMPLETED' } }),
        db.projectMember.count({ where: { projectId: id } }),
      ])

      return {
        data: {
          projectId: id,
          projectName: project.name,
          projectStatus: project.status,
          requests: { total: totalRequests, completed: completedRequests },
          workItems: { total: totalWorkItems, completed: completedWorkItems },
          bugs: { open: openBugs, critical: criticalBugs },
          approvals: { pending: pendingApprovals },
          risks: { active: activeRisks },
          issues: { open: openIssues },
          decisions: { pending: pendingDecisions },
          uat: { total: totalUatCycles, completed: completedUatCycles },
          members: { total: totalMembers },
        },
      }
    } catch (error) {
      console.error('Get project progress summary error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id/risks - List project risks
  .get('/:id/risks', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      const risks = await db.projectRisk.findMany({
        where: { projectId: id },
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return { data: risks }
    } catch (error) {
      console.error('List project risks error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/projects/:id/risks - Create project risk
  .post('/:id/risks', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()
      const { title, description, probability, impact, mitigation, status, ownerId } = body

      if (!title) {
        set.status = 400
        return { error: 'title is required' }
      }

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      const risk = await db.projectRisk.create({
        data: {
          projectId: id,
          title,
          description: description ?? null,
          probability: probability ?? 'MEDIUM',
          impact: impact ?? 'MEDIUM',
          mitigation: mitigation ?? null,
          status: status ?? 'IDENTIFIED',
          ownerId: ownerId ?? null,
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'CREATE_PROJECT_RISK',
        entity: 'ProjectRisk',
        entityId: risk.id,
        aitNo: project.aitNo ?? undefined,
        newValue: { title, probability, impact, status },
      })

      set.status = 201
      return { data: risk }
    } catch (error) {
      console.error('Create project risk error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/projects/:id/risks/:riskId - Update project risk
  .patch('/:id/risks/:riskId', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id, riskId } = params
      const body = await request.json()

      const risk = await db.projectRisk.findFirst({
        where: { id: riskId, projectId: id },
      })

      if (!risk) {
        set.status = 404
        return { error: 'Risk not found' }
      }

      const allowedFields = ['title', 'description', 'probability', 'impact', 'mitigation', 'status', 'ownerId']
      const data: Record<string, unknown> = {}
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          data[field] = body[field]
        }
      }

      if (Object.keys(data).length === 0) {
        set.status = 400
        return { error: 'No valid fields to update' }
      }

      const updated = await db.projectRisk.update({
        where: { id: riskId },
        data,
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      })

      await logAudit({
        userId: authUser.id,
        action: 'UPDATE_PROJECT_RISK',
        entity: 'ProjectRisk',
        entityId: riskId,
        newValue: data,
      })

      return { data: updated }
    } catch (error) {
      console.error('Update project risk error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id/timeline - Get timeline data for Gantt chart
  .get('/:id/timeline', async ({ request, params, set }) => {
    try {
      const user = await getAuthUser(request)
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Fetch work items with their MIT step assignments
      const workItems = await db.workItem.findMany({
        where: { projectId: id },
        include: {
          assignments: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
          mitStepAssignments: {
            include: {
              assignee: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
            orderBy: { step: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      })

      // Fetch UAT cycles for the project
      const uatCycles = await db.uatCycle.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'asc' },
      })

      // Fetch project members for grouping by member
      const members = await db.projectMember.findMany({
        where: { projectId: id },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      })

      // Build timeline items from work items and their MIT steps
      type MitStepWithAssignee = {
        id: string
        step: string
        assigneeId: string | null
        status: string
        assignedAt: Date | null
        acceptedAt: Date | null
        submittedAt: Date | null
        deployedAt: Date | null
        estimatedManDays: number
        spentManDays: number
        assignee: { id: string; name: string; email: string; avatarUrl: string | null } | null
      }

      type WorkItemWithRelations = {
        id: string
        title: string
        description: string | null
        status: string
        currentStep: string | null
        priority: string
        aitNo: string | null
        dueDate: Date | null
        createdAt: Date
        assignments: {
          id: string
          userId: string
          role: string
          isActive: boolean
          user: { id: string; name: string; email: string; avatarUrl: string | null }
        }[]
        mitStepAssignments: MitStepWithAssignee[]
      }

      const timelineItems: Array<{
        id: string
        title: string
        phase: string
        phaseLabel: string
        phaseColor: string
        startDate: string | null
        endDate: string | null
        status: string
        priority: string
        assignees: Array<{ id: string; name: string; email: string; avatarUrl: string | null }>
        type: 'work_item' | 'uat_cycle'
        aitNo: string | null
        progress: number
      }> = []

      for (const wi of workItems as WorkItemWithRelations[]) {
        // Group MIT steps by phase
        const phases = new Set<string>()
        if (wi.mitStepAssignments.length > 0) {
          for (const msa of wi.mitStepAssignments) {
            phases.add(msa.step)
          }
        } else {
          if (wi.currentStep) phases.add(wi.currentStep)
        }

        // If no phases, default to the current step or BA
        if (phases.size === 0) phases.add('BA')

        for (const phase of phases) {
          const config = PHASE_CONFIG[phase] || { label: phase, color: '#6b7280', order: 99 }

          // Find the MIT step assignment for this phase to get dates
          const stepAssignment = wi.mitStepAssignments.find(msa => msa.step === phase)

          // Determine start date: assignedAt or createdAt
          let startDate: Date | null = null
          if (stepAssignment?.assignedAt) {
            startDate = stepAssignment.assignedAt
          } else if (stepAssignment?.acceptedAt) {
            startDate = stepAssignment.acceptedAt
          }

          // Determine end date: submittedAt, deployedAt, or dueDate
          let endDate: Date | null = null
          if (stepAssignment?.deployedAt) {
            endDate = stepAssignment.deployedAt
          } else if (stepAssignment?.submittedAt) {
            endDate = stepAssignment.submittedAt
          } else if (wi.dueDate) {
            endDate = wi.dueDate
          }

          // If we still don't have dates, estimate based on project dates or work item creation
          if (!startDate) {
            startDate = new Date(wi.createdAt)
          }
          if (!endDate) {
            // Default to 2 weeks after start date
            const estimated = new Date(startDate)
            estimated.setDate(estimated.getDate() + 14)
            endDate = estimated
          }

          // Ensure end date is after start date
          if (endDate <= startDate) {
            const adjusted = new Date(startDate)
            adjusted.setDate(adjusted.getDate() + 7)
            endDate = adjusted
          }

          // Calculate progress based on step assignment status
          let progress = 0
          if (stepAssignment) {
            const s = stepAssignment.status.toUpperCase()
            if (s === 'DEPLOYED') progress = 100
            else if (s === 'SUBMITTED') progress = 90
            else if (s === 'ACCEPTED') progress = 50
            else if (s === 'ASSIGNED') progress = 25
            else if (s === 'PENDING') progress = 5
          } else {
            // Use work item status
            const s = wi.status.toUpperCase()
            if (s === 'DEPLOYED') progress = 100
            else if (s === 'SUBMITTED') progress = 90
            else if (s === 'IN_PROGRESS') progress = 50
            else if (s === 'ASSIGNED') progress = 25
            else if (s === 'CREATED') progress = 5
          }

          // Get assignees for this phase
          const assignees = stepAssignment?.assignee
            ? [stepAssignment.assignee]
            : wi.assignments.map(a => a.user)

          timelineItems.push({
            id: `${wi.id}-${phase}`,
            title: wi.title,
            phase,
            phaseLabel: config.label,
            phaseColor: config.color,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            status: stepAssignment?.status || wi.status,
            priority: wi.priority,
            assignees,
            type: 'work_item',
            aitNo: wi.aitNo,
            progress,
          })
        }
      }

      // Add UAT cycles as timeline items
      for (const cycle of uatCycles) {
        const startDate = cycle.startDate ? new Date(cycle.startDate) : new Date(cycle.createdAt)
        let endDate: Date
        if (cycle.endDate) {
          endDate = new Date(cycle.endDate)
        } else {
          endDate = new Date(startDate)
          endDate.setDate(endDate.getDate() + 14)
        }
        if (endDate <= startDate) {
          const adjusted = new Date(startDate)
          adjusted.setDate(adjusted.getDate() + 7)
          endDate = adjusted
        }

        let progress = 0
        const s = cycle.status.toUpperCase()
        if (s === 'COMPLETED') progress = 100
        else if (s === 'IN_PROGRESS') progress = 60
        else if (s === 'PLANNED') progress = 10
        else if (s === 'FAILED') progress = 80

        timelineItems.push({
          id: cycle.id,
          title: cycle.name,
          phase: 'UAT',
          phaseLabel: PHASE_CONFIG.UAT.label,
          phaseColor: PHASE_CONFIG.UAT.color,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          status: cycle.status,
          priority: 'MEDIUM',
          assignees: [],
          type: 'uat_cycle',
          aitNo: cycle.aitNo,
          progress,
        })
      }

      // Sort by phase order, then by start date
      timelineItems.sort((a, b) => {
        const orderA = PHASE_CONFIG[a.phase]?.order ?? 99
        const orderB = PHASE_CONFIG[b.phase]?.order ?? 99
        if (orderA !== orderB) return orderA - orderB
        return (a.startDate || '').localeCompare(b.startDate || '')
      })

      // Build phase groups
      const phases = Object.entries(PHASE_CONFIG).map(([key, config]) => {
        const items = timelineItems.filter(item => item.phase === key)
        return {
          key,
          label: config.label,
          color: config.color,
          order: config.order,
          items,
        }
      }).filter(phase => phase.items.length > 0)

      // Calculate overall date range for the timeline
      const allDates = timelineItems
        .flatMap(item => [item.startDate, item.endDate])
        .filter(Boolean) as string[]

      let timelineStart: string
      let timelineEnd: string

      if (allDates.length > 0) {
        const minDate = new Date(Math.min(...allDates.map(d => new Date(d).getTime())))
        const maxDate = new Date(Math.max(...allDates.map(d => new Date(d).getTime())))
        // Expand range: start from 1st of the month, end at last day of month
        const startOfMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
        const endOfMonth = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0)
        timelineStart = startOfMonth.toISOString()
        timelineEnd = endOfMonth.toISOString()
      } else {
        // Default: current month ± 2 months
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
        const end = new Date(now.getFullYear(), now.getMonth() + 3, 0)
        timelineStart = start.toISOString()
        timelineEnd = end.toISOString()
      }

      // Build member groups for "Group by member" view
      const memberGroups = members.map(pm => {
        const memberItems = timelineItems.filter(item =>
          item.assignees.some(a => a.id === pm.user.id)
        )
        return {
          userId: pm.user.id,
          name: pm.user.name,
          email: pm.user.email,
          avatarUrl: pm.user.avatarUrl,
          role: pm.role,
          items: memberItems,
        }
      }).filter(mg => mg.items.length > 0)

      return {
        data: {
          phases,
          memberGroups,
          timelineStart,
          timelineEnd,
          totalItems: timelineItems.length,
          projectStartDate: project.startDate?.toISOString() ?? null,
          projectEndDate: project.endDate?.toISOString() ?? null,
        },
      }
    } catch (error) {
      console.error('Get project timeline error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id/vault - List all vault nodes for a project
  .get('/:id/vault', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id: projectId } = params

      const project = await db.project.findUnique({ where: { id: projectId } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Parse query params
      const { searchParams } = new URL(request.url)
      const type = searchParams.get('type') || undefined
      const parentId = searchParams.get('parentId') || undefined
      const search = searchParams.get('search') || undefined

      // Build where clause
      const where: Record<string, unknown> = { projectId }
      if (type) where.type = type
      if (parentId !== undefined) {
        // Allow filtering for root nodes (parentId=null) via "null" or empty string
        where.parentId = parentId === 'null' || parentId === '' ? null : parentId
      }
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { content: { contains: search } },
        ]
      }

      const nodes = await db.vaultNode.findMany({
        where,
        include: {
          outgoing: {
            include: {
              target: { select: { id: true, name: true, type: true } },
            },
          },
          incoming: {
            include: {
              source: { select: { id: true, name: true, type: true } },
            },
          },
          creator: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })

      return { data: nodes }
    } catch (error) {
      console.error('List vault nodes error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/projects/:id/vault - Create a new vault node
  .post('/:id/vault', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id: projectId } = params
      const body = await request.json()
      const { name, type, parentId, content, frontmatter, tags, icon, color } = body

      if (!name) {
        set.status = 400
        return { error: 'name is required' }
      }

      const project = await db.project.findUnique({ where: { id: projectId } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Validate parent belongs to same project if specified
      if (parentId) {
        const parent = await db.vaultNode.findFirst({
          where: { id: parentId, projectId },
        })
        if (!parent) {
          set.status = 400
          return { error: 'Parent node not found in this project' }
        }
      }

      const node = await db.vaultNode.create({
        data: {
          projectId,
          name,
          type: type ?? 'NOTE',
          parentId: parentId ?? null,
          content: content ?? null,
          frontmatter: frontmatter ?? null,
          tags: tags ?? null,
          icon: icon ?? null,
          color: color ?? null,
          createdById: authUser.id,
        },
        include: {
          outgoing: {
            include: {
              target: { select: { id: true, name: true, type: true } },
            },
          },
          incoming: {
            include: {
              source: { select: { id: true, name: true, type: true } },
            },
          },
          creator: { select: { id: true, name: true, email: true } },
        },
      })

      // Auto-parse wiki-links from content and create VaultLink entries
      if (content) {
        await syncWikiLinks(projectId, node.id, content)
      }

      set.status = 201
      return { data: node }
    } catch (error) {
      console.error('Create vault node error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // PATCH /api/projects/:id/vault - Update a vault node
  .patch('/:id/vault', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id: projectId } = params
      const body = await request.json()
      const {
        id,
        name,
        content,
        frontmatter,
        tags,
        parentId,
        sortOrder,
        isPinned,
        isExpanded,
        icon,
        color,
      } = body

      if (!id) {
        set.status = 400
        return { error: 'id is required' }
      }

      const project = await db.project.findUnique({ where: { id: projectId } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Verify node belongs to this project
      const existing = await db.vaultNode.findFirst({
        where: { id, projectId },
      })
      if (!existing) {
        set.status = 404
        return { error: 'Vault node not found in this project' }
      }

      // Build update data
      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name
      if (content !== undefined) updateData.content = content
      if (frontmatter !== undefined) updateData.frontmatter = frontmatter
      if (tags !== undefined) updateData.tags = tags
      if (parentId !== undefined) updateData.parentId = parentId
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder
      if (isPinned !== undefined) updateData.isPinned = isPinned
      if (isExpanded !== undefined) updateData.isExpanded = isExpanded
      if (icon !== undefined) updateData.icon = icon
      if (color !== undefined) updateData.color = color

      const node = await db.vaultNode.update({
        where: { id },
        data: updateData,
        include: {
          outgoing: {
            include: {
              target: { select: { id: true, name: true, type: true } },
            },
          },
          incoming: {
            include: {
              source: { select: { id: true, name: true, type: true } },
            },
          },
          creator: { select: { id: true, name: true, email: true } },
        },
      })

      // Re-parse wiki-links if content was updated
      if (content !== undefined) {
        await syncWikiLinks(projectId, id, content)
      }

      return { data: node }
    } catch (error) {
      console.error('Update vault node error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // DELETE /api/projects/:id/vault - Delete a vault node (cascade)
  .delete('/:id/vault', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      // Only ADMIN or PROJECT_MANAGER can delete vault nodes
      if (!authUser.roles.includes('ADMIN') && !authUser.roles.includes('PROJECT_MANAGER')) {
        set.status = 403
        return { error: 'Insufficient permissions. ADMIN or PROJECT_MANAGER role required.' }
      }

      const { id: projectId } = params
      const body = await request.json()
      const { id } = body

      if (!id) {
        set.status = 400
        return { error: 'id is required' }
      }

      const project = await db.project.findUnique({ where: { id: projectId } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Verify node belongs to this project
      const existing = await db.vaultNode.findFirst({
        where: { id, projectId },
      })
      if (!existing) {
        set.status = 404
        return { error: 'Vault node not found in this project' }
      }

      // Collect all descendant IDs for cascade delete
      const descendantIds = await collectDescendantIds(id)

      // Delete all vault links involving these nodes
      await db.vaultLink.deleteMany({
        where: {
          OR: [
            { sourceId: { in: descendantIds } },
            { targetId: { in: descendantIds } },
          ],
        },
      })

      // Delete all descendant nodes (children first due to tree structure)
      // Sort by depth - delete deepest first
      // Since SQLite doesn't support recursive CTE well via Prisma, we delete in reverse
      await db.vaultNode.deleteMany({
        where: { id: { in: descendantIds } },
      })

      return {
        data: { deletedIds: descendantIds },
      }
    } catch (error) {
      console.error('Delete vault node error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/projects/:id/vault/generate - AI-generate vault structure
  .post('/:id/vault/generate', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id: projectId } = params
      const body = await request.json()
      const { requirements } = body

      if (!requirements || typeof requirements !== 'string' || requirements.trim().length === 0) {
        set.status = 400
        return { error: 'requirements is required and must be a non-empty string' }
      }

      const project = await db.project.findUnique({ where: { id: projectId } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Call AI to generate vault structure
      const userPrompt = `Analyze the following project requirements and generate a comprehensive Obsidian-style vault structure with folders, markdown notes, YAML frontmatter, and wiki-links.

Project Name: ${project.name}
${project.description ? `Project Description: ${project.description}` : ''}

Requirements:
${requirements}`

      const result = await aiService.generateText({
        systemPrompt: VAULT_GENERATION_SYSTEM_PROMPT,
        userPrompt,
      })

      // Parse the AI response
      let vaultStructure: {
        nodes: Array<{
          name: string
          type: string
          parentId: number | null
          sortOrder: number
          icon: string | null
          color: string | null
          frontmatter: Record<string, unknown> | null
          content: string | null
          tags: string[] | null
        }>
      }

      try {
        // Try to extract JSON from the response (handle potential markdown code fences)
        let jsonStr = result.output.trim()
        // Remove markdown code fences if present
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
        }
        vaultStructure = JSON.parse(jsonStr)
      } catch {
        console.error('Failed to parse AI vault generation output:', result.output.substring(0, 500))
        set.status = 422
        return { error: 'AI generated invalid vault structure. Please try again.' }
      }

      if (!vaultStructure.nodes || !Array.isArray(vaultStructure.nodes)) {
        set.status = 422
        return { error: 'AI generated invalid vault structure: missing nodes array' }
      }

      // Create all vault nodes in the database
      // We need to create them in order and track the mapping from array index to DB id
      const indexToIdMap = new Map<number, string>()
      const createdNodes: Array<{
        id: string
        projectId: string
        parentId: string | null
        name: string
        type: string
        content: string | null
        frontmatter: string | null
        tags: string | null
        sortOrder: number
        isPinned: boolean
        isExpanded: boolean
        icon: string | null
        color: string | null
        createdById: string | null
        createdAt: Date
        updatedAt: Date
      }> = []

      for (let i = 0; i < vaultStructure.nodes.length; i++) {
        const nodeDef = vaultStructure.nodes[i]

        // Resolve parentId from index to actual DB id
        let parentDbId: string | null = null
        if (nodeDef.parentId !== null && nodeDef.parentId !== undefined) {
          parentDbId = indexToIdMap.get(nodeDef.parentId) ?? null
        }

        // Serialize frontmatter and tags as JSON strings
        const frontmatterStr = nodeDef.frontmatter
          ? JSON.stringify(nodeDef.frontmatter)
          : null
        const tagsStr = nodeDef.tags
          ? JSON.stringify(nodeDef.tags)
          : null

        const created = await db.vaultNode.create({
          data: {
            projectId,
            name: nodeDef.name,
            type: nodeDef.type || 'NOTE',
            parentId: parentDbId,
            content: nodeDef.content ?? null,
            frontmatter: frontmatterStr,
            tags: tagsStr,
            sortOrder: nodeDef.sortOrder ?? i,
            icon: nodeDef.icon ?? null,
            color: nodeDef.color ?? null,
            createdById: authUser.id,
          },
        })

        indexToIdMap.set(i, created.id)
        createdNodes.push(created)
      }

      // Create wiki-links between nodes based on [[...]] patterns in content
      const createdLinks: Array<{
        id: string
        sourceId: string
        targetId: string
        label: string | null
        linkType: string
        createdAt: Date
      }> = []

      // Build name-to-id map for wiki-link resolution
      const nameToIdMap = new Map<string, string>()
      for (let i = 0; i < vaultStructure.nodes.length; i++) {
        const nodeDef = vaultStructure.nodes[i]
        const dbId = indexToIdMap.get(i)
        if (dbId) {
          // Map both the full name and the name without .md extension
          nameToIdMap.set(nodeDef.name, dbId)
          if (nodeDef.name.endsWith('.md')) {
            nameToIdMap.set(nodeDef.name.replace(/\.md$/, ''), dbId)
          }
        }
      }

      // Extract wiki-links from each note's content and create VaultLink entries
      const wikiLinkRegex = /\[\[([^\]]+)\]\]/g
      for (let i = 0; i < vaultStructure.nodes.length; i++) {
        const nodeDef = vaultStructure.nodes[i]
        const sourceId = indexToIdMap.get(i)
        if (!sourceId || !nodeDef.content) continue

        const links = new Set<string>()
        let match: RegExpExecArray | null
        const regex = new RegExp(wikiLinkRegex.source, wikiLinkRegex.flags)
        while ((match = regex.exec(nodeDef.content)) !== null) {
          links.add(match[1].trim())
        }

        for (const linkName of links) {
          const targetId = nameToIdMap.get(linkName)
          if (!targetId || targetId === sourceId) continue

          try {
            const link = await db.vaultLink.create({
              data: {
                sourceId,
                targetId,
                linkType: 'REFERENCE',
              },
            })
            createdLinks.push(link)
          } catch {
            // Unique constraint violation - skip duplicate links
          }
        }
      }

      set.status = 201
      return {
        data: {
          nodes: createdNodes,
          links: createdLinks,
          generationMeta: {
            latencyMs: result.latencyMs,
            tokenUsage: result.tokenUsage,
            nodeCount: createdNodes.length,
            linkCount: createdLinks.length,
          },
        },
      }
    } catch (error) {
      console.error('Generate vault structure error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id/vault/links - List all links for a project's vault
  .get('/:id/vault/links', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id: projectId } = params

      const project = await db.project.findUnique({ where: { id: projectId } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Find all links where source or target node belongs to this project
      const links = await db.vaultLink.findMany({
        where: {
          OR: [
            { source: { projectId } },
            { target: { projectId } },
          ],
        },
        include: {
          source: { select: { id: true, name: true, type: true, projectId: true } },
          target: { select: { id: true, name: true, type: true, projectId: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return { data: links }
    } catch (error) {
      console.error('List vault links error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/projects/:id/vault/links - Create a link
  .post('/:id/vault/links', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id: projectId } = params
      const body = await request.json()
      const { sourceId, targetId, label, linkType } = body

      if (!sourceId || !targetId) {
        set.status = 400
        return { error: 'sourceId and targetId are required' }
      }

      if (sourceId === targetId) {
        set.status = 400
        return { error: 'Cannot create a self-referencing link' }
      }

      const project = await db.project.findUnique({ where: { id: projectId } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Validate both nodes belong to the same project
      const [sourceNode, targetNode] = await Promise.all([
        db.vaultNode.findFirst({ where: { id: sourceId, projectId } }),
        db.vaultNode.findFirst({ where: { id: targetId, projectId } }),
      ])

      if (!sourceNode) {
        set.status = 400
        return { error: 'Source node not found in this project' }
      }

      if (!targetNode) {
        set.status = 400
        return { error: 'Target node not found in this project' }
      }

      const link = await db.vaultLink.create({
        data: {
          sourceId,
          targetId,
          label: label ?? null,
          linkType: linkType ?? 'REFERENCE',
        },
        include: {
          source: { select: { id: true, name: true, type: true, projectId: true } },
          target: { select: { id: true, name: true, type: true, projectId: true } },
        },
      })

      set.status = 201
      return { data: link }
    } catch (error) {
      console.error('Create vault link error:', error)
      // Handle unique constraint violation
      if (error instanceof Error && error.message.includes('Unique')) {
        set.status = 409
        return { error: 'A link with this source, target, and type already exists' }
      }
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // DELETE /api/projects/:id/vault/links - Delete a link
  .delete('/:id/vault/links', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id: projectId } = params
      const body = await request.json()
      const { id } = body

      if (!id) {
        set.status = 400
        return { error: 'id is required' }
      }

      const project = await db.project.findUnique({ where: { id: projectId } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      // Verify the link belongs to a node in this project
      const existing = await db.vaultLink.findUnique({
        where: { id },
        include: {
          source: { select: { projectId: true } },
          target: { select: { projectId: true } },
        },
      })

      if (!existing) {
        set.status = 404
        return { error: 'Link not found' }
      }

      if (
        existing.source.projectId !== projectId &&
        existing.target.projectId !== projectId
      ) {
        set.status = 403
        return { error: 'Link does not belong to this project' }
      }

      await db.vaultLink.delete({ where: { id } })

      return { data: { deleted: true } }
    } catch (error) {
      console.error('Delete vault link error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/projects/:id/versions - List all versions of a project
  .get('/:id/versions', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      const versions = await db.projectVersion.findMany({
        where: { projectId: id },
        orderBy: { version: 'desc' },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      return { data: versions }
    } catch (error) {
      console.error('Get project versions error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/projects/:id/versions - Create a manual version snapshot
  .post('/:id/versions', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params
      const body = await request.json()

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        set.status = 404
        return { error: 'Project not found' }
      }

      const newVersion = project.currentVersion + 1

      // Build snapshot of current project data
      const snapshot = JSON.stringify({
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.startDate?.toISOString() ?? null,
        endDate: project.endDate?.toISOString() ?? null,
        aitNo: project.aitNo,
        healthScore: project.healthScore,
      })

      const version = await db.projectVersion.create({
        data: {
          projectId: id,
          version: newVersion,
          name: project.name,
          description: project.description,
          status: project.status,
          startDate: project.startDate,
          endDate: project.endDate,
          aitNo: project.aitNo,
          healthScore: project.healthScore,
          changeLog: body.changeLog ?? null,
          changeType: 'MANUAL',
          snapshot,
          createdById: authUser.id,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      // Update project currentVersion
      await db.project.update({
        where: { id },
        data: { currentVersion: newVersion },
      })

      // Log audit
      await logAudit({
        userId: authUser.id,
        action: 'CREATE_VERSION',
        entity: 'ProjectVersion',
        entityId: version.id,
        aitNo: project.aitNo ?? undefined,
        newValue: { version: newVersion, changeType: 'MANUAL', changeLog: body.changeLog },
        entityType: 'Project',
      })

      set.status = 201
      return { data: version }
    } catch (error) {
      console.error('Create project version error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })
