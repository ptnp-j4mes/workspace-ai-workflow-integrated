'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { io, Socket } from 'socket.io-client'
import {
  ArrowLeft,
  Video,
  Bot,
  Calendar,
  Users,
  ExternalLink,
  Play,
  Square,
  Loader2,
  FileText,
  CheckSquare,
  ListChecks,
  ClipboardList,
  Sparkles,
  User,
  Download,
  Mic,
  MicOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cloud,
  CloudOff,
  FileDown,
  Globe,
  Settings,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/store/app-store'
import { api } from '@/lib/api-client'
import { toast } from '@/lib/toast'
import { useI18n } from '@/i18n'

// ============================================================
// Types
// ============================================================

interface Participant {
  id: string
  name: string
  email: string | null
  role: string | null
  user?: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  } | null
}

interface Transcript {
  id: string
  content: string
  format: string
  duration: number | null
  createdAt: string
}

interface Summary {
  id: string
  summaryMarkdown: string
  decisions: string | null
  requirements: string | null
  scopeIn: string | null
  scopeOut: string | null
  risks: string | null
  openQuestions: string | null
  aiModel: string | null
  createdAt: string
}

interface ActionItem {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  status: string
  confidence: number | null
  sourceQuote: string | null
  createdAt: string
  assignee?: {
    id: string
    name: string
    email: string
  } | null
}

interface BotSession {
  id: string
  status: string
  joinedAt: string | null
  leftAt: string | null
  errorLog: string | null
  createdAt: string
  botAccount: {
    id: string
    name: string
    email: string
  }
  // Pipeline tracking fields
  recordingStartedAt?: string | null
  recordingEndedAt?: string | null
  recordingFilePath?: string | null
  transcriptionStartedAt?: string | null
  transcriptionEndedAt?: string | null
  transcriptText?: string | null
  summaryStartedAt?: string | null
  summaryEndedAt?: string | null
  exportFormat?: string | null
  exportStatus?: string | null
  exportFilePath?: string | null
  exportDocsUrl?: string | null
}

interface Recording {
  id: string
  filePath: string
  fileName: string
  fileSizeBytes: number | null
  durationSeconds: number | null
  format: string
  status: string
  transcriptionStatus: string | null
  transcriptionText: string | null
  summaryStatus: string | null
  exportStatus: string | null
  exportFormat: string | null
  exportFilePath: string | null
  createdAt: string
}

interface GoogleAuthStatus {
  connected: boolean
  email: string | null
  purpose: string | null
  scopes: string[]
}

interface Meeting {
  id: string
  title: string
  description: string | null
  meetingUrl: string | null
  scheduledAt: string | null
  endedAt: string | null
  status: string
  botStatus: string | null
  recordingStatus: string | null
  projectId: string | null
  createdAt: string
  project?: {
    id: string
    name: string
    code: string
  } | null
  participants: Participant[]
  transcripts: Transcript[]
  summaries: Summary[]
  actionItems: ActionItem[]
  botSessions: BotSession[]
}

// ============================================================
// Status Configs
// ============================================================

const meetingStatusConfig: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: 'Scheduled', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
}

