import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import {
  CATEGORY_TYPE_COLORS,
  type CategoryType,
  type Category,
  type Transaction
} from '../../../shared/types'

interface BudgetSummaryPanelProps {
  incomeTotal: number
  totalPlanned: number
  totalSpent: number
  leftToBudget: number
  categoryBreakdown: {
    type: CategoryType
    label: string
    planned: number
    spent: number
    percentage: number
  }[]
  transactions: Transaction[]
  categories: Category[]
  currentMonth: string
}

export function BudgetSummaryPanel({
  incomeTotal,
  leftToBudget,
  categoryBreakdown,
  transactions,
  categories
}: BudgetSummaryPanelProps): React.JSX.Element {
  // Data for donut chart
  const chartData = categoryBreakdown
    .filter((c) => c.planned > 0)
    .map((c) => ({
      name: c.label,
      value: c.planned,
      color: CATEGORY_TYPE_COLORS[c.type]
    }))

  // Recent transactions (last 10)
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)

  return (
    <Card className="h-full border-l-0 rounded-l-none">
      <Tabs defaultValue="summary" className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary" className="text-sm">
              Summary
            </TabsTrigger>
            <TabsTrigger value="transactions" className="text-sm">
              Transactions
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto">
          <TabsContent value="summary" className="mt-0 space-y-6">
            {/* Donut Chart */}
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Income</span>
                <span className="text-2xl font-bold">{formatCurrency(incomeTotal)}</span>
              </div>
            </div>

            {/* Category Breakdown Table */}
            <div className="space-y-1">
              <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 pb-2 border-b">
                <span className="col-span-1">Category</span>
                <span className="text-right">Planned</span>
                <span className="text-right">Spent</span>
                <span className="text-right">%</span>
              </div>
              {categoryBreakdown.map((cat) => (
                <div
                  key={cat.type}
                  className="grid grid-cols-4 gap-2 text-sm py-2 px-2 hover:bg-muted/50 rounded-md transition-colors"
                >
                  <span
                    className="font-medium truncate"
                    style={{ color: CATEGORY_TYPE_COLORS[cat.type] }}
                  >
                    {cat.label}
                  </span>
                  <span className="text-right text-muted-foreground">
                    {formatCurrency(cat.planned)}
                  </span>
                  <span className="text-right">{formatCurrency(cat.spent)}</span>
                  <span className="text-right text-muted-foreground">
                    ({cat.percentage.toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>

            {/* Left to Budget Summary */}
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Left to Budget</span>
                <Badge
                  variant={leftToBudget === 0 ? 'success' : leftToBudget > 0 ? 'warning' : 'destructive'}
                  className="text-sm"
                >
                  {formatCurrency(leftToBudget)}
                </Badge>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="mt-0 space-y-4">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No transactions yet</p>
                <p className="text-sm">Add expenses to see them here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTransactions.map((tx) => {
                  const category = categories.find((c) => c.id === tx.categoryId)
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-2 px-2 hover:bg-muted/50 rounded-md transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tx.description || category?.name || 'Expense'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {category?.name} • {new Date(tx.date).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-red-600">
                        -{formatCurrency(tx.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}
