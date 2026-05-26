import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { generateDocumentNo } from '@/lib/services/document-number-service'
import { logAudit } from '@/lib/services/audit-service'
import { sendNotification } from '@/lib/services/notification-service'

// POST /api/requests/[id]/create-mit - Create MIT/work item from a request
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

    const req = await db.request.findUnique({ where: { id } })
    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (!['APPROVED', 'ASSIGNED', 'IN_DEVELOPMENT'].includes(req.status)) {
      return NextResponse.json(
        { error: 'Request must be approved or in progress to create a work item' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, description, priority, dueDate, currentStep } = body

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    // Generate AIT MIT Number
    const aitNo = await generateDocumentNo('MIT', 'Request', id, authUser.id)

    const workItem = await db.workItem.create({
      data: {
        title,
        description: description ?? req.description,
        requestId: id,
        projectId: req.projectId,
        status: 'CREATED',
        currentStep: currentStep ?? 'BA',
        priority: priority ?? req.priority,
        aitNo,
        dueDate: dueDate ? new Date(dueDate) : req.dueDate,
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'CREATE_MIT_FROM_REQUEST',
      entity: 'WorkItem',
      entityId: workItem.id,
      aitNo,
      newValue: { title, requestId: id, priority: workItem.priority },
    })

    // Notify the request creator
    await sendNotification('MIT_CREATED', {
      userId: req.createdById,
      entityType: 'MIT',
      entityId: workItem.id,
      aitNo,
      title: `Work Item Created: ${title}`,
      message: `A work item has been created from your request "${req.title}" (AIT: ${aitNo})`,
      link: `/work-items/${workItem.id}`,
    })

    return NextResponse.json({ data: workItem }, { status: 201 })
  } catch (error) {
    console.error('Create MIT from request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
