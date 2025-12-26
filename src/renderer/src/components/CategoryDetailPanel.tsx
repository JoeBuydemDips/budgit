import { useState } from 'react'
import { X, Calendar, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn, formatCurrency } from '@/lib/utils'
import type { Category, Transaction, CategoryType } from '../../../shared/types'

const TYPE_COLORS: Record<CategoryType, string> = {
  GIVING: '#10B981',
  SAVINGS: '#3B82F6',
  NEEDS: '#8B5CF6',
  WANTS: '#F59E0B',
  DEBT: '#EF4444'
}

interface CategoryDetailPanelProps {
  category: Category & {
    planned: number
    spent: number
    carryover: number
    remaining: number
  }
  transactions: Transaction[]
  currentMonth: string
  onClose: () => void
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
  onDeleteTransaction: (id: string) => Promise<void>
}

export function CategoryDetailPanel({
  category,
  transactions,
  currentMonth,
  onClose,
  onAddTransaction,
  onDeleteTransaction
}: CategoryDetailPanelProps): React.JSX.Element {
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)

  const categoryTransactions = transactions
    .filter((t) => t.categoryId === category.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const safeToSpend = category.planned + category.carryover - category.spent
  const headerColor = TYPE_COLORS[category.type]

  const handleQuickAdd = async (): Promise<void> => {
    if (!amount || parseFloat(amount) <= 0) return

    setSubmitting(true)
    try {
      await onAddTransaction({
        amount: parseFloat(amount),
        description: description || category.name,
        date,
        categoryId: category.id,
        budgetMonth: currentMonth
      })
      setAmount('')
      setDescription('')
      setShowQuickAdd(false)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="h-full flex flex-col bg-background border-l">
      {/* Colored Header */}
      <div
        className="relative px-6 py-8 text-white"
        style={{ backgroundColor: headerColor }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 text-white/80 hover:text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="mt-4">
          <p className="text-white/80 text-sm text-right">Safe to Spend</p>
          <div className="flex items-baseline justify-between mt-1">
            <h2 className="text-2xl font-bold">{category.name}</h2>
            <span className="text-3xl font-bold">
              {formatCurrency(safeToSpend)}
            </span>
          </div>
          <p className="text-white/80 text-sm mt-1">
            <span className={safeToSpend >= 0 ? 'text-white' : 'text-red-200'}>
              {formatCurrency(category.spent)}
            </span>{' '}
            spent of {formatCurrency(category.planned)}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Quick Add Button */}
        <Button
          className="w-full gap-2"
          variant="outline"
          onClick={() => setShowQuickAdd(true)}
        >
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>

        <Separator />

        {/* Activity This Month */}
        <div>
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
            Activity This Month
          </h3>

          {categoryTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No transactions have been tracked to</p>
              <p className="text-sm font-medium">{category.name} for this month.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categoryTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="group flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground w-10">
                      {formatDate(tx.date)}
                    </div>
                    <span className="font-medium text-sm">
                      {tx.description || category.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-red-600">
                      -{formatCurrency(tx.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => onDeleteTransaction(tx.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer - Available */}
      <div className="border-t px-6 py-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Available</span>
          <span
            className={cn(
              'text-lg font-bold',
              safeToSpend >= 0 ? 'text-green-600' : 'text-red-600'
            )}
          >
            {formatCurrency(safeToSpend)}
          </span>
        </div>
      </div>

      {/* Quick Add Dialog */}
      <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>
              Track an expense for {category.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Large Amount Input */}
            <div className="text-center">
              <div className="relative inline-block">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-3xl text-muted-foreground">
                  $
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '')
                    setAmount(val)
                  }}
                  placeholder="0.00"
                  className="text-center text-4xl font-bold h-16 pl-8 pr-4 w-48 border-primary/50 focus:border-primary"
                  autoFocus
                />
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <div className="relative">
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={category.name}
                  />
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: headerColor }}
                  />
                  <span className="font-medium">{category.name}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowQuickAdd(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleQuickAdd}
              disabled={!amount || parseFloat(amount) <= 0 || submitting}
            >
              Track Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
