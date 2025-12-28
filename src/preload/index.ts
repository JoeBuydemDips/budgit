import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  Category,
  LearnedCategoryMapping,
  AppSettings,
  Transaction,
  Budget,
  CategoryAllocation
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
  getBudgetWithSpent: (
    month: string
  ): Promise<
    | (Budget & {
        computed: { totalSpent: number; leftToBudget: number; available: Record<string, number> }
      })
    | null
  > => ipcRenderer.invoke('budget:getWithSpent', month),
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
    transactions: Array<{ budgetMonth: string; categoryName: string; amount: number; description: string; date: string; card?: string }>
    errors: { row: number; message: string }[]
  }> => ipcRenderer.invoke('csv:parseTransactions', csvContent, options)
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
