import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// ============================================================
// GET /api/projects/[id]/vault/links - List all links for a project's vault
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

    return NextResponse.json({ data: links })
  } catch (error) {
    console.error('List vault links error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// POST /api/projects/[id]/vault/links - Create a link
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
    const { sourceId, targetId, label, linkType } = body

    if (!sourceId || !targetId) {
      return NextResponse.json(
        { error: 'sourceId and targetId are required' },
        { status: 400 }
      )
    }

    if (sourceId === targetId) {
      return NextResponse.json(
        { error: 'Cannot create a self-referencing link' },
        { status: 400 }
      )
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Validate both nodes belong to the same project
    const [sourceNode, targetNode] = await Promise.all([
      db.vaultNode.findFirst({ where: { id: sourceId, projectId } }),
      db.vaultNode.findFirst({ where: { id: targetId, projectId } }),
    ])

    if (!sourceNode) {
      return NextResponse.json(
        { error: 'Source node not found in this project' },
        { status: 400 }
      )
    }

    if (!targetNode) {
      return NextResponse.json(
        { error: 'Target node not found in this project' },
        { status: 400 }
      )
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

    return NextResponse.json({ data: link }, { status: 201 })
  } catch (error) {
    console.error('Create vault link error:', error)
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('Unique')) {
      return NextResponse.json(
        { error: 'A link with this source, target, and type already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// DELETE /api/projects/[id]/vault/links - Delete a link
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

    // Verify the link belongs to a node in this project
    const existing = await db.vaultLink.findUnique({
      where: { id },
      include: {
        source: { select: { projectId: true } },
        target: { select: { projectId: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    if (
      existing.source.projectId !== projectId &&
      existing.target.projectId !== projectId
    ) {
      return NextResponse.json(
        { error: 'Link does not belong to this project' },
        { status: 403 }
      )
    }

    await db.vaultLink.delete({ where: { id } })

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    console.error('Delete vault link error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
