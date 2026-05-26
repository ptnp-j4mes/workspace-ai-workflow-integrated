# Task: Meeting Bot Mini-Service

## Summary
Created a complete Meeting Bot mini-service at `/home/z/my-project/mini-services/meeting-bot-service/` running on port 3010. The service handles the full meeting bot pipeline: join meeting → record audio → transcribe → summarize → export.

## File Structure
```
mini-services/meeting-bot-service/
  index.ts          - Main Bun HTTP server with Socket.io (port 3010)
  package.json      - Dependencies (socket.io, z-ai-web-dev-sdk)
  lib/
    bot-manager.ts  - Bot session management (CRUD, status tracking, WebSocket broadcasts)
    recorder.ts     - Audio recording simulation (creates valid WAV files)
    transcriber.ts  - ASR transcription using z-ai-web-dev-sdk (with demo fallback)
    summarizer.ts   - LLM summarization using z-ai-web-dev-sdk (structured JSON output)
    exporter.ts     - Export to Markdown / Google Docs
  recordings/       - Audio files directory
  exports/          - Export files directory
```

## API Endpoints (all verified working)
- `POST /api/bot/start` - Create bot session, simulate join, start recording
- `POST /api/bot/stop` - Stop recording
- `POST /api/bot/transcribe/:sessionId` - Transcribe audio via ASR
- `POST /api/bot/summarize/:sessionId` - Summarize transcript via LLM
- `POST /api/bot/export/:sessionId` - Export as Markdown/Google Docs/BOTH
- `GET /api/bot/status/:sessionId` - Get session status
- `GET /api/bot/recordings/:meetingId` - List recordings for a meeting
- `GET /api/bot/sessions` - List all sessions
- `GET /health` - Health check

## WebSocket Events
- `bot:status` - Real-time pipeline status updates (joining, joined, recording, transcribing, summarizing, exporting, completed, error)

## Key Design Decisions
- Uses `createServer(handleRequest)` for HTTP and attaches socket.io to the same server
- Socket.io uses default path `/socket.io/` to avoid conflicts with REST API routes
- ASR returns empty for silent WAV → falls back to demo transcript for demo purposes
- LLM generates structured JSON summary parsed into MeetingSummary type
- Google Docs export creates placeholder file (would need Google Docs API in production)
- Service started with `bun run dev` (`bun --hot index.ts`) for hot reload

## Service Status
- Running on port 3010 with `bun run dev`
- All endpoints verified working through full pipeline test
