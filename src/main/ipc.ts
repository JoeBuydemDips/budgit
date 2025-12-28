import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFile, readFile } from 'fs/promises'
import {
  getSettings,
  updateSettings,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  removeCategoryFromBudget,
  cleanupOrphanedAllocations,
  reorderCategories,
  getBudgetByMonth,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgets,
  getBudgetsByMonths,
  getBudgetsWithSpent,
  getTransactionsByMonth,
  getTransactions,
  getTransactionsByDateRange,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getBudgetWithSpent,
  getPreviousMonth,
  getNextMonth,
  importBudgets,
  importTransactions,
  importCategories,
  ImportResult,
  ImportCategoriesResult
} from './store'
import {
  generateBudgetsCSV,
  generateTransactionsCSV,
  generateCategoriesCSV,
  parseBudgetsCSV,
  parseTransactionsCSV,
  parseCategoriesCSV
} from './csv'
import type { Category, AppSettings, Transaction } from '../shared/types'

export function registerIpcHandlers(): void {
  // ============== Settings ==============
  ipcMain.handle('settings:get', () => {
    return getSettings()
  })

  ipcMain.handle('settings:update', (_, settings: Partial<AppSettings>) => {
    return updateSettings(settings)
  })

  // ============== Categories ==============
  ipcMain.handle('categories:list', () => {
    return getCategories()
  })

  ipcMain.handle('categories:add', (_, category: Omit<Category, 'id'>) => {
    return addCategory(category)
  })

  ipcMain.handle('categories:update', (_, id: string, updates: Partial<Category>) => {
    return updateCategory(id, updates)
  })

  ipcMain.handle('categories:delete', (_, id: string) => {
    return deleteCategory(id)
  })

  ipcMain.handle('categories:remove-from-budget', (_, month: string, categoryId: string) => {
    return removeCategoryFromBudget(month, categoryId)
  })

  ipcMain.handle('categories:cleanup-orphaned', () => {
    return cleanupOrphanedAllocations()
  })

  ipcMain.handle('categories:reorder', (_, categoryIds: string[]) => {
    return reorderCategories(categoryIds)
  })

  // ============== Budgets ==============
  ipcMain.handle('budget:get', (_, month: string) => {
    return getBudgetByMonth(month)
  })

  ipcMain.handle('budget:list', () => {
    return getBudgets()
  })

  ipcMain.handle('budget:listWithSpent', () => {
    return getBudgetsWithSpent()
  })

  ipcMain.handle('budget:getWithSpent', (_, month: string) => {
    return getBudgetWithSpent(month)
  })

  ipcMain.handle(
    'budget:create',
    (_, month: string, incomeTotal: number, copyFromMonth?: string) => {
      return createBudget(month, incomeTotal, copyFromMonth)
    }
  )

  ipcMain.handle(
    'budget:update',
    (
      _,
      month: string,
      updates: {
        incomeTotal?: number
        allocations?: { categoryId: string; planned: number; spent: number; carryover: number }[]
      }
    ) => {
      return updateBudget(month, updates)
    }
  )

  ipcMain.handle('budget:delete', (_, month: string) => {
    return deleteBudget(month)
  })

  ipcMain.handle('budget:getPreviousMonth', (_, month: string) => {
    return getPreviousMonth(month)
  })

  ipcMain.handle('budget:getNextMonth', (_, month: string) => {
    return getNextMonth(month)
  })

  // ============== Transactions ==============
  ipcMain.handle('transactions:list', (_, month: string) => {
    return getTransactionsByMonth(month)
  })

  ipcMain.handle('transactions:add', (_, transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    return addTransaction(transaction)
  })

  ipcMain.handle(
    'transactions:update',
    (_, id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => {
      return updateTransaction(id, updates)
    }
  )

  ipcMain.handle('transactions:delete', (_, id: string) => {
    return deleteTransaction(id)
  })

  // ============== CSV Export/Import ==============
  ipcMain.handle('csv:exportBudgets', async (_, options?: { months?: string[] }) => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return { success: false, error: 'No active window' }

    const result = await dialog.showSaveDialog(window, {
      title: 'Export Budgets',
      defaultPath: 'budgit-budgets.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    try {
      // Use filtered budgets if months specified, otherwise export all
      const budgets =
        options?.months && options.months.length > 0
          ? getBudgetsByMonths(options.months)
          : getBudgets()
      const categories = getCategories()
      const csvContent = generateBudgetsCSV(budgets, categories)
      await writeFile(result.filePath, csvContent, 'utf-8')
      return { success: true, filePath: result.filePath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'csv:exportTransactions',
    async (_, options?: { startDate?: string; endDate?: string }) => {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) return { success: false, error: 'No active window' }

      const result = await dialog.showSaveDialog(window, {
        title: 'Export Transactions',
        defaultPath: 'budgit-transactions.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true }
      }

      try {
        // Use filtered transactions if date range specified, otherwise export all
        const transactions =
          options?.startDate || options?.endDate
            ? getTransactionsByDateRange(options.startDate, options.endDate)
            : getTransactions()
        const categories = getCategories()
        const csvContent = generateTransactionsCSV(transactions, categories)
        await writeFile(result.filePath, csvContent, 'utf-8')
        return { success: true, filePath: result.filePath }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    'csv:importBudgets',
    async (
      _,
      options?: { targetMonth?: string }
    ): Promise<ImportResult & { canceled?: boolean }> => {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) return { success: false, imported: 0, skipped: 0, errors: ['No active window'] }

      const result = await dialog.showOpenDialog(window, {
        title: 'Import Budgets',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, imported: 0, skipped: 0, errors: [], canceled: true }
      }

      try {
        const csvContent = await readFile(result.filePaths[0], 'utf-8')
        const parsed = parseBudgetsCSV(csvContent)

        if (parsed.errors.length > 0) {
          return {
            success: false,
            imported: 0,
            skipped: 0,
            errors: parsed.errors.map((e) => `Row ${e.row}: ${e.message}`)
          }
        }

        return importBudgets(parsed.allocations, options?.targetMonth)
      } catch (error) {
        return { success: false, imported: 0, skipped: 0, errors: [String(error)] }
      }
    }
  )

  ipcMain.handle(
    'csv:importTransactions',
    async (
      _,
      options?: { targetMonth?: string }
    ): Promise<ImportResult & { canceled?: boolean }> => {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) return { success: false, imported: 0, skipped: 0, errors: ['No active window'] }

      const result = await dialog.showOpenDialog(window, {
        title: 'Import Transactions',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, imported: 0, skipped: 0, errors: [], canceled: true }
      }

      try {
        const csvContent = await readFile(result.filePaths[0], 'utf-8')
        const categories = getCategories()
        const parsed = parseTransactionsCSV(csvContent, categories)

        if (parsed.errors.length > 0) {
          return {
            success: false,
            imported: 0,
            skipped: 0,
            errors: parsed.errors.map((e) => `Row ${e.row}: ${e.message}`)
          }
        }

        return importTransactions(parsed.transactions, options?.targetMonth)
      } catch (error) {
        return { success: false, imported: 0, skipped: 0, errors: [String(error)] }
      }
    }
  )

  // Export categories
  ipcMain.handle('csv:exportCategories', async () => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return { success: false, error: 'No active window' }

    const result = await dialog.showSaveDialog(window, {
      title: 'Export Categories',
      defaultPath: 'budgit-categories.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    try {
      const categories = getCategories()
      const csvContent = generateCategoriesCSV(categories)
      await writeFile(result.filePath, csvContent, 'utf-8')
      return { success: true, filePath: result.filePath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Import categories
  ipcMain.handle(
    'csv:importCategories',
    async (
      _,
      options?: { mode?: 'merge' | 'replace' }
    ): Promise<ImportCategoriesResult & { canceled?: boolean }> => {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) return { success: false, imported: 0, updated: 0, errors: ['No active window'] }

      const result = await dialog.showOpenDialog(window, {
        title: 'Import Categories',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, imported: 0, updated: 0, errors: [], canceled: true }
      }

      try {
        const csvContent = await readFile(result.filePaths[0], 'utf-8')
        const parsed = parseCategoriesCSV(csvContent)

        if (parsed.errors.length > 0) {
          return {
            success: false,
            imported: 0,
            updated: 0,
            errors: parsed.errors.map((e) => `Row ${e.row}: ${e.message}`)
          }
        }

        return importCategories(parsed.categories, options?.mode || 'merge')
      } catch (error) {
        return { success: false, imported: 0, updated: 0, errors: [String(error)] }
      }
    }
  )
}
