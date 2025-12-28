import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Receipt, Edit3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn, formatCurrency } from '@/lib/utils'
import type { Category, Transaction, CategoryType } from '../../../shared/types'

const TYPE_COLORS: Record<CategoryType, string> = {
  GIVING: '#10B981',
  SAVINGS: '#3B82F6',
  NEEDS: '#8B5CF6',
  WANTS: '#F59E0B',
  DEBT: '#EF4444',
  FOOD: '#06B6D4',
  MISC: '#6B7280'
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

const CATEGORY_TYPE_ORDER: CategoryType[] = ['GIVING', 'SAVINGS', 'NEEDS', 'FOOD', 'WANTS', 'DEBT']

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
  onUpdateCategory: (id: string, updates: Partial<Category>) => Promise<void>
}

export function CategoryDetailPanel({
  category,
  transactions,
  currentMonth,
  onClose,
  onAddTransaction,
  onDeleteTransaction,
  onUpdateCategory
}: CategoryDetailPanelProps): React.JSX.Element {
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)
  const [editingType, setEditingType] = useState(false)
  const [typeValue, setTypeValue] = useState<CategoryType>(category.type)

  // Update type value when category changes
  useEffect(() => {
    setTypeValue(category.type)
  }, [category.type])

  const categoryTransactions = transactions
    .filter((t) => t.categoryId === category.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const safeToSpend = category.planned + category.carryover - category.spent
  const headerColor = TYPE_COLORS[category.type]
  const spentPercentage = category.planned > 0 
    ? Math.min((category.spent / category.planned) * 100, 100) 
    : 0

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
        className="relative px-6 pt-6 pb-8 text-white"
        style={{ 
          background: `linear-gradient(135deg, ${headerColor} 0%, ${headerColor}dd 100%)`
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold">{category.name}</h2>
            <p className="text-white/70 text-sm mt-0.5">
              {formatCurrency(category.spent)} of {formatCurrency(category.planned)} spent
            </p>
          </div>
          
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${spentPercentage}%` }}
              />
            </div>
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <span className="text-white/70 text-sm">Available</span>
            <span className="text-3xl font-bold tracking-tight">
              {formatCurrency(safeToSpend)}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Quick Add Button */}
        <div className="p-4">
          <Button
            className="w-full h-12 gap-2 text-base font-medium"
            style={{ 
              backgroundColor: `${headerColor}15`,
              color: headerColor,
              borderColor: `${headerColor}30`
            }}
            variant="outline"
            onClick={() => setShowQuickAdd(true)}
          >
            <Plus className="h-5 w-5" />
            Add Expense
          </Button>
        </div>

        {/* Category Type */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Category Type</span>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: TYPE_COLORS[category.type] }}
              />
            </div>
            {!editingType ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingType(true)}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <Edit3 className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTypeValue(category.type)
                    setEditingType(false)
                  }}
                  className="h-8 px-2"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (typeValue !== category.type) {
                      await onUpdateCategory(category.id, { type: typeValue })
                    }
                    setEditingType(false)
                  }}
                  className="h-8 px-2"
                  disabled={typeValue === category.type}
                >
                  Save
                </Button>
              </div>
            )}
          </div>
          {editingType ? (
            <div className="mt-3">
              <Select
                value={typeValue}
                onValueChange={(value: CategoryType) => setTypeValue(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_TYPE_ORDER.map((type) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: TYPE_COLORS[type] }}
                        />
                        {CATEGORY_TYPE_LABELS[type]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              {CATEGORY_TYPE_LABELS[category.type]}
            </p>
          )}
        </div>

        {/* Activity This Month */}
        <div className="px-4 pb-4">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-4 px-2">
            Activity This Month
          </h3>

          {categoryTransactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No transactions yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your first expense to {category.name}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {categoryTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="group flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {tx.description || category.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(tx.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-red-500 tabular-nums">
                      -{formatCurrency(tx.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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

      {/* Footer */}
      <div className="border-t px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Remaining Budget</p>
            <p className="text-sm text-muted-foreground">
              {Math.round(spentPercentage)}% spent
            </p>
          </div>
          <span
            className={cn(
              'text-2xl font-bold tabular-nums',
              safeToSpend >= 0 ? 'text-green-500' : 'text-red-500'
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
