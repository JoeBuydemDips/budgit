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
  CategoryAllocation
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

export function reorderCategories(categoryIds: string[]): void {
  const categories = store.get('categories')
  const updated = categories.map((cat) => {
    const newIndex = categoryIds.indexOf(cat.id)
    if (newIndex !== -1) {
      return { ...cat, sortOrder: newIndex }
    }
    return cat
  })
  store.set('categories', updated)
}

export interface ImportCategoriesResult {
  success: boolean
  imported: number
  updated: number
  errors: string[]
}

export interface ImportCategoryData {
  id: string
  name: string
  type: Category['type']
  rolloverEnabled: boolean
  sortOrder: number
}

export function importCategories(
  categoriesToImport: ImportCategoryData[],
  mode: 'merge' | 'replace' = 'merge'
): ImportCategoriesResult {
  const existingCategories = store.get('categories')
  const existingIds = new Set(existingCategories.map((c) => c.id))

  const errors: string[] = []
  let imported = 0
  let updated = 0

  if (mode === 'replace') {
    // Replace all categories
    const newCategories: Category[] = categoriesToImport.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      rolloverEnabled: c.rolloverEnabled,
      sortOrder: c.sortOrder
    }))
    store.set('categories', newCategories)
    imported = newCategories.length
  } else {
    // Merge - update existing, add new
    const categoryMap = new Map(existingCategories.map((c) => [c.id, c]))

    for (const cat of categoriesToImport) {
      if (existingIds.has(cat.id)) {
        // Update existing
        categoryMap.set(cat.id, {
          id: cat.id,
          name: cat.name,
          type: cat.type,
          rolloverEnabled: cat.rolloverEnabled,
          sortOrder: cat.sortOrder
        })
        updated++
      } else {
        // Add new
        categoryMap.set(cat.id, {
          id: cat.id,
          name: cat.name,
          type: cat.type,
          rolloverEnabled: cat.rolloverEnabled,
          sortOrder: cat.sortOrder
        })
        imported++
      }
    }

    store.set('categories', Array.from(categoryMap.values()))
  }

  return {
    success: errors.length === 0,
    imported,
    updated,
    errors
  }
}

// ============== Budgets ==============
export function getBudgets(): Budget[] {
  return store.get('budgets')
}

