import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

// GET /api/search - Global search by keyword
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get('keyword') || ''
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!keyword || keyword.length < 2) {
      return NextResponse.json(
        { error: 'keyword must be at least 2 characters' },
        { status: 400 }
      )
    }

    const results: Array<{ type: string; id: string; title: string; description?: string; aitNo?: string | null; status?: string; code?: string }> = []

    // Search by AIT No in document numbers
    const docNumbers = await db.documentNumber.findMany({
      where: {
        documentNo: { contains: keyword },
        status: 'ACTIVE',
      },
      take: 5,
    })
    for (const doc of docNumbers) {
      results.push({
        type: 'DOCUMENT_NUMBER',
        id: doc.id,
        title: doc.documentNo,
        description: `Type: ${doc.documentType}`,
        aitNo: doc.documentNo,
        status: doc.status,
      })
    }

    // Search requests by title, code, or aitNo
    const requests = await db.request.findMany({
      where: {
        OR: [
          { title: { contains: keyword } },
          { code: { contains: keyword } },
          { aitNo: { contains: keyword } },
          { description: { contains: keyword } },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        code: true,
        aitNo: true,
        status: true,
        type: true,
      },
      take: limit,
    })
    for (const req of requests) {
      results.push({
        type: 'REQUEST',
        id: req.id,
        title: req.title,
        description: req.description.substring(0, 200),
        aitNo: req.aitNo,
        status: req.status,
        code: req.code,
      })
    }

    // Search projects by name, code, or aitNo
    const projects = await db.project.findMany({
      where: {
        OR: [
          { name: { contains: keyword } },
          { code: { contains: keyword } },
          { aitNo: { contains: keyword } },
          { description: { contains: keyword } },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        code: true,
        aitNo: true,
        status: true,
      },
      take: limit,
    })
    for (const proj of projects) {
      results.push({
        type: 'PROJECT',
        id: proj.id,
        title: proj.name,
        description: proj.description ?? undefined,
        aitNo: proj.aitNo,
        status: proj.status,
        code: proj.code,
      })
    }

    // Search work items by title or aitNo
    const workItems = await db.workItem.findMany({
      where: {
        OR: [
          { title: { contains: keyword } },
          { aitNo: { contains: keyword } },
        ],
      },
      select: {
        id: true,
        title: true,
        aitNo: true,
        status: true,
        currentStep: true,
      },
      take: limit,
    })
    for (const wi of workItems) {
      results.push({
        type: 'WORK_ITEM',
        id: wi.id,
        title: wi.title,
        aitNo: wi.aitNo,
        status: wi.status,
      })
    }

    // Search bug reports by title
    const bugs = await db.bugReport.findMany({
      where: {
        OR: [
          { title: { contains: keyword } },
          { aitNo: { contains: keyword } },
        ],
      },
      select: {
        id: true,
        title: true,
        aitNo: true,
        status: true,
        severity: true,
      },
      take: limit,
    })
    for (const bug of bugs) {
      results.push({
        type: 'BUG',
        id: bug.id,
        title: bug.title,
        aitNo: bug.aitNo,
        status: bug.status,
      })
    }

    return NextResponse.json({ data: results })
  } catch (error) {
    console.error('Global search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
