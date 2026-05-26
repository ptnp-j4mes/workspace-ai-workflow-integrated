import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { generateDocumentNo } from '@/lib/services/document-number-service'
import { logAudit } from '@/lib/services/audit-service'
import { sendNotification } from '@/lib/services/notification-service'

// POST /api/requests/[id]/create-project - Create a project from an approved request
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

    const req = await db.request.findUnique({
      where: { id },
      include: {
        project: true,
      },
    })

    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (req.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved requests can be converted to projects' },
        { status: 400 }
      )
    }

    if (req.projectId) {
      return NextResponse.json(
        { error: 'Request already has an associated project' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, description, startDate, endDate } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
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

    return NextResponse.json({ data: project }, { status: 201 })
  } catch (error) {
    console.error('Create project from request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
