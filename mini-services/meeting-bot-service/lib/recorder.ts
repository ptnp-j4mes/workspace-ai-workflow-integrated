import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { botManager } from './bot-manager';

const execAsync = promisify(exec);

const RECORDINGS_DIR = '/home/z/my-project/mini-services/meeting-bot-service/recordings';

/**
 * Ensure the recordings directory exists.
 */
function ensureRecordingsDir(): void {
  if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  }
}

/**
 * Create a minimal valid WAV file with silence.
 * WAV format: 44-byte header + PCM audio data.
 * In production, this would use: ffmpeg -f pulse -i default -ac 1 -ar 16000 output.wav
 */
function createSilentWav(filePath: string, durationSeconds: number = 5): void {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const numSamples = sampleRate * durationSeconds;
  const dataSize = numSamples * blockAlign;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);            // Sub-chunk size (16 for PCM)
  buffer.writeUInt16LE(1, 20);             // Audio format (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Silence: all zeros (already zeroed by Buffer.alloc)

  fs.writeFileSync(filePath, buffer);
}

/**
 * Start recording for a bot session.
 * In sandbox mode, this creates a simulated silent WAV file.
 * In production, this would spawn an ffmpeg process.
 */
export async function startRecording(sessionId: string): Promise<string> {
  ensureRecordingsDir();

  const session = botManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Update status to recording
  botManager.updateSessionStatus(sessionId, 'recording');

  const fileName = `recording_${sessionId}_${Date.now()}.wav`;
  const filePath = path.join(RECORDINGS_DIR, fileName);

  // Simulate recording by creating a silent WAV file
  // In production: ffmpeg -f pulse -i default -ac 1 -ar 16000 <filePath>
  createSilentWav(filePath, 5); // 5 seconds of silence

  // Update session with recording path
  botManager.updateSessionStatus(sessionId, 'recorded', {
    recordingPath: filePath,
  });

  console.log(`[Recorder] Created simulated recording: ${filePath}`);
  return filePath;
}

/**
 * Stop recording for a bot session.
 * In sandbox mode, the simulated file is already complete.
 * In production, this would stop the ffmpeg process.
 */
export async function stopRecording(sessionId: string): Promise<void> {
  const session = botManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (!session.recordingPath) {
    throw new Error(`No recording in progress for session: ${sessionId}`);
  }

  // In production, we would stop the ffmpeg process here.
  // In sandbox, the file is already written.

  // Verify the file exists
  if (!fs.existsSync(session.recordingPath)) {
    throw new Error(`Recording file not found: ${session.recordingPath}`);
  }

  const fileSize = fs.statSync(session.recordingPath).size;
  console.log(`[Recorder] Recording stopped. File size: ${fileSize} bytes`);
}
