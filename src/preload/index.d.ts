import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  BudgetItem,
  BudgetWithComputed,
  LearnedItemMapping,
  AppSettings,
  Transaction,
  Budget,
  Allocation,
  IncomeSource,
  ChatMessage,
  ChatSession,
  AiContextMonths,
  ColumnMapping,
  CsvImportProfile,
  DateFormatPreset,
  AmountSignMode,
  PaymentRowHandling
} from '../shared/types'

interface BudgetAPI {
  // Settings
  getSettings: () => Promise<AppSettings>
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>

  // Budget Items
  getItems: () => Promise<BudgetItem[]>
  getLearnedMappings: () => Promise<LearnedItemMapping[]>
  addItem: (item: Omit<BudgetItem, 'id'>) => Promise<BudgetItem>
  updateItem: (id: string, updates: Partial<BudgetItem>) => Promise<BudgetItem | null>
  deleteItem: (id: string) => Promise<boolean>
  removeItemFromBudget: (month: string, itemId: string) => Promise<boolean>
  cleanupOrphanedAllocations: () => Promise<{ cleanedBudgets: number; removedAllocations: number }>
  reorderItems: (itemIds: string[]) => Promise<void>

  // Budgets
  getBudget: (month: string) => Promise<Budget | null>
  getBudgets: () => Promise<Budget[]>
  getBudgetsWithSpent: () => Promise<Budget[]>
  getBudgetWithSpent: (month: string) => Promise<BudgetWithComputed | null>
  createBudget: (month: string, incomeTotal: number, copyFromMonth?: string) => Promise<Budget>
  updateBudget: (
    month: string,
    updates: {
      incomeTotal?: number
      allocations?: Allocation[]
      incomeSources?: IncomeSource[]
    }
  ) => Promise<Budget | null>
  deleteBudget: (month: string) => Promise<boolean>
  getPreviousMonth: (month: string) => Promise<string>
  getNextMonth: (month: string) => Promise<string>

  // Transactions
  getTransactions: (month: string) => Promise<Transaction[]>
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<Transaction>
  updateTransaction: (
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>
  ) => Promise<Transaction | null>
  deleteTransaction: (id: string) => Promise<boolean>

  // CSV Import/Export
  exportBudgetsCSV: (options?: { months?: string[] }) => Promise<{
    success: boolean
    filePath?: string
    error?: string
    canceled?: boolean
  }>
  exportTransactionsCSV: (options?: { startDate?: string; endDate?: string }) => Promise<{
    success: boolean
    filePath?: string
    error?: string
    canceled?: boolean
  }>
  exportItemsCSV: () => Promise<{
    success: boolean
    filePath?: string
    error?: string
    canceled?: boolean
  }>
  importBudgetsCSV: (options?: { targetMonth?: string }) => Promise<{
    success: boolean
    imported: number
    skipped: number
    errors: string[]
    canceled?: boolean
  }>
  importTransactionsCSV: (options?: { targetMonth?: string; format?: string }) => Promise<{
    success: boolean
    imported: number
    skipped: number
    errors: string[]
    canceled?: boolean
  }>
  importItemsCSV: (options?: { mode?: 'merge' | 'replace' }) => Promise<{
    success: boolean
    imported: number
    updated: number
    errors: string[]
    canceled?: boolean
  }>
  parseTransactionsCSV: (
    csvContent: string,
    options?: { format?: string; defaultItemId?: string }
  ) => Promise<{
    transactions: Array<{
      budgetMonth: string
      itemName: string
      amount: number
      description: string
      date: string
      card?: string
    }>
    errors: { row: number; message: string }[]
  }>

  // CSV Import Wizard (Dynamic Column Mapping)
  selectCsvFile: () => Promise<{
    success: boolean
    content?: string
    fileName?: string
    canceled?: boolean
    error?: string
  }>
  extractCsvHeaders: (csvContent: string) => Promise<string[]>
  getCsvPreviewRows: (csvContent: string, maxRows?: number) => Promise<string[][]>
  autoDetectMapping: (headers: string[]) => Promise<Partial<ColumnMapping>>
  parseWithMapping: (
    csvContent: string,
    mapping: ColumnMapping,
    options?: {
      dateFormat?: DateFormatPreset
      amountSignMode?: AmountSignMode
      paymentHandling?: PaymentRowHandling
      paymentKeywords?: string[]
      defaultItemId?: string
    }
  ) => Promise<{
    transactions: Array<{
      budgetMonth: string
      itemName: string
      amount: number
      description: string
      date: string
      card?: string
    }>
    errors: { row: number; field: string; message: string }[]
    skippedPayments: number
  }>
  importWithMapping: (
    csvContent: string,
    mapping: ColumnMapping,
    options?: {
      dateFormat?: DateFormatPreset
      amountSignMode?: AmountSignMode
      paymentHandling?: PaymentRowHandling
      paymentKeywords?: string[]
      targetMonth?: string
    }
  ) => Promise<{
    success: boolean
    imported: number
    skipped: number
    errors: string[]
    skippedPayments?: number
  }>

  // CSV Import Profiles
  getCsvProfiles: () => Promise<CsvImportProfile[]>
  getCsvProfile: (id: string) => Promise<CsvImportProfile | null>
  addCsvProfile: (
    profile: Omit<CsvImportProfile, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<CsvImportProfile>
  updateCsvProfile: (
    id: string,
    updates: Partial<Omit<CsvImportProfile, 'id' | 'createdAt'>>
  ) => Promise<CsvImportProfile | null>
  deleteCsvProfile: (id: string) => Promise<boolean>
  createDefaultProfile: (
    name: string,
    headers: string[]
  ) => Promise<Omit<CsvImportProfile, 'id' | 'createdAt' | 'updatedAt'>>

  // AI Chat
  getSessions: () => Promise<ChatSession[]>
  getCurrentSessionId: () => Promise<string | null>
  createSession: () => Promise<ChatSession>
  getSession: (sessionId: string) => Promise<ChatSession | null>
  setCurrentSession: (sessionId: string) => Promise<void>
  saveChatMessage: (sessionId: string, message: ChatMessage) => Promise<void>
  renameSession: (sessionId: string, newTitle: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  clearAllSessions: () => Promise<void>
  sendChatMessage: (
    messages: { role: 'user' | 'assistant'; content: string }[],
    contextMonths: AiContextMonths
  ) => void
  onChatStreamChunk: (callback: (data: { text: string }) => void) => () => void
  onChatStreamEnd: (callback: () => void) => () => void
  onChatStreamError: (callback: (data: { error: string }) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: BudgetAPI
  }
}
