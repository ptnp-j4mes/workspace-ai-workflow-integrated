import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Server as SocketServer } from 'socket.io';
import { botManager, ExportFormat, PipelineStage } from './lib/bot-manager';
import { startRecording, stopRecording } from './lib/recorder';
import { transcribeRecording } from './lib/transcriber';
import { summarizeTranscript } from './lib/summarizer';
import { exportSession } from './lib/exporter';

// ─── Constants ───────────────────────────────────────────────────────────────

const PORT = 3010;

// ─── HTTP Server (request handler attached) ──────────────────────────────────

const httpServer = createServer(handleRequest);

// Socket.io attached to the same HTTP server
// Using default path '/socket.io/' to avoid conflicts with REST API routes
const io = new SocketServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Set the socket.io instance in bot manager for status broadcasts
botManager.setIo(io);

// ─── Socket.io Events ────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Send current sessions status on connect
  const allSessions = botManager.getAllSessions();
  for (const session of allSessions) {
    socket.emit('bot:status', {
      sessionId: session.sessionId,
      status: session.status,
      updatedAt: session.updatedAt,
      error: session.error,
    });
  }

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });

  socket.on('error', (error) => {
    console.error(`[WS] Socket error (${socket.id}):`, error);
  });
});

// ─── Request Router ──────────────────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method || 'GET';

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // ─── POST /api/bot/start ───────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/bot/start') {
      const body = await readBody(req);
      const { meetingId, meetingUrl, botAccountId, exportFormat } = JSON.parse(body);

      if (!meetingId || !meetingUrl || !botAccountId) {
        sendJson(res, 400, { error: 'Missing required fields: meetingId, meetingUrl, botAccountId' });
        return;
      }

      const session = botManager.createSession({
        meetingId,
        meetingUrl,
        botAccountId,
        exportFormat: (exportFormat as ExportFormat) || 'MARKDOWN',
      });

      // Simulate the join pipeline (async, don't await)
      simulateJoinPipeline(session.sessionId);

      sendJson(res, 200, {
        sessionId: session.sessionId,
        status: session.status,
        meetingId: session.meetingId,
      });
      return;
    }

    // ─── POST /api/bot/stop ────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/bot/stop') {
      const body = await readBody(req);
      const { sessionId } = JSON.parse(body);

      if (!sessionId) {
        sendJson(res, 400, { error: 'Missing required field: sessionId' });
        return;
      }

      const session = botManager.getSession(sessionId);
      if (!session) {
        sendJson(res, 404, { error: `Session not found: ${sessionId}` });
        return;
      }

      try {
        await stopRecording(sessionId);
        sendJson(res, 200, {
          sessionId,
          status: botManager.getSession(sessionId)?.status,
          recordingPath: botManager.getSession(sessionId)?.recordingPath,
        });
      } catch (error: any) {
        sendJson(res, 500, { error: error.message });
      }
      return;
    }

    // ─── POST /api/bot/transcribe/:sessionId ───────────────────────────────
    if (method === 'POST' && pathname.match(/^\/api\/bot\/transcribe\/[^/]+$/)) {
      const sessionId = pathname.split('/').pop()!;
      const session = botManager.getSession(sessionId);
      if (!session) {
        sendJson(res, 404, { error: `Session not found: ${sessionId}` });
        return;
      }

      try {
        const transcript = await transcribeRecording(sessionId);
        sendJson(res, 200, {
          sessionId,
          transcript,
          status: botManager.getSession(sessionId)?.status,
        });
      } catch (error: any) {
        sendJson(res, 500, { error: error.message });
      }
      return;
    }

    // ─── POST /api/bot/summarize/:sessionId ────────────────────────────────
    if (method === 'POST' && pathname.match(/^\/api\/bot\/summarize\/[^/]+$/)) {
      const sessionId = pathname.split('/').pop()!;

      const body = await readBody(req);
      let transcriptText: string | undefined;
      try {
        const parsed = JSON.parse(body);
        transcriptText = parsed.transcriptText;
      } catch {
        // Body may be empty
      }

      const session = botManager.getSession(sessionId);
      if (!session) {
        sendJson(res, 404, { error: `Session not found: ${sessionId}` });
        return;
      }

      try {
        const result = await summarizeTranscript(sessionId, transcriptText);
        sendJson(res, 200, {
          sessionId,
          summaryRaw: result.summaryRaw,
          summaryParsed: result.summaryParsed,
          status: botManager.getSession(sessionId)?.status,
        });
      } catch (error: any) {
        sendJson(res, 500, { error: error.message });
      }
      return;
    }

    // ─── POST /api/bot/export/:sessionId ───────────────────────────────────
    if (method === 'POST' && pathname.match(/^\/api\/bot\/export\/[^/]+$/)) {
      const sessionId = pathname.split('/').pop()!;

      const body = await readBody(req);
      let format: ExportFormat = 'MARKDOWN';
      try {
        const parsed = JSON.parse(body);
        if (parsed.format) format = parsed.format as ExportFormat;
      } catch {
        // Body may be empty, use default
      }

      const session = botManager.getSession(sessionId);
      if (!session) {
        sendJson(res, 404, { error: `Session not found: ${sessionId}` });
        return;
      }

      try {
        const result = await exportSession(sessionId, format);
        sendJson(res, 200, {
          sessionId,
          files: result.files,
          format,
          status: botManager.getSession(sessionId)?.status,
        });
      } catch (error: any) {
        sendJson(res, 500, { error: error.message });
      }
      return;
    }

    // ─── GET /api/bot/status/:sessionId ────────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/bot\/status\/[^/]+$/)) {
      const sessionId = pathname.split('/').pop()!;
      const session = botManager.getSession(sessionId);
      if (!session) {
        sendJson(res, 404, { error: `Session not found: ${sessionId}` });
        return;
      }

      sendJson(res, 200, session);
      return;
    }

    // ─── GET /api/bot/recordings/:meetingId ────────────────────────────────
    if (method === 'GET' && pathname.match(/^\/api\/bot\/recordings\/[^/]+$/)) {
      const meetingId = pathname.split('/').pop()!;

      const sessions = botManager.getSessionsByMeetingId(meetingId);
      const recordings = sessions
        .filter((s) => s.recordingPath)
        .map((s) => ({
          sessionId: s.sessionId,
          meetingId: s.meetingId,
          recordingPath: s.recordingPath,
          status: s.status,
          createdAt: s.createdAt,
        }));

      sendJson(res, 200, { meetingId, recordings });
      return;
    }

    // ─── GET /api/bot/sessions ────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/bot/sessions') {
      const sessions = botManager.getAllSessions();
      sendJson(res, 200, { sessions });
      return;
    }

    // ─── Health Check ──────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { status: 'ok', service: 'meeting-bot', port: PORT });
      return;
    }

    // ─── 404 ───────────────────────────────────────────────────────────────
    sendJson(res, 404, { error: 'Not found' });
  } catch (error: any) {
    console.error(`[Server] Unhandled error: ${error.message}`);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Simulate the join and record pipeline with staged status updates.
 * In production, this would actually connect to the meeting URL.
 */
async function simulateJoinPipeline(sessionId: string) {
  // Stage 1: Joining
  botManager.updateSessionStatus(sessionId, 'joining');
  await delay(500);

  // Stage 2: Joined
  botManager.updateSessionStatus(sessionId, 'joined');
  await delay(500);

  // Stage 3: Start recording
  try {
    await startRecording(sessionId);
  } catch (error: any) {
    botManager.updateSessionStatus(sessionId, 'error', {
      error: `Recording failed: ${error.message}`,
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Start Server ────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[Meeting Bot Service] Running on port ${PORT}`);
  console.log(`[Meeting Bot Service] REST API: http://localhost:${PORT}/api/bot/`);
  console.log(`[Meeting Bot Service] WebSocket: socket.io on default path`);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  console.log('[Meeting Bot Service] Received SIGTERM, shutting down...');
  io.close();
  httpServer.close(() => {
    console.log('[Meeting Bot Service] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Meeting Bot Service] Received SIGINT, shutting down...');
  io.close();
  httpServer.close(() => {
    console.log('[Meeting Bot Service] Server closed');
    process.exit(0);
  });
});
