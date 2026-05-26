// ============================================================
// Document Number Service - AIT Document Number Generation & Management
// ============================================================

import { db } from '@/lib/db'
import { logAudit } from './audit-service'

// Default document type configurations
const DEFAULT_SEQUENCE_CONFIGS: Record<string, { prefix: string; formatTemplate: string }> = {
  REQUEST:  { prefix: 'REQ', formatTemplate: 'AIT-REQ-{YEAR}-{NUMBER}' },
  PROJECT:  { prefix: 'AIT', formatTemplate: 'AIT{SHORTYEAR}{MONTH}-{NUMBER}' },
  MIT:      { prefix: 'MIT', formatTemplate: 'AIT-MIT-{YEAR}-{NUMBER}' },
  UAT:      { prefix: 'UAT', formatTemplate: 'AIT-UAT-{YEAR}-{NUMBER}' },
  BUG:      { prefix: 'BUG', formatTemplate: 'AIT-BUG-{YEAR}-{NUMBER}' },
  CHANGE:   { prefix: 'CHG', formatTemplate: 'AIT-CHG-{YEAR}-{NUMBER}' },
  APPROVAL: { prefix: 'APR', formatTemplate: 'AIT-APR-{YEAR}-{NUMBER}' },
  MA:       { prefix: 'MA',  formatTemplate: 'AIT-MA-{YEAR}-{NUMBER}' },
  PLATFORM: { prefix: 'PLT', formatTemplate: 'AIT-PLT-{SHORTYEAR}{MONTH}-{NUMBER}' },
}

/**
 * Generate a new document number for a given document type.
 * Atomically increments the sequence counter and creates a DocumentNumber record.
 */
