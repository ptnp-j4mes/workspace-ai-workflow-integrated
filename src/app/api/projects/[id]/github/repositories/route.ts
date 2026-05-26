import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// POST /api/projects/[id]/github/repositories - Link repository to project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { repositoryId, branch, pathFilter, isPrimary } = body

    if (!repositoryId) {
      return NextResponse.json({ error: 'repositoryId is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const repository = await db.githubRepository.findUnique({ where: { id: repositoryId } })
    if (!repository) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    }

    // Check if already linked
    const existing = await db.projectGithubRepository.findUnique({
      where: { projectId_repositoryId: { projectId: id, repositoryId } },
    })

    if (existing) {
      return NextResponse.json({ error: 'Repository already linked to project' }, { status: 400 })
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

    return NextResponse.json({ data: link }, { status: 201 })
  } catch (error) {
    console.error('Link repository error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/projects/[id]/github/repositories - Get linked repositories
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
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

    return NextResponse.json({ data: repos })
  } catch (error) {
    console.error('Get linked repositories error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
