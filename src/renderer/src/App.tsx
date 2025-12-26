import { useState } from 'react'
import { Header } from '@/components/Header'
import { Navigation, ViewType } from '@/components/Navigation'
import { Dashboard } from '@/views/Dashboard'
import { BudgetView } from '@/views/BudgetView'
import { TransactionsView } from '@/views/TransactionsView'
import { SettingsView } from '@/views/SettingsView'
import {
  useCurrentMonth,
  useCategories,
  useBudget,
  useTransactions,
  useBudgetIndex,
  getCurrentMonthKey
} from '@/hooks/useBudget'
import { BudgetManagerDialog } from '@/components/BudgetManagerDialog'

function App(): React.JSX.Element {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showBudgetManager, setShowBudgetManager] = useState(false)
  const { currentMonth, setCurrentMonth, goToPreviousMonth, goToNextMonth } = useCurrentMonth()
  const { categories, refresh: refreshCategories } = useCategories()
  const { budgets, loading: budgetsLoading, refresh: refreshBudgets } = useBudgetIndex()
  const {
    budget,
    loading: budgetLoading,
    refresh: refreshBudget,
    createBudget,
    updateIncome,
    updateAllocation
  } = useBudget(currentMonth)
  const {
    transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction
  } = useTransactions(currentMonth)

  // Refresh budget when transactions change
  const handleAddTransaction = async (transaction: Parameters<typeof addTransaction>[0]) => {
    await addTransaction(transaction)
    await refreshBudget()
  }

  const handleUpdateTransaction = async (
    id: string,
    updates: Parameters<typeof updateTransaction>[1]
  ) => {
    await updateTransaction(id, updates)
    await refreshBudget()
  }

  const handleDeleteTransaction = async (id: string) => {
    await deleteTransaction(id)
    await refreshBudget()
  }

  const handleSelectMonth = (month: string) => {
    setCurrentMonth(month)
  }

  const handleCreateBudgetForMonth = async (
    month: string,
    incomeTotal: number,
    copyFromMonth?: string
  ) => {
    await window.api.createBudget(month, incomeTotal, copyFromMonth)
    await refreshBudgets()
    setCurrentMonth(month)
  }

  const handleDeleteBudget = async (month: string) => {
    await window.api.deleteBudget(month)
    const next = await window.api.getBudgets()
    await refreshBudgets()

    if (month === currentMonth) {
      const fallback = next.sort((a, b) => b.month.localeCompare(a.month))[0]
      if (fallback) {
        setCurrentMonth(fallback.month)
      } else {
        setCurrentMonth(getCurrentMonthKey())
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 text-foreground">
      <div className="flex h-screen overflow-hidden">
        <Navigation
          currentView={currentView}
          onViewChange={setCurrentView}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onOpenBudgets={() => setShowBudgetManager(true)}
        />

        <div className="flex flex-1 flex-col">
          <Header
            currentMonth={currentMonth}
            onPreviousMonth={goToPreviousMonth}
            onNextMonth={goToNextMonth}
            onOpenBudgets={() => setShowBudgetManager(true)}
          />

          <main className="flex-1 overflow-y-auto px-4 pb-24 pt-20 md:px-8 md:pb-8 md:pt-6">
            <div className="mx-auto max-w-6xl space-y-6">
              {currentView === 'dashboard' && (
                <Dashboard
                  budget={budget}
                  categories={categories}
                  transactions={transactions}
                  loading={budgetLoading}
                  currentMonth={currentMonth}
                  onCreateBudget={createBudget}
                  onAddTransaction={handleAddTransaction}
                />
              )}
              {currentView === 'budget' && (
                <BudgetView
                  budget={budget}
                  categories={categories}
                  loading={budgetLoading}
                  currentMonth={currentMonth}
                  onCreateBudget={createBudget}
                  onUpdateIncome={updateIncome}
                  onUpdateAllocation={updateAllocation}
                />
              )}
              {currentView === 'transactions' && (
                <TransactionsView
                  transactions={transactions}
                  categories={categories}
                  currentMonth={currentMonth}
                  onAddTransaction={handleAddTransaction}
                  onUpdateTransaction={handleUpdateTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              )}
              {currentView === 'settings' && (
                <SettingsView categories={categories} onRefreshCategories={refreshCategories} />
              )}
            </div>
          </main>
        </div>
      </div>

      <BudgetManagerDialog
        open={showBudgetManager}
        onOpenChange={setShowBudgetManager}
        budgets={budgets}
        loading={budgetsLoading}
        currentMonth={currentMonth}
        onSelectMonth={handleSelectMonth}
        onCreate={handleCreateBudgetForMonth}
        onDelete={handleDeleteBudget}
      />
    </div>
  )
}

export default App