export async function generateDocumentNo(
  documentType: string,
  entityType?: string,
  entityId?: string,
  userId?: string
): Promise<string> {
  try {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // getMonth() is 0-based

    // Default config for auto-creating sequences
    const defaultConfig = DEFAULT_SEQUENCE_CONFIGS[documentType] || {
      prefix: documentType.substring(0, 3).toUpperCase(),
      formatTemplate: `AIT-${documentType.substring(0, 3).toUpperCase()}-{YEAR}-{NUMBER}`,
    }

    // Determine default padding and reset policy based on document type
    const defaultPadding = (documentType === 'PROJECT' || documentType === 'PLATFORM') ? 3 : 6
    const defaultResetPolicy = (documentType === 'PROJECT' || documentType === 'PLATFORM') ? 'MONTHLY' : 'YEARLY'

    // Get or create the DocumentNumberSequence for this type
    let sequence = await db.documentNumberSequence.findUnique({
      where: { documentType },
    })

    if (!sequence) {
      sequence = await db.documentNumberSequence.create({
        data: {
          documentType,
          prefix: defaultConfig.prefix,
          year: currentYear,
          currentNumber: 0,
          paddingLength: defaultPadding,
          formatTemplate: defaultConfig.formatTemplate,
          resetPolicy: defaultResetPolicy,
          isActive: true,
        },
      })
    }

    // Check if we need to reset the sequence
    if (sequence.resetPolicy === 'YEARLY' && sequence.year !== currentYear) {
      sequence = await db.documentNumberSequence.update({
        where: { id: sequence.id },
        data: {
          year: currentYear,
          currentNumber: 0,
        },
      })
    } else if (sequence.resetPolicy === 'MONTHLY') {
      // For MONTHLY reset: check if the year or month has changed
      // Since the schema only stores `year`, we check the last generated document's metadata
      // to determine if we're in a new month
      let shouldReset = false

      if (sequence.year !== currentYear) {
        // Year changed — definitely reset
        shouldReset = true
      } else if (sequence.currentNumber > 0) {
        // Same year but might be a new month — check last generated document
        const lastDoc = await db.documentNumber.findFirst({
          where: { documentType },
          orderBy: { generatedAt: 'desc' },
        })
        if (lastDoc) {
          const lastDocMonth = new Date(lastDoc.generatedAt).getMonth() + 1
          const lastDocYear = new Date(lastDoc.generatedAt).getFullYear()
          if (lastDocYear !== currentYear || lastDocMonth !== currentMonth) {
            shouldReset = true
          }
        }
      }

      if (shouldReset) {
        sequence = await db.documentNumberSequence.update({
          where: { id: sequence.id },
          data: {
            year: currentYear,
            currentNumber: 0,
          },
        })
      }
    }

    // Atomically increment the current number
    sequence = await db.documentNumberSequence.update({
      where: { id: sequence.id },
      data: {
        currentNumber: { increment: 1 },
      },
    })

    const paddedNumber = String(sequence.currentNumber).padStart(sequence.paddingLength, '0')

    // Generate the formatted document number
    const shortYear = String(sequence.year).slice(-2) // Last 2 digits of year
    const paddedMonth = String(currentMonth).padStart(2, '0') // 2-digit month

    const documentNo = sequence.formatTemplate
      .replace('{PREFIX}', sequence.prefix)
      .replace('{YEAR}', String(sequence.year))
      .replace('{SHORTYEAR}', shortYear)
      .replace('{MONTH}', paddedMonth)
      .replace('{NUMBER}', paddedNumber)

    // Create the DocumentNumber record
    await db.documentNumber.create({
      data: {
        documentNo,
        documentType,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        status: 'ACTIVE',
        generatedById: userId ?? null,
        generatedAt: new Date(),
        metadata: JSON.stringify({
          sequenceId: sequence.id,
          sequenceNumber: sequence.currentNumber,
          year: sequence.year,
          month: currentMonth,
        }),
      },
    })

    // Audit log
    if (userId) {
      await logAudit({
        userId,
        action: 'GENERATE_DOCUMENT_NO',
        entity: 'DocumentNumber',
        entityId: documentNo,
        entityType: documentType,
        newValue: { documentNo, documentType, entityType, entityId },
      })
    }

    return documentNo
  } catch (error) {
    console.error('[DocumentNumberService] Error generating document number:', error)
    throw new Error(
      `Failed to generate document number: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Void a document number, marking it as no longer valid.
 */
export async function voidDocumentNo(
  documentNo: string,
  voidReason: string,
  userId: string
): Promise<void> {
  try {
    const docNumber = await db.documentNumber.findUnique({
      where: { documentNo },
    })

    if (!docNumber) {
      throw new Error(`Document number "${documentNo}" not found`)
    }

    if (docNumber.status === 'VOID') {
      throw new Error(`Document number "${documentNo}" is already voided`)
    }

    await db.documentNumber.update({
      where: { documentNo },
      data: {
        status: 'VOID',
        voidedById: userId,
        voidedAt: new Date(),
        voidReason,
      },
    })

    // Audit log
    await logAudit({
      userId,
      action: 'VOID_DOCUMENT_NO',
      entity: 'DocumentNumber',
      entityId: documentNo,
      entityType: docNumber.documentType,
      oldValue: { status: docNumber.status },
      newValue: { status: 'VOID', voidReason },
    })
  } catch (error) {
    console.error('[DocumentNumberService] Error voiding document number:', error)
    throw error
  }
}

/**
 * Get a document number record by its number.
 */
export async function getDocumentByNo(documentNo: string) {
  try {
    return await db.documentNumber.findUnique({
      where: { documentNo },
      include: {
        generator: { select: { id: true, name: true, email: true } },
        voidedBy: { select: { id: true, name: true, email: true } },
      },
    })
  } catch (error) {
    console.error('[DocumentNumberService] Error getting document by number:', error)
    throw error
  }
}

/**
 * Search documents by document number prefix.
 */
export async function searchDocuments(query: string) {
  try {
    return await db.documentNumber.findMany({
      where: {
        documentNo: { startsWith: query },
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        generator: { select: { id: true, name: true, email: true } },
      },
    })
  } catch (error) {
    console.error('[DocumentNumberService] Error searching documents:', error)
    throw error
  }
}
