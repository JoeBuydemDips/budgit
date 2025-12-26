import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'
import {
  StoreSchema,
  Budget,
  Transaction,
  Category,
  AppSettings,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  CategoryAllocation,
  IncomeSource
} from '../shared/types'

// Create the store with schema defaults
const store = new Store<StoreSchema>({
  name: 'budgit-data',
  defaults: {
    categories: DEFAULT_CATEGORIES,
    budgets: [],
    transactions: [],
    settings: DEFAULT_SETTINGS
  }
})

// ============== Settings ==============
export function getSettings(): AppSettings {
  return store.get('settings')
}

export function updateSettings(settings: Partial<AppSettings>): AppSettings {
  const current = store.get('settings')
  const updated = { ...current, ...settings }
  store.set('settings', updated)
  return updated
}

// ============== Categories ==============
export function getCategories(): Category[] {
  return store.get('categories').sort((a, b) => a.sortOrder - b.sortOrder)
}

export function addCategory(category: Omit<Category, 'id'>): Category {
  const categories = store.get('categories')
  const newCategory: Category = {
    ...category,
    id: uuidv4()
  }
  store.set('categories', [...categories, newCategory])
  return newCategory
}

export function updateCategory(id: string, updates: Partial<Category>): Category | null {
  const categories = store.get('categories')
  const index = categories.findIndex((c) => c.id === id)
  if (index === -1) return null

  const updated = { ...categories[index], ...updates }
  categories[index] = updated
  store.set('categories', categories)
  return updated
}

export function deleteCategory(id: string): boolean {
  const categories = store.get('categories')
  const filtered = categories.filter((c) => c.id !== id)
  if (filtered.length === categories.length) return false
  store.set('categories', filtered)
  return true
}

// ============== Budgets ==============
export function getBudgets(): Budget[] {
  return store.get('budgets')
}

export function getBudgetByMonth(month: string): Budget | null {
  const budgets = store.get('budgets')
  return budgets.find((b) => b.month === month) || null
}

export function createBudget(month: string, incomeTotal: number, copyFromMonth?: string): Budget {
  const budgets = store.get('budgets')
  const categories = store.get('categories')
  const transactions = store.get('transactions')

  // Check if budget already exists for this month
  const existing = budgets.find((b) => b.month === month)
  if (existing) {
    return existing
  }

  let allocations: CategoryAllocation[]

  if (copyFromMonth) {
    // Copy allocations from previous month
    const previousBudget = budgets.find((b) => b.month === copyFromMonth)
    if (previousBudget) {
      // Calculate spent amounts for previous month
      const previousTransactions = transactions.filter((t) => t.budgetMonth === copyFromMonth)

      allocations = categories.map((cat) => {
        const prevAllocation = previousBudget.allocations.find((a) => a.categoryId === cat.id)
        const prevSpent = previousTransactions
          .filter((t) => t.categoryId === cat.id)
          .reduce((sum, t) => sum + t.amount, 0)

        // Calculate carryover (only positive, only if rollover enabled)
        let carryover = 0
        if (cat.rolloverEnabled && prevAllocation) {
          const remaining = prevAllocation.planned - prevSpent
          carryover = Math.max(0, remaining)
        }

        return {
          categoryId: cat.id,
          planned: prevAllocation?.planned || 0,
          spent: 0,
          carryover
        }
      })
    } else {
      // No previous budget found, start fresh
      allocations = categories.map((cat) => ({
        categoryId: cat.id,
        planned: 0,
        spent: 0,
        carryover: 0
      }))
    }
  } else {
    // Start fresh
    allocations = categories.map((cat) => ({
      categoryId: cat.id,
      planned: 0,
      spent: 0,
      carryover: 0
    }))
  }

  const totalPlanned = allocations.reduce((sum, a) => sum + a.planned, 0)

  const newBudget: Budget = {
    id: uuidv4(),
    month,
    incomeTotal,
    incomeSources: [{ id: uuidv4(), name: 'Primary Income', planned: incomeTotal, received: 0 }],
    allocations,
    isBalanced: incomeTotal === totalPlanned,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  store.set('budgets', [...budgets, newBudget])
  return newBudget
}

export function updateBudget(
  month: string,
  updates: Partial<Pick<Budget, 'incomeTotal' | 'allocations' | 'incomeSources'>>
): Budget | null {
  const budgets = store.get('budgets')
  const index = budgets.findIndex((b) => b.month === month)
  if (index === -1) return null

  const current = budgets[index]
  const newAllocations = updates.allocations || current.allocations
  const newIncomeSources = updates.incomeSources || current.incomeSources || []
  const newIncome = updates.incomeTotal !== undefined ? updates.incomeTotal : current.incomeTotal
  const totalPlanned = newAllocations.reduce((sum, a) => sum + a.planned, 0)

  const updated: Budget = {
    ...current,
    incomeTotal: newIncome,
    incomeSources: newIncomeSources,
    allocations: newAllocations,
    isBalanced: newIncome === totalPlanned,
    updatedAt: new Date().toISOString()
  }

  budgets[index] = updated
  store.set('budgets', budgets)
  return updated
}

export function deleteBudget(month: string): boolean {
  const budgets = store.get('budgets')
  const filtered = budgets.filter((b) => b.month !== month)
  if (filtered.length === budgets.length) return false
  store.set('budgets', filtered)
  return true
}

// ============== Transactions ==============
export function getTransactions(): Transaction[] {
  return store.get('transactions')
}

export function getTransactionsByMonth(month: string): Transaction[] {
  return store.get('transactions').filter((t) => t.budgetMonth === month)
}

export function addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
  const transactions = store.get('transactions')
  const newTransaction: Transaction = {
    ...transaction,
    id: uuidv4(),
    createdAt: new Date().toISOString()
  }
  store.set('transactions', [...transactions, newTransaction])

  // Update spent amount in budget
  updateBudgetSpent(transaction.budgetMonth)

  return newTransaction
}

