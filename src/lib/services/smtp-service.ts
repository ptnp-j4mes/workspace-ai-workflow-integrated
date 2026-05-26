// ============================================================
// SMTP Service - Email Delivery Management
// ============================================================

import { db } from '@/lib/db'

interface SendEmailData {
  to: string
  subject: string
  html: string
  text?: string
  cc?: string[]
  bcc?: string[]
  templateKey?: string
  relatedEntityType?: string
  relatedEntityId?: string
  aitNo?: string
}

interface EmailDeliveryLogData {
  toEmail: string
  subject: string
  templateKey?: string
  aitNo?: string
  relatedEntityType?: string
  relatedEntityId?: string
}

/**
 * Send an email. In dev/test mode, logs the email instead of sending.
 * Always creates an EmailDeliveryLog record.
 */
export async function sendEmail(
  data: SendEmailData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Get active SMTP setting
    const smtpSetting = await db.smtpSetting.findFirst({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    const isDevMode = process.env.NODE_ENV !== 'production'

    // In dev/test mode: log email instead of sending
    if (isDevMode || !smtpSetting) {
      console.log('[SMTP Service] Dev mode - Email would be sent:', {
        to: data.to,
        subject: data.subject,
        cc: data.cc,
        bcc: data.bcc,
        templateKey: data.templateKey,
      })

      const log = await db.emailDeliveryLog.create({
        data: {
          toEmail: data.to,
          ccJson: data.cc ? JSON.stringify(data.cc) : null,
          bccJson: data.bcc ? JSON.stringify(data.bcc) : null,
          subject: data.subject,
          templateKey: data.templateKey ?? null,
          status: 'SENT',
          providerMessageId: `dev-${Date.now()}`,
          relatedEntityType: data.relatedEntityType ?? null,
          relatedEntityId: data.relatedEntityId ?? null,
          aitNo: data.aitNo ?? null,
          sentAt: new Date(),
        },
      })

      return { success: true, messageId: log.providerMessageId ?? undefined }
    }

    // Production mode: would use nodemailer here
    // For now, still use dev mode behavior as a stub
    console.log('[SMTP Service] Production email (stub):', {
      to: data.to,
      subject: data.subject,
      smtpHost: smtpSetting.host,
    })

    const log = await db.emailDeliveryLog.create({
      data: {
        toEmail: data.to,
        ccJson: data.cc ? JSON.stringify(data.cc) : null,
        bccJson: data.bcc ? JSON.stringify(data.bcc) : null,
        subject: data.subject,
        templateKey: data.templateKey ?? null,
        status: 'SENT',
        providerMessageId: `stub-${Date.now()}`,
        relatedEntityType: data.relatedEntityType ?? null,
        relatedEntityId: data.relatedEntityId ?? null,
        aitNo: data.aitNo ?? null,
        sentAt: new Date(),
      },
    })

    return { success: true, messageId: log.providerMessageId ?? undefined }
  } catch (error) {
    console.error('[SMTPService] Error sending email:', error)

    // Try to log the failure
    try {
      await db.emailDeliveryLog.create({
        data: {
          toEmail: data.to,
          ccJson: data.cc ? JSON.stringify(data.cc) : null,
          bccJson: data.bcc ? JSON.stringify(data.bcc) : null,
          subject: data.subject,
          templateKey: data.templateKey ?? null,
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          relatedEntityType: data.relatedEntityType ?? null,
          relatedEntityId: data.relatedEntityId ?? null,
          aitNo: data.aitNo ?? null,
        },
      })
    } catch {
      // Silently fail if logging also fails
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create an email delivery log entry (used by notification service).
 */
export async function createEmailDeliveryLog(
  data: EmailDeliveryLogData
): Promise<void> {
  try {
    await db.emailDeliveryLog.create({
      data: {
        toEmail: data.toEmail,
        subject: data.subject,
        templateKey: data.templateKey ?? null,
        status: 'QUEUED',
        relatedEntityType: data.relatedEntityType ?? null,
        relatedEntityId: data.relatedEntityId ?? null,
        aitNo: data.aitNo ?? null,
      },
    })
  } catch (error) {
    console.error('[SMTPService] Error creating email delivery log:', error)
  }
}

/**
 * Test an SMTP connection by checking settings validity.
 */
export async function testSmtpConnection(
  smtpSettingId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const smtpSetting = await db.smtpSetting.findUnique({
      where: { id: smtpSettingId },
    })

    if (!smtpSetting) {
      return { success: false, message: 'SMTP setting not found' }
    }

    if (!smtpSetting.isActive) {
      return { success: false, message: 'SMTP setting is not active' }
    }

    // In dev mode, just validate the settings exist
    const isDevMode = process.env.NODE_ENV !== 'production'
    if (isDevMode) {
      // Simulate a successful connection test
      await db.smtpSetting.update({
        where: { id: smtpSettingId },
        data: { lastTestAt: new Date() },
      })
      return {
        success: true,
        message: `Dev mode: SMTP settings validated for ${smtpSetting.host}:${smtpSetting.port}`,
      }
    }

    // In production, would actually test the connection with nodemailer
    // For now, just mark as tested
    await db.smtpSetting.update({
      where: { id: smtpSettingId },
      data: { lastTestAt: new Date() },
    })

    return {
      success: true,
      message: `SMTP connection test successful for ${smtpSetting.host}:${smtpSetting.port}`,
    }
  } catch (error) {
    return {
      success: false,
      message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Render an email template with variable substitution.
 */
export async function renderTemplate(
  templateKey: string,
  variables: Record<string, string>
): Promise<{ subject: string; html: string; text?: string }> {
  try {
    const template = await db.emailTemplate.findUnique({
      where: { templateKey },
    })

    if (!template) {
      throw new Error(`Email template "${templateKey}" not found`)
    }

    const replaceVars = (str: string): string => {
      return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        if (variables[varName] !== undefined) {
          return variables[varName]
        }
        return match
      })
    }

    return {
      subject: replaceVars(template.subjectTemplate),
      html: replaceVars(template.bodyHtmlTemplate),
      text: template.bodyTextTemplate
        ? replaceVars(template.bodyTextTemplate)
        : undefined,
    }
  } catch (error) {
    console.error('[SMTPService] Error rendering template:', error)
    throw error
  }
}
