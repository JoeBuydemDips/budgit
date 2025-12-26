import { ipcMain } from 'electron'
import {
  getSettings,
  updateSettings,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getBudgetByMonth,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgets,
  getTransactionsByMonth,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getBudgetWithSpent,
  getPreviousMonth,
  getNextMonth
} from './store'
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

  // ============== Budgets ==============
  ipcMain.handle('budget:get', (_, month: string) => {
    return getBudgetByMonth(month)
  })

  ipcMain.handle('budget:list', () => {
    return getBudgets()
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
}
