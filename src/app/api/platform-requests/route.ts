import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'
import { generateDocumentNo } from '@/lib/services/document-number-service'

// GET /api/platform-requests - List platform requests with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const mine = searchParams.get('mine') === 'true'
    const pendingApproval = searchParams.get('pendingApproval') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status

    if (mine) {
      where.requesterId = user.id
    }

    if (pendingApproval) {
      where.approvals = {
        some: {
          approverId: user.id,
          status: 'PENDING',
        },
      }
    }

    const include = {
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
      project: {
        select: { id: true, name: true, status: true },
      },
    }

    const [platformRequests, total] = await Promise.all([
      db.platformRequest.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.platformRequest.count({ where }),
    ])

    return NextResponse.json({
      data: platformRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List platform requests error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/platform-requests - Create a new platform request
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, objective, targetUsers, expectedTimeline, priority } = body

    if (!name || !description) {
      return NextResponse.json(
        { error: 'Name and description are required' },
        { status: 400 }
      )
    }

    // Resolve requester's department
    const requester = await db.user.findUnique({
      where: { id: user.id },
      include: { department: { include: { parent: true } } },
    })

    let departmentId: string | null = null
    let divisionDepartmentId: string | null = null

    if (requester?.department) {
      departmentId = requester.department.id
      if (requester.department.type === 'SECTION' && requester.department.parentId) {
        // User is in a section — the division is the parent
        divisionDepartmentId = requester.department.parentId
      } else if (requester.department.type === 'DIVISION') {
        divisionDepartmentId = requester.department.id
      }
    }

    // Resolve division head
    let divisionHeadId: string | null = null
    if (divisionDepartmentId) {
      // Find a user in the division department with role DIVISION_MANAGER or similar
      const divisionManager = await db.user.findFirst({
        where: {
          departmentId: divisionDepartmentId,
          isActive: true,
          roles: {
            some: {
              role: {
                key: {
                  in: ['DIVISION_MANAGER', 'DIVISION_HEAD', 'MANAGER'],
                },
              },
            },
          },
        },
      })

      if (divisionManager) {
        divisionHeadId = divisionManager.id
      } else {
        // Fallback: find any admin/manager in the division department
        const fallbackManager = await db.user.findFirst({
          where: {
            departmentId: divisionDepartmentId,
            isActive: true,
            roles: {
              some: {
                role: {
                  key: {
                    in: ['ADMIN', 'MANAGER'],
                  },
                },
              },
            },
          },
        })
        if (fallbackManager) {
          divisionHeadId = fallbackManager.id
        }
      }
    }

    // Resolve SD Manager
    let sdManagerId: string | null = null
    const sdManager = await db.user.findFirst({
      where: {
        isActive: true,
        roles: {
          some: {
            role: {
              key: {
                in: ['IT_MANAGER', 'SD_MANAGER'],
              },
            },
          },
        },
      },
    })

    if (sdManager) {
      sdManagerId = sdManager.id
    } else {
      // Fallback: find any admin user
      const adminUser = await db.user.findFirst({
        where: {
          isActive: true,
          roles: {
            some: {
              role: { key: 'ADMIN' },
            },
          },
        },
      })
      if (adminUser) {
        sdManagerId = adminUser.id
      }
    }

    // Create the platform request first (without requestNo)
    const platformRequest = await db.platformRequest.create({
      data: {
        requestNo: `TEMP-${Date.now()}`, // Temporary, will update after generating
        name,
        description,
        objective: objective || null,
        targetUsers: targetUsers || null,
        expectedTimeline: expectedTimeline || null,
        priority: priority || 'MEDIUM',
        status: 'PENDING',
        requesterId: user.id,
        departmentId,
        divisionHeadId,
        sdManagerId,
        approvals: {
          create: [
            {
              step: 'DIVISION_HEAD',
              status: 'PENDING',
              approverId: divisionHeadId || user.id, // Placeholder if no division head found
            },
            {
              step: 'SD_MANAGER',
              status: 'PENDING',
              approverId: sdManagerId || user.id, // Placeholder if no SD manager found
            },
          ],
        },
      },
    })

    // Generate the requestNo using document number service
    const requestNo = await generateDocumentNo(
      'PLATFORM',
      'PlatformRequest',
      platformRequest.id,
      user.id
    )

    // Update with the generated requestNo
    const updatedRequest = await db.platformRequest.update({
      where: { id: platformRequest.id },
      data: { requestNo },
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
        },
      },
    })

    // Audit log
    await logAudit({
      userId: user.id,
      action: 'CREATE_PLATFORM_REQUEST',
      entity: 'PlatformRequest',
      entityId: platformRequest.id,
      newValue: {
        requestNo,
        name,
        priority: priority || 'MEDIUM',
        status: 'PENDING',
      },
    })

    return NextResponse.json({ data: updatedRequest }, { status: 201 })
  } catch (error) {
    console.error('Create platform request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
