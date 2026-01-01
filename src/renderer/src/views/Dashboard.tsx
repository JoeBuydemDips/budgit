import { useState, useMemo } from 'react'
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowRight,
  DollarSign,
  PiggyBank,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn, formatCurrency, formatMonth, parseMonthKey } from '@/lib/utils'
import { AddTransactionDialog } from '@/components/AddTransactionDialog'
import type { BudgetWithComputed, Category, Transaction } from '../../../shared/types'
import { CATEGORY_TYPE_COLORS, type CategoryType } from '../../../shared/types'

interface DashboardProps {
  budget: BudgetWithComputed | null
  categories: Category[]
  transactions: Transaction[]
  loading: boolean
  currentMonth: string
  onCreateBudget: (incomeTotal: number, copyFromMonth?: string) => Promise<void>
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
}

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  GIVING: 'Giving',
  SAVINGS: 'Savings',
  NEEDS: 'Essentials',
  WANTS: 'Lifestyle',
  DEBT: 'Debt',
  FOOD: 'Food',
  MISC: 'Miscellaneous'
}

export function Dashboard({
  budget,
  categories,
  transactions,
  loading,
  currentMonth,
  onCreateBudget,
  onAddTransaction
}: DashboardProps): React.JSX.Element {
  const [showAddTransaction, setShowAddTransaction] = useState(false)

  // Calculate spending by day for the area chart
  const dailySpending = useMemo(() => {
    if (!transactions || !transactions.length) return []

    const spendingByDay: Record<string, number> = {}

    // Parse the currentMonth to get the correct month/year
    const monthDate = parseMonthKey(currentMonth)
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()

    const today = new Date()
    const startOfMonth = new Date(year, month, 1)

    // Determine the end date: either today (if viewing current month) or end of the selected month
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
    const endOfMonth = isCurrentMonth ? today : new Date(year, month + 1, 0) // Last day of selected month

    // Initialize all days of the month up to the end date
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0]
      spendingByDay[key] = 0
    }

    // Sum transactions by day
    transactions.forEach((txn) => {
      const day = txn.date.split('T')[0]
      if (spendingByDay[day] !== undefined) {
        spendingByDay[day] += txn.amount
      }
    })

    return Object.entries(spendingByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({
        date: new Date(date).getDate().toString(),
        amount
      }))
  }, [transactions, currentMonth])

  // Calculate category breakdown for pie chart
  const categoryBreakdown = useMemo(() => {
    if (!budget) return []

    const typeSpending: Record<CategoryType, { planned: number; spent: number }> = {
      GIVING: { planned: 0, spent: 0 },
      SAVINGS: { planned: 0, spent: 0 },
      NEEDS: { planned: 0, spent: 0 },
      WANTS: { planned: 0, spent: 0 },
      DEBT: { planned: 0, spent: 0 },
      FOOD: { planned: 0, spent: 0 },
      MISC: { planned: 0, spent: 0 }
    }

    categories.forEach((cat) => {
      const allocation = budget.allocations.find((a) => a.categoryId === cat.id)
      if (allocation) {
        typeSpending[cat.type].planned += allocation.planned
        typeSpending[cat.type].spent += allocation.spent
      }
    })

    return Object.entries(typeSpending)
      .filter(([, data]) => data.planned > 0 || data.spent > 0)
      .map(([type, data]) => ({
        type: type as CategoryType,
        label: CATEGORY_TYPE_LABELS[type as CategoryType],
        ...data,
        color: CATEGORY_TYPE_COLORS[type as CategoryType]
      }))
  }, [budget, categories])

  // Top spending categories
  const topCategories = useMemo(() => {
    if (!budget) return []

    return categories
      .map((cat) => {
        const allocation = budget.allocations.find((a) => a.categoryId === cat.id)
        const spent = allocation?.spent || 0
        const planned = allocation?.planned || 0
        // If no budget set but there's spending, show as 100% (over budget)
        // If budget is set, calculate actual percentage
        const percentage = planned > 0 ? (spent / planned) * 100 : spent > 0 ? 100 : 0
        return {
          ...cat,
          planned,
          spent,
          percentage
        }
      })
      .filter((c) => c.spent > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5)
  }, [budget, categories])

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
            Take control of your finances with zero-based budgeting. Give every dollar a job and
            watch your savings grow.
          </p>
        </div>

        <Card className="w-full max-w-md border-muted/60 shadow-lg">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Start Your Journey</CardTitle>
            <CardDescription>
              Create a budget for{' '}
              <span className="font-medium text-foreground">
                {formatMonth(parseMonthKey(currentMonth))}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Button
              size="lg"
              className="w-full text-base h-12 shadow-md hover:shadow-lg transition-all"
              onClick={async () => {
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
            <p className="text-sm text-muted-foreground">
              Log all your income sources in one place.
            </p>
          </div>
          <div className="space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">Manage Expenses</h3>
            <p className="text-sm text-muted-foreground">
              Categorize and track every penny you spend.
            </p>
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
  const totalSpent = budget.computed.totalSpentCategorized
  const leftToBudget = budget.computed.leftToBudget
  const remaining = totalPlanned - totalSpent
  const spentPercentage = totalPlanned > 0 ? (totalSpent / totalPlanned) * 100 : 0

  // Budget health indicators
  const isOverBudget = totalSpent > totalPlanned
  const isBalanced = leftToBudget === 0

  // Recent transactions
  const recentTransactions = [...(transactions || [])]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6)

  // Donut chart data
  const donutData = categoryBreakdown.map((c) => ({
    name: c.label,
    value: c.spent,
    color: c.color
  }))

  return (
    <div className="space-y-6">
      {/* Hero Stats Section */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Income Card */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Income
            </CardTitle>
            <div className="p-2 bg-green-500/10 rounded-full">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl lg:text-2xl font-bold">
              {formatCurrency(budget.incomeTotal)}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-3 w-3 text-green-600" />
              <span className="text-xs text-muted-foreground">Monthly income</span>
            </div>
          </CardContent>
        </Card>

        {/* Budgeted Card */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Budgeted
            </CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-full">
              <PiggyBank className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl lg:text-2xl font-bold">{formatCurrency(totalPlanned)}</div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-muted-foreground">
                {Math.round((totalPlanned / budget.incomeTotal) * 100)}% of income
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Spent Card */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
            <div className="p-2 bg-red-500/10 rounded-full">
              <Receipt className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl lg:text-2xl font-bold">{formatCurrency(totalSpent)}</div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowDownRight className="h-3 w-3 text-red-500" />
              <span className="text-xs text-muted-foreground">
                {Math.round(spentPercentage)}% of budget
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Remaining Card */}
        <Card className="relative overflow-hidden">
          <div
            className={cn(
              'absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-1/2 translate-x-1/2',
              remaining >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
            )}
          />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Remaining</CardTitle>
            <div
              className={cn(
                'p-2 rounded-full',
                remaining >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
              )}
            >
              <Wallet
                className={cn('h-4 w-4', remaining >= 0 ? 'text-emerald-600' : 'text-red-500')}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-xl lg:text-2xl font-bold',
                remaining >= 0 ? 'text-emerald-600' : 'text-red-600'
              )}
            >
              {formatCurrency(Math.abs(remaining))}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-muted-foreground">
                {remaining >= 0 ? 'Left to spend' : 'Over budget'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Health Banner */}
      <Card
        className={cn(
          'border-l-4',
          isBalanced && !isOverBudget && 'border-l-emerald-500 bg-emerald-500/5',
          !isBalanced && !isOverBudget && 'border-l-amber-500 bg-amber-500/5',
          isOverBudget && 'border-l-red-500 bg-red-500/5'
        )}
      >
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            {isOverBudget ? (
              <>
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium text-red-600">
                    Over budget by {formatCurrency(Math.abs(remaining))}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Review your spending to get back on track
                  </p>
                </div>
              </>
            ) : isBalanced ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="font-medium text-emerald-600">Budget is balanced!</p>
                  <p className="text-sm text-muted-foreground">
                    Every dollar has a job. Great work!
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-600">
                    {formatCurrency(leftToBudget)} left to assign
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Allocate remaining income to categories
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Spending by Category - Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spending by Category</CardTitle>
            <CardDescription>Where your money is going this month</CardDescription>
          </CardHeader>
          <CardContent>
            {donutData.length === 0 || donutData.every((d) => d.value === 0) ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Receipt className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No spending recorded yet</p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <div className="relative flex-shrink-0">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold">{formatCurrency(totalSpent)}</span>
                    <span className="text-xs text-muted-foreground">spent</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  {categoryBreakdown
                    .filter((c) => c.spent > 0)
                    .sort((a, b) => b.spent - a.spent)
                    .slice(0, 5)
                    .map((cat) => (
                      <div key={cat.type} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-sm flex-1 truncate">{cat.label}</span>
                        <span className="text-sm font-medium">{formatCurrency(cat.spent)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Spending Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daily Spending</CardTitle>
            <CardDescription>Your spending pattern this month</CardDescription>
          </CardHeader>
          <CardContent>
            {dailySpending.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Calendar className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={dailySpending}>
                  <defs>
                    <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value as number), 'Spent']}
                    labelFormatter={(label) => `Day ${label}`}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#spendingGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Categories by Spending */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Categories</CardTitle>
            <CardDescription>Your highest spending areas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topCategories.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                No spending recorded yet
              </p>
            ) : (
              topCategories.map((cat) => {
                // Over budget if spending exceeds planned, OR if spending exists with no budget
                const isOver = cat.spent > cat.planned
                const hasNoBudget = cat.planned === 0 && cat.spent > 0
                return (
                  <div key={cat.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: CATEGORY_TYPE_COLORS[cat.type] }}
                        />
                        <span className="font-medium text-sm">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm', (isOver || hasNoBudget) && 'text-red-600')}>
                          {formatCurrency(cat.spent)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          / {hasNoBudget ? 'No budget' : formatCurrency(cat.planned)}
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={Math.min(cat.percentage, 100)}
                      className="h-2"
                      indicatorClassName={cn(
                        (isOver || hasNoBudget) && 'bg-red-500',
                        cat.percentage >= 80 && !isOver && !hasNoBudget && 'bg-amber-500'
                      )}
                    />
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Recent Transactions</CardTitle>
              <CardDescription>Latest activity</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowAddTransaction(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground text-sm">No transactions yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowAddTransaction(true)}
                >
                  Add your first transaction
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((txn) => {
                  const category = categories.find((c) => c.id === txn.categoryId)
                  return (
                    <div
                      key={txn.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: category
                            ? `${CATEGORY_TYPE_COLORS[category.type]}20`
                            : 'hsl(var(--muted))'
                        }}
                      >
                        <Receipt
                          className="h-4 w-4"
                          style={{
                            color: category ? CATEGORY_TYPE_COLORS[category.type] : undefined
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {txn.description || category?.name || 'Transaction'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {category?.name} •{' '}
                          {new Date(txn.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <span
                        className={`font-semibold text-sm tabular-nums flex-shrink-0 ${
                          txn.amount >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {txn.amount >= 0 ? '-' : '+'}
                        {formatCurrency(Math.abs(txn.amount))}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
