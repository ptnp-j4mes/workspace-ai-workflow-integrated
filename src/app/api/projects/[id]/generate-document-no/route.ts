import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { generateDocumentNo } from '@/lib/services/document-number-service'
import { logAudit } from '@/lib/services/audit-service'

// POST /api/projects/[id]/generate-document-no - Generate AIT Project No for a project
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

    if (project.aitNo) {
      return NextResponse.json(
        { error: 'Project already has an AIT number', data: { aitNo: project.aitNo } },
        { status: 400 }
      )
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

    return NextResponse.json({ data: { aitNo } }, { status: 201 })
  } catch (error) {
    console.error('Generate project document no error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
