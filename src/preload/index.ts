import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  Category,
  BudgetWithComputed,
  LearnedCategoryMapping,
  AppSettings,
  Transaction,
  Budget,
  CategoryAllocation,
  ChatMessage,
  ChatSession,
  AiContextMonths
} from '../shared/types'

// Budget API for renderer
const budgetApi = {
  // Settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', settings),

  // Categories
  getCategories: (): Promise<Category[]> => ipcRenderer.invoke('categories:list'),
  getLearnedMappings: (): Promise<LearnedCategoryMapping[]> =>
    ipcRenderer.invoke('categories:getLearnedMappings'),
  addCategory: (category: Omit<Category, 'id'>): Promise<Category> =>
    ipcRenderer.invoke('categories:add', category),
  updateCategory: (id: string, updates: Partial<Category>): Promise<Category | null> =>
    ipcRenderer.invoke('categories:update', id, updates),
  deleteCategory: (id: string): Promise<boolean> => ipcRenderer.invoke('categories:delete', id),
  removeCategoryFromBudget: (month: string, categoryId: string): Promise<boolean> =>
    ipcRenderer.invoke('categories:remove-from-budget', month, categoryId),
  cleanupOrphanedAllocations: (): Promise<{ cleanedBudgets: number; removedAllocations: number }> =>
    ipcRenderer.invoke('categories:cleanup-orphaned'),
  reorderCategories: (categoryIds: string[]): Promise<void> =>
    ipcRenderer.invoke('categories:reorder', categoryIds),

  // Budgets
  getBudget: (month: string): Promise<Budget | null> => ipcRenderer.invoke('budget:get', month),
  getBudgets: (): Promise<Budget[]> => ipcRenderer.invoke('budget:list'),
  getBudgetsWithSpent: (): Promise<Budget[]> => ipcRenderer.invoke('budget:listWithSpent'),
  getBudgetWithSpent: (month: string): Promise<BudgetWithComputed | null> =>
    ipcRenderer.invoke('budget:getWithSpent', month),
  createBudget: (month: string, incomeTotal: number, copyFromMonth?: string): Promise<Budget> =>
    ipcRenderer.invoke('budget:create', month, incomeTotal, copyFromMonth),
  updateBudget: (
    month: string,
    updates: { incomeTotal?: number; allocations?: CategoryAllocation[] }
  ): Promise<Budget | null> => ipcRenderer.invoke('budget:update', month, updates),
  deleteBudget: (month: string): Promise<boolean> => ipcRenderer.invoke('budget:delete', month),
  getPreviousMonth: (month: string): Promise<string> =>
    ipcRenderer.invoke('budget:getPreviousMonth', month),
  getNextMonth: (month: string): Promise<string> =>
    ipcRenderer.invoke('budget:getNextMonth', month),

  // Transactions
  getTransactions: (month: string): Promise<Transaction[]> =>
    ipcRenderer.invoke('transactions:list', month),
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> =>
    ipcRenderer.invoke('transactions:add', transaction),
  updateTransaction: (
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>
  ): Promise<Transaction | null> => ipcRenderer.invoke('transactions:update', id, updates),
  deleteTransaction: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('transactions:delete', id),

  // CSV Import/Export
  exportBudgetsCSV: (options?: {
    months?: string[]
  }): Promise<{
    success: boolean
    filePath?: string
    error?: string
    canceled?: boolean
  }> => ipcRenderer.invoke('csv:exportBudgets', options),
  exportTransactionsCSV: (options?: {
    startDate?: string
    endDate?: string
  }): Promise<{
    success: boolean
    filePath?: string
    error?: string
    canceled?: boolean
  }> => ipcRenderer.invoke('csv:exportTransactions', options),
  exportCategoriesCSV: (): Promise<{
    success: boolean
    filePath?: string
    error?: string
    canceled?: boolean
  }> => ipcRenderer.invoke('csv:exportCategories'),
  importBudgetsCSV: (options?: {
    targetMonth?: string
  }): Promise<{
    success: boolean
    imported: number
    skipped: number
    errors: string[]
    canceled?: boolean
  }> => ipcRenderer.invoke('csv:importBudgets', options),
  importTransactionsCSV: (options?: {
    targetMonth?: string
    format?: string
  }): Promise<{
    success: boolean
    imported: number
    skipped: number
    errors: string[]
    canceled?: boolean
  }> => ipcRenderer.invoke('csv:importTransactions', options),
  importCategoriesCSV: (options?: {
    mode?: 'merge' | 'replace'
  }): Promise<{
    success: boolean
    imported: number
    updated: number
    errors: string[]
    canceled?: boolean
  }> => ipcRenderer.invoke('csv:importCategories', options),
  parseTransactionsCSV: (
    csvContent: string,
    options?: {
      format?: string
      defaultCategoryId?: string
    }
  ): Promise<{
    transactions: Array<{
      budgetMonth: string
      categoryName: string
      amount: number
      description: string
      date: string
      card?: string
    }>
    errors: { row: number; message: string }[]
  }> => ipcRenderer.invoke('csv:parseTransactions', csvContent, options),

  // AI Chat
  getSessions: (): Promise<ChatSession[]> => ipcRenderer.invoke('ai:getSessions'),
  getCurrentSessionId: (): Promise<string | null> => ipcRenderer.invoke('ai:getCurrentSessionId'),
  createSession: (): Promise<ChatSession> => ipcRenderer.invoke('ai:createSession'),
  getSession: (sessionId: string): Promise<ChatSession | null> =>
    ipcRenderer.invoke('ai:getSession', sessionId),
  setCurrentSession: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('ai:setCurrentSession', sessionId),
  saveChatMessage: (sessionId: string, message: ChatMessage): Promise<void> =>
    ipcRenderer.invoke('ai:saveChatMessage', sessionId, message),
  renameSession: (sessionId: string, newTitle: string): Promise<void> =>
    ipcRenderer.invoke('ai:renameSession', sessionId, newTitle),
  deleteSession: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('ai:deleteSession', sessionId),
  clearAllSessions: (): Promise<void> => ipcRenderer.invoke('ai:clearAllSessions'),
  sendChatMessage: (
    messages: { role: 'user' | 'assistant'; content: string }[],
    contextMonths: AiContextMonths
  ): void => {
    ipcRenderer.send('ai:chat-stream', { messages, contextMonths })
  },
  onChatStreamChunk: (callback: (data: { text: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { text: string }): void =>
      callback(data)
    ipcRenderer.on('ai:chat-stream-chunk', handler)
    return () => ipcRenderer.removeListener('ai:chat-stream-chunk', handler)
  },
  onChatStreamEnd: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('ai:chat-stream-end', handler)
    return () => ipcRenderer.removeListener('ai:chat-stream-end', handler)
  },
  onChatStreamError: (callback: (data: { error: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { error: string }): void =>
      callback(data)
    ipcRenderer.on('ai:chat-stream-error', handler)
    return () => ipcRenderer.removeListener('ai:chat-stream-error', handler)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', budgetApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = budgetApi
}
