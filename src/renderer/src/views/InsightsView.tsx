import { useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  ReferenceLine
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle2,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import type { Budget, Category, CategoryType } from '../../../shared/types'

const TYPE_COLORS: Record<CategoryType, string> = {
  GIVING: '#10B981',
  SAVINGS: '#3B82F6',
  NEEDS: '#8B5CF6',
  WANTS: '#F59E0B',
  DEBT: '#EF4444',
  FOOD: '#06B6D4'
}

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  GIVING: 'Giving',
  SAVINGS: 'Savings',
  NEEDS: 'Housing & Utilities',
  WANTS: 'Lifestyle',
  DEBT: 'Debt',
  FOOD: 'Food'
}

interface InsightsViewProps {
  budgets: Budget[]
  categories: Category[]
}

// Get short month name from month key
function getShortMonth(monthKey: string): string {
  const [, month] = monthKey.split('-').map(Number)
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]
}

export function InsightsView({
  budgets,
  categories
}: InsightsViewProps): React.JSX.Element {
  // Get last 6 months of budgets for trends (sorted oldest to newest)
  const recentBudgets = useMemo(() => {
    return [...budgets].sort((a, b) => a.month.localeCompare(b.month)).slice(-6)
  }, [budgets])

  // Calculate total spending by category type across all budgets
  const spendingByType = useMemo(() => {
    const totals: Record<CategoryType, { planned: number; spent: number }> = {
      GIVING: { planned: 0, spent: 0 },
      SAVINGS: { planned: 0, spent: 0 },
      NEEDS: { planned: 0, spent: 0 },
      WANTS: { planned: 0, spent: 0 },
      DEBT: { planned: 0, spent: 0 },
      FOOD: { planned: 0, spent: 0 }
    }

    budgets.forEach((budget) => {
      budget.allocations.forEach((alloc) => {
        const category = categories.find((c) => c.id === alloc.categoryId)
        if (category) {
          totals[category.type].planned += alloc.planned
          totals[category.type].spent += alloc.spent
        }
      })
    })

    return Object.entries(totals)
      .map(([type, data]) => ({
        name: CATEGORY_TYPE_LABELS[type as CategoryType],
        type: type as CategoryType,
        planned: data.planned,
        spent: data.spent,
        color: TYPE_COLORS[type as CategoryType]
      }))
      .filter((item) => item.planned > 0 || item.spent > 0)
      .sort((a, b) => b.spent - a.spent)
  }, [budgets, categories])

  const totalPlanned = spendingByType.reduce((sum, item) => sum + item.planned, 0)
  const totalSpent = spendingByType.reduce((sum, item) => sum + item.spent, 0)
  const totalIncome = budgets.reduce((sum, b) => sum + b.incomeTotal, 0)
  const totalSavings = spendingByType.find((s) => s.type === 'SAVINGS')?.spent || 0

  // Monthly trend data - actual spending vs income over time
  const monthlyTrends = useMemo(() => {
    return recentBudgets.map((budget) => {
      const spent = budget.allocations.reduce((sum, a) => sum + a.spent, 0)
      const planned = budget.allocations.reduce((sum, a) => sum + a.planned, 0)
      const received = budget.incomeSources?.reduce((sum, s) => sum + s.received, 0) || 0
      const income = budget.incomeTotal
      
      // Calculate actual savings from SAVINGS category allocations
      const savings = budget.allocations.reduce((sum, a) => {
        const cat = categories.find((c) => c.id === a.categoryId)
        return cat?.type === 'SAVINGS' ? sum + a.spent : sum
      }, 0)

      return {
        month: getShortMonth(budget.month),
        monthKey: budget.month,
        income,
        received,
        planned,
        spent,
        savings,
        savingsRate: income > 0 ? (savings / income) * 100 : 0
      }
    })
  }, [recentBudgets, categories])

  // Calculate budget adherence (how well you stick to your budget)
  const budgetAdherence = useMemo(() => {
    if (budgets.length === 0) return { overall: 0, categories: [] }

    const categoryAdherence = categories.map((cat) => {
      let catPlanned = 0
      let catSpent = 0

      budgets.forEach((budget) => {
        const alloc = budget.allocations.find((a) => a.categoryId === cat.id)
        if (alloc) {
          catPlanned += alloc.planned
          catSpent += alloc.spent
        }
      })

      const adherence = catPlanned > 0 ? Math.min((catSpent / catPlanned) * 100, 200) : 0
      const overBudget = catSpent > catPlanned

      return {
        id: cat.id,
        name: cat.name,
        type: cat.type,
        planned: catPlanned,
        spent: catSpent,
        adherence,
        overBudget,
        difference: catSpent - catPlanned
      }
    })

    const overall = totalPlanned > 0 ? Math.min((totalSpent / totalPlanned) * 100, 200) : 0

    return {
      overall,
      categories: categoryAdherence
        .filter((c) => c.planned > 0)
        .sort((a, b) => b.difference - a.difference)
    }
  }, [budgets, categories, totalPlanned, totalSpent])

  // Identify spending patterns and insights
  const insights = useMemo(() => {
    const results: Array<{
      type: 'success' | 'warning' | 'info'
      title: string
      description: string
    }> = []

    if (monthlyTrends.length < 2) {
      results.push({
        type: 'info',
        title: 'Building Your History',
        description: 'Keep tracking for at least 2 months to see spending trends and personalized insights.'
      })
      return results
    }

    // Savings rate trend
    const recentSavingsRates = monthlyTrends.slice(-3).map((m) => m.savingsRate)
    const avgSavingsRate = recentSavingsRates.reduce((a, b) => a + b, 0) / recentSavingsRates.length

    if (avgSavingsRate >= 20) {
      results.push({
        type: 'success',
        title: 'Strong Savings Rate',
        description: `You're saving ${avgSavingsRate.toFixed(0)}% of your income on average. Keep it up!`
      })
    } else if (avgSavingsRate >= 10) {
      results.push({
        type: 'info',
        title: 'Savings Rate: Room to Grow',
        description: `You're saving ${avgSavingsRate.toFixed(0)}% of income. Aim for 20% or more.`
      })
    } else if (avgSavingsRate > 0) {
      results.push({
        type: 'warning',
        title: 'Low Savings Rate',
        description: `Only saving ${avgSavingsRate.toFixed(0)}% of income. Try to cut lifestyle spending.`
      })
    }

    // Spending trend
    if (monthlyTrends.length >= 2) {
      const lastMonth = monthlyTrends[monthlyTrends.length - 1]
      const prevMonth = monthlyTrends[monthlyTrends.length - 2]

      if (lastMonth.spent < prevMonth.spent) {
        const decrease = ((prevMonth.spent - lastMonth.spent) / prevMonth.spent) * 100
        results.push({
          type: 'success',
          title: 'Spending Decreased',
          description: `You spent ${decrease.toFixed(0)}% less than last month. Great progress!`
        })
      } else if (lastMonth.spent > prevMonth.spent * 1.1) {
        const increase = ((lastMonth.spent - prevMonth.spent) / prevMonth.spent) * 100
        results.push({
          type: 'warning',
          title: 'Spending Increased',
          description: `Spending jumped ${increase.toFixed(0)}% vs last month. Review your recent expenses.`
        })
      }
    }

    // Budget adherence insight
    const overBudgetCategories = budgetAdherence.categories.filter(
      (c) => c.overBudget && c.difference > 50
    )
    if (overBudgetCategories.length > 0) {
      const worstCategory = overBudgetCategories[0]
      results.push({
        type: 'warning',
        title: 'Overspending Alert',
        description: `"${worstCategory.name}" is ${formatCurrency(worstCategory.difference)} over budget.`
      })
    } else if (budgetAdherence.overall <= 100 && budgetAdherence.overall > 0) {
      results.push({
        type: 'success',
        title: 'Budget On Track',
        description: "You're staying within your planned budget. Excellent discipline!"
      })
    }

    // Lifestyle spending check
    const lifestyleType = spendingByType.find((s) => s.type === 'WANTS')
    const needsType = spendingByType.find((s) => s.type === 'NEEDS')
    if (lifestyleType && needsType && lifestyleType.spent > needsType.spent * 0.5) {
      results.push({
        type: 'info',
        title: 'Lifestyle Check',
        description: 'Your lifestyle spending is high relative to essentials. Consider if these align with your goals.'
      })
    }

    return results.slice(0, 4) // Limit to 4 insights
  }, [monthlyTrends, budgetAdherence, spendingByType])

  // Find categories with most variance (inconsistent spending)
  const spendingVariance = useMemo(() => {
    if (recentBudgets.length < 3) return []

    return categories
      .map((cat) => {
        const monthlyAmounts = recentBudgets
          .map((b) => b.allocations.find((a) => a.categoryId === cat.id)?.spent || 0)
          .filter((a) => a > 0)

        if (monthlyAmounts.length < 2) return null

        const avg = monthlyAmounts.reduce((a, b) => a + b, 0) / monthlyAmounts.length
        const variance = monthlyAmounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / monthlyAmounts.length
        const stdDev = Math.sqrt(variance)
        const coeffOfVariation = avg > 0 ? (stdDev / avg) * 100 : 0

        return {
          name: cat.name,
          type: cat.type,
          avg,
          stdDev,
          coeffOfVariation,
          isVariable: coeffOfVariation > 30
        }
      })
      .filter((c) => c !== null && c.avg > 50)
      .sort((a, b) => b!.coeffOfVariation - a!.coeffOfVariation)
      .slice(0, 5) as Array<{
        name: string
        type: CategoryType
        avg: number
        stdDev: number
        coeffOfVariation: number
        isVariable: boolean
      }>
  }, [recentBudgets, categories])

  // Calculate average monthly values
  const avgMonthlyIncome = budgets.length > 0 ? totalIncome / budgets.length : 0
  const avgMonthlySpent = budgets.length > 0 ? totalSpent / budgets.length : 0
  const avgMonthlySavings = budgets.length > 0 ? totalSavings / budgets.length : 0

  if (budgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <PiggyBank className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Budget Data Yet</h2>
        <p className="text-muted-foreground max-w-md">
          Create your first budget to start seeing insights about your spending patterns and financial trends.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Insights</h1>
          <p className="text-muted-foreground">
            Based on {budgets.length} month{budgets.length !== 1 ? 's' : ''} of data
          </p>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Monthly Income</p>
                <p className="text-2xl font-bold">{formatCurrency(avgMonthlyIncome)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Monthly Spent</p>
                <p className="text-2xl font-bold">{formatCurrency(avgMonthlySpent)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Savings Contributions</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(avgMonthlySavings)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <PiggyBank className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Budget Adherence</p>
                <p className={cn('text-2xl font-bold', budgetAdherence.overall <= 100 ? 'text-green-600' : 'text-amber-600')}>
                  {budgetAdherence.overall.toFixed(0)}%
                </p>
              </div>
              <div className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center',
                budgetAdherence.overall <= 100 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
              )}>
                <Target className={cn('h-5 w-5', budgetAdherence.overall <= 100 ? 'text-green-600' : 'text-amber-600')} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Smart Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Smart Insights</CardTitle>
            <CardDescription>Personalized observations based on your spending</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {insights.map((insight, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border',
                    insight.type === 'success' && 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
                    insight.type === 'warning' && 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
                    insight.type === 'info' && 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                  )}
                >
                  {insight.type === 'success' && <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />}
                  {insight.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />}
                  {insight.type === 'info' && <Target className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-medium text-sm">{insight.title}</p>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Spending Breakdown Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Spending Breakdown</CardTitle>
            <CardDescription>Total spending by category type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative flex-shrink-0">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={spendingByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="spent"
                      stroke="none"
                    >
                      {spendingByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(value as number)}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">{formatCurrency(totalSpent)}</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2 w-full">
                {spendingByType.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatCurrency(item.spent)}</span>
                      <span className="text-xs text-muted-foreground">
                        ({totalSpent > 0 ? ((item.spent / totalSpent) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Income vs Spending Trend</CardTitle>
            <CardDescription>Last {monthlyTrends.length} months</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                  />
                  <Tooltip
                    formatter={(value, name) => [formatCurrency(value as number), name === 'income' ? 'Income' : 'Spent']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', strokeWidth: 0, r: 4 }} name="Income" />
                  <Line type="monotone" dataKey="spent" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', strokeWidth: 0, r: 4 }} name="Spent" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">Not enough data for trends</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget Adherence + Savings Rate Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Budget Adherence by Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Budget Adherence</CardTitle>
            <CardDescription>How well you stick to planned amounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {budgetAdherence.categories.slice(0, 6).map((cat) => (
                <div key={cat.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[cat.type] }} />
                      <span className="truncate max-w-[140px]">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {cat.overBudget ? (
                        <Badge variant="destructive" className="text-xs">+{formatCurrency(cat.difference)}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">{formatCurrency(cat.difference)}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground w-12 text-right">{cat.adherence.toFixed(0)}%</span>
                    </div>
                  </div>
                  <Progress value={Math.min(cat.adherence, 100)} className={cn('h-2', cat.overBudget && 'bg-red-100 dark:bg-red-900/30')} />
                </div>
              ))}
              {budgetAdherence.categories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No budget data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Savings Rate Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Savings Rate Trend</CardTitle>
            <CardDescription>Savings category contributions as % of income</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    stroke="hsl(var(--muted-foreground))" 
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, (dataMax: number) => Math.max(dataMax + 5, 25)]}
                  />
                  <Tooltip
                    formatter={(value) => [`${(value as number).toFixed(1)}%`, 'Savings Rate']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <ReferenceLine y={20} stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" label={{ value: '20% target', position: 'right', fill: '#10B981', fontSize: 11 }} />
                  <Bar dataKey="savingsRate" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Savings Rate" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">Not enough data</div>
            )}
            <p className="text-xs text-muted-foreground text-center mt-2">Green dashed line = 20% recommended savings rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Variable Spending Categories */}
      {spendingVariance.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Spending Consistency</CardTitle>
            <CardDescription>Categories with the most variable spending month-to-month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {spendingVariance.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[cat.type] }} />
                    <span className="text-sm font-medium truncate max-w-[120px]">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {cat.isVariable ? (
                      <ArrowUpRight className="h-3 w-3 text-amber-500" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-green-500" />
                    )}
                    <span className="text-muted-foreground">±{formatCurrency(cat.stdDev)}/mo</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
