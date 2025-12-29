import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Receipt } from 'lucide-react'
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // Data for donut chart
  const chartData = categoryBreakdown
    .filter((c) => c.planned > 0)
    .map((c) => ({
      name: c.label,
      value: c.planned,
      color: CATEGORY_TYPE_COLORS[c.type]
    }))

  // Get hovered segment data for center display
  const hoveredData = activeIndex !== null ? chartData[activeIndex] : null

  // Recent transactions (last 10)
  const recentTransactions = [...(transactions || [])]
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
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color}
                        onMouseEnter={() => setActiveIndex(index)}
                        style={{ 
                          cursor: 'pointer',
                          transform: activeIndex === index ? 'scale(1.08)' : 'scale(1)',
                          transformOrigin: 'center',
                          transition: 'transform 0.2s ease, filter 0.2s ease',
                          filter: activeIndex === index ? 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))' : 'none'
                        }}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center text - shows hovered segment or income */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {hoveredData ? (
                  <>
                    <span 
                      className="text-[10px] font-medium uppercase tracking-wide transition-all duration-200"
                      style={{ color: hoveredData.color }}
                    >
                      {hoveredData.name}
                    </span>
                    <span 
                      className="text-lg font-bold transition-all duration-200"
                      style={{ color: hoveredData.color }}
                    >
                      {formatCurrency(hoveredData.value)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Income</span>
                    <span className="text-lg font-bold">{formatCurrency(incomeTotal)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Category Breakdown Table */}
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 pb-2 border-b">
                <span>Category</span>
                <span className="text-right w-20">Planned</span>
                <span className="text-right w-20">Spent</span>
                <span className="text-right w-10">%</span>
              </div>
              {categoryBreakdown.map((cat) => (
                <div
                  key={cat.type}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-sm py-2 px-2 hover:bg-muted/50 rounded-md transition-colors"
                >
                  <span
                    className="font-medium truncate min-w-0"
                    style={{ color: CATEGORY_TYPE_COLORS[cat.type] }}
                    title={cat.label}
                  >
                    {cat.label}
                  </span>
                  <span className="text-right text-muted-foreground w-20 tabular-nums">
                    {formatCurrency(cat.planned)}
                  </span>
                  <span className="text-right w-20 tabular-nums">{formatCurrency(cat.spent)}</span>
                  <span className="text-right text-muted-foreground w-10 tabular-nums">
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

          <TabsContent value="transactions" className="mt-0">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                  <Receipt className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium">No transactions yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add expenses to see them here
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentTransactions.map((tx) => {
                  const category = categories.find((c) => c.id === tx.categoryId)
                  const categoryColor = category ? CATEGORY_TYPE_COLORS[category.type] : '#888'
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 py-3 px-3 hover:bg-muted/50 rounded-lg transition-colors"
                    >
                      {/* Color indicator */}
                      <div
                        className="w-1 h-10 rounded-full flex-shrink-0"
                        style={{ backgroundColor: categoryColor }}
                      />
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tx.description || category?.name || 'Expense'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {category?.name} • {new Date(tx.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                      
                      {/* Amount */}
                      <span className={`text-sm font-semibold tabular-nums ${
                        tx.amount >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {tx.amount >= 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount))}
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
