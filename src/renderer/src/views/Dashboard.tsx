import { useState } from 'react'
import { Plus, TrendingUp, TrendingDown, Wallet, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn, formatCurrency, formatMonth, parseMonthKey } from '@/lib/utils'
import { AddTransactionDialog } from '@/components/AddTransactionDialog'
import type { Budget, Category, Transaction } from '../../../shared/types'

interface DashboardProps {
  budget:
    | (Budget & {
        computed: { totalSpent: number; leftToBudget: number; available: Record<string, number> }
      })
    | null
  categories: Category[]
  transactions: Transaction[]
  loading: boolean
  currentMonth: string
  onCreateBudget: (incomeTotal: number, copyFromMonth?: string) => Promise<void>
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
}

export function Dashboard({
  budget,
  categories,
  transactions,
  loading,
  currentMonth,
  onCreateBudget,
  onAddTransaction
}: DashboardProps) {
  const [showAddTransaction, setShowAddTransaction] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // No budget - show welcome screen
  if (!budget) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="relative">
          <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <div className="relative bg-background p-6 rounded-full border shadow-sm">
            <Wallet className="h-12 w-12 text-primary" />
          </div>
        </div>
        
        <div className="text-center space-y-3 max-w-lg">
          <h1 className="text-4xl font-bold tracking-tight">Welcome to Budgit</h1>
          <p className="text-lg text-muted-foreground">
            Take control of your finances with zero-based budgeting. 
            Give every dollar a job and watch your savings grow.
          </p>
        </div>

        <Card className="w-full max-w-md border-muted/60 shadow-lg">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Start Your Journey</CardTitle>
            <CardDescription>
              Create a budget for <span className="font-medium text-foreground">{formatMonth(parseMonthKey(currentMonth))}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Button
              size="lg"
              className="w-full text-base h-12 shadow-md hover:shadow-lg transition-all"
              onClick={async () => {
                // Quick start with placeholder income
                await onCreateBudget(0)
              }}
            >
              Create My First Budget
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center max-w-3xl w-full pt-8">
          <div className="space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">Track Income</h3>
            <p className="text-sm text-muted-foreground">Log all your income sources in one place.</p>
          </div>
          <div className="space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">Manage Expenses</h3>
            <p className="text-sm text-muted-foreground">Categorize and track every penny you spend.</p>
          </div>
          <div className="space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">Zero-Based</h3>
            <p className="text-sm text-muted-foreground">Assign every dollar a specific purpose.</p>
          </div>
        </div>
      </div>
    )
  }

  const totalPlanned = budget.allocations.reduce((sum, a) => sum + a.planned, 0)
  const totalSpent = budget.computed.totalSpent
  const leftToBudget = budget.computed.leftToBudget
  const remaining = totalPlanned - totalSpent

  // Get top spending categories
  const categorySpending = categories
    .map((cat) => {
      const allocation = budget.allocations.find((a) => a.categoryId === cat.id)
      return {
        ...cat,
        planned: allocation?.planned || 0,
        spent: allocation?.spent || 0,
        available: budget.computed.available[cat.id] || 0
      }
    })
    .filter((c) => c.planned > 0 || c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5)

  // Get recent transactions
  const recentTransactions = transactions.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Income
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(budget.incomeTotal)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
            <p className="text-xs text-muted-foreground">
              {totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0}% of budget
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            leftToBudget === 0 && 'border-green-500',
            leftToBudget !== 0 && 'border-amber-500'
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Left to Budget
            </CardTitle>
            <Wallet
              className={cn(
                'h-4 w-4',
                leftToBudget === 0 && 'text-green-600',
                leftToBudget !== 0 && 'text-amber-600'
              )}
            />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-bold',
                leftToBudget === 0 && 'text-green-600',
                leftToBudget > 0 && 'text-amber-600',
                leftToBudget < 0 && 'text-red-600'
              )}
            >
              {formatCurrency(leftToBudget)}
            </div>
            <p className="text-xs text-muted-foreground">
              {leftToBudget === 0 ? 'Budget is balanced!' : 'Assign to categories'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Remaining to Spend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Remaining to Spend</CardTitle>
          <CardDescription>Out of {formatCurrency(totalPlanned)} budgeted</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Spent: {formatCurrency(totalSpent)}</span>
              <span className={cn(remaining < 0 && 'text-red-600')}>
                Remaining: {formatCurrency(remaining)}
              </span>
            </div>
            <Progress
              value={totalPlanned > 0 ? (totalSpent / totalPlanned) * 100 : 0}
              className="h-3"
              indicatorClassName={cn(
                totalSpent > totalPlanned && 'bg-red-500',
                totalSpent / totalPlanned >= 0.8 && totalSpent <= totalPlanned && 'bg-amber-500'
              )}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categorySpending.length === 0 ? (
              <p className="text-muted-foreground text-sm">No spending yet this month</p>
            ) : (
              categorySpending.map((cat) => (
                <div key={cat.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{cat.name}</span>
                    <span
                      className={cn(cat.spent > cat.planned && cat.planned > 0 && 'text-red-600')}
                    >
                      {formatCurrency(cat.spent)} / {formatCurrency(cat.planned)}
                    </span>
                  </div>
                  <Progress
                    value={cat.planned > 0 ? Math.min((cat.spent / cat.planned) * 100, 100) : 0}
                    className="h-2"
                    indicatorClassName={cn(cat.spent > cat.planned && 'bg-red-500')}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Transactions</CardTitle>
            <Button size="sm" onClick={() => setShowAddTransaction(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No transactions yet</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((txn) => {
                  const category = categories.find((c) => c.id === txn.categoryId)
                  return (
                    <div key={txn.id} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{txn.description || category?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {category?.name} • {new Date(txn.date).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="font-medium text-red-600">
                        -{formatCurrency(txn.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating Add Button (mobile) */}
      <Button
        size="lg"
        className="fixed bottom-20 right-4 md:bottom-8 rounded-full h-14 w-14 shadow-lg"
        onClick={() => setShowAddTransaction(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <AddTransactionDialog
        open={showAddTransaction}
        onOpenChange={setShowAddTransaction}
        categories={categories}
        currentMonth={currentMonth}
        onAddTransaction={onAddTransaction}
      />
    </div>
  )
}
