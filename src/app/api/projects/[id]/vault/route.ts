import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

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
// GET /api/projects/[id]/vault - List all vault nodes for a project
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
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

    return NextResponse.json({ data: nodes })
  } catch (error) {
    console.error('List vault nodes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// POST /api/projects/[id]/vault - Create a new vault node
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await request.json()
    const { name, type, parentId, content, frontmatter, tags, icon, color } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Validate parent belongs to same project if specified
    if (parentId) {
      const parent = await db.vaultNode.findFirst({
        where: { id: parentId, projectId },
      })
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent node not found in this project' },
          { status: 400 }
        )
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

    return NextResponse.json({ data: node }, { status: 201 })
  } catch (error) {
    console.error('Create vault node error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// PATCH /api/projects/[id]/vault - Update a vault node
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
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
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify node belongs to this project
    const existing = await db.vaultNode.findFirst({
      where: { id, projectId },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Vault node not found in this project' },
        { status: 404 }
      )
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

    return NextResponse.json({ data: node })
  } catch (error) {
    console.error('Update vault node error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// DELETE /api/projects/[id]/vault - Delete a vault node (cascade)
// ============================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN or PROJECT_MANAGER can delete vault nodes
    if (!authUser.roles.includes('ADMIN') && !authUser.roles.includes('PROJECT_MANAGER')) {
      return NextResponse.json(
        { error: 'Insufficient permissions. ADMIN or PROJECT_MANAGER role required.' },
        { status: 403 }
      )
    }

    const { id: projectId } = await params
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify node belongs to this project
    const existing = await db.vaultNode.findFirst({
      where: { id, projectId },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Vault node not found in this project' },
        { status: 404 }
      )
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

    return NextResponse.json({
      data: { deletedIds: descendantIds },
    })
  } catch (error) {
    console.error('Delete vault node error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
