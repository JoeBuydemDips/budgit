import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'
import {
  StoreSchema,
  Budget,
  Transaction,
  BudgetItem,
  AppSettings,
  BudgetWithComputed,
  DEFAULT_ITEMS,
  DEFAULT_SETTINGS,
  Allocation,
  ChatMessage,
  ChatSession,
  CsvImportProfile
} from '../shared/types'
import { learnItemMapping } from '../shared/categoryInference'

// Migration: Convert old 'categories' key to 'items' and update allocations
// This migration runs ONCE and stores a version flag to prevent re-running
function migrateStore(storeInstance: Store<StoreSchema>): void {
  // Check if migration has already been completed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawData = storeInstance.store as any

  // If migration is already done (version 2+), skip everything
  if (rawData.migrationVersion && rawData.migrationVersion >= 2) {
    return
  }

  console.log('Running one-time data migration...')

  // Migrate categories -> items (if categories exists with data, use it instead of defaults)
  if (
    'categories' in rawData &&
    Array.isArray(rawData.categories) &&
    rawData.categories.length > 0
  ) {
    console.log('Migrating categories to items...')
    storeInstance.set('items', rawData.categories as BudgetItem[])
    // Properly delete the old key from the store file
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(storeInstance as any).delete('categories')
  }

  // Migrate items: type -> group (old terminology)
  const currentItems = storeInstance.get('items')
  let needsItemMigration = false
  const migratedItems = currentItems.map((item) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawItem = item as any
    if ('type' in rawItem && !('group' in rawItem)) {
      needsItemMigration = true
      const { type, ...rest } = rawItem
      return { ...rest, group: type }
    }
    return item
  })

  if (needsItemMigration) {
    console.log('Migrating items from type to group...')
    storeInstance.set('items', migratedItems)
  }

  // Migrate allocations: categoryId -> itemId
  const budgets = storeInstance.get('budgets')
  let needsBudgetMigration = false
  const migratedBudgets = budgets.map((budget) => {
    const migratedAllocations = budget.allocations.map((alloc) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawAlloc = alloc as any
      if ('categoryId' in rawAlloc && !('itemId' in rawAlloc)) {
        needsBudgetMigration = true
        return {
          ...alloc,
          itemId: rawAlloc.categoryId as string
        }
      }
      return alloc
    })
    return { ...budget, allocations: migratedAllocations }
  })

  if (needsBudgetMigration) {
    console.log('Migrating budget allocations from categoryId to itemId...')
    storeInstance.set('budgets', migratedBudgets)
  }

  // Migrate learnedMappings: categoryId -> itemId
  const mappings = storeInstance.get('learnedMappings')
  let needsMappingMigration = false
  const migratedMappings = mappings.map((mapping) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMapping = mapping as any
    if ('categoryId' in rawMapping && !('itemId' in rawMapping)) {
      needsMappingMigration = true
      return {
        ...mapping,
        itemId: rawMapping.categoryId as string
      }
    }
    return mapping
  })

  if (needsMappingMigration) {
    console.log('Migrating learned mappings from categoryId to itemId...')
    storeInstance.set('learnedMappings', migratedMappings)
  }

  // Migrate transactions: categoryId -> itemId
  const transactions = storeInstance.get('transactions')
  let needsTransactionMigration = false
  const migratedTransactions = transactions.map((tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawTx = tx as any
    if ('categoryId' in rawTx && !('itemId' in rawTx)) {
      needsTransactionMigration = true
      return {
        ...tx,
        itemId: rawTx.categoryId as string
      }
    }
    return tx
  })

  if (needsTransactionMigration) {
    console.log('Migrating transactions from categoryId to itemId...')
    storeInstance.set('transactions', migratedTransactions)
  }

  // Recovery: Find orphaned item references and create placeholder items for them
  const items = storeInstance.get('items')
  const itemIds = new Set(items.map((item) => item.id))
  const orphanedIds = new Set<string>()

  // Find orphaned allocations
  for (const budget of storeInstance.get('budgets')) {
    for (const alloc of budget.allocations) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = (alloc as any).itemId || (alloc as any).categoryId
      if (id && !itemIds.has(id)) {
        orphanedIds.add(id)
      }
    }
  }

  // Find orphaned transactions
  for (const tx of storeInstance.get('transactions')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const id = (tx as any).itemId || (tx as any).categoryId
    if (id && !itemIds.has(id)) {
      orphanedIds.add(id)
    }
  }

  // Create placeholder items for orphans so they show in the UI
  if (orphanedIds.size > 0) {
    console.log(`Creating ${orphanedIds.size} placeholder items for orphaned references...`)
    const newItems = [...items]
    let sortOrder = items.length
    for (const orphanId of orphanedIds) {
      newItems.push({
        id: orphanId,
        name: `Recovered Item (${orphanId.slice(0, 8)})`,
        group: 'MISC',
        rolloverEnabled: false,
        sortOrder: sortOrder++
      })
    }
    storeInstance.set('items', newItems)
    console.log('Placeholder items created. Please rename them in Settings.')
  }

  // Mark migration as complete so it doesn't run again
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(storeInstance as any).set('migrationVersion', 2)
  console.log('Migration complete.')
}

