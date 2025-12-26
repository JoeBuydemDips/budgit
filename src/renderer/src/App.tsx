import { useState } from 'react'
import { Header } from '@/components/Header'
import { Navigation, ViewType } from '@/components/Navigation'
import { Dashboard } from '@/views/Dashboard'
import { BudgetView } from '@/views/BudgetView'
import { TransactionsView } from '@/views/TransactionsView'
import { SettingsView } from '@/views/SettingsView'
import { useCurrentMonth, useCategories, useBudget, useTransactions } from '@/hooks/useBudget'

function App(): React.JSX.Element {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')
  const { currentMonth, goToPreviousMonth, goToNextMonth } = useCurrentMonth()
  const { categories, refresh: refreshCategories } = useCategories()
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
    refresh: refreshTransactions,
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

  return (
    <div className="min-h-screen bg-background">
      <Header
        currentMonth={currentMonth}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
      />
      <Navigation currentView={currentView} onViewChange={setCurrentView} />

      <main className="pt-14 pb-20 md:pt-28 md:pb-4">
        <div className="container mx-auto px-4 py-6">
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
  )
}

export default App
