import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'
import { generateDocumentNo } from '@/lib/services/document-number-service'

// POST /api/platform-requests/[id]/approve - Approve or reject a platform request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, comment } = body

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be APPROVE or REJECT' },
        { status: 400 }
      )
    }

    // Fetch the platform request with approvals
    const platformRequest = await db.platformRequest.findUnique({
      where: { id },
      include: {
        approvals: {
          include: {
            approver: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        requester: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!platformRequest) {
      return NextResponse.json({ error: 'Platform request not found' }, { status: 404 })
    }

    // Check if request is in an actionable status
    if (!['PENDING', 'DIVISION_APPROVED'].includes(platformRequest.status)) {
      return NextResponse.json(
        { error: `Cannot act on platform request with status ${platformRequest.status}` },
        { status: 400 }
      )
    }

    // Find the current pending approval for this user
    const pendingApproval = platformRequest.approvals.find(
      (a) => a.approverId === user.id && a.status === 'PENDING'
    )

    if (!pendingApproval) {
      return NextResponse.json(
        { error: 'You are not authorized to approve/reject this request, or there is no pending action for you' },
        { status: 403 }
      )
    }

    const now = new Date()

    if (action === 'REJECT') {
      // Mark the current step approval as REJECTED
      await db.platformRequestApproval.update({
        where: { id: pendingApproval.id },
        data: {
          status: 'REJECTED',
          comment: comment || null,
          actedAt: now,
        },
      })

      // Update PlatformRequest status to REJECTED
      const updatedRequest = await db.platformRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: comment || null,
        },
        include: {
          requester: {
            select: { id: true, name: true, email: true },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
              parent: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          divisionHead: {
            select: { id: true, name: true, email: true },
          },
          sdManager: {
            select: { id: true, name: true, email: true },
          },
          project: {
            select: { id: true, name: true, status: true },
          },
          approvals: {
            include: {
              approver: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      // Audit log
      await logAudit({
        userId: user.id,
        action: 'REJECT_PLATFORM_REQUEST',
        entity: 'PlatformRequest',
        entityId: id,
        newValue: {
          step: pendingApproval.step,
          comment: comment || null,
          status: 'REJECTED',
        },
      })

      return NextResponse.json({ data: updatedRequest })
    }

    // action === 'APPROVE'
    if (pendingApproval.step === 'DIVISION_HEAD') {
      // Mark DIVISION_HEAD approval as APPROVED
      await db.platformRequestApproval.update({
        where: { id: pendingApproval.id },
        data: {
          status: 'APPROVED',
          comment: comment || null,
          actedAt: now,
        },
      })

      // Update PlatformRequest status to DIVISION_APPROVED
      const updatedRequest = await db.platformRequest.update({
        where: { id },
        data: {
          status: 'DIVISION_APPROVED',
        },
        include: {
          requester: {
            select: { id: true, name: true, email: true },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
              parent: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          divisionHead: {
            select: { id: true, name: true, email: true },
          },
          sdManager: {
            select: { id: true, name: true, email: true },
          },
          project: {
            select: { id: true, name: true, status: true },
          },
          approvals: {
            include: {
              approver: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      // Audit log
      await logAudit({
        userId: user.id,
        action: 'APPROVE_PLATFORM_REQUEST_DIVISION',
        entity: 'PlatformRequest',
        entityId: id,
        newValue: {
          step: 'DIVISION_HEAD',
          comment: comment || null,
          newStatus: 'DIVISION_APPROVED',
        },
      })

      return NextResponse.json({ data: updatedRequest })
    }

    if (pendingApproval.step === 'SD_MANAGER') {
      // Mark SD_MANAGER approval as APPROVED
      await db.platformRequestApproval.update({
        where: { id: pendingApproval.id },
        data: {
          status: 'APPROVED',
          comment: comment || null,
          actedAt: now,
        },
      })

      // Auto-create a Project linked to this request
      const projectCode = await generateDocumentNo(
        'PROJECT',
        'Project',
        undefined,
        user.id
      )

      const project = await db.project.create({
        data: {
          code: projectCode,
          name: platformRequest.name,
          description: platformRequest.description,
          aitNo: platformRequest.requestNo,
          status: 'INITIATION',
          createdById: platformRequest.requesterId,
          members: {
            create: {
              userId: platformRequest.requesterId,
              role: 'PROJECT_MANAGER',
            },
          },
        },
      })

      // Update PlatformRequest: status APPROVED → LINKED, set approvedAt and projectId
      const updatedRequest = await db.platformRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: now,
          projectId: project.id,
        },
      })

      // Now set status to LINKED after project is linked
      const finalRequest = await db.platformRequest.update({
        where: { id },
        data: { status: 'LINKED' },
        include: {
          requester: {
            select: { id: true, name: true, email: true },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
              parent: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          divisionHead: {
            select: { id: true, name: true, email: true },
          },
          sdManager: {
            select: { id: true, name: true, email: true },
          },
          project: {
            select: { id: true, name: true, status: true, code: true },
          },
          approvals: {
            include: {
              approver: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      // Audit log
      await logAudit({
        userId: user.id,
        action: 'APPROVE_PLATFORM_REQUEST_SD',
        entity: 'PlatformRequest',
        entityId: id,
        newValue: {
          step: 'SD_MANAGER',
          comment: comment || null,
          status: 'LINKED',
          projectId: project.id,
          projectCode,
        },
      })

      return NextResponse.json({ data: finalRequest })
    }

    // Should not reach here
    return NextResponse.json({ error: 'Invalid approval step' }, { status: 400 })
  } catch (error) {
    console.error('Approve/reject platform request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
