import { useState, useEffect, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
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
  HelpCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Budget, Category, ChatMessage, AiContextMonths } from '../../../shared/types'

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

export function InsightsView({
  onNavigateToSettings
}: InsightsViewProps): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [contextMonths, setContextMonths] = useState<AiContextMonths>(3)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load chat history and settings on mount
  useEffect(() => {
    const loadData = async (): Promise<void> => {
      const [history, settings] = await Promise.all([
        window.api.getChatHistory(),
        window.api.getSettings()
      ])
      setMessages(history)
      setHasApiKey(!!settings.claudeApiKey)
      setContextMonths(settings.aiContextMonths || 3)
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
      setStreamingContent((prev) => {
        if (prev) {
          const assistantMessage: ChatMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: prev,
            timestamp: new Date().toISOString()
          }
          setMessages((msgs) => [...msgs, assistantMessage])
          window.api.saveChatMessage(assistantMessage)
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
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return

      setError(null)
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString()
      }

      setMessages((prev) => [...prev, userMessage])
      await window.api.saveChatMessage(userMessage)
      setInputValue('')
      setIsLoading(true)
      setStreamingContent('')

      // Build message history for context
      const messageHistory = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content
      }))

      window.api.sendChatMessage(messageHistory, contextMonths)
    },
    [messages, isLoading, contextMonths]
  )

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    sendMessage(inputValue)
  }

  const handleStarterClick = (question: string): void => {
    sendMessage(question)
  }

  const handleClearHistory = async (): Promise<void> => {
    await window.api.clearChatHistory()
    setMessages([])
    setStreamingContent('')
    setError(null)
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

  // Loading state while checking API key
  if (hasApiKey === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const showStarterQuestions = messages.length === 0 && !streamingContent

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold">Budgit</h1>
            <p className="text-xs text-muted-foreground">Your AI Budget Assistant</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearHistory}
            className="text-muted-foreground hover:text-destructive gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        )}
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

            {/* Streaming message */}
            {streamingContent && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="flex-1 bg-muted rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%]">
                  <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
                  <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && !streamingContent && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
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
  )
}

function MessageBubble({ message }: { message: ChatMessage }): React.JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isUser
            ? 'bg-secondary'
            : 'bg-gradient-to-br from-primary/80 to-primary'
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
            : 'bg-muted rounded-tl-md'
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
