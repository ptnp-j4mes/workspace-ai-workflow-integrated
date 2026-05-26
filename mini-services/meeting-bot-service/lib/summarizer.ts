import { botManager, MeetingSummary } from './bot-manager';

/**
 * Parse the LLM response into a structured MeetingSummary.
 * Tries JSON parse first, falls back to extracting sections from text.
 */
function parseSummaryResponse(text: string): MeetingSummary {
  // Try to parse as JSON first
  try {
    // Look for JSON block in the response
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        summary: parsed.summary || '',
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
        scopeIn: Array.isArray(parsed.scopeIn || parsed.scope_in) ? (parsed.scopeIn || parsed.scope_in) : [],
        scopeOut: Array.isArray(parsed.scopeOut || parsed.scope_out) ? (parsed.scopeOut || parsed.scope_out) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
        openQuestions: Array.isArray(parsed.openQuestions || parsed.open_questions) ? (parsed.openQuestions || parsed.open_questions) : [],
        actionItems: Array.isArray(parsed.actionItems || parsed.action_items)
          ? (parsed.actionItems || parsed.action_items).map((item: any) =>
              typeof item === 'string'
                ? { item, assignee: undefined, dueDate: undefined }
                : {
                    item: item.item || item.task || '',
                    assignee: item.assignee || item.owner || undefined,
                    dueDate: item.dueDate || item.due || item.deadline || undefined,
                  }
            )
          : [],
      };
    }
  } catch {
    // JSON parse failed, fall through to text extraction
  }

  // Fallback: return the raw text as summary
  return {
    summary: text,
    decisions: [],
    requirements: [],
    scopeIn: [],
    scopeOut: [],
    risks: [],
    openQuestions: [],
    actionItems: [],
  };
}

/**
 * Summarize a meeting transcript using z-ai-web-dev-sdk LLM.
 * Generates structured output: summary, decisions, requirements, scope in/out, risks, action items.
 */
export async function summarizeTranscript(sessionId: string, transcriptText?: string): Promise<{
  summaryRaw: string;
  summaryParsed: MeetingSummary;
}> {
  const session = botManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const transcript = transcriptText || session.transcript;
  if (!transcript) {
    throw new Error(`No transcript available for session: ${sessionId}`);
  }

  // Update status to summarizing
  botManager.updateSessionStatus(sessionId, 'summarizing');

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    console.log(`[Summarizer] Sending transcript to LLM (${transcript.length} chars)`);

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `You are a professional meeting summarizer. Analyze the meeting transcript and provide a structured summary. Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "summary": "A concise 2-3 sentence summary of the meeting",
  "decisions": ["Decision 1", "Decision 2"],
  "requirements": ["Requirement 1", "Requirement 2"],
  "scopeIn": ["Items within scope"],
  "scopeOut": ["Items out of scope"],
  "risks": ["Risk 1", "Risk 2"],
  "openQuestions": ["Question 1"],
  "actionItems": [{"item": "Action description", "assignee": "Person name", "dueDate": "Date or timeframe"}]
}`,
        },
        {
          role: 'user',
          content: `Please summarize this meeting transcript:\n\n${transcript}`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const summaryRaw = completion.choices?.[0]?.message?.content || '';

    console.log(`[Summarizer] LLM response received (${summaryRaw.length} chars)`);

    const summaryParsed = parseSummaryResponse(summaryRaw);

    // Update session with summary
    botManager.updateSessionStatus(sessionId, 'summarized', {
      summary: summaryRaw,
      summaryParsed,
    });

    return { summaryRaw, summaryParsed };
  } catch (error: any) {
    console.error(`[Summarizer] LLM error: ${error.message}`);
    botManager.updateSessionStatus(sessionId, 'error', {
      error: `Summarization failed: ${error.message}`,
    });
    throw error;
  }
}
