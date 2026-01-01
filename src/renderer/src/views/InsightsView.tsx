import { useState, useEffect, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send,
  Sparkles,
  User,
  Settings,
  Loader2,
  Trash2,
  TrendingUp,
  PiggyBank,
  Wallet,
  HelpCircle,
  MessageSquarePlus,
  MoreVertical
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type {
  Budget,
  Category,
  ChatMessage,
  ChatSession,
  AiContextMonths
} from '../../../shared/types'

interface InsightsViewProps {
  budgets: Budget[]
  categories: Category[]
  onNavigateToSettings?: () => void
}

const STARTER_QUESTIONS = [
  {
    icon: TrendingUp,
    title: 'Where is my money going?',
    description: 'Breakdown of spending by category'
  },
  {
    icon: PiggyBank,
    title: 'Am I on track this month?',
    description: 'Compare planned vs actual spending'
  },
  {
    icon: Wallet,
    title: 'What can I cut back on?',
    description: 'Find opportunities to save'
  },
  {
    icon: HelpCircle,
    title: 'Summarize my spending habits',
    description: 'Overview of your financial patterns'
  }
]

export function InsightsView({ onNavigateToSettings }: InsightsViewProps): React.JSX.Element {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [contextMonths, setContextMonths] = useState<AiContextMonths>(3)
  const [error, setError] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionsLoadedRef = useRef(false)
  const streamingMessageIdRef = useRef<string | null>(null)

  // Load sessions and settings on mount
  useEffect(() => {
    if (sessionsLoadedRef.current) return
    sessionsLoadedRef.current = true

    const loadData = async (): Promise<void> => {
      const [loadedSessions, currentId, settings] = await Promise.all([
        window.api.getSessions(),
        window.api.getCurrentSessionId(),
        window.api.getSettings()
      ])

      setSessions(loadedSessions)
      setHasApiKey(!!settings.claudeApiKey)
      setContextMonths(settings.aiContextMonths || 3)

      // Load current session or create new one
      if (currentId) {
        const session = await window.api.getSession(currentId)
        if (session) {
          setCurrentSessionId(currentId)
          setMessages(session.messages)
        } else {
          // Session was deleted, create new
          await handleNewChat()
        }
      } else if (loadedSessions.length > 0) {
        // Use most recent session
        const recent = loadedSessions[loadedSessions.length - 1]
        setCurrentSessionId(recent.id)
        setMessages(recent.messages)
        await window.api.setCurrentSession(recent.id)
      } else {
        // Create first session
        await handleNewChat()
      }
    }
    loadData()
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Set up streaming listeners
  useEffect(() => {
    const unsubChunk = window.api.onChatStreamChunk(({ text }) => {
      setStreamingContent((prev) => prev + text)
    })

    const unsubEnd = window.api.onChatStreamEnd(() => {
      if (!streamingMessageIdRef.current || !currentSessionId) return

      setStreamingContent((prev) => {
        if (prev && streamingMessageIdRef.current && currentSessionId) {
          const assistantMessage: ChatMessage = {
            id: streamingMessageIdRef.current,
            role: 'assistant',
            content: prev,
            timestamp: new Date().toISOString()
          }
          setMessages((msgs) => [...msgs, assistantMessage])
          window.api.saveChatMessage(currentSessionId, assistantMessage)
          streamingMessageIdRef.current = null

          // Reload sessions to update titles/timestamps
          window.api.getSessions().then(setSessions)
        }
        return ''
      })
      setIsLoading(false)
    })

    const unsubError = window.api.onChatStreamError(({ error: errMsg }) => {
      setError(errMsg)
      setStreamingContent('')
      setIsLoading(false)
    })

    return () => {
      unsubChunk()
      unsubEnd()
      unsubError()
    }
  }, [currentSessionId])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading || !currentSessionId) return

      setError(null)
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString()
      }

      setMessages((prev) => [...prev, userMessage])
      await window.api.saveChatMessage(currentSessionId, userMessage)
      setInputValue('')
      setIsLoading(true)
      setStreamingContent('')
      streamingMessageIdRef.current = uuidv4()

      // Reload sessions to update titles
      window.api.getSessions().then(setSessions)

      const messageHistory = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content
      }))

      window.api.sendChatMessage(messageHistory, contextMonths)
    },
    [messages, isLoading, contextMonths, currentSessionId]
  )

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    sendMessage(inputValue)
  }

  const handleStarterClick = (question: string): void => {
    sendMessage(question)
  }

  const handleNewChat = async (): Promise<void> => {
    const newSession = await window.api.createSession()
    setSessions((prev) => [...prev, newSession])
    setCurrentSessionId(newSession.id)
    setMessages([])
    setStreamingContent('')
    setError(null)
  }

  const handleSelectSession = async (sessionId: string): Promise<void> => {
    const session = await window.api.getSession(sessionId)
    if (session) {
      setCurrentSessionId(sessionId)
      setMessages(session.messages)
      setStreamingContent('')
      setError(null)
      await window.api.setCurrentSession(sessionId)
    }
  }

  const handleDeleteSession = async (sessionId: string): Promise<void> => {
    await window.api.deleteSession(sessionId)
    const updated = sessions.filter((s) => s.id !== sessionId)
    setSessions(updated)

    if (sessionId === currentSessionId) {
      if (updated.length > 0) {
        await handleSelectSession(updated[updated.length - 1].id)
      } else {
        await handleNewChat()
      }
    }
  }

  // API key not configured state
  if (hasApiKey === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto px-4">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">Meet Budgit</h1>
            <p className="text-muted-foreground text-lg">
              Your personal AI assistant for budget insights and financial guidance
            </p>
          </div>
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                To start chatting with Budgit, you'll need to add your Claude API key in Settings.
                Your key is stored locally and never shared.
              </p>
              <Button onClick={onNavigateToSettings} className="gap-2">
                <Settings className="h-4 w-4" />
                Go to Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Loading state
  if (hasApiKey === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const showStarterQuestions = messages.length === 0 && !streamingContent

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div
        className={cn(
          'border-r bg-muted/10 transition-all duration-300',
          sidebarCollapsed ? 'w-0' : 'w-64'
        )}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {!sidebarCollapsed && (
            <>
              <div className="p-3 border-b">
                <Button onClick={handleNewChat} className="w-full gap-2" size="sm">
                  <MessageSquarePlus className="h-4 w-4" />
                  New Chat
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions
                  .slice()
                  .reverse()
                  .map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleSelectSession(session.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-sm group hover:bg-muted/50 transition-colors',
                        session.id === currentSessionId && 'bg-muted'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 truncate">
                          <p className="truncate font-medium">{session.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {new Date(session.lastUpdated).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteSession(session.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold">Budgit</h1>
              <p className="text-xs text-muted-foreground">Your AI Budget Assistant</p>
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {showStarterQuestions ? (
            <div className="flex flex-col items-center justify-center h-full space-y-8">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold">Good {getGreeting()}</h2>
                <p className="text-muted-foreground">
                  What's on <span className="text-primary font-medium">your mind?</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q.title}
                    onClick={() => handleStarterClick(q.title)}
                    className="flex items-start gap-3 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className="p-2 rounded-lg bg-muted group-hover:bg-background transition-colors">
                      <q.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{q.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{q.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {streamingContent && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="flex-1 bg-muted/50 dark:bg-muted rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%]">
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-p:leading-relaxed prose-headings:mt-3 prose-headings:mb-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                    </div>
                    <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />
                  </div>
                </div>
              )}

              {isLoading && !streamingContent && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="bg-muted/50 dark:bg-muted rounded-2xl rounded-tl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span
                        className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex justify-center">
                  <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-2 text-sm">
                    {error}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Budgit a question..."
                disabled={isLoading}
                className="pr-12 py-6 rounded-xl bg-muted/50 border-muted-foreground/20 focus:border-primary"
              />
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isLoading}
              className="h-12 w-12 rounded-xl bg-primary hover:bg-primary/90"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Budgit uses your budget data to provide personalized insights
          </p>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }): React.JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-secondary' : 'bg-gradient-to-br from-primary/80 to-primary'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-secondary-foreground" />
        ) : (
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        )}
      </div>
      <div
        className={cn(
          'rounded-2xl px-4 py-3 max-w-[85%]',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-md'
            : 'bg-muted/50 dark:bg-muted rounded-tl-md'
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-p:leading-relaxed prose-headings:mt-3 prose-headings:mb-2 prose-p:text-foreground prose-headings:text-foreground prose-li:text-foreground prose-strong:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  return 'Evening'
}
