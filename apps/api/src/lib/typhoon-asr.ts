// ============================================================
// Typhoon ASR Client - opentyphoon.ai speech-to-text (OpenAI-compatible)
// ============================================================

import { spawn } from 'child_process'
import { readFile, readdir, mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

const TYPHOON_ASR_URL = 'https://api.opentyphoon.ai/v1/audio/transcriptions'
const TYPHOON_ASR_MODEL = 'typhoon-asr-realtime'

// Shared ceiling for the Typhoon HTTP call and spawned ffmpeg/ffprobe processes -
// none of them should be able to hang a transcribe request indefinitely.
const DEFAULT_TIMEOUT_MS = 120_000

// ponytail: Typhoon docs don't publish a hard size/duration limit. 10min/chunk is a
// conservative default sized for typical Whisper-family API limits (~25MB per request).
// Bump this (or wire it to a real published limit) if Typhoon starts rejecting long chunks.
const CHUNK_DURATION_SEC = 600

export function isTyphoonConfigured(): boolean {
  return Boolean(process.env.TYPHOON_API_KEY)
}

export async function transcribeWithTyphoon(audioBuffer: Buffer, fileName: string): Promise<string> {
  const apiKey = process.env.TYPHOON_API_KEY
  if (!apiKey) {
    throw new Error('TYPHOON_API_KEY not configured')
  }

  const form = new FormData()
  form.append('file', new Blob([audioBuffer]), fileName)
  form.append('model', TYPHOON_ASR_MODEL)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(TYPHOON_ASR_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Typhoon ASR request timed out after ${DEFAULT_TIMEOUT_MS}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new Error(`Typhoon ASR request failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as { text?: string }
  return data.text ?? ''
}

// ============================================================
// Long-recording support - split via ffmpeg, transcribe chunks, stitch back together
// ============================================================

function runCommand(cmd: string, args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args)
    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => (stdout += d))
    proc.stderr.on('data', (d) => (stderr += d))
    proc.on('error', reject)
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 500)}`))
      } else {
        resolve(stdout)
      }
    })
  })
}

async function getAudioDurationSec(filePath: string): Promise<number> {
  const out = await runCommand('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    filePath,
  ])
  return parseFloat(out.trim())
}

async function splitAudioIntoChunks(filePath: string, chunkDir: string): Promise<string[]> {
  const ext = path.extname(filePath) || '.webm'
  await runCommand('ffmpeg', [
    '-i', filePath,
    '-f', 'segment',
    '-segment_time', String(CHUNK_DURATION_SEC),
    '-c', 'copy',
    '-reset_timestamps', '1',
    path.join(chunkDir, `chunk_%03d${ext}`),
  ])
  const files = await readdir(chunkDir)
  return files.filter((f) => f.startsWith('chunk_')).sort().map((f) => path.join(chunkDir, f))
}

function formatTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Transcribe an audio file with Typhoon ASR. Recordings longer than
 * CHUNK_DURATION_SEC are split with ffmpeg and transcribed chunk by chunk
 * (sequentially, to stay well under Typhoon's rate limit) so multi-hour
 * meetings don't blow past per-request limits or timeouts.
 */
export async function transcribeAudioFile(filePath: string): Promise<string> {
  let durationSec = 0
  try {
    durationSec = await getAudioDurationSec(filePath)
  } catch {
    // ffprobe missing/failed - fall through to a single-shot attempt below
  }

  if (!durationSec || durationSec <= CHUNK_DURATION_SEC) {
    const buffer = await readFile(filePath)
    return transcribeWithTyphoon(buffer, path.basename(filePath))
  }

  const chunkDir = await mkdtemp(path.join(tmpdir(), 'typhoon-chunks-'))
  try {
    const chunkPaths = await splitAudioIntoChunks(filePath, chunkDir)
    const parts: string[] = []
    let successCount = 0
    for (let i = 0; i < chunkPaths.length; i++) {
      const label = `[${formatTimestamp(i * CHUNK_DURATION_SEC)}]`
      try {
        const buffer = await readFile(chunkPaths[i])
        const text = await transcribeWithTyphoon(buffer, path.basename(chunkPaths[i]))
        parts.push(`${label}\n${text}`)
        successCount++
      } catch (chunkError) {
        // One bad chunk (network blip, rate limit) shouldn't discard the rest of a long meeting.
        console.warn(`Typhoon ASR failed for chunk ${i + 1}/${chunkPaths.length}:`, chunkError)
        parts.push(`${label}\n[transcription failed for this segment]`)
      }
    }

    // If every chunk failed, don't return a "successful" transcript made entirely of
    // placeholders - throw so the caller's mock-transcript fallback kicks in instead.
    if (successCount === 0) {
      throw new Error(`Typhoon ASR failed for all ${chunkPaths.length} chunks`)
    }

    return parts.join('\n\n')
  } finally {
    await rm(chunkDir, { recursive: true, force: true })
  }
}
