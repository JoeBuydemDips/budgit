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
  ChatMessage,
  ChatSession
} from '../shared/types'
import { learnCategoryMapping } from '../shared/categoryInference'

// Create the store with schema defaults
const store = new Store<StoreSchema>({
  name: 'budgit-data',
  defaults: {
    categories: DEFAULT_CATEGORIES,
    budgets: [],
    transactions: [],
    settings: DEFAULT_SETTINGS,
    learnedMappings: [],
    chatSessions: [],
    currentSessionId: null
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

  // Clean up allocations in all budgets
  const budgets = store.get('budgets')
  const updatedBudgets = budgets.map((budget) => {
    const filteredAllocations = budget.allocations.filter((a) => a.categoryId !== id)
    if (filteredAllocations.length !== budget.allocations.length) {
      const totalPlanned = filteredAllocations.reduce((sum, a) => sum + a.planned, 0)
      return {
        ...budget,
        allocations: filteredAllocations,
        isBalanced: budget.incomeTotal === totalPlanned,
        updatedAt: new Date().toISOString()
      }
    }
    return budget
  })
  store.set('budgets', updatedBudgets)
  return true
}

export function removeCategoryFromBudget(month: string, categoryId: string): boolean {
  const budget = getBudgetByMonth(month)
  if (!budget) return false

  const filteredAllocations = budget.allocations.filter((a) => a.categoryId !== categoryId)
  if (filteredAllocations.length === budget.allocations.length) return false

  updateBudget(month, { allocations: filteredAllocations })
  return true
}

export function cleanupOrphanedAllocations(): {
  cleanedBudgets: number
  removedAllocations: number
} {
  const categories = store.get('categories')
  const categoryIds = new Set(categories.map((c) => c.id))
  const budgets = store.get('budgets')
  let cleanedBudgets = 0
  let removedAllocations = 0

  const updatedBudgets = budgets.map((budget) => {
    const originalLength = budget.allocations.length
    const filteredAllocations = budget.allocations.filter((a) => categoryIds.has(a.categoryId))
    const removed = originalLength - filteredAllocations.length
    if (removed > 0) {
      cleanedBudgets++
      removedAllocations += removed
      const totalPlanned = filteredAllocations.reduce((sum, a) => sum + a.planned, 0)
      return {
        ...budget,
        allocations: filteredAllocations,
        isBalanced: budget.incomeTotal === totalPlanned,
        updatedAt: new Date().toISOString()
      }
    }
    return budget
  })

  store.set('budgets', updatedBudgets)
  return { cleanedBudgets, removedAllocations }
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

// Helper to get or create the "Uncategorized" category for transactions with unmatched categories
function getOrCreateUncategorizedCategory(): string {
  const categories = store.get('categories')
  const existing = categories.find((c) => c.name === 'Uncategorized')
  if (existing) return existing.id

  const newCategory: Category = {
    id: uuidv4(),
    name: 'Uncategorized',
    type: 'MISC',
    rolloverEnabled: false,
    sortOrder: categories.length
  }
  store.set('categories', [...categories, newCategory])
  return newCategory.id
}

// Common category name aliases for better matching
const CATEGORY_ALIASES: Record<string, string[]> = {
  Groceries: ['Grocery', 'Groc', 'Food'],
  Transportation: ['Gas', 'Fuel', 'Car', 'Auto', 'Vehicle'],
  Housing: ['Rent', 'Mortgage', 'Home'],
  Utilities: ['Electric', 'Electricity', 'Water', 'Gas Bill', 'Internet', 'Phone'],
  Entertainment: ['Fun', 'Movies', 'Games'],
  'Dining Out': ['Restaurant', 'Eat Out', 'Food Out'],
  Savings: ['Save', 'Emergency Fund'],
  Debt: ['Loan', 'Credit Card', 'Payment'],
  Giving: ['Church', 'Charity', 'Donation'],
  Wants: ['Lifestyle', 'Personal'],
  Needs: ['Essentials', 'Necessities'],
  Miscellaneous: ['Misc', 'Other', 'Various', 'Sundry']
}

// Helper to find the best matching category, including aliases
function findMatchingCategory(categoryName: string, categories: Category[]): string | null {
  const normalizedInput = categoryName.toLowerCase().trim()

  // Exact match (case-insensitive)
  const exactMatch = categories.find((c) => c.name.toLowerCase() === normalizedInput)
  if (exactMatch) return exactMatch.id

  // Check aliases
  for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((alias) => alias.toLowerCase() === normalizedInput)) {
      const category = categories.find((c) => c.name === canonical)
      if (category) return category.id
    }
  }

  // Fuzzy match: check if input contains category name or vice versa
  for (const category of categories) {
    const normalizedCategory = category.name.toLowerCase()
    if (
      normalizedInput.includes(normalizedCategory) ||
      normalizedCategory.includes(normalizedInput)
    ) {
      return category.id
    }
  }

  return null
}

// Import transactions from parsed CSV data
// If targetMonth is provided, all transactions will be imported to that month regardless of the CSV budgetMonth
export function importTransactions(
  transactions: Array<{
    budgetMonth: string
    categoryName: string
    amount: number
    description: string
    date: string
    card?: string
  }>,
  targetMonth?: string
): ImportResult {
  const categories = store.get('categories')
  const uncategorizedCategoryId = getOrCreateUncategorizedCategory()
  const existingTransactions = store.get('transactions')

  const errors: string[] = []
  let imported = 0
  let skipped = 0

  const newTransactions: Transaction[] = []

  for (const tx of transactions) {
    // Find matching category with improved matching
    let categoryId = findMatchingCategory(tx.categoryName, categories)

    // For income transactions (positive amounts), prioritize income categories
    if (!categoryId && tx.amount > 0) {
      // This is an income transaction - try to match against income categories
      const incomeCategories = categories.filter(
        (cat) =>
          cat.name.toLowerCase().includes('income') ||
          cat.name.toLowerCase().includes('salary') ||
          cat.name.toLowerCase().includes('payroll') ||
          cat.name.toLowerCase().includes('freelance') ||
          cat.name.toLowerCase().includes('dividend') ||
          cat.name.toLowerCase().includes('interest') ||
          cat.name.toLowerCase().includes('investment')
      )

      // Try fuzzy matching against income categories
      for (const incomeCat of incomeCategories) {
        const normalizedDesc = tx.description.toLowerCase()
        const normalizedCatName = incomeCat.name.toLowerCase()

        if (
          normalizedDesc.includes(normalizedCatName) ||
          normalizedCatName.includes(normalizedDesc) ||
          // Check for common income keywords in description
          (normalizedDesc.includes('deposit') && normalizedCatName.includes('salary')) ||
          (normalizedDesc.includes('payroll') && normalizedCatName.includes('salary')) ||
          (normalizedDesc.includes('direct deposit') && normalizedCatName.includes('salary'))
        ) {
          categoryId = incomeCat.id
          break
        }
      }
    }

    if (!categoryId) {
      // Assign to Uncategorized category for manual assignment
      categoryId = uncategorizedCategoryId
    }

    // Check for duplicate (same date, category, amount, description, card)
    const isDuplicate = existingTransactions.some(
      (existing) =>
        existing.date === tx.date &&
        existing.categoryId === categoryId &&
        existing.amount === tx.amount &&
        existing.description === tx.description &&
        existing.card === tx.card
    )

    if (isDuplicate) {
      skipped++
      continue
    }

    const newTx: Transaction = {
      id: uuidv4(),
      budgetMonth: targetMonth || tx.budgetMonth,
      categoryId,
      amount: tx.amount,
      description: tx.description,
      date: tx.date,
      createdAt: new Date().toISOString(),
      card: tx.card
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

// Learn category mapping from user correction
export function learnTransactionCategory(transactionId: string, categoryId: string): void {
  const transactions = store.get('transactions')
  const transaction = transactions.find((t) => t.id === transactionId)
  if (!transaction) return

  const categories = store.get('categories')
  const category = categories.find((c) => c.id === categoryId)
  if (!category) return

  // Update the transaction's category
  const updatedTransactions = transactions.map((t) =>
    t.id === transactionId ? { ...t, categoryId } : t
  )
  store.set('transactions', updatedTransactions)

  // Learn the mapping
  let learnedMappings = store.get('learnedMappings')
  learnedMappings = learnCategoryMapping(transaction.description, categoryId, learnedMappings)
  store.set('learnedMappings', learnedMappings)

  // Update budget spent amounts for affected months
  updateBudgetSpentForMonth(transaction.budgetMonth)
}

// Get learned category mappings
export function getLearnedMappings() {
  return store.get('learnedMappings')
}

// ============== Chat Sessions ==============
export function getChatSessions(): ChatSession[] {
  return store.get('chatSessions') || []
}

export function getCurrentSessionId(): string | null {
  return store.get('currentSessionId')
}

export function createChatSession(): ChatSession {
  const session: ChatSession = {
    id: uuidv4(),
    title: 'New Chat',
    messages: [],
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  }
  const sessions = store.get('chatSessions') || []
  sessions.push(session)
  store.set('chatSessions', sessions)
  store.set('currentSessionId', session.id)
  return session
}

export function getChatSession(sessionId: string): ChatSession | null {
  const sessions = store.get('chatSessions') || []
  return sessions.find((s) => s.id === sessionId) || null
}

export function setCurrentSession(sessionId: string): void {
  store.set('currentSessionId', sessionId)
}

export function saveChatMessage(sessionId: string, message: ChatMessage): void {
  const sessions = store.get('chatSessions') || []
  const sessionIndex = sessions.findIndex((s) => s.id === sessionId)

  if (sessionIndex === -1) return

  sessions[sessionIndex].messages.push(message)
  sessions[sessionIndex].lastUpdated = new Date().toISOString()

  // Update title from first user message if still "New Chat"
  if (sessions[sessionIndex].title === 'New Chat' && message.role === 'user') {
    // Clean up title: remove question words and limit length
    let title = message.content.trim()
    // Strip leading question words for cleaner titles
    const questionWords = /^(where|what|how|why|can|is|are|do|does|would|could|should|when|who|which)\s+/i
    title = title.replace(questionWords, '')
    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1)
    // Limit to 35 characters
    title = title.slice(0, 35) + (title.length > 35 ? '...' : '')
    sessions[sessionIndex].title = title
  }

  store.set('chatSessions', sessions)
}

export function renameChatSession(sessionId: string, newTitle: string): void {
  const sessions = store.get('chatSessions') || []
  const sessionIndex = sessions.findIndex((s) => s.id === sessionId)

  if (sessionIndex === -1) return

  sessions[sessionIndex].title = newTitle
  sessions[sessionIndex].lastUpdated = new Date().toISOString()
  store.set('chatSessions', sessions)
}

export function deleteChatSession(sessionId: string): void {
  const sessions = store.get('chatSessions') || []
  const filtered = sessions.filter((s) => s.id !== sessionId)
  store.set('chatSessions', filtered)

  // If we deleted the current session, clear it
  if (store.get('currentSessionId') === sessionId) {
    store.set('currentSessionId', null)
  }
}

export function clearAllChatSessions(): void {
  store.set('chatSessions', [])
  store.set('currentSessionId', null)
}
