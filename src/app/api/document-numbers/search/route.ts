import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { searchDocuments } from '@/lib/services/document-number-service'

// GET /api/document-numbers/search - Search document numbers
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get('keyword') || ''

    if (!keyword) {
      return NextResponse.json(
        { error: 'keyword query parameter is required' },
        { status: 400 }
      )
    }

    const results = await searchDocuments(keyword)

    return NextResponse.json({ data: results })
  } catch (error) {
    console.error('Search document numbers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
