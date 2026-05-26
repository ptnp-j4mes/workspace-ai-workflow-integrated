import { Server as SocketServer } from 'socket.io';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PipelineStage =
  | 'idle'
  | 'joining'
  | 'joined'
  | 'recording'
  | 'recorded'
  | 'transcribing'
  | 'transcribed'
  | 'summarizing'
  | 'summarized'
  | 'exporting'
  | 'completed'
  | 'error';

export type ExportFormat = 'MARKDOWN' | 'GOOGLE_DOCS' | 'BOTH';

export interface BotSession {
  sessionId: string;
  meetingId: string;
  meetingUrl: string;
  botAccountId: string;
  exportFormat: ExportFormat;
  status: PipelineStage;
  createdAt: string;
  updatedAt: string;
  recordingPath: string | null;
  transcript: string | null;
  summary: string | null;
  summaryParsed: MeetingSummary | null;
  exportPaths: string[];
  error: string | null;
}

export interface MeetingSummary {
  summary: string;
  decisions: string[];
  requirements: string[];
  scopeIn: string[];
  scopeOut: string[];
  risks: string[];
  openQuestions: string[];
  actionItems: Array<{
    item: string;
    assignee?: string;
    dueDate?: string;
  }>;
}

// ─── Bot Manager ─────────────────────────────────────────────────────────────

class BotManager {
  private sessions: Map<string, BotSession> = new Map();
  private io: SocketServer | null = null;

  setIo(io: SocketServer) {
    this.io = io;
  }

  private emitStatus(session: BotSession) {
    if (this.io) {
      this.io.emit('bot:status', {
        sessionId: session.sessionId,
        status: session.status,
        updatedAt: session.updatedAt,
        error: session.error,
      });
    }
  }

  createSession(data: {
    meetingId: string;
    meetingUrl: string;
    botAccountId: string;
    exportFormat: ExportFormat;
  }): BotSession {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    const session: BotSession = {
      sessionId,
      meetingId: data.meetingId,
      meetingUrl: data.meetingUrl,
      botAccountId: data.botAccountId,
      exportFormat: data.exportFormat,
      status: 'idle',
      createdAt: now,
      updatedAt: now,
      recordingPath: null,
      transcript: null,
      summary: null,
      summaryParsed: null,
      exportPaths: [],
      error: null,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): BotSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateSessionStatus(sessionId: string, status: PipelineStage, extra?: Partial<BotSession>): BotSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.status = status;
    session.updatedAt = new Date().toISOString();

    if (extra) {
      Object.assign(session, extra);
    }

    this.sessions.set(sessionId, session);
    this.emitStatus(session);
    return session;
  }

  getSessionsByMeetingId(meetingId: string): BotSession[] {
    const results: BotSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.meetingId === meetingId) {
        results.push(session);
      }
    }
    return results;
  }

  getAllSessions(): BotSession[] {
    return Array.from(this.sessions.values());
  }
}

// Singleton instance
export const botManager = new BotManager();
