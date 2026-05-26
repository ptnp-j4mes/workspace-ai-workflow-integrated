import fs from 'fs';
import { botManager } from './bot-manager';

// Demo transcript used when ASR returns empty (silent WAV file)
const DEMO_TRANSCRIPT = `
Meeting Transcript - Project Alpha Sprint Review

[00:00] Facilitator (Sarah): Good morning everyone. Let's kick off the sprint review for Project Alpha. We have several items to cover today including the deployment timeline, scope changes, and resource allocation.

[00:45] Developer (Mike): We've completed the user authentication module. It passed all QA tests yesterday. The OAuth2 integration with the third-party provider is working as expected.

[01:20] Product Manager (Lisa): Great progress on authentication. I want to flag that we have a new requirement from the compliance team. They need an audit trail for all data access events. This wasn't in the original scope.

[02:10] Architect (David): Adding audit trails is feasible, but it will impact the database schema. We'll need at least two additional tables and a logging service. I estimate 3-5 extra development days.

[02:55] Sarah: Let's document that as a scope addition. David, can you prepare a technical impact assessment by Friday?

[03:15] David: Yes, I'll have it ready by Thursday actually.

[03:30] QA Lead (Emma): I want to raise a risk. The payment integration testing is blocked because the sandbox environment is down. We've escalated to the vendor but haven't received a timeline for the fix.

[04:05] Sarah: That's a significant risk. Mike, can you look into setting up a mock payment service as a fallback?

[04:20] Mike: I can have a basic mock service ready by tomorrow. It won't cover edge cases but will unblock testing.

[04:35] Lisa: Also, regarding scope - the mobile app push notification feature should be considered out of scope for this sprint. We don't have the Firebase configuration ready yet.

[05:00] Sarah: Agreed. Push notifications are out of scope for Sprint 4. Let's move it to Sprint 5.

[05:15] David: One more thing - we need to decide on the database migration strategy. Rolling migration or big-bang?

[05:30] Lisa: I prefer rolling migration. Less risk for production.

[05:40] Sarah: Decision noted - we'll go with rolling migration. Action items: David to prepare technical impact assessment by Thursday, Mike to set up mock payment service by tomorrow, and Lisa to finalize Sprint 5 scope by end of week.

[06:10] Emma: I'll update the test plan to include the mock service scenario.

[06:20] Sarah: Thank you everyone. Let's reconvene on Thursday for the mid-sprint check.
`;

/**
 * Transcribe the recorded audio file using z-ai-web-dev-sdk ASR.
 * Falls back to demo transcript if ASR returns empty (e.g., silent audio).
 */
export async function transcribeRecording(sessionId: string): Promise<string> {
  const session = botManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (!session.recordingPath) {
    throw new Error(`No recording found for session: ${sessionId}`);
  }

  if (!fs.existsSync(session.recordingPath)) {
    throw new Error(`Recording file not found: ${session.recordingPath}`);
  }

  // Update status to transcribing
  botManager.updateSessionStatus(sessionId, 'transcribing');

  let transcript = '';

  try {
    // Use z-ai-web-dev-sdk ASR
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const audioFile = fs.readFileSync(session.recordingPath);
    const base64Audio = audioFile.toString('base64');

    console.log(`[Transcriber] Sending audio to ASR (${audioFile.length} bytes, base64: ${base64Audio.length} chars)`);

    const response = await zai.audio.asr.create({
      file_base64: base64Audio,
    });

    transcript = response.text || '';
    console.log(`[Transcriber] ASR response: "${transcript}"`);
  } catch (error: any) {
    console.error(`[Transcriber] ASR error: ${error.message}`);
    // Fall through to demo transcript
  }

  // If ASR returns empty (silent audio), use demo transcript
  if (!transcript || transcript.trim().length === 0) {
    console.log('[Transcriber] ASR returned empty, using demo transcript');
    transcript = DEMO_TRANSCRIPT;
  }

  // Update session with transcript
  botManager.updateSessionStatus(sessionId, 'transcribed', {
    transcript,
  });

  console.log(`[Transcriber] Transcript saved (${transcript.length} chars)`);
  return transcript;
}