export function getBudgetsByMonths(months: string[]): Budget[] {
  const budgets = store.get('budgets')
  return budgets.filter((b) => months.includes(b.month))
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

export function getTransactionsByDateRange(startDate?: string, endDate?: string): Transaction[] {
  const transactions = store.get('transactions')
  return transactions.filter((t) => {
    if (startDate && t.date < startDate) return false
    if (endDate && t.date > endDate) return false
    return true
  })
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

// Get all budgets with computed spent values from transactions
export function getBudgetsWithSpent(): Budget[] {
  const budgets = getBudgets()
  const transactions = store.get('transactions')

  return budgets.map((budget) => {
    const monthTransactions = transactions.filter((t) => t.budgetMonth === budget.month)
    const spentByCategory: Record<string, number> = {}
    monthTransactions.forEach((t) => {
      spentByCategory[t.categoryId] = (spentByCategory[t.categoryId] || 0) + t.amount
    })

    return {
      ...budget,
      allocations: budget.allocations.map((a) => ({
        ...a,
        spent: spentByCategory[a.categoryId] || 0
      }))
    }
  })
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

// ============== CSV Import Helpers ==============
export interface ImportBudgetAllocation {
  month: string
  incomeTotal: number
  categoryId: string
  planned: number
  spent: number
  carryover: number
}

export interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: string[]
}

// Import budgets from parsed CSV data
// If targetMonth is provided, all allocations will be imported to that month regardless of the CSV month
export function importBudgets(
  allocations: ImportBudgetAllocation[],
  targetMonth?: string
): ImportResult {
  const categories = store.get('categories')
  const categoryIds = new Set(categories.map((c) => c.id))
  const budgets = store.get('budgets')

  const errors: string[] = []
  let imported = 0
  let skipped = 0

  // Group allocations by month (or use target month for all)
  const allocationsByMonth = new Map<string, ImportBudgetAllocation[]>()
  for (const allocation of allocations) {
    // Validate category exists
    if (!categoryIds.has(allocation.categoryId)) {
      errors.push(`Unknown category ID: ${allocation.categoryId} for month ${allocation.month}`)
      skipped++
      continue
    }

    // Use targetMonth if provided, otherwise use the month from CSV
    const monthKey = targetMonth || allocation.month
    const existing = allocationsByMonth.get(monthKey) || []
    existing.push({ ...allocation, month: monthKey })
    allocationsByMonth.set(monthKey, existing)
  }

  // Process each month's data
  for (const [month, monthAllocations] of allocationsByMonth) {
    const existingBudget = budgets.find((b) => b.month === month)
    // Use the maximum incomeTotal from all allocations in this month (they should be consistent)
    const incomeTotal = Math.max(...monthAllocations.map((a) => a.incomeTotal), 0)

    const newAllocations: CategoryAllocation[] = monthAllocations.map((a) => ({
      categoryId: a.categoryId,
      planned: a.planned,
      spent: a.spent,
      carryover: a.carryover
    }))

    if (existingBudget) {
      // Merge with existing budget - update allocations that exist, add new ones
      const existingAllocMap = new Map(existingBudget.allocations.map((a) => [a.categoryId, a]))
      for (const newAlloc of newAllocations) {
        existingAllocMap.set(newAlloc.categoryId, newAlloc)
      }

      const mergedAllocations = Array.from(existingAllocMap.values())
      const totalPlanned = mergedAllocations.reduce((sum, a) => sum + a.planned, 0)

      const updatedBudget: Budget = {
        ...existingBudget,
        incomeTotal: incomeTotal > 0 ? incomeTotal : existingBudget.incomeTotal,
        allocations: mergedAllocations,
        isBalanced: (incomeTotal > 0 ? incomeTotal : existingBudget.incomeTotal) === totalPlanned,
        updatedAt: new Date().toISOString()
      }

      const idx = budgets.findIndex((b) => b.month === month)
      budgets[idx] = updatedBudget
      imported += monthAllocations.length
    } else {
      // Create new budget
      // Ensure all categories have allocations (fill missing with zeros)
      const allocMap = new Map(newAllocations.map((a) => [a.categoryId, a]))
      const fullAllocations: CategoryAllocation[] = categories.map((cat) => {
        const existing = allocMap.get(cat.id)
        return existing || { categoryId: cat.id, planned: 0, spent: 0, carryover: 0 }
      })

      const totalPlanned = fullAllocations.reduce((sum, a) => sum + a.planned, 0)

      const newBudget: Budget = {
        id: uuidv4(),
        month,
        incomeTotal,
        incomeSources: [
          { id: uuidv4(), name: 'Primary Income', planned: incomeTotal, received: 0 }
        ],
        allocations: fullAllocations,
        isBalanced: incomeTotal === totalPlanned,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      budgets.push(newBudget)
      imported += monthAllocations.length
    }
  }

  store.set('budgets', budgets)

  return {
    success: errors.length === 0,
    imported,
    skipped,
    errors
  }
}

// Import transactions from parsed CSV data
// If targetMonth is provided, all transactions will be imported to that month regardless of the CSV budgetMonth
export function importTransactions(
  transactions: Array<{
    budgetMonth: string
    categoryId: string
    amount: number
    description: string
    date: string
  }>,
  targetMonth?: string
): ImportResult {
  const categories = store.get('categories')
  const categoryIds = new Set(categories.map((c) => c.id))
  const existingTransactions = store.get('transactions')

  const errors: string[] = []
  let imported = 0
  let skipped = 0

  const newTransactions: Transaction[] = []

  for (const tx of transactions) {
    // Validate category exists
    if (!categoryIds.has(tx.categoryId)) {
      errors.push(`Unknown category ID: ${tx.categoryId} for transaction on ${tx.date}`)
      skipped++
      continue
    }

    // Check for duplicate (same date, category, amount, description)
    const isDuplicate = existingTransactions.some(
      (existing) =>
        existing.date === tx.date &&
        existing.categoryId === tx.categoryId &&
        existing.amount === tx.amount &&
        existing.description === tx.description
    )

    if (isDuplicate) {
      skipped++
      continue
    }

    const newTx: Transaction = {
      id: uuidv4(),
      budgetMonth: targetMonth || tx.budgetMonth,
      categoryId: tx.categoryId,
      amount: tx.amount,
      description: tx.description,
      date: tx.date,
      createdAt: new Date().toISOString()
    }

    newTransactions.push(newTx)
    imported++
  }

  if (newTransactions.length > 0) {
    store.set('transactions', [...existingTransactions, ...newTransactions])

    // Update budget spent amounts for affected months
    const affectedMonths = new Set(newTransactions.map((tx) => tx.budgetMonth))
    for (const month of affectedMonths) {
      updateBudgetSpentForMonth(month)
    }
  }

  return {
    success: errors.length === 0,
    imported,
    skipped,
    errors
  }
}

// Helper to update budget spent amounts for a specific month
function updateBudgetSpentForMonth(month: string): void {
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
