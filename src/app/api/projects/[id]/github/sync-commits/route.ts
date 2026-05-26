import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { syncCommits } from '@/lib/services/github-service'
import { logAudit } from '@/lib/services/audit-service'

// POST /api/projects/[id]/github/sync-commits - Trigger commit sync
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

    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
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
      return NextResponse.json(
        { error: 'No repositories linked to this project' },
        { status: 400 }
      )
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

    return NextResponse.json({ data: results })
  } catch (error) {
    console.error('Sync commits error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
