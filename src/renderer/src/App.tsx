import { useState } from 'react'
import { Header } from '@/components/Header'
import { Navigation, ViewType } from '@/components/Navigation'
import { Dashboard } from '@/views/Dashboard'
import { BudgetView } from '@/views/BudgetViewNew'
import { TransactionsView } from '@/views/TransactionsView'
import { InsightsView } from '@/views/InsightsView'
import { SettingsView } from '@/views/SettingsView'
import {
  useCurrentMonth,
  useItems,
  useBudget,
  useTransactions,
  useBudgetIndex,
  getCurrentMonthKey
} from '@/hooks/useBudget'
import { BudgetManagerDialog } from '@/components/BudgetManagerDialog'
import { ErrorBoundary } from '@/components/ErrorBoundary'

function App(): React.JSX.Element {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showBudgetManager, setShowBudgetManager] = useState(false)
  const { currentMonth, setCurrentMonth, goToPreviousMonth, goToNextMonth } = useCurrentMonth()
  const {
    items,
    refresh: refreshItems,
    addItem,
    updateItem,
    deleteItem,
    reorderItems
  } = useItems()
  const { budgets, loading: budgetsLoading, refresh: refreshBudgets } = useBudgetIndex()
  const {
    budget,
    loading: budgetLoading,
    refresh: refreshBudget,
    createBudget,
    updateAllocation,
    updateIncomeSources
  } = useBudget(currentMonth)
  const {
    transactions,
    refresh: refreshTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction
  } = useTransactions(currentMonth)

  // Refresh budget when transactions change
  const handleAddTransaction = async (transaction: Parameters<typeof addTransaction>[0]) => {
    await addTransaction(transaction)
    await refreshBudget()
    await refreshBudgets() // Keep insights in sync
  }

  const handleUpdateTransaction = async (
    id: string,
    updates: Parameters<typeof updateTransaction>[1]
  ) => {
    await updateTransaction(id, updates)
    await refreshBudget()
    await refreshBudgets() // Keep insights in sync
  }

  const handleDeleteTransaction = async (id: string) => {
    await deleteTransaction(id)
    await refreshBudget()
    await refreshBudgets() // Keep insights in sync
  }

  const handleDeleteItem = async (id: string) => {
    await deleteItem(id)
    await refreshBudget()
    await refreshBudgets() // Keep insights in sync
    await refreshTransactions() // Ensure transactions view updates if needed
  }

  const handleRemoveItemFromBudget = async (itemId: string) => {
    await window.api.removeItemFromBudget(currentMonth, itemId)
    await refreshBudget()
    await refreshBudgets() // Keep insights in sync
  }

  // Wrap budget update functions to also refresh the budgets index for Insights
  const handleUpdateIncomeSources = async (
    incomeSources: Parameters<typeof updateIncomeSources>[0]
  ) => {
    await updateIncomeSources(incomeSources)
    await refreshBudgets() // Keep insights in sync
  }

  const handleUpdateAllocation = async (itemId: string, planned: number) => {
    await updateAllocation(itemId, planned)
    await refreshBudgets() // Keep insights in sync
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
    await refreshBudgets()

    if (month === currentMonth) {
      const next = await window.api.getBudgets()
      const fallback = next.sort((a, b) => b.month.localeCompare(a.month))[0]
      if (fallback) {
        setCurrentMonth(fallback.month)
      } else {
        setCurrentMonth(getCurrentMonthKey())
      }
    }
    // Refresh current budget view in case deleted budget was affecting it
    await refreshBudget()
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <div className="flex h-screen overflow-hidden">
        <Navigation
          currentView={currentView}
          onViewChange={setCurrentView}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onOpenBudgets={() => setShowBudgetManager(true)}
        />

        <ErrorBoundary>
          <div className="flex flex-1 flex-col relative">
            {currentView !== 'insights' && (
              <Header
                currentMonth={currentMonth}
                onPreviousMonth={goToPreviousMonth}
                onNextMonth={goToNextMonth}
                onOpenBudgets={() => setShowBudgetManager(true)}
                showMonthNav={currentView !== 'settings'}
              />
            )}

            <main className="flex-1 overflow-hidden">
              {currentView === 'budget' ? (
                <BudgetView
                  budget={budget}
                  items={items}
                  transactions={transactions}
                  loading={budgetLoading}
                  currentMonth={currentMonth}
                  onCreateBudget={createBudget}
                  onUpdateAllocation={handleUpdateAllocation}
                  onUpdateIncomeSources={handleUpdateIncomeSources}
                  onAddItem={addItem}
                  onUpdateItem={updateItem}
                  onDeleteItem={handleDeleteItem}
                  onRemoveFromBudget={handleRemoveItemFromBudget}
                  onReorderItems={reorderItems}
                  onAddTransaction={handleAddTransaction}
                  onUpdateTransaction={handleUpdateTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              ) : currentView === 'insights' ? (
                <InsightsView
                  budgets={budgets}
                  items={items}
                  onNavigateToSettings={() => setCurrentView('settings')}
                />
              ) : (
                <div className="container mx-auto max-w-7xl p-4 md:p-8 pb-24 md:pb-8 space-y-8 overflow-y-auto h-full">
                  {currentView === 'dashboard' && (
                    <Dashboard
                      budget={budget}
                      items={items}
                      transactions={transactions}
                      loading={budgetLoading}
                      currentMonth={currentMonth}
                      onCreateBudget={createBudget}
                      onAddTransaction={handleAddTransaction}
                    />
                  )}
                  {currentView === 'transactions' && (
                    <TransactionsView
                      transactions={transactions}
                      items={items}
                      currentMonth={currentMonth}
                      onAddTransaction={handleAddTransaction}
                      onUpdateTransaction={handleUpdateTransaction}
                      onDeleteTransaction={handleDeleteTransaction}
                    />
                  )}
                  {currentView === 'settings' && (
                    <SettingsView
                      items={items}
                      onRefreshItems={refreshItems}
                      onRefreshBudgets={refreshBudgets}
                      onRefreshBudget={refreshBudget}
                      onRefreshTransactions={refreshTransactions}
                    />
                  )}
                </div>
              )}
            </main>
          </div>
        </ErrorBoundary>
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
