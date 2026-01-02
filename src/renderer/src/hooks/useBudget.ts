import { useState, useEffect, useCallback } from 'react'
import type {
  Budget,
  BudgetWithComputed,
  Category,
  Transaction,
  CategoryAllocation,
  IncomeSource,
  LearnedCategoryMapping
} from '../../../shared/types'

export function useBudgetIndex() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    // Use getBudgetsWithSpent to get computed spent values from transactions
    const list = await window.api.getBudgetsWithSpent()
    setBudgets(list.sort((a, b) => b.month.localeCompare(a.month)))
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { budgets, loading, refresh }
}

// Get current month key
export function getCurrentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Hook to manage the current month state
export function useCurrentMonth() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthKey())

  const goToPreviousMonth = useCallback(async () => {
    const prev = await window.api.getPreviousMonth(currentMonth)
    setCurrentMonth(prev)
  }, [currentMonth])

  const goToNextMonth = useCallback(async () => {
    const next = await window.api.getNextMonth(currentMonth)
    setCurrentMonth(next)
  }, [currentMonth])

  return {
    currentMonth,
    setCurrentMonth,
    goToPreviousMonth,
    goToNextMonth
  }
}

// Hook to manage categories
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    // Don't set loading=true during refresh to prevent scroll reset
    const cats = await window.api.getCategories()
    setCategories(cats)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addCategory = useCallback(
    async (category: Omit<Category, 'id'>) => {
      await window.api.addCategory(category)
      await refresh()
    },
    [refresh]
  )

  const deleteCategory = useCallback(
    async (id: string) => {
      await window.api.deleteCategory(id)
      await refresh()
    },
    [refresh]
  )

  const reorderCategories = useCallback(
    async (categoryIds: string[]) => {
      await window.api.reorderCategories(categoryIds)
      await refresh()
    },
    [refresh]
  )

  const updateCategory = useCallback(
    async (id: string, updates: Partial<Category>) => {
      await window.api.updateCategory(id, updates)
      await refresh()
    },
    [refresh]
  )

  return {
    categories,
    loading,
    refresh,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories
  }
}

// Hook to manage budget for a specific month
export function useBudget(month: string) {
  const [budget, setBudget] = useState<BudgetWithComputed | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    // Only show loading spinner on initial load, not during refreshes
    // This prevents scroll position reset when updating allocations
    const b = await window.api.getBudgetWithSpent(month)
    setBudget(b)
    setLoading(false)
  }, [month])

  // Reset loading when month changes
  useEffect(() => {
    setLoading(true)
    refresh()
  }, [month]) // eslint-disable-line react-hooks/exhaustive-deps

  const createBudget = useCallback(
    async (incomeTotal: number, copyFromMonth?: string) => {
      await window.api.createBudget(month, incomeTotal, copyFromMonth)
      await refresh()
    },
    [month, refresh]
  )

  const updateIncome = useCallback(
    async (incomeTotal: number) => {
      await window.api.updateBudget(month, { incomeTotal })
      await refresh()
    },
    [month, refresh]
  )

  const updateAllocation = useCallback(
    async (categoryId: string, planned: number) => {
      if (!budget) return
      const existingAllocation = budget.allocations.find((a) => a.categoryId === categoryId)
      let newAllocations
      if (existingAllocation) {
        // Update existing allocation
        newAllocations = budget.allocations.map((a) =>
          a.categoryId === categoryId ? { ...a, planned } : a
        )
      } else {
        // Create new allocation for this category
        newAllocations = [...budget.allocations, { categoryId, planned, spent: 0, carryover: 0 }]
      }
      await window.api.updateBudget(month, { allocations: newAllocations })
      await refresh()
    },
    [month, budget, refresh]
  )

  const removeCategoryFromBudget = useCallback(
    async (categoryId: string) => {
      await window.api.removeCategoryFromBudget(month, categoryId)
      await refresh()
    },
    [month, refresh]
  )

  const updateAllocations = useCallback(
    async (allocations: CategoryAllocation[]) => {
      await window.api.updateBudget(month, { allocations })
      await refresh()
    },
    [month, refresh]
  )

  const updateIncomeSources = useCallback(
    async (incomeSources: IncomeSource[]) => {
      const newTotal = incomeSources.reduce((sum, s) => sum + s.planned, 0)
      await window.api.updateBudget(month, { incomeSources, incomeTotal: newTotal })
      await refresh()
    },
    [month, refresh]
  )

  return {
    budget,
    loading,
    refresh,
    createBudget,
    updateIncome,
    updateAllocation,
    updateAllocations,
    updateIncomeSources,
    removeCategoryFromBudget
  }
}

// Hook to manage transactions for a specific month
export function useTransactions(month: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    // Don't set loading=true during refresh to prevent scroll reset
    try {
      const txns = await window.api.getTransactions(month)
      setTransactions(txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    } catch (err) {
      console.error('Failed to fetch transactions for month', month, err)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [month])

  // Reset loading when month changes
  useEffect(() => {
    setLoading(true)
    refresh()
  }, [month]) // eslint-disable-line react-hooks/exhaustive-deps

  const addTransaction = useCallback(
    async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
      try {
        await window.api.addTransaction(transaction)
        await refresh()
      } catch (err) {
        console.error('Failed to add transaction', err)
        throw err
      }
    },
    [refresh]
  )

  const updateTransaction = useCallback(
    async (id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => {
      try {
        await window.api.updateTransaction(id, updates)
        await refresh()
      } catch (err) {
        console.error('Failed to update transaction', id, err)
        throw err
      }
    },
    [refresh]
  )

  const deleteTransaction = useCallback(
    async (id: string) => {
      try {
        await window.api.deleteTransaction(id)
        await refresh()
      } catch (err) {
        console.error('Failed to delete transaction', id, err)
        throw err
      }
    },
    [refresh]
  )

  return {
    transactions,
    loading,
    refresh,
    addTransaction,
    updateTransaction,
    deleteTransaction
  }
}

// Hook for learned category mappings
export function useLearnedMappings() {
  const [learnedMappings, setLearnedMappings] = useState<LearnedCategoryMapping[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const mappings = await window.api.getLearnedMappings()
    setLearnedMappings(mappings)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { learnedMappings, loading, refresh }
}
