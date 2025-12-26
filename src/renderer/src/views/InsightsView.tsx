import { useState, useMemo } from 'react'
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
  Line
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import type { Budget, Category, CategoryType } from '../../../shared/types'

const TYPE_COLORS: Record<CategoryType, string> = {
  GIVING: '#10B981',
  SAVINGS: '#3B82F6',
  NEEDS: '#8B5CF6',
  WANTS: '#F59E0B',
  DEBT: '#EF4444'
}

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  GIVING: 'Giving',
  SAVINGS: 'Savings',
  NEEDS: 'Housing',
  WANTS: 'Personal',
  DEBT: 'Debt'
}

interface InsightsViewProps {
  budgets: Budget[]
  categories: Category[]
  currentYear?: number
}

export function InsightsView({
  budgets,
  categories,
  currentYear = new Date().getFullYear()
}: InsightsViewProps): React.JSX.Element {
  const [timeRange, setTimeRange] = useState<'ytd' | '12m' | 'all'>('ytd')
  const [selectedGroup, setSelectedGroup] = useState<CategoryType | 'all'>('all')

  // Filter budgets based on time range
  const filteredBudgets = useMemo(() => {
    const now = new Date()
    return budgets.filter((b) => {
      const [year, month] = b.month.split('-').map(Number)
      const budgetDate = new Date(year, month - 1, 1)

      if (timeRange === 'ytd') {
        return year === currentYear && budgetDate <= now
      } else if (timeRange === '12m') {
        const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
        return budgetDate >= twelveMonthsAgo && budgetDate <= now
      }
      return true
    }).sort((a, b) => a.month.localeCompare(b.month))
  }, [budgets, timeRange, currentYear])

  // Calculate spending totals by category type (YTD)
  const spendingByType = useMemo(() => {
    const totals: Record<CategoryType, number> = {
      GIVING: 0,
      SAVINGS: 0,
      NEEDS: 0,
      WANTS: 0,
      DEBT: 0
    }

    filteredBudgets.forEach((budget) => {
      budget.allocations.forEach((alloc) => {
        const category = categories.find((c) => c.id === alloc.categoryId)
        if (category) {
          totals[category.type] += alloc.spent
        }
      })
    })

    return Object.entries(totals)
      .filter(([, value]) => value > 0)
      .map(([type, value]) => ({
        name: CATEGORY_TYPE_LABELS[type as CategoryType],
        value,
        color: TYPE_COLORS[type as CategoryType],
        type: type as CategoryType
      }))
      .sort((a, b) => b.value - a.value)
  }, [filteredBudgets, categories])

  const totalSpent = spendingByType.reduce((sum, item) => sum + item.value, 0)

  // Monthly spending data for bar chart
  const monthlySpending = useMemo(() => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ]

    return months.map((monthName, index) => {
      const monthKey = `${currentYear}-${String(index + 1).padStart(2, '0')}`
      const budget = filteredBudgets.find((b) => b.month === monthKey)

      if (!budget) {
        return { month: monthName, ...Object.fromEntries(Object.keys(TYPE_COLORS).map(t => [t, 0])) }
      }

      const spendingByType: Record<string, number> = {}
      budget.allocations.forEach((alloc) => {
        const category = categories.find((c) => c.id === alloc.categoryId)
        if (category) {
          spendingByType[category.type] = (spendingByType[category.type] || 0) + alloc.spent
        }
      })

      return {
        month: monthName,
        ...spendingByType
      }
    })
  }, [filteredBudgets, categories, currentYear])

  // Monthly income data
  const monthlyIncome = useMemo(() => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ]

    return months.map((monthName, index) => {
      const monthKey = `${currentYear}-${String(index + 1).padStart(2, '0')}`
      const budget = filteredBudgets.find((b) => b.month === monthKey)

      const totalReceived = budget?.incomeSources?.reduce((sum, s) => sum + s.received, 0) || 0

      return {
        month: monthName,
        planned: budget?.incomeTotal || 0,
        received: totalReceived
      }
    })
  }, [filteredBudgets, currentYear])

  // Income vs Spent comparison
  const incomeVsSpent = useMemo(() => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ]

    return months.map((monthName, index) => {
      const monthKey = `${currentYear}-${String(index + 1).padStart(2, '0')}`
      const budget = filteredBudgets.find((b) => b.month === monthKey)

      const totalSpent = budget?.allocations.reduce((sum, a) => sum + a.spent, 0) || 0

      return {
        month: monthName,
        income: budget?.incomeTotal || 0,
        spent: totalSpent
      }
    })
  }, [filteredBudgets, currentYear])

  const avgMonthlySpending = totalSpent / Math.max(filteredBudgets.length, 1)
  const totalIncome = filteredBudgets.reduce((sum, b) => sum + b.incomeTotal, 0)
  const avgMonthlyIncome = totalIncome / Math.max(filteredBudgets.length, 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Insights</h1>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ytd">Year to date</SelectItem>
            <SelectItem value="12m">Last 12 months</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Top Row - Spending Totals & Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Spending Totals - Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold uppercase tracking-wide text-muted-foreground">
                Spending Totals
              </CardTitle>
              <Select
                value={selectedGroup}
                onValueChange={(v) => setSelectedGroup(v as typeof selectedGroup)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {Object.entries(CATEGORY_TYPE_LABELS).map(([type, label]) => (
                    <SelectItem key={type} value={type}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div className="relative">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={
                        selectedGroup === 'all'
                          ? spendingByType
                          : spendingByType.filter((s) => s.type === selectedGroup)
                      }
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {spendingByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {spendingByType.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(item.value)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t mt-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total Spent (year to date)</span>
                    <span>{formatCurrency(totalSpent)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Spending Details - Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold uppercase tracking-wide text-muted-foreground">
                Spending Details
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(CATEGORY_TYPE_LABELS).map(([type, label]) => (
                <div key={type} className="flex items-center gap-1 text-xs">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[type as CategoryType] }}
                  />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlySpending}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                {Object.entries(TYPE_COLORS).map(([type, color]) => (
                  <Bar key={type} dataKey={type} stackId="a" fill={color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 text-center text-sm text-muted-foreground">
              <span className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                {formatCurrency(avgMonthlySpending)} (avg)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Income Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Income */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold uppercase tracking-wide text-muted-foreground">
              Monthly Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <blockquote className="text-sm italic text-muted-foreground mb-4 border-l-2 pl-3">
              "Your income is your most powerful wealth-building tool." — Dave Ramsey
            </blockquote>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyIncome}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="planned" fill="#10B981" name="Planned" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 text-center text-sm text-muted-foreground">
              <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                {formatCurrency(avgMonthlyIncome)} (avg)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Income vs Spent */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold uppercase tracking-wide text-muted-foreground">
              Income vs. Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Want to really crush those money goals? Live on less than you make.
            </p>
            <div className="flex items-center gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span>Income — {formatCurrency(totalIncome)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-500" />
                <span>Spent — {formatCurrency(totalSpent)}</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={incomeVsSpent}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', strokeWidth: 0 }}
                  name="Income"
                />
                <Line
                  type="monotone"
                  dataKey="spent"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  dot={{ fill: '#06B6D4', strokeWidth: 0 }}
                  name="Spent"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
