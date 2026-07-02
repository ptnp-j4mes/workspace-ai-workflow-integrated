import { Elysia } from 'elysia'
import { db } from '../lib/db'
import { getAuthUser } from '../lib/api-auth'
import {
  generateDocumentNo,
  voidDocumentNo,
  getDocumentByNo,
  searchDocuments,
} from '../lib/services/document-number-service'

export const documentNumbersRoutes = new Elysia({ prefix: '/api/document-numbers' })
  // GET /api/document-numbers/search - Search document numbers
  .get('/search', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { searchParams } = new URL(request.url)
      const keyword = searchParams.get('keyword') || ''

      if (!keyword) {
        set.status = 400
        return { error: 'keyword query parameter is required' }
      }

      const results = await searchDocuments(keyword)

      return { data: results }
    } catch (error) {
      console.error('Search document numbers error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/document-numbers/generate - Generate a document number
  .post('/generate', async ({ request, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const body = await request.json()
      const { documentType, entityType, entityId } = body

      if (!documentType) {
        set.status = 400
        return { error: 'documentType is required' }
      }

      const validTypes = ['REQUEST', 'PROJECT', 'MIT', 'UAT', 'BUG', 'CHANGE', 'APPROVAL', 'MA']
      if (!validTypes.includes(documentType)) {
        set.status = 400
        return { error: `Invalid documentType. Must be one of: ${validTypes.join(', ')}` }
      }

      const documentNo = await generateDocumentNo(
        documentType,
        entityType,
        entityId,
        authUser.id
      )

      set.status = 201
      return { data: { documentNo } }
    } catch (error) {
      console.error('Generate document number error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // GET /api/document-numbers/:id - Get document number details
  // The :id param can be either a document number string or a CUID
  .get('/:id', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const { id } = params

      // Try to find by documentNo first
      let docNumber = await getDocumentByNo(id)

      // If not found by documentNo, try by ID (CUID)
      if (!docNumber) {
        docNumber = await db.documentNumber.findUnique({
          where: { id },
          include: {
            generator: { select: { id: true, name: true, email: true } },
            voidedBy: { select: { id: true, name: true, email: true } },
          },
        })
      }

      if (!docNumber) {
        set.status = 404
        return { error: 'Document number not found' }
      }

      return { data: docNumber }
    } catch (error) {
      console.error('Get document number error:', error)
      set.status = 500
      return { error: 'Internal server error' }
    }
  })

  // POST /api/document-numbers/:id/void - Void a document number
  .post('/:id/void', async ({ request, params, set }) => {
    try {
      const authUser = await getAuthUser(request)
      if (!authUser) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const isAdmin = authUser.roles.includes('ADMIN')
      if (!isAdmin) {
        set.status = 403
        return { error: 'Only administrators can void document numbers' }
      }

      const { id } = params
      const body = await request.json()
      const { reason } = body

      if (!reason) {
        set.status = 400
        return { error: 'reason is required' }
      }

      // Find the document number by ID
      const docNumber = await db.documentNumber.findUnique({ where: { id } })
      if (!docNumber) {
        set.status = 404
        return { error: 'Document number not found' }
      }

      await voidDocumentNo(docNumber.documentNo, reason, authUser.id)

      return { data: { message: 'Document number voided successfully' } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      console.error('Void document number error:', error)
      set.status = 500
      return { error: message }
    }
  })
