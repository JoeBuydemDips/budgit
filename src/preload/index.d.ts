import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  Category,
  LearnedCategoryMapping,
  AppSettings,
  Transaction,
  Budget,
  CategoryAllocation,
  IncomeSource
} from '../shared/types'

interface BudgetAPI {
  // Settings
  getSettings: () => Promise<AppSettings>
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>

  // Categories
  getCategories: () => Promise<Category[]>
  getLearnedMappings: () => Promise<LearnedCategoryMapping[]>
  addCategory: (category: Omit<Category, 'id'>) => Promise<Category>
  updateCategory: (id: string, updates: Partial<Category>) => Promise<Category | null>
  deleteCategory: (id: string) => Promise<boolean>
  removeCategoryFromBudget: (month: string, categoryId: string) => Promise<boolean>
  cleanupOrphanedAllocations: () => Promise<{ cleanedBudgets: number; removedAllocations: number }>
  reorderCategories: (categoryIds: string[]) => Promise<void>

  // Budgets
  getBudget: (month: string) => Promise<Budget | null>
  getBudgets: () => Promise<Budget[]>
  getBudgetsWithSpent: () => Promise<Budget[]>
  getBudgetWithSpent: (month: string) => Promise<
    | (Budget & {
        computed: { totalSpent: number; leftToBudget: number; available: Record<string, number> }
      })
    | null
  >
  createBudget: (month: string, incomeTotal: number, copyFromMonth?: string) => Promise<Budget>
  updateBudget: (
    month: string,
    updates: {
      incomeTotal?: number
      allocations?: CategoryAllocation[]
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
  exportCategoriesCSV: () => Promise<{
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
  importTransactionsCSV: (options?: { targetMonth?: string }) => Promise<{
    success: boolean
    imported: number
    skipped: number
    errors: string[]
    canceled?: boolean
  }>
  importCategoriesCSV: (options?: { mode?: 'merge' | 'replace' }) => Promise<{
    success: boolean
    imported: number
    updated: number
    errors: string[]
    canceled?: boolean
  }>
  learnTransactionCategory: (transactionId: string, categoryId: string) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: BudgetAPI
  }
}
