'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Send,
  Sparkles,
  Loader2,
  FileText,
  Edit,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Bot,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { useAppStore } from '@/store/app-store'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  timestamp: Date
  data?: {
    requestType?: string
    priority?: string
    affectedSystem?: string
    confidence?: number
    missingFields?: string[]
    followUpQuestions?: string[]
  }
}

interface DraftData {
  title: string
  description: string
  type: string
  priority: string
  affectedSystem: string
  businessImpact: string
  acceptanceCriteria: string
}

const INITIAL_DRAFT: DraftData = {
  title: '',
  description: '',
  type: '',
  priority: '',
  affectedSystem: '',
  businessImpact: '',
  acceptanceCriteria: '',
}

const TYPE_COLORS: Record<string, string> = {
  FEATURE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  BUG: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CHANGE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  SUPPORT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  QUESTION: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  INCIDENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  URGENT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

function formatLabel(val: string): string {
  return val.replace(/_/g, ' ')
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

// ============================================================
// Component
// ============================================================

export default function AiIntakePage() {
  const { navigate } = useAppStore()
  const { t } = useI18n()

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: generateId(),
      role: 'ai',
      content:
        "Hello! I'm your AI Request Assistant. Tell me about your request and I'll help you create it. What do you need help with?",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [draft, setDraft] = useState<DraftData>(INITIAL_DRAFT)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Call classify endpoint
      const classifyResult = await api.post<{
        classification: {
          requestType: string
          priority: string
          affectedSystem: string
          confidence: number
          missingFields: string[]
          followUpQuestions: string[]
        }
      }>('/api/ai/request-intake/classify', { message: userMessage.content })

      const classification = classifyResult.classification

      // Add AI classification message
      const aiMessage: ChatMessage = {
        id: generateId(),
        role: 'ai',
        content: classification.followUpQuestions?.length
          ? `I've analyzed your request. Here's what I detected:\n\n${classification.followUpQuestions.map((q) => `• ${q}`).join('\n')}`
          : "I've analyzed your request and generated a draft. Please review it in the preview panel.",
        timestamp: new Date(),
        data: {
          requestType: classification.requestType,
          priority: classification.priority,
          affectedSystem: classification.affectedSystem,
          confidence: classification.confidence,
          missingFields: classification.missingFields,
          followUpQuestions: classification.followUpQuestions,
        },
      }

      setMessages((prev) => [...prev, aiMessage])
      setMissingFields(classification.missingFields || [])

      // Also call generate-draft
      try {
        const draftResult = await api.post<{
          draft: {
            title?: string
            description?: string
            priority?: string
            affectedSystem?: string
            businessImpact?: string
            acceptanceCriteria?: string[]
            missingFields?: string[]
          }
        }>('/api/ai/request-intake/generate-draft', {
          message: userMessage.content,
          requestType: classification.requestType,
        })

        const d = draftResult.draft
        if (d) {
          setDraft({
            title: d.title || '',
            description: d.description || '',
            type: classification.requestType || '',
            priority: d.priority || classification.priority || '',
            affectedSystem: d.affectedSystem || classification.affectedSystem || '',
            businessImpact: d.businessImpact || '',
            acceptanceCriteria: Array.isArray(d.acceptanceCriteria)
              ? d.acceptanceCriteria.join('\n')
              : '',
          })
          if (d.missingFields?.length) {
            setMissingFields(d.missingFields)
          }
        }
      } catch {
        // If draft generation fails, still show classification
        setDraft((prev) => ({
          ...prev,
          type: classification.requestType || prev.type,
          priority: classification.priority || prev.priority,
          affectedSystem: classification.affectedSystem || prev.affectedSystem,
        }))
      }
    } catch {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'ai',
        content: "I'm sorry, I encountered an error analyzing your request. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleCreateRequest = async () => {
    if (!draft.title || !draft.description || !draft.type) {
      toast.error('Title, description, and type are required to create a request')
      return
    }

    setCreating(true)
    try {
      await api.post('/api/requests', {
        title: draft.title,
        description: draft.description,
        type: draft.type,
        priority: draft.priority || 'MEDIUM',
        affectedSystem: draft.affectedSystem || null,
        businessImpact: draft.businessImpact || null,
        acceptanceCriteria: draft.acceptanceCriteria || null,
      })
      toast.success('Request created successfully')
      navigate('requests')
    } catch {
      toast.error('Failed to create request')
    } finally {
      setCreating(false)
    }
  }

  const handleEditAndSubmit = () => {
    navigate('request-create', { draft: JSON.stringify(draft) })
  }

  const isFieldMissing = (fieldName: string): boolean => {
    return missingFields.some(
      (f) => f.toLowerCase().includes(fieldName.toLowerCase())
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
      {/* Left: Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        <Card className="flex flex-col flex-1 min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              {t.aiIntake.title}
            </CardTitle>
          </CardHeader>
          <Separator />
          <ScrollArea className="flex-1 min-h-0 p-4">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'ai' && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`
                      max-w-[80%] rounded-lg px-4 py-3
                      ${msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                      }
                    `}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                    {/* Classification data display */}
                    {msg.data && (
                      <div className="mt-3 space-y-2 border-t border-border/30 pt-2">
                        <div className="flex flex-wrap gap-2">
                          {msg.data.requestType && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${TYPE_COLORS[msg.data.requestType] || ''}`}
                            >
                              {formatLabel(msg.data.requestType)}
                            </Badge>
                          )}
                          {msg.data.priority && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${PRIORITY_COLORS[msg.data.priority] || ''}`}
                            >
                              {formatLabel(msg.data.priority)}
                            </Badge>
                          )}
                          {msg.data.affectedSystem && (
                            <Badge variant="outline" className="text-[10px]">
                              {msg.data.affectedSystem}
                            </Badge>
                          )}
                        </div>
                        {msg.data.confidence !== undefined && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs opacity-70">Confidence:</span>
                            <span className="text-xs font-medium">
                              {Math.round(msg.data.confidence * 100)}%
                            </span>
                          </div>
                        )}
                        {msg.data.followUpQuestions && msg.data.followUpQuestions.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-xs opacity-70">Follow-up questions:</span>
                            {msg.data.followUpQuestions.map((q, i) => (
                              <p key={i} className="text-xs">• {q}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="rounded-lg px-4 py-3 bg-muted">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Analyzing your request...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </ScrollArea>
          <Separator />
          <div className="p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage()
              }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                placeholder="Describe your request..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </Card>
      </div>

      {/* Right: Request Preview */}
      <div className="w-full lg:w-[380px] shrink-0">
        <Card className="flex flex-col h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              {t.aiIntake.generatedDraft}
            </CardTitle>
          </CardHeader>
          <Separator />
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground">{t.common.name}</span>
                  {isFieldMissing('title') && (
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  )}
                </div>
                <div
                  className={`rounded-md px-3 py-2 text-sm ${
                    isFieldMissing('title')
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                      : 'bg-muted'
                  }`}
                >
                  {draft.title || <span className="text-muted-foreground italic">Not specified</span>}
                </div>
              </div>

              {/* Type & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{t.common.type}</span>
                    {isFieldMissing('type') && (
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    )}
                  </div>
                  <div
                    className={`rounded-md px-3 py-2 text-sm ${
                      isFieldMissing('type')
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                        : 'bg-muted'
                    }`}
                  >
                    {draft.type ? (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${TYPE_COLORS[draft.type] || ''}`}
                      >
                        {formatLabel(draft.type)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground italic">Not detected</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{t.common.priority}</span>
                    {isFieldMissing('priority') && (
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    )}
                  </div>
                  <div
                    className={`rounded-md px-3 py-2 text-sm ${
                      isFieldMissing('priority')
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                        : 'bg-muted'
                    }`}
                  >
                    {draft.priority ? (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${PRIORITY_COLORS[draft.priority] || ''}`}
                      >
                        {formatLabel(draft.priority)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground italic">Not detected</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground">{t.common.description}</span>
                  {isFieldMissing('description') && (
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  )}
                </div>
                <div
                  className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto ${
                    isFieldMissing('description')
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                      : 'bg-muted'
                  }`}
                >
                  {draft.description || <span className="text-muted-foreground italic">Not generated</span>}
                </div>
              </div>

              {/* Affected System */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Affected System</span>
                  {isFieldMissing('affected') && (
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  )}
                </div>
                <div
                  className={`rounded-md px-3 py-2 text-sm ${
                    isFieldMissing('affected')
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                      : 'bg-muted'
                  }`}
                >
                  {draft.affectedSystem || <span className="text-muted-foreground italic">Not detected</span>}
                </div>
              </div>

              {/* Business Impact */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Business Impact</span>
                  {isFieldMissing('impact') && (
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  )}
                </div>
                <div
                  className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap max-h-24 overflow-y-auto ${
                    isFieldMissing('impact')
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                      : 'bg-muted'
                  }`}
                >
                  {draft.businessImpact || <span className="text-muted-foreground italic">Not generated</span>}
                </div>
              </div>

              {/* Acceptance Criteria */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Acceptance Criteria</span>
                  {isFieldMissing('acceptance') && (
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  )}
                </div>
                <div
                  className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap max-h-24 overflow-y-auto ${
                    isFieldMissing('acceptance')
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                      : 'bg-muted'
                  }`}
                >
                  {draft.acceptanceCriteria || <span className="text-muted-foreground italic">Not generated</span>}
                </div>
              </div>

              {/* Missing Fields Summary */}
              {missingFields.length > 0 && (
                <div className="rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                      Missing Information
                    </span>
                  </div>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    {missingFields.join(', ')}
                  </p>
                </div>
              )}

              {/* No draft yet */}
              {!draft.title && !draft.description && !draft.type && (
                <div className="text-center py-8">
                  <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Start a conversation to generate a request draft
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
          <Separator />
          <div className="p-3 space-y-2">
            <Button
              className="w-full gap-2"
              onClick={handleCreateRequest}
              disabled={creating || !draft.title || !draft.type}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {creating ? 'Creating...' : t.requests.createRequest}
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleEditAndSubmit}
              disabled={!draft.title && !draft.description}
            >
              <Edit className="h-4 w-4" />
              Edit & Submit
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