export function updateTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>
): Transaction | null {
  const transactions = store.get('transactions')
  const index = transactions.findIndex((t) => t.id === id)
  if (index === -1) return null

  const oldTransaction = transactions[index]
  const updated = { ...oldTransaction, ...updates }
  transactions[index] = updated
  store.set('transactions', transactions)

  // Update spent amounts in affected budgets
  updateBudgetSpent(oldTransaction.budgetMonth)
  if (updates.budgetMonth && updates.budgetMonth !== oldTransaction.budgetMonth) {
    updateBudgetSpent(updates.budgetMonth)
  }

  return updated
}

export function deleteTransaction(id: string): boolean {
  const transactions = store.get('transactions')
  const transaction = transactions.find((t) => t.id === id)
  if (!transaction) return false

  const filtered = transactions.filter((t) => t.id !== id)
  store.set('transactions', filtered)

  // Update spent amount in budget
  updateBudgetSpent(transaction.budgetMonth)

  return true
}

// Helper to recalculate spent amounts in a budget
function updateBudgetSpent(month: string): void {
  const budgets = store.get('budgets')
  const transactions = store.get('transactions')
  const index = budgets.findIndex((b) => b.month === month)
  if (index === -1) return

  const monthTransactions = transactions.filter((t) => t.budgetMonth === month)
  const budget = budgets[index]

  const updatedAllocations = budget.allocations.map((allocation) => {
    const spent = monthTransactions
      .filter((t) => t.categoryId === allocation.categoryId)
      .reduce((sum, t) => sum + t.amount, 0)
    return { ...allocation, spent }
  })

  budgets[index] = {
    ...budget,
    allocations: updatedAllocations,
    updatedAt: new Date().toISOString()
  }
  store.set('budgets', budgets)
}

// ============== Computed helpers ==============
export function getBudgetWithSpent(month: string):
  | (Budget & {
      computed: { totalSpent: number; leftToBudget: number; available: Record<string, number> }
    })
  | null {
  const budget = getBudgetByMonth(month)
  if (!budget) return null

  const transactions = getTransactionsByMonth(month)

  const spentByCategory: Record<string, number> = {}
  transactions.forEach((t) => {
    spentByCategory[t.categoryId] = (spentByCategory[t.categoryId] || 0) + t.amount
  })

  const totalPlanned = budget.allocations.reduce((sum, a) => sum + a.planned, 0)
  const totalSpent = Object.values(spentByCategory).reduce((sum, s) => sum + s, 0)
  const leftToBudget = budget.incomeTotal - totalPlanned

  const available: Record<string, number> = {}
  budget.allocations.forEach((a) => {
    const spent = spentByCategory[a.categoryId] || 0
    available[a.categoryId] = a.planned + a.carryover - spent
  })

  return {
    ...budget,
    allocations: budget.allocations.map((a) => ({
      ...a,
      spent: spentByCategory[a.categoryId] || 0
    })),
    computed: {
      totalSpent,
      leftToBudget,
      available
    }
  }
}

export function getPreviousMonth(month: string): string {
  const [year, monthNum] = month.split('-').map(Number)
  const date = new Date(year, monthNum - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function getNextMonth(month: string): string {
  const [year, monthNum] = month.split('-').map(Number)
  const date = new Date(year, monthNum, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
