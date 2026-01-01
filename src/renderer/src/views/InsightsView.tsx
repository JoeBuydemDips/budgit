import { useState, useEffect, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
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
  PanelRightClose,
  PanelRight,
  Pencil,
  Check,
  X,
  Plus,
  ArrowUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/theme-toggle'
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

// Helper to get time-of-day greeting
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

// Helper to group sessions by date
function groupSessionsByDate(sessions: ChatSession[]): Record<string, ChatSession[]> {
  const groups: Record<string, ChatSession[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    'This Month': [],
    Older: []
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  sessions.forEach((session) => {
    const sessionDate = new Date(session.lastUpdated)
    const sessionDay = new Date(
      sessionDate.getFullYear(),
      sessionDate.getMonth(),
      sessionDate.getDate()
    )

    if (sessionDay >= today) {
      groups['Today'].push(session)
    } else if (sessionDay >= yesterday) {
      groups['Yesterday'].push(session)
    } else if (sessionDay >= weekAgo) {
      groups['This Week'].push(session)
    } else if (sessionDay >= monthAgo) {
      groups['This Month'].push(session)
    } else {
      groups['Older'].push(session)
    }
  })

  return groups
}

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
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sessionsLoadedRef = useRef(false)
  const streamingMessageIdRef = useRef<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Responsive auto-collapse for smaller screens
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)')

    const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList): void => {
      if (e.matches) {
        setSidebarCollapsed(true)
      }
    }

    // Check on mount
    handleMediaChange(mediaQuery)

    // Listen for changes
    mediaQuery.addEventListener('change', handleMediaChange)
    return () => mediaQuery.removeEventListener('change', handleMediaChange)
  }, [])

  // Keyboard shortcut to toggle sidebar (Cmd/Ctrl + \)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        setSidebarCollapsed((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingSessionId])

  // Create new chat session handler - defined early so it can be used in loadData
  const createNewSession = useCallback(async (): Promise<void> => {
    const newSession = await window.api.createSession()
    setSessions((prev) => [...prev, newSession])
    setCurrentSessionId(newSession.id)
    setMessages([])
    setStreamingContent('')
    setError(null)
  }, [])

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
          await createNewSession()
        }
      } else if (loadedSessions.length > 0) {
        // Use most recent session
        const recent = loadedSessions[loadedSessions.length - 1]
        setCurrentSessionId(recent.id)
        setMessages(recent.messages)
        await window.api.setCurrentSession(recent.id)
      } else {
        // Create first session
        await createNewSession()
      }
    }
    loadData()
  }, [createNewSession])

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  const handleStarterClick = (question: string): void => {
    sendMessage(question)
  }

  const handleNewChat = createNewSession

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

  const handleStartRename = (session: ChatSession): void => {
    setEditingSessionId(session.id)
    setEditingTitle(session.title)
  }

  const handleCancelRename = (): void => {
    setEditingSessionId(null)
    setEditingTitle('')
  }

  const handleSaveRename = async (): Promise<void> => {
    if (!editingSessionId || !editingTitle.trim()) {
      handleCancelRename()
      return
    }

    await window.api.renameSession(editingSessionId, editingTitle.trim())
    setSessions((prev) =>
      prev.map((s) => (s.id === editingSessionId ? { ...s, title: editingTitle.trim() } : s))
    )
    handleCancelRename()
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveRename()
    } else if (e.key === 'Escape') {
      handleCancelRename()
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
                To start chatting with Budgit, you&apos;ll need to add your Claude API key in
                Settings. Your key is stored locally and never shared.
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
  const groupedSessions = groupSessionsByDate(sessions.slice().reverse())

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col bg-gradient-to-b from-background via-background to-muted/20">
        {/* Compact Header Bar */}
        <header className="flex items-center justify-between border-b bg-card/60 px-4 py-2.5 backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 shadow-md">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400 ring-2 ring-background" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold leading-tight">Budgit AI</h1>
              <p className="text-xs text-muted-foreground">Context: {contextMonths} months</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={handleNewChat}>
              <MessageSquarePlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New chat</span>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarCollapsed((prev) => !prev)}
                  className="h-8 w-8"
                >
                  {sidebarCollapsed ? (
                    <PanelRight className="h-4 w-4" />
                  ) : (
                    <PanelRightClose className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {sidebarCollapsed ? 'Show history' : 'Hide history'}{' '}
                <kbd className="ml-1 text-[10px] opacity-60">⌘\</kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex min-h-0 flex-1 gap-0">
          {/* Chat Section */}
          <section className="flex min-h-0 flex-1 flex-col border-r bg-card/50">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 md:px-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="font-medium">Conversation</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 lg:px-12">
              <div
                className={cn(
                  'mx-auto max-w-4xl',
                  showStarterQuestions ? 'flex h-full flex-col' : 'flex flex-col gap-4'
                )}
              >
                {showStarterQuestions ? (
                  <div className="flex flex-1 flex-col items-center justify-center">
                    <div className="w-full max-w-2xl space-y-6">
                      {/* Logo and Greeting */}
                      <div className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/30 to-primary/50 shadow-lg shadow-primary/25">
                          <Sparkles className="h-8 w-8 text-primary" />
                        </div>
                        <h1 className="text-2xl font-semibold md:text-3xl">
                          {getGreeting()}
                        </h1>
                        <p className="mt-1 text-2xl font-semibold md:text-3xl">
                          What&apos;s on <span className="text-primary">your budget?</span>
                        </p>
                      </div>

                      {/* Input Box - Centered and prominent */}
                      <form onSubmit={handleSubmit}>
                        <div className="relative rounded-2xl border border-muted-foreground/20 bg-card shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                          <div className="flex items-start gap-3 px-4 pt-4 pb-14">
                            <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                            <textarea
                              ref={inputRef}
                              value={inputValue}
                              onChange={(e) => setInputValue(e.target.value)}
                              onKeyDown={handleKeyDown}
                              placeholder="Ask Budgit anything about your money..."
                              disabled={isLoading}
                              rows={2}
                              className="w-full resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>
                          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5 rounded-lg text-xs"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Attach
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Attach file</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="submit"
                                  size="icon"
                                  disabled={!inputValue.trim() || isLoading}
                                  className="h-8 w-8 rounded-lg bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-30"
                                >
                                  {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <ArrowUp className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Send message</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </form>

                      {/* Get Started Section */}
                      <div className="space-y-4 pt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Get started with an example below
                        </p>
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                          {STARTER_QUESTIONS.map((q) => (
                            <button
                              key={q.title}
                              onClick={() => handleStarterClick(q.title)}
                              className="group flex min-h-[100px] flex-col justify-between rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md"
                            >
                              <p className="text-sm font-medium leading-snug">
                                {q.title}
                              </p>
                              <div className="mt-3 flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                <q.icon className="h-4 w-4" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}

                    {streamingContent && (
                      <div className="flex gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary shadow-md">
                          <Sparkles className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div className="max-w-[90%] flex-1 rounded-2xl rounded-tl-md bg-muted/60 px-4 py-3 shadow-sm">
                          <div className="prose prose-sm max-w-none text-sm prose-p:my-2 prose-li:my-0 prose-p:leading-relaxed dark:prose-invert">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {streamingContent}
                            </ReactMarkdown>
                          </div>
                          <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-primary/50" />
                        </div>
                      </div>
                    )}

                    {isLoading && !streamingContent && (
                      <div className="flex gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary shadow-md">
                          <Sparkles className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div className="rounded-2xl rounded-tl-md bg-muted/60 px-4 py-3">
                          <div className="flex gap-1">
                            <span
                              className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                              style={{ animationDelay: '0ms' }}
                            />
                            <span
                              className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                              style={{ animationDelay: '150ms' }}
                            />
                            <span
                              className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                              style={{ animationDelay: '300ms' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="flex justify-center">
                        <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
                          {error}
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </div>

            {/* Bottom Input - Only show when in conversation mode */}
            {!showStarterQuestions && (
              <div className="border-t bg-card/70 px-4 py-4 md:px-8 lg:px-12">
                <div className="mx-auto max-w-4xl">
                <form onSubmit={handleSubmit}>
                  <div className="relative rounded-2xl border border-muted-foreground/20 bg-muted/30 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask Budgit anything about your money..."
                      disabled={isLoading}
                      rows={3}
                      className="w-full resize-none bg-transparent px-4 pt-4 pb-12 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Attach file</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="submit"
                            size="icon"
                            disabled={!inputValue.trim() || isLoading}
                            className="h-8 w-8 rounded-lg bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-30"
                          >
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowUp className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Send message</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </form>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Budgit uses your budget data to provide personalized insights
                </p>
              </div>
            </div>
            )}
          </section>

          {/* History Sidebar */}
          <aside
            className={cn(
              'hidden flex-col border-l bg-card/60 transition-all duration-300 md:flex',
              sidebarCollapsed
                ? 'w-0 overflow-hidden opacity-0'
                : 'w-72 opacity-100 lg:w-80 xl:w-96'
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
              <div>
                <p className="text-xs font-medium">History</p>
                <p className="text-[10px] text-muted-foreground">Previous conversations</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleNewChat}>
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New chat</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
              {Object.entries(groupedSessions).map(([group, groupSessions]) =>
                groupSessions.length > 0 ? (
                  <div key={group} className="space-y-1">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {group}
                    </p>
                    {groupSessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => !editingSessionId && handleSelectSession(session.id)}
                        className={cn(
                          'group w-full cursor-pointer rounded-lg border border-transparent px-2.5 py-2 text-left text-sm transition-all hover:bg-muted/60',
                          session.id === currentSessionId && 'border-primary/30 bg-primary/10'
                        )}
                      >
                        {editingSessionId === session.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              ref={editInputRef}
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={handleRenameKeyDown}
                              onBlur={handleSaveRename}
                              className="h-7 px-2 text-xs"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSaveRename()
                              }}
                            >
                              <Check className="h-3 w-3 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCancelRename()
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{session.title}</p>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleStartRename(session)
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Rename</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteSession(session.id)
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null
              )}
            </div>
          </aside>
        </div>
      </div>
    </TooltipProvider>
  )
}

function MessageBubble({ message }: { message: ChatMessage }): React.JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-secondary' : 'bg-gradient-to-br from-primary/80 to-primary'
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5 text-secondary-foreground" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        )}
      </div>
      <div
        className={cn(
          'max-w-[90%] rounded-2xl px-3.5 py-2.5',
          isUser
            ? 'rounded-tr-md bg-primary text-primary-foreground'
            : 'rounded-tl-md bg-muted/50 dark:bg-muted'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none text-sm dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0 prose-p:leading-relaxed prose-headings:mb-1.5 prose-headings:mt-2.5 prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
