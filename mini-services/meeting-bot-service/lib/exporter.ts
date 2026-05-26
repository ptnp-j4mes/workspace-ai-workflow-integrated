import fs from 'fs';
import path from 'path';
import { botManager, MeetingSummary, ExportFormat } from './bot-manager';

const EXPORTS_DIR = '/home/z/my-project/mini-services/meeting-bot-service/exports';

/**
 * Ensure the exports directory exists.
 */
function ensureExportsDir(): void {
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
}

/**
 * Format a MeetingSummary as Markdown.
 */
function formatAsMarkdown(sessionId: string, meetingId: string, transcript: string, summary: MeetingSummary): string {
  const timestamp = new Date().toISOString();
  const lines: string[] = [];

  lines.push(`# Meeting Summary`);
  lines.push('');
  lines.push(`**Meeting ID:** ${meetingId}`);
  lines.push(`**Session ID:** ${sessionId}`);
  lines.push(`**Generated:** ${timestamp}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(summary.summary || 'No summary available.');
  lines.push('');

  // Decisions
  if (summary.decisions.length > 0) {
    lines.push('## Decisions');
    lines.push('');
    for (const decision of summary.decisions) {
      lines.push(`- ${decision}`);
    }
    lines.push('');
  }

  // Requirements
  if (summary.requirements.length > 0) {
    lines.push('## Requirements');
    lines.push('');
    for (const req of summary.requirements) {
      lines.push(`- ${req}`);
    }
    lines.push('');
  }

  // Scope In
  if (summary.scopeIn.length > 0) {
    lines.push('## Scope (In)');
    lines.push('');
    for (const item of summary.scopeIn) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  // Scope Out
  if (summary.scopeOut.length > 0) {
    lines.push('## Scope (Out)');
    lines.push('');
    for (const item of summary.scopeOut) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  // Risks
  if (summary.risks.length > 0) {
    lines.push('## Risks');
    lines.push('');
    for (const risk of summary.risks) {
      lines.push(`- ⚠️ ${risk}`);
    }
    lines.push('');
  }

  // Open Questions
  if (summary.openQuestions.length > 0) {
    lines.push('## Open Questions');
    lines.push('');
    for (const question of summary.openQuestions) {
      lines.push(`- ❓ ${question}`);
    }
    lines.push('');
  }

  // Action Items
  if (summary.actionItems.length > 0) {
    lines.push('## Action Items');
    lines.push('');
    lines.push('| # | Action | Assignee | Due Date |');
    lines.push('|---|--------|----------|----------|');
    summary.actionItems.forEach((item, index) => {
      lines.push(`| ${index + 1} | ${item.item} | ${item.assignee || '-'} | ${item.dueDate || '-'} |`);
    });
    lines.push('');
  }

  // Full Transcript
  lines.push('---');
  lines.push('');
  lines.push('## Full Transcript');
  lines.push('');
  lines.push(transcript || 'No transcript available.');
  lines.push('');

  return lines.join('\n');
}

/**
 * Export the meeting summary and transcript.
 */
export async function exportSession(
  sessionId: string,
  format: ExportFormat = 'MARKDOWN'
): Promise<{ files: string[]; error?: string }> {
  const session = botManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (!session.transcript) {
    throw new Error(`No transcript available for session: ${sessionId}`);
  }

  // Update status to exporting
  botManager.updateSessionStatus(sessionId, 'exporting');

  ensureExportsDir();

  const exportedFiles: string[] = [];
  const summaryParsed = session.summaryParsed || {
    summary: session.summary || '',
    decisions: [],
    requirements: [],
    scopeIn: [],
    scopeOut: [],
    risks: [],
    openQuestions: [],
    actionItems: [],
  };

  try {
    if (format === 'MARKDOWN' || format === 'BOTH') {
      const mdContent = formatAsMarkdown(
        sessionId,
        session.meetingId,
        session.transcript,
        summaryParsed
      );
      const mdFileName = `meeting_${session.meetingId}_${sessionId}.md`;
      const mdFilePath = path.join(EXPORTS_DIR, mdFileName);
      fs.writeFileSync(mdFilePath, mdContent, 'utf-8');
      exportedFiles.push(mdFilePath);
      console.log(`[Exporter] Markdown exported: ${mdFilePath}`);
    }

    if (format === 'GOOGLE_DOCS' || format === 'BOTH') {
      // In production, this would use the Google Docs API to create a document.
      // For sandbox, create a placeholder file indicating it would be uploaded.
      const placeholderContent = [
        `Google Docs Export Placeholder`,
        `===============================`,
        ``,
        `Session ID: ${sessionId}`,
        `Meeting ID: ${session.meetingId}`,
        `Generated: ${new Date().toISOString()}`,
        ``,
        `In production, this document would be automatically created in Google Docs`,
        `using the Google Docs API with the following content:`,
        ``,
        formatAsMarkdown(sessionId, session.meetingId, session.transcript, summaryParsed),
      ].join('\n');

      const gdocsFileName = `meeting_${session.meetingId}_${sessionId}_gdocs.txt`;
      const gdocsFilePath = path.join(EXPORTS_DIR, gdocsFileName);
      fs.writeFileSync(gdocsFilePath, placeholderContent, 'utf-8');
      exportedFiles.push(gdocsFilePath);
      console.log(`[Exporter] Google Docs placeholder exported: ${gdocsFilePath}`);
    }

    // Update session
    botManager.updateSessionStatus(sessionId, 'completed', {
      exportPaths: exportedFiles,
    });

    return { files: exportedFiles };
  } catch (error: any) {
    console.error(`[Exporter] Export error: ${error.message}`);
    botManager.updateSessionStatus(sessionId, 'error', {
      error: `Export failed: ${error.message}`,
    });
    throw error;
  }
}