const botStatusConfig: Record<string, { label: string; color: string }> = {
  IDLE: { label: 'Idle', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  JOINING: { label: 'Joining', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  LEAVING: { label: 'Leaving', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  ERROR: { label: 'Error', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

const botSessionStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  STARTING: { label: 'Starting', color: 'bg-gray-100 text-gray-800', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  JOINED: { label: 'Joined', color: 'bg-blue-100 text-blue-800', icon: <CheckCircle className="h-3 w-3" /> },
  RECORDING: { label: 'Recording', color: 'bg-red-100 text-red-800', icon: <Mic className="h-3 w-3 animate-pulse" /> },
  TRANSCRIBING: { label: 'Transcribing', color: 'bg-purple-100 text-purple-800', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  SUMMARIZING: { label: 'Summarizing', color: 'bg-indigo-100 text-indigo-800', icon: <Sparkles className="h-3 w-3 animate-pulse" /> },
  EXPORTING: { label: 'Exporting', color: 'bg-teal-100 text-teal-800', icon: <Download className="h-3 w-3" /> },
  LEAVING: { label: 'Leaving', color: 'bg-amber-100 text-amber-800', icon: <Square className="h-3 w-3" /> },
  ENDED: { label: 'Ended', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3 w-3" /> },
  ERROR: { label: 'Error', color: 'bg-red-100 text-red-800', icon: <AlertTriangle className="h-3 w-3" /> },
}

const actionItemStatusConfig: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Open', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
}

// ============================================================
// Pipeline Stage Indicator
// ============================================================

function PipelineIndicator({ status }: { status: string }) {
  const stages = [
    { key: 'joining', label: 'Join' },
    { key: 'joined', label: 'Connected' },
    { key: 'recording', label: 'Record' },
    { key: 'transcribing', label: 'Transcribe' },
    { key: 'summarizing', label: 'Summarize' },
    { key: 'exporting', label: 'Export' },
    { key: 'ended', label: 'Done' },
  ]

  const statusOrder: Record<string, number> = {
    STARTING: 0, JOINED: 1, RECORDING: 2, TRANSCRIBING: 3, SUMMARIZING: 4, EXPORTING: 5, ENDED: 6,
    LEAVING: 6, ERROR: -1,
  }

  const currentIdx = statusOrder[status] ?? -1

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {stages.map((stage, idx) => {
        const isActive = idx === currentIdx
        const isDone = idx < currentIdx
        const isError = currentIdx === -1
        return (
          <div key={stage.key} className="flex items-center gap-1">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
              isActive ? 'bg-primary text-primary-foreground' :
              isDone ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
              'bg-muted text-muted-foreground'
            }`}>
              {isDone && <CheckCircle className="h-3 w-3" />}
              {isActive && !isError && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>{stage.label}</span>
            </div>
            {idx < stages.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        )
      })}
      {currentIdx === -1 && (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" /> Error
        </Badge>
      )}
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function MeetingDetailPage() {
  const { viewParams, goBack } = useAppStore()
  const { t } = useI18n()
  const meetingId = viewParams?.id

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('details')

  // Transcript state
  const [transcriptText, setTranscriptText] = useState('')
  const [summarizing, setSummarizing] = useState(false)

  // Bot state
  const [botStarting, setBotStarting] = useState(false)
  const [botStopping, setBotStopping] = useState(false)
  const [activeBotSession, setActiveBotSession] = useState<string | null>(null)
  const [botSessionStatus, setBotSessionStatus] = useState<string | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<string>('MARKDOWN')
  const [recordings, setRecordings] = useState<Recording[]>([])

  // Voice recording state
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const [voiceElapsed, setVoiceElapsed] = useState(0)
  const [voiceProcessing, setVoiceProcessing] = useState(false)

  // Google Auth state
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthStatus | null>(null)
  const [googleConnecting, setGoogleConnecting] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportResult, setExportResult] = useState<{ markdown: string; filePath: string } | null>(null)

  // WebSocket ref
  const socketRef = useRef<Socket | null>(null)

  // Voice recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchMeeting = useCallback(async () => {
    if (!meetingId) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ meeting: Meeting }>(`/api/meetings/${meetingId}`)
      setMeeting(data.meeting)
      if (data.meeting.transcripts?.[0]) {
        setTranscriptText(data.meeting.transcripts[0].content)
      }
      // Check for active bot session
      const activeSession = data.meeting.botSessions?.find(
        (bs: BotSession) => !['ENDED', 'ERROR'].includes(bs.status)
      )
      if (activeSession) {
        setActiveBotSession(activeSession.id)
        setBotSessionStatus(activeSession.status)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meeting')
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  const fetchGoogleAuth = useCallback(async () => {
    try {
      const data = await api.get<GoogleAuthStatus>('/api/auth/google/status')
      setGoogleAuth(data)
    } catch {
      // Not connected, that's fine
    }
  }, [])

  const fetchRecordings = useCallback(async () => {
    if (!meetingId) return
    try {
      const data = await api.get<{ recordings: Recording[] }>(`/api/meetings/${meetingId}/recordings`)
      setRecordings(data.recordings || [])
    } catch {
      // No recordings yet
    }
  }, [meetingId])

  useEffect(() => {
    ;(() => {
      fetchMeeting()
      fetchGoogleAuth()
      fetchRecordings()
    })()
  }, [fetchMeeting, fetchGoogleAuth, fetchRecordings])

  // WebSocket connection for real-time bot status
  useEffect(() => {
    const socket = io('/', {
      transports: ['websocket', 'polling'],
      query: { XTransformPort: '3010' },
    })

    socket.on('connect', () => {
      console.log('[WS] Connected to meeting bot service')
    })

    socket.on('bot:status', (data: { sessionId: string; status: string; error?: string }) => {
      if (data.sessionId === activeBotSession) {
        setBotSessionStatus(data.status)
        if (data.status === 'ENDED' || data.status === 'ERROR') {
          // Refresh meeting data when bot finishes
          setTimeout(() => {
            fetchMeeting()
            fetchRecordings()
          }, 1000)
        }
      }
    })

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected from meeting bot service')
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [activeBotSession, fetchMeeting, fetchRecordings])

  // Poll bot session status if active
  useEffect(() => {
    if (!activeBotSession) return
    const interval = setInterval(async () => {
      try {
        const data = await api.get(`/api/bot/status/${activeBotSession}?XTransformPort=3010`)
        setBotSessionStatus(data.status)
        if (['ENDED', 'ERROR'].includes(data.status)) {
          setActiveBotSession(null)
          fetchMeeting()
          fetchRecordings()
        }
      } catch {
        // Bot service might be unreachable
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [activeBotSession, fetchMeeting, fetchRecordings])

  // ============================================================
  // Bot Actions
  // ============================================================

  const handleStartBot = async () => {
    if (!meetingId) return
    setBotStarting(true)
    try {
      const data = await api.post(`/api/meetings/${meetingId}/bot`, {
        action: 'start',
        exportFormat: exportFormat,
      })
      setActiveBotSession(data.sessionId)
      setBotSessionStatus(data.status || 'STARTING')
      toast.info('Bot Started', 'Meeting bot is joining the meeting...')
    } catch (err) {
      toast.error('Error Starting Bot', err instanceof Error ? err.message : 'Failed to start bot')
    } finally {
      setBotStarting(false)
    }
  }

  const handleStopBot = async () => {
    if (!meetingId) return
    setBotStopping(true)
    try {
      await api.post(`/api/meetings/${meetingId}/bot`, {
        action: 'stop',
      })
      toast.info('Bot Stopping', 'Meeting bot is leaving and stopping recording...')
      setTimeout(() => {
        fetchMeeting()
        fetchRecordings()
      }, 2000)
    } catch (err) {
      toast.error('Error Stopping Bot', err instanceof Error ? err.message : 'Failed to stop bot')
    } finally {
      setBotStopping(false)
    }
  }

  const handleTranscribe = async () => {
    if (!meetingId || recordings.length === 0) return
    setTranscribing(true)
    try {
      const latestRecording = recordings[recordings.length - 1]
      const data = await api.post(`/api/meetings/${meetingId}/transcribe`, {
        recordingId: latestRecording.id,
      })
      setTranscriptText(data.transcript || '')
      toast.success('Transcription Complete', 'Audio has been transcribed successfully.')
      fetchMeeting()
    } catch (err) {
      toast.error('Transcription Error', err instanceof Error ? err.message : 'Failed to transcribe')
    } finally {
      setTranscribing(false)
    }
  }

  const startVoiceRecording = async () => {
    let stream: MediaStream | undefined
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : ''
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setIsVoiceRecording(true)
      setVoiceElapsed(0)
      voiceTimerRef.current = setInterval(() => setVoiceElapsed((s) => s + 1), 1000)
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop())
      toast.error('Microphone Error', err instanceof Error ? err.message : 'Could not access microphone')
    }
  }

  // Release the mic/timer if the user navigates away mid-recording
  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) {
        clearInterval(voiceTimerRef.current)
        voiceTimerRef.current = null
      }
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.stream.getTracks().forEach((track) => track.stop())
        recorder.stop()
      }
    }
  }, [])

  const stopVoiceRecording = async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || !meetingId) return

    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current)
      voiceTimerRef.current = null
    }
    setIsVoiceRecording(false)

    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((track) => track.stop())
        resolve()
      }
      recorder.stop()
    })

    setVoiceProcessing(true)
    try {
      const mimeType = recorder.mimeType || 'audio/webm'
      const ext = mimeType.split('/')[1]?.split(';')[0] || 'webm'
      const blob = new Blob(audioChunksRef.current, { type: mimeType })
      const formData = new FormData()
      formData.append('audio', blob, `recording.${ext}`)

      const uploadResult = await api.post<{ recording: Recording }>(
        `/api/meetings/${meetingId}/recordings/upload`,
        formData
      )

      toast.info('Transcribing', 'Voice clip uploaded, transcribing now...')

      const transcribeResult = await api.post<{ transcript: string }>(
        `/api/meetings/${meetingId}/transcribe`,
        { recordingId: uploadResult.recording.id }
      )

      setTranscriptText(transcribeResult.transcript || '')
      toast.success('Transcription Complete', 'Voice recording transcribed successfully.')
      fetchMeeting()
      fetchRecordings()
    } catch (err) {
      toast.error('Voice Recording Error', err instanceof Error ? err.message : 'Failed to process recording')
    } finally {
      setVoiceProcessing(false)
    }
  }

  const handleSummarize = async () => {
    if (!meetingId) return
    setSummarizing(true)
    try {
      await api.post(`/api/meetings/${meetingId}/summarize`, {
        transcript: transcriptText,
      })
      toast.info('Summarization started', 'AI is generating the meeting summary.')
      setTimeout(() => fetchMeeting(), 2000)
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Summarization failed')
    } finally {
      setSummarizing(false)
    }
  }

  const handleExport = async () => {
    if (!meetingId) return
    setExporting(true)
    try {
      const data = await api.post(`/api/meetings/${meetingId}/export`, {
        format: exportFormat,
      })
      setExportResult({ markdown: data.markdown, filePath: data.filePath })
      setShowExportDialog(true)
      toast.success('Export Complete', `Meeting exported as ${exportFormat}`)
    } catch (err) {
      toast.error('Export Error', err instanceof Error ? err.message : 'Failed to export')
    } finally {
      setExporting(false)
    }
  }

  const handleGoogleConnect = async () => {
    setGoogleConnecting(true)
    try {
      const data = await api.get<{ url: string; demo: boolean }>('/api/auth/google/connect')
      if (data.demo) {
        // In demo mode, simulate connection
        toast.info('Google Connected (Demo)', 'Google account connected in demo mode.')
        await fetchGoogleAuth()
      } else if (data.url) {
        window.open(data.url, '_blank')
      }
    } catch (err) {
      toast.error('Connection Error', err instanceof Error ? err.message : 'Failed to connect Google')
    } finally {
      setGoogleConnecting(false)
    }
  }

  const handleGoogleDisconnect = async () => {
    try {
      await api.delete('/api/auth/google/disconnect')
      setGoogleAuth(null)
      toast.info('Google Disconnected', 'Your Google account has been disconnected.')
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to disconnect')
    }
  }

  const parseJsonList = (jsonStr: string | null): string[] => {
    if (!jsonStr) return []
    try {
      return JSON.parse(jsonStr)
    } catch {
      return []
    }
  }

  const downloadMarkdown = () => {
    if (!exportResult?.markdown) return
    const blob = new Blob([exportResult.markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${meeting?.title || 'meeting'}-summary.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isBotActive = activeBotSession && botSessionStatus && !['ENDED', 'ERROR'].includes(botSessionStatus)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !meeting) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-6 text-center">
          <p className="text-destructive">{error || t.meetings.noMeetings}</p>
          <Button variant="outline" onClick={goBack} className="mt-3">{t.common.back}</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{meeting.title}</h1>
              <Badge variant="secondary" className={meetingStatusConfig[meeting.status]?.color || ''}>
                {meetingStatusConfig[meeting.status]?.label || meeting.status}
              </Badge>
              {meeting.botStatus && (
                <Badge variant="outline" className={botStatusConfig[meeting.botStatus]?.color || ''}>
                  <Bot className="h-3 w-3 mr-1" />
                  {botStatusConfig[meeting.botStatus]?.label || meeting.botStatus}
                </Badge>
              )}
            </div>
            {meeting.scheduledAt && (
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{new Date(meeting.scheduledAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Google Auth Status */}
          {googleAuth?.connected ? (
            <Badge variant="outline" className="gap-1 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
              <Cloud className="h-3 w-3" />
              {googleAuth.email}
            </Badge>
          ) : (
            <Button variant="outline" size="sm" className="gap-1" onClick={handleGoogleConnect} disabled={googleConnecting}>
              {googleConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
              Connect Google
            </Button>
          )}

          {/* Bot Controls */}
          {isBotActive ? (
            <Button variant="destructive" size="sm" className="gap-1" onClick={handleStopBot} disabled={botStopping}>
              {botStopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              {t.meetings.startRecording.replace('Start ', '')}
            </Button>
          ) : (
            <Button size="sm" className="gap-1" onClick={handleStartBot} disabled={botStarting || !meeting.meetingUrl}>
              {botStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {t.meetings.bot}
            </Button>
          )}

          {/* Export */}
          <div className="flex items-center gap-1">
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MARKDOWN">
                  <div className="flex items-center gap-1">
                    <FileDown className="h-3 w-3" /> Markdown
                  </div>
                </SelectItem>
                <SelectItem value="GOOGLE_DOCS">
                  <div className="flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Google Docs
                  </div>
                </SelectItem>
                <SelectItem value="BOTH">
                  <div className="flex items-center gap-1">
                    <Download className="h-3 w-3" /> Both
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t.meetings.export}
            </Button>
          </div>
        </div>
      </div>

      {/* Active Bot Session Pipeline Indicator */}
      {isBotActive && botSessionStatus && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-sm">{t.meetings.bot} Pipeline Active</span>
                  {botSessionStatusConfig[botSessionStatus] && (
                    <Badge variant="outline" className={`text-xs ${botSessionStatusConfig[botSessionStatus].color}`}>
                      {botSessionStatusConfig[botSessionStatus].icon}
                      <span className="ml-1">{botSessionStatusConfig[botSessionStatus].label}</span>
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => { fetchMeeting(); fetchRecordings(); }} className="h-7 text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" /> {t.common.refresh}
                </Button>
              </div>
              <PipelineIndicator status={botSessionStatus} />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            {t.common.overview}
          </TabsTrigger>
          <TabsTrigger value="bot" className="gap-1.5">
            <Bot className="h-4 w-4" />
            {t.meetings.bot} & Recordings
          </TabsTrigger>
          <TabsTrigger value="transcript" className="gap-1.5">
            <FileText className="h-4 w-4" />
            {t.meetings.transcribe}
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-1.5">
            <ListChecks className="h-4 w-4" />
            {t.meetings.summarize}
          </TabsTrigger>
          <TabsTrigger value="action-items" className="gap-1.5">
            <CheckSquare className="h-4 w-4" />
            {t.meetings.actionItems}
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{t.common.overview}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {meeting.description && (
                  <div>
                    <span className="text-muted-foreground">Description: </span>
                    <span>{meeting.description}</span>
                  </div>
                )}
                {meeting.meetingUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">URL:</span>
                    <a
                      href={meeting.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Join Meeting
                    </a>
                  </div>
                )}
                {meeting.project && (
                  <div>
                    <span className="text-muted-foreground">Project: </span>
                    <span>{meeting.project.name}</span>
                  </div>
                )}
                {meeting.recordingStatus && (
                  <div>
                    <span className="text-muted-foreground">Recording: </span>
                    <Badge variant="outline" className="text-xs">{meeting.recordingStatus}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Participants ({meeting.participants?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {meeting.participants?.length > 0 ? (
                  <div className="space-y-2">
                    {meeting.participants.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{p.name}</span>
                        {p.role && (
                          <Badge variant="outline" className="text-xs">{p.role}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t.common.noData}</p>
                )}
              </CardContent>
            </Card>

            {/* Bot Sessions */}
            {meeting.botSessions?.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">{t.meetings.bot} Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {meeting.botSessions.map((bs) => (
                      <div key={bs.id} className="flex items-center justify-between text-sm rounded-md bg-muted/50 p-3">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                          <span>{bs.botAccount.name}</span>
                          {botSessionStatusConfig[bs.status] ? (
                            <Badge variant="outline" className={`text-xs ${botSessionStatusConfig[bs.status].color}`}>
                              {botSessionStatusConfig[bs.status].icon}
                              <span className="ml-1">{botSessionStatusConfig[bs.status].label}</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">{bs.status}</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-3">
                          {bs.joinedAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Joined: {new Date(bs.joinedAt).toLocaleTimeString()}
                            </span>
                          )}
                          {bs.leftAt && (
                            <span>| Left: {new Date(bs.leftAt).toLocaleTimeString()}</span>
                          )}
                          {bs.exportStatus === 'COMPLETED' && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" /> Exported
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Bot & Recordings Tab */}
        <TabsContent value="bot" className="mt-4 space-y-4">
          {/* Google Auth Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                Google Connection
              </CardTitle>
              <CardDescription>
                Connect your Google account to enable the bot to join Google Meet meetings and monitor your calendar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {googleAuth?.connected ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Cloud className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{googleAuth.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Connected · Scopes: {googleAuth.scopes?.length || 0} granted
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleGoogleDisconnect} className="text-destructive">
                    <CloudOff className="h-4 w-4 mr-1" /> Disconnect
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <CloudOff className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">No Google Account Connected</p>
                      <p className="text-xs text-muted-foreground">
                        Connect Google to enable meeting bot and calendar sync
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={handleGoogleConnect} disabled={googleConnecting}>
                    {googleConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Cloud className="h-4 w-4 mr-1" />}
                    Connect Google
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bot Control Panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-4 w-4" />
                {t.meetings.bot} Control
              </CardTitle>
              <CardDescription>
                The bot will join the meeting, record audio, transcribe with ASR, and generate an AI summary.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pipeline Flow Diagram */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Bot Pipeline</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { icon: <Play className="h-4 w-4" />, label: 'Join Meeting' },
                    { icon: <Mic className="h-4 w-4" />, label: 'Record Audio' },
                    { icon: <FileText className="h-4 w-4" />, label: 'ASR Transcribe' },
                    { icon: <Sparkles className="h-4 w-4" />, label: 'AI Summary' },
                    { icon: <Download className="h-4 w-4" />, label: 'Export' },
                  ].map((step, i, arr) => (
                    <React.Fragment key={i}>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background border text-xs font-medium">
                        {step.icon}
                        {step.label}
                      </div>
                      {i < arr.length - 1 && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Bot Controls */}
              <div className="flex items-center gap-3">
                {isBotActive ? (
                  <>
                    <Button variant="destructive" onClick={handleStopBot} disabled={botStopping} className="gap-2">
                      {botStopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                      Stop Bot & End Recording
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Bot session active: {botSessionStatus}
                    </span>
                  </>
                ) : (
                  <>
                    <Button onClick={handleStartBot} disabled={botStarting || !meeting.meetingUrl} className="gap-2">
                      {botStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Start Bot
                    </Button>
                    {!meeting.meetingUrl && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Meeting URL required
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Export Options */}
              <div className="flex items-center gap-3 pt-2 border-t">
                <span className="text-sm font-medium">Export Format:</span>
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKDOWN">
                      <div className="flex items-center gap-2">
                        <FileDown className="h-3.5 w-3.5" /> Markdown (.md)
                      </div>
                    </SelectItem>
                    <SelectItem value="GOOGLE_DOCS">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" /> Google Docs
                      </div>
                    </SelectItem>
                    <SelectItem value="BOTH">
                      <div className="flex items-center gap-2">
                        <Download className="h-3.5 w-3.5" /> Both
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleExport} disabled={exporting} className="gap-2">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export Now
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Voice Recording */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Quick Voice Recording
              </CardTitle>
              <CardDescription>
                Record from your microphone and transcribe it to text directly — no bot required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {isVoiceRecording ? (
                  <Button variant="destructive" onClick={stopVoiceRecording} className="gap-2">
                    <Square className="h-4 w-4" />
                    Stop ({String(Math.floor(voiceElapsed / 60)).padStart(2, '0')}:{String(voiceElapsed % 60).padStart(2, '0')})
                  </Button>
                ) : (
                  <Button onClick={startVoiceRecording} disabled={voiceProcessing} className="gap-2">
                    {voiceProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                    {voiceProcessing ? 'Transcribing...' : 'Record Voice'}
                  </Button>
                )}
                {isVoiceRecording && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> Recording...
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recordings */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{t.meetings.bot} & Recordings</CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchRecordings} className="h-7 text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" /> {t.common.refresh}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recordings.length > 0 ? (
                <div className="space-y-3">
                  {recordings.map((rec) => (
                    <div key={rec.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mic className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{rec.fileName}</span>
                          <Badge variant="outline" className="text-xs">{rec.format}</Badge>
                          <Badge variant="outline" className={`text-xs ${
                            rec.status === 'COMPLETED' ? 'bg-green-50 text-green-700' :
                            rec.status === 'RECORDING' ? 'bg-red-50 text-red-700' :
                            rec.status === 'FAILED' ? 'bg-red-50 text-red-700' : ''
                          }`}>
                            {rec.status}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(rec.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {rec.durationSeconds && <span>Duration: {Math.floor(rec.durationSeconds / 60)}m {rec.durationSeconds % 60}s</span>}
                        {rec.fileSizeBytes && <span>Size: {(rec.fileSizeBytes / 1024 / 1024).toFixed(1)} MB</span>}
                      </div>
                      {/* Pipeline status indicators */}
                      <div className="flex items-center gap-2">
                        <Badge variant={rec.transcriptionStatus === 'COMPLETED' ? 'default' : 'outline'} className="text-xs">
                          {rec.transcriptionStatus === 'COMPLETED' ? <CheckCircle className="h-3 w-3 mr-1" /> :
                           rec.transcriptionStatus === 'IN_PROGRESS' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> :
                           <FileText className="h-3 w-3 mr-1" />}
                          Transcribe: {rec.transcriptionStatus || 'PENDING'}
                        </Badge>
                        <Badge variant={rec.summaryStatus === 'COMPLETED' ? 'default' : 'outline'} className="text-xs">
                          {rec.summaryStatus === 'COMPLETED' ? <CheckCircle className="h-3 w-3 mr-1" /> :
                           rec.summaryStatus === 'IN_PROGRESS' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> :
                           <Sparkles className="h-3 w-3 mr-1" />}
                          Summary: {rec.summaryStatus || 'PENDING'}
                        </Badge>
                        <Badge variant={rec.exportStatus === 'COMPLETED' ? 'default' : 'outline'} className="text-xs">
                          {rec.exportStatus === 'COMPLETED' ? <CheckCircle className="h-3 w-3 mr-1" /> :
                           rec.exportStatus === 'IN_PROGRESS' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> :
                           <Download className="h-3 w-3 mr-1" />}
                          Export: {rec.exportStatus || 'PENDING'}
                        </Badge>
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        {rec.status === 'COMPLETED' && rec.transcriptionStatus !== 'COMPLETED' && (
                          <Button size="sm" variant="outline" onClick={handleTranscribe} disabled={transcribing} className="h-7 text-xs gap-1">
                            {transcribing ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                            Transcribe
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Mic className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No recordings yet. Start the bot to begin recording.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transcript Tab */}
        <TabsContent value="transcript" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Meeting Transcript</CardTitle>
                <div className="flex items-center gap-2">
                  {recordings.length > 0 && recordings[recordings.length - 1].status === 'COMPLETED' && (
                    <Button
                      onClick={handleTranscribe}
                      disabled={transcribing}
                      variant="outline"
                      size="sm"
                      className="gap-1"
                    >
                      {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                      Auto Transcribe
                    </Button>
                  )}
                  <Button
                    onClick={handleSummarize}
                    disabled={summarizing || !transcriptText}
                    className="gap-2"
                    size="sm"
                  >
                    {summarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Summarize
                  </Button>
                </div>
              </div>
              <CardDescription>Paste or edit the meeting transcript, then click Summarize to generate AI insights.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                rows={20}
                className="font-mono text-sm resize-y"
                placeholder="Paste meeting transcript here, or use the bot to auto-transcribe..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="mt-4 space-y-4">
          {meeting.summaries?.length > 0 ? (
            meeting.summaries.map((summary) => (
              <motion.div
                key={summary.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Meeting Summary</CardTitle>
                      <div className="flex items-center gap-2">
                        {summary.aiModel && (
                          <Badge variant="outline" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            {summary.aiModel}
                          </Badge>
                        )}
                        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="h-7 text-xs gap-1">
                          {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          Export
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {new Date(summary.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Main summary */}
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div className="whitespace-pre-wrap text-sm">{summary.summaryMarkdown}</div>
                    </div>

                    <Separator />

                    {/* Decisions */}
                    {parseJsonList(summary.decisions).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Decisions</h4>
                        <ul className="space-y-1">
                          {parseJsonList(summary.decisions).map((d, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-primary mt-0.5">&#x2022;</span>
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Requirements */}
                    {parseJsonList(summary.requirements).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Requirements</h4>
                        <ul className="space-y-1">
                          {parseJsonList(summary.requirements).map((r, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-primary mt-0.5">&#x2022;</span>
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Scope In/Out */}
                    {(parseJsonList(summary.scopeIn).length > 0 || parseJsonList(summary.scopeOut).length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {parseJsonList(summary.scopeIn).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-green-700 dark:text-green-400">In Scope</h4>
                            <ul className="space-y-1">
                              {parseJsonList(summary.scopeIn).map((s, i) => (
                                <li key={i} className="text-sm flex items-start gap-2">
                                  <span className="text-green-600 mt-0.5">&#x2713;</span>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {parseJsonList(summary.scopeOut).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-red-700 dark:text-red-400">Out of Scope</h4>
                            <ul className="space-y-1">
                              {parseJsonList(summary.scopeOut).map((s, i) => (
                                <li key={i} className="text-sm flex items-start gap-2">
                                  <span className="text-red-600 mt-0.5">&#x2717;</span>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Risks */}
                    {parseJsonList(summary.risks).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 text-amber-700 dark:text-amber-400">Risks</h4>
                        <ul className="space-y-1">
                          {parseJsonList(summary.risks).map((r, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-amber-600 mt-0.5">&#x26A0;</span>
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Open Questions */}
                    {parseJsonList(summary.openQuestions).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Open Questions</h4>
                        <ul className="space-y-1">
                          {parseJsonList(summary.openQuestions).map((q, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-muted-foreground mt-0.5">?</span>
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <ListChecks className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h4 className="font-semibold">No summaries yet</h4>
                <p className="text-sm text-muted-foreground mt-1">Add a transcript and click Summarize to generate AI insights</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Action Items Tab */}
        <TabsContent value="action-items" className="mt-4 space-y-4">
          <h3 className="text-lg font-semibold">{t.meetings.actionItems}</h3>
          {meeting.actionItems?.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Source Quote</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meeting.actionItems.map((ai) => (
                      <TableRow key={ai.id}>
                        <TableCell className="text-sm font-medium max-w-48">
                          <div>
                            <span>{ai.title}</span>
                            {ai.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ai.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {ai.assignee?.name || 'Unassigned'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {ai.dueDate ? new Date(ai.dueDate).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-xs ${actionItemStatusConfig[ai.status]?.color || ''}`}>
                            {actionItemStatusConfig[ai.status]?.label || ai.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {ai.confidence !== null ? `${Math.round(ai.confidence * 100)}%` : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-32 truncate">
                          {ai.sourceQuote || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h4 className="font-semibold">No action items</h4>
                <p className="text-sm text-muted-foreground mt-1">Action items will be auto-extracted when you summarize the meeting</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" /> Export Complete
            </DialogTitle>
            <DialogDescription>
              Your meeting transcript and summary have been exported successfully.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {exportResult?.filePath && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <FileDown className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">File saved</p>
                  <p className="text-xs text-muted-foreground">{exportResult.filePath}</p>
                </div>
              </div>
            )}
            {exportResult?.markdown && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Preview</Label>
                  <Button variant="outline" size="sm" onClick={downloadMarkdown} className="h-7 text-xs gap-1">
                    <Download className="h-3 w-3" /> Download .md
                  </Button>
                </div>
                <Textarea
                  value={exportResult.markdown}
                  readOnly
                  rows={12}
                  className="font-mono text-xs"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowExportDialog(false)}>{t.common.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
