import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/services/audit-service'

function hasIntegrationsPermission(roles: string[]): boolean {
  return roles.includes('ADMIN') || roles.includes('IT_MANAGER')
}

// GET /api/admin/github/connections - List GitHub connections (mask tokens)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connections = await db.githubConnection.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        repositories: {
          select: {
            id: true,
            fullName: true,
            defaultBranch: true,
            visibility: true,
            lastSyncedAt: true,
          },
        },
      },
    })

    // Mask tokens
    const masked = connections.map((c) => ({
      ...c,
      tokenEncrypted: '***',
    }))

    return NextResponse.json({ data: masked })
  } catch (error) {
    console.error('List GitHub connections error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/github/connections - Create GitHub connection
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasIntegrationsPermission(authUser.roles)) {
      return NextResponse.json({ error: 'Forbidden: admin:integrations permission required' }, { status: 403 })
    }

    const body = await request.json()
    const { connectionName, authType, tokenEncrypted, owner, isActive } = body

    if (!connectionName || !owner) {
      return NextResponse.json(
        { error: 'connectionName and owner are required' },
        { status: 400 }
      )
    }

    const connection = await db.githubConnection.create({
      data: {
        connectionName,
        authType: authType ?? 'TOKEN',
        tokenEncrypted: tokenEncrypted ?? null,
        owner,
        isActive: isActive ?? true,
        createdById: authUser.id,
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    await logAudit({
      userId: authUser.id,
      action: 'CREATE_GITHUB_CONNECTION',
      entity: 'GithubConnection',
      entityId: connection.id,
      newValue: { connectionName, authType: connection.authType, owner, tokenEncrypted: '***' },
    })

    return NextResponse.json(
      { data: { ...connection, tokenEncrypted: '***' } },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create GitHub connection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
