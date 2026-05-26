import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

// DELETE /api/projects/[id]/github/repositories/[repositoryId] - Unlink repository from project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; repositoryId: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, repositoryId } = await params

    const link = await db.projectGithubRepository.findFirst({
      where: { projectId: id, repositoryId },
    })

    if (!link) {
      return NextResponse.json({ error: 'Repository link not found' }, { status: 404 })
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

    return NextResponse.json({ data: { message: 'Repository unlinked from project' } })
  } catch (error) {
    console.error('Unlink repository error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