// Create the store with schema defaults
// Note: Internal storage uses legacy keys for backward compatibility
const store = new Store<StoreSchema>({
  name: 'budgit-data',
  defaults: {
    items: DEFAULT_ITEMS,
    budgets: [],
    transactions: [],
    settings: DEFAULT_SETTINGS,
    learnedMappings: [],
    chatSessions: [],
    currentSessionId: null,
    csvImportProfiles: []
  }
})

// Run migration on startup
migrateStore(store)

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

// ============== Budget Items ==============
export function getItems(): BudgetItem[] {
  return store.get('items').sort((a, b) => a.sortOrder - b.sortOrder)
}

export function addItem(item: Omit<BudgetItem, 'id'>): BudgetItem {
  const items = store.get('items')
  const newItem: BudgetItem = {
    ...item,
    id: uuidv4()
  }
  store.set('items', [...items, newItem])
  return newItem
}

export function updateItem(id: string, updates: Partial<BudgetItem>): BudgetItem | null {
  const items = store.get('items')
  const index = items.findIndex((c) => c.id === id)
  if (index === -1) return null

  const updated = { ...items[index], ...updates }
  items[index] = updated
  store.set('items', items)
  return updated
}

export function deleteItem(id: string): boolean {
  const items = store.get('items')
  const filtered = items.filter((c) => c.id !== id)
  if (filtered.length === items.length) return false
  store.set('items', filtered)

  // Clean up allocations in all budgets
  const budgets = store.get('budgets')
  const updatedBudgets = budgets.map((budget) => {
    const filteredAllocations = budget.allocations.filter((a) => a.itemId !== id)
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

export function removeItemFromBudget(month: string, itemId: string): boolean {
  const budget = getBudgetByMonth(month)
  if (!budget) return false

  const filteredAllocations = budget.allocations.filter((a) => a.itemId !== itemId)
  if (filteredAllocations.length === budget.allocations.length) return false

  updateBudget(month, { allocations: filteredAllocations })
  return true
}

export function cleanupOrphanedAllocations(): {
  cleanedBudgets: number
  removedAllocations: number
} {
  const items = store.get('items')
  const itemIds = new Set(items.map((c) => c.id))
  const budgets = store.get('budgets')
  let cleanedBudgets = 0
  let removedAllocations = 0

  const updatedBudgets = budgets.map((budget) => {
    const originalLength = budget.allocations.length
    const filteredAllocations = budget.allocations.filter((a) => itemIds.has(a.itemId))
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

export function reorderItems(itemIds: string[]): void {
  const items = store.get('items')
  const updated = items.map((item) => {
    const newIndex = itemIds.indexOf(item.id)
    if (newIndex !== -1) {
      return { ...item, sortOrder: newIndex }
    }
    return item
  })
  store.set('items', updated)
}

export interface ImportItemsResult {
  success: boolean
  imported: number
  updated: number
  errors: string[]
}

export interface ImportItemData {
  id: string
  name: string
  group: BudgetItem['group']
  rolloverEnabled: boolean
  sortOrder: number
}

export function importItems(
  itemsToImport: ImportItemData[],
  mode: 'merge' | 'replace' = 'merge'
): ImportItemsResult {
  const existingItems = store.get('items')
  const existingIds = new Set(existingItems.map((c) => c.id))

  const errors: string[] = []
  let imported = 0
  let updated = 0

  if (mode === 'replace') {
    // Replace all items
    const newItems: BudgetItem[] = itemsToImport.map((c) => ({
      id: c.id,
      name: c.name,
      group: c.group,
      rolloverEnabled: c.rolloverEnabled,
      sortOrder: c.sortOrder
    }))
    store.set('items', newItems)
    imported = newItems.length
  } else {
    // Merge - update existing, add new
    const itemMap = new Map(existingItems.map((c) => [c.id, c]))

    for (const item of itemsToImport) {
      if (existingIds.has(item.id)) {
        // Update existing
        itemMap.set(item.id, {
          id: item.id,
          name: item.name,
          group: item.group,
          rolloverEnabled: item.rolloverEnabled,
          sortOrder: item.sortOrder
        })
        updated++
      } else {
        // Add new
        itemMap.set(item.id, {
          id: item.id,
          name: item.name,
          group: item.group,
          rolloverEnabled: item.rolloverEnabled,
          sortOrder: item.sortOrder
        })
        imported++
      }
    }

    store.set('items', Array.from(itemMap.values()))
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
  const items = store.get('items')
  const transactions = store.get('transactions')

  // Check if budget already exists for this month
  const existing = budgets.find((b) => b.month === month)
  if (existing) {
    return existing
  }

  let allocations: Allocation[]
  let incomeSources: Budget['incomeSources']

  if (copyFromMonth) {
    // Copy allocations from previous month
    const previousBudget = budgets.find((b) => b.month === copyFromMonth)
    if (previousBudget) {
      // Calculate spent amounts for previous month
      const previousTransactions = transactions.filter((t) => t.budgetMonth === copyFromMonth)

      // Copy income sources and reset received; keep structure familiar to the user
      incomeSources = previousBudget.incomeSources.map((src) => ({
        ...src,
        received: 0
      }))

      // Keep incomeTotal in sync with sources while respecting user input
      const sourcesPlannedTotal = incomeSources.reduce((sum, src) => sum + src.planned, 0)
      if (incomeSources.length === 0) {
        incomeSources = [
          { id: uuidv4(), name: 'Primary Income', planned: incomeTotal, received: 0 }
        ]
      } else {
        const restPlanned = sourcesPlannedTotal - incomeSources[0].planned
        const adjustedFirstPlanned = Math.max(0, incomeTotal - restPlanned)
        incomeSources[0] = { ...incomeSources[0], planned: adjustedFirstPlanned }
        incomeTotal = adjustedFirstPlanned + restPlanned
      }

      allocations = items.map((item) => {
        const prevAllocation = previousBudget.allocations.find((a) => a.itemId === item.id)
        const prevSpent = previousTransactions
          .filter((t) => t.itemId === item.id)
          .reduce((sum, t) => sum + t.amount, 0)

        // Calculate carryover (only positive, only if rollover enabled)
        let carryover = 0
        if (item.rolloverEnabled && prevAllocation) {
          const remaining = prevAllocation.planned - prevSpent
          carryover = Math.max(0, remaining)
        }

        return {
          itemId: item.id,
          planned: prevAllocation?.planned || 0,
          spent: 0,
          carryover
        }
      })
    } else {
      // No previous budget found, start fresh
      incomeSources = [{ id: uuidv4(), name: 'Primary Income', planned: incomeTotal, received: 0 }]
      allocations = items.map((item) => ({
        itemId: item.id,
        planned: 0,
        spent: 0,
        carryover: 0
      }))
    }
  } else {
    // Start fresh
    incomeSources = [{ id: uuidv4(), name: 'Primary Income', planned: incomeTotal, received: 0 }]
    allocations = items.map((item) => ({
      itemId: item.id,
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
    incomeSources,
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

// Unassign a transaction from its category (move to uncategorized)
export function unassignTransaction(id: string): Transaction | null {
  const transactions = store.get('transactions')
  const index = transactions.findIndex((t) => t.id === id)
  if (index === -1) return null

  const oldTransaction = transactions[index]
  const uncategorizedItemId = getOrCreateUncategorizedItem()

  const updated: Transaction = {
    ...oldTransaction,
    itemId: uncategorizedItemId
  }

  transactions[index] = updated
  store.set('transactions', transactions)

  // Update spent amount in budget (recalculates allocations)
  updateBudgetSpent(oldTransaction.budgetMonth)

  return updated
}

// Helper to recalculate spent amounts in a budget
function updateBudgetSpent(month: string): void {
  const budgets = store.get('budgets')
  const transactions = store.get('transactions')
  const index = budgets.findIndex((b) => b.month === month)
  if (index === -1) return

  const monthTransactions = transactions.filter((t) => t.budgetMonth === month)
  const budget = budgets[index]

  // Calculate spent for existing allocations
  const updatedAllocations = budget.allocations.map((allocation) => {
    const spent = monthTransactions
      .filter((t) => t.itemId === allocation.itemId)
      .reduce((sum, t) => sum + t.amount, 0)
    return { ...allocation, spent }
  })

  // Find items with transactions that don't have allocations yet
  const existingItemIds = new Set(budget.allocations.map((a) => a.itemId))
  const itemsWithSpending = new Set(monthTransactions.map((t) => t.itemId))

  for (const itemId of itemsWithSpending) {
    if (!existingItemIds.has(itemId)) {
      // Add a new allocation for this item with spent amount
      const spent = monthTransactions
        .filter((t) => t.itemId === itemId)
        .reduce((sum, t) => sum + t.amount, 0)
      updatedAllocations.push({
        itemId,
        planned: 0,
        spent,
        carryover: 0
      })
    }
  }

  budgets[index] = {
    ...budget,
    allocations: updatedAllocations,
    updatedAt: new Date().toISOString()
  }
  store.set('budgets', budgets)
}

// ============== Computed helpers ==============
function getUncategorizedItemIds(): Set<string> {
  const items = store.get('items')
  return new Set(
    items.filter((c) => c.name.toLowerCase().includes('uncategorized')).map((c) => c.id)
  )
}

export function getBudgetWithSpent(month: string): BudgetWithComputed | null {
  const budget = getBudgetByMonth(month)
  if (!budget) return null

  const transactions = getTransactionsByMonth(month)
  const items = store.get('items')
  const itemById = new Map(items.map((c) => [c.id, c]))
  const uncategorizedItemIds = getUncategorizedItemIds()

  const spentByItem: Record<string, number> = {}
  const totals = transactions.reduce(
    (acc, t) => {
      // Only count positive amounts as spending (negative amounts are income/credits)
      if (t.amount > 0) {
        spentByItem[t.itemId] = (spentByItem[t.itemId] || 0) + t.amount
        acc.totalSpentAll += t.amount

        const item = t.itemId ? itemById.get(t.itemId) : undefined
        const isUncategorized = !item || uncategorizedItemIds.has(t.itemId) || t.itemId === ''

        if (isUncategorized) {
          acc.uncategorizedSpent += t.amount
        } else {
          acc.totalSpentCategorized += t.amount
        }
      }
      return acc
    },
    { totalSpentAll: 0, totalSpentCategorized: 0, uncategorizedSpent: 0 }
  )

  const totalPlanned = budget.allocations.reduce((sum, a) => sum + a.planned, 0)
  const leftToBudget = budget.incomeTotal - totalPlanned

  const available: Record<string, number> = {}
  budget.allocations.forEach((a) => {
    const spent = spentByItem[a.itemId] || 0
    available[a.itemId] = a.planned + a.carryover - spent
  })

  return {
    ...budget,
    allocations: budget.allocations.map((a) => ({
      ...a,
      spent: spentByItem[a.itemId] || 0
    })),
    computed: {
      totalSpent: totals.totalSpentCategorized,
      totalSpentCategorized: totals.totalSpentCategorized,
      totalSpentAll: totals.totalSpentAll,
      uncategorizedSpent: totals.uncategorizedSpent,
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
    const spentByItem: Record<string, number> = {}
    monthTransactions.forEach((t) => {
      spentByItem[t.itemId] = (spentByItem[t.itemId] || 0) + t.amount
    })

    return {
      ...budget,
      allocations: budget.allocations.map((a) => ({
        ...a,
        spent: spentByItem[a.itemId] || 0
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
  itemId: string
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
  const items = store.get('items')
  const itemIds = new Set(items.map((c) => c.id))
  const budgets = store.get('budgets')

  const errors: string[] = []
  let imported = 0
  let skipped = 0

  // Group allocations by month (or use target month for all)
  const allocationsByMonth = new Map<string, ImportBudgetAllocation[]>()
  for (const allocation of allocations) {
    // Validate item exists
    if (!itemIds.has(allocation.itemId)) {
      errors.push(`Unknown item ID: ${allocation.itemId} for month ${allocation.month}`)
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

    const newAllocations: Allocation[] = monthAllocations.map((a) => ({
      itemId: a.itemId,
      planned: a.planned,
      spent: a.spent,
      carryover: a.carryover
    }))

    if (existingBudget) {
      // Merge with existing budget - update allocations that exist, add new ones
      const existingAllocMap = new Map(existingBudget.allocations.map((a) => [a.itemId, a]))
      for (const newAlloc of newAllocations) {
        existingAllocMap.set(newAlloc.itemId, newAlloc)
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
      // Ensure all items have allocations (fill missing with zeros)
      const allocMap = new Map(newAllocations.map((a) => [a.itemId, a]))
      const fullAllocations: Allocation[] = items.map((item) => {
        const existing = allocMap.get(item.id)
        return existing || { itemId: item.id, planned: 0, spent: 0, carryover: 0 }
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

// Helper to get or create the "Uncategorized" item for transactions with unmatched items
function getOrCreateUncategorizedItem(): string {
  const items = store.get('items')
  const existing = items.find((c) => c.name === 'Uncategorized')
  if (existing) return existing.id

  const newItem: BudgetItem = {
    id: uuidv4(),
    name: 'Uncategorized',
    group: 'MISC',
    rolloverEnabled: false,
    sortOrder: items.length
  }
  store.set('items', [...items, newItem])
  return newItem.id
}

// Common item name aliases for better matching
const ITEM_ALIASES: Record<string, string[]> = {
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

// Helper to find the best matching item, including aliases
function findMatchingItem(itemName: string, items: BudgetItem[]): string | null {
  const normalizedInput = itemName.toLowerCase().trim()

  // Exact match (case-insensitive)
  const exactMatch = items.find((c) => c.name.toLowerCase() === normalizedInput)
  if (exactMatch) return exactMatch.id

  // Check aliases
  for (const [canonical, aliases] of Object.entries(ITEM_ALIASES)) {
    if (aliases.some((alias) => alias.toLowerCase() === normalizedInput)) {
      const item = items.find((c) => c.name === canonical)
      if (item) return item.id
    }
  }

  // Fuzzy match: check if input contains item name or vice versa
  for (const item of items) {
    const normalizedItem = item.name.toLowerCase()
    if (normalizedInput.includes(normalizedItem) || normalizedItem.includes(normalizedInput)) {
      return item.id
    }
  }

  return null
}

// Import transactions from parsed CSV data
// If targetMonth is provided, all transactions will be imported to that month regardless of the CSV budgetMonth
export function importTransactions(
  transactions: Array<{
    budgetMonth: string
    itemName: string
    amount: number
    description: string
    date: string
    card?: string
  }>,
  targetMonth?: string
): ImportResult {
  const items = store.get('items')
  const uncategorizedItemId = getOrCreateUncategorizedItem()
  const existingTransactions = store.get('transactions')

  const errors: string[] = []
  let imported = 0
  let skipped = 0

  const newTransactions: Transaction[] = []

  for (const tx of transactions) {
    // Find matching item with improved matching
    let itemId = findMatchingItem(tx.itemName, items)

    // For income transactions (positive amounts), prioritize income items
    if (!itemId && tx.amount > 0) {
      // This is an income transaction - try to match against income items
      const incomeItems = items.filter(
        (itm) =>
          itm.name.toLowerCase().includes('income') ||
          itm.name.toLowerCase().includes('salary') ||
          itm.name.toLowerCase().includes('payroll') ||
          itm.name.toLowerCase().includes('freelance') ||
          itm.name.toLowerCase().includes('dividend') ||
          itm.name.toLowerCase().includes('interest') ||
          itm.name.toLowerCase().includes('investment')
      )

      // Try fuzzy matching against income items
      for (const incomeItem of incomeItems) {
        const normalizedDesc = tx.description.toLowerCase()
        const normalizedItemName = incomeItem.name.toLowerCase()

        if (
          normalizedDesc.includes(normalizedItemName) ||
          normalizedItemName.includes(normalizedDesc) ||
          // Check for common income keywords in description
          (normalizedDesc.includes('deposit') && normalizedItemName.includes('salary')) ||
          (normalizedDesc.includes('payroll') && normalizedItemName.includes('salary')) ||
          (normalizedDesc.includes('direct deposit') && normalizedItemName.includes('salary'))
        ) {
          itemId = incomeItem.id
          break
        }
      }
    }

    if (!itemId) {
      // Assign to Uncategorized item for manual assignment
      itemId = uncategorizedItemId
    }

    // Check for duplicate (same date, item, amount, description, card)
    const isDuplicate = existingTransactions.some(
      (existing) =>
        existing.date === tx.date &&
        existing.itemId === itemId &&
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
      itemId,
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
      .filter((t) => t.itemId === allocation.itemId)
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

// Learn item mapping from user correction
export function learnTransactionItem(transactionId: string, itemId: string): void {
  const transactions = store.get('transactions')
  const transaction = transactions.find((t) => t.id === transactionId)
  if (!transaction) return

  const items = store.get('items')
  const item = items.find((c) => c.id === itemId)
  if (!item) return

  // Update the transaction's item
  const updatedTransactions = transactions.map((t) =>
    t.id === transactionId ? { ...t, itemId } : t
  )
  store.set('transactions', updatedTransactions)

  // Learn the mapping
  let learnedMappings = store.get('learnedMappings')
  learnedMappings = learnItemMapping(transaction.description, itemId, learnedMappings)
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
    const questionWords =
      /^(where|what|how|why|can|is|are|do|does|would|could|should|when|who|which)\s+/i
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

// ============== CSV Import Profiles ==============
export function getCsvImportProfiles(): CsvImportProfile[] {
  return store.get('csvImportProfiles') || []
}

export function getCsvImportProfile(id: string): CsvImportProfile | null {
  const profiles = store.get('csvImportProfiles') || []
  return profiles.find((p) => p.id === id) || null
}

export function addCsvImportProfile(
  profile: Omit<CsvImportProfile, 'id' | 'createdAt' | 'updatedAt'>
): CsvImportProfile {
  const profiles = store.get('csvImportProfiles') || []
  const now = new Date().toISOString()
  const newProfile: CsvImportProfile = {
    ...profile,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now
  }
  store.set('csvImportProfiles', [...profiles, newProfile])
  return newProfile
}

export function updateCsvImportProfile(
  id: string,
  updates: Partial<Omit<CsvImportProfile, 'id' | 'createdAt'>>
): CsvImportProfile | null {
  const profiles = store.get('csvImportProfiles') || []
  const index = profiles.findIndex((p) => p.id === id)
  if (index === -1) return null

  const updated: CsvImportProfile = {
    ...profiles[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }
  profiles[index] = updated
  store.set('csvImportProfiles', profiles)
  return updated
}

export function deleteCsvImportProfile(id: string): boolean {
  const profiles = store.get('csvImportProfiles') || []
  const filtered = profiles.filter((p) => p.id !== id)
  if (filtered.length === profiles.length) return false
  store.set('csvImportProfiles', filtered)
  return true
}
