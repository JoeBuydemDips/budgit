import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Receipt, Edit3, Search, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
import type { Category, Transaction, CategoryType, LearnedCategoryMapping } from '../../../shared/types'
import { AddTransactionDialog } from './AddTransactionDialog'

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
  categories: Category[]
  learnedMappings: LearnedCategoryMapping[]
  currentMonth: string
  onClose: () => void
  onUpdateTransaction: (
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>
  ) => Promise<void>
  onDeleteTransaction: (id: string) => Promise<void>
  onUpdateCategory: (id: string, updates: Partial<Category>) => Promise<void>
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
}

export function CategoryDetailPanel({
  category,
  transactions,
  categories,
  learnedMappings,
  currentMonth,
  onClose,
  onUpdateTransaction,
  onDeleteTransaction,
  onUpdateCategory,
  onAddTransaction
}: CategoryDetailPanelProps): React.JSX.Element {
  const [showAddTransactions, setShowAddTransactions] = useState(false)
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [editingType, setEditingType] = useState(false)
  const [typeValue, setTypeValue] = useState<CategoryType>(category.type)
  const [showAddNewExpense, setShowAddNewExpense] = useState(false)

  // Update type value when category changes
  useEffect(() => {
    setTypeValue(category.type)
  }, [category.type])

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!showAddTransactions) {
      setSelectedTransactionIds([])
      setSearchQuery('')
    }
  }, [showAddTransactions])

  const categoryTransactions = transactions
    .filter((t) => t.categoryId === category.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Find uncategorized category
  const uncategorizedCategory = categories.find((c) => c.name === 'Uncategorized')

  // Available transactions that can be assigned to this category (from uncategorized)
  const availableTransactions = transactions
    .filter((t) => t && t.categoryId && t.categoryId === uncategorizedCategory?.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Filtered available transactions based on search
  const filteredAvailableTransactions = availableTransactions.filter((txn) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      txn.description.toLowerCase().includes(searchLower) ||
      txn.amount.toString().includes(searchLower) ||
      new Date(txn.date).toLocaleDateString().toLowerCase().includes(searchLower)
    )
  })

  const safeToSpend = category.planned + category.carryover - category.spent
  const headerColor = (TYPE_COLORS as any)[category?.type] || '#6B7280'
  const spentPercentage = category.planned > 0 
    ? Math.min((category.spent / category.planned) * 100, 100) 
    : 0

  const handleAssignTransactions = async (): Promise<void> => {
    if (selectedTransactionIds.length === 0) return

    setAssigning(true)
    try {
      for (const id of selectedTransactionIds) {
        await onUpdateTransaction(id, { categoryId: category.id })
      }
      setSelectedTransactionIds([])
      setSearchQuery('')
      setShowAddTransactions(false)
    } finally {
      setAssigning(false)
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedTransactionIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    setSelectedTransactionIds(filteredAvailableTransactions.map((t) => t.id))
  }

  const handleClearSelection = () => {
    setSelectedTransactionIds([])
  }

  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return 'Invalid date'
    }
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
        {/* Quick Add Buttons */}
        <div className="p-4 space-y-2">
          <Button
            className="w-full h-12 gap-2 text-base font-medium"
            style={{ 
              backgroundColor: `${headerColor}15`,
              color: headerColor,
              borderColor: `${headerColor}30`
            }}
            variant="outline"
            onClick={() => setShowAddNewExpense(true)}
          >
            <Plus className="h-5 w-5" />
            Add New Expense
          </Button>
          <Button
            className="w-full h-12 gap-2 text-base font-medium"
            variant="outline"
            onClick={() => setShowAddTransactions(true)}
          >
            <Plus className="h-5 w-5" />
            Assign from Available
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

      {/* Add New Expense Dialog */}
      <AddTransactionDialog
        open={showAddNewExpense}
        onOpenChange={setShowAddNewExpense}
        categories={categories}
        learnedMappings={learnedMappings}
        currentMonth={currentMonth}
        defaultCategoryId={category.id}
        onAddTransaction={onAddTransaction}
      />

      {/* Add Transactions Dialog */}
      <Dialog open={showAddTransactions} onOpenChange={setShowAddTransactions}>
        <DialogContent className="sm:max-w-2xl" style={{ maxHeight: '90vh', maxWidth: '90vw', overflow: 'auto', padding: '1rem' }}>
          <DialogHeader>
            <DialogTitle>Add Transactions to {category.name}</DialogTitle>
            <DialogDescription>
              Select transactions to assign to this category
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Selection Controls */}
            {filteredAvailableTransactions.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedTransactionIds.length} of {filteredAvailableTransactions.length} selected
                </span>
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearSelection}>
                  Clear
                </Button>
              </div>
            )}

            {/* Transaction List */}
            <div className="max-h-64 overflow-y-auto border rounded-md" style={{ padding: '0.5rem' }}>
              {filteredAvailableTransactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {searchQuery ? 'No transactions match your search' : 'No available transactions to assign'}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredAvailableTransactions.map((txn) => (
                    <div key={txn.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                      <Checkbox
                        checked={selectedTransactionIds.includes(txn.id)}
                        onCheckedChange={() => handleToggleSelect(txn.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {txn.description || 'Transaction'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(txn.date)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold tabular-nums text-red-600">
                          -{formatCurrency(Math.abs(txn.amount || 0))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category Info */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: headerColor }}
                />
                <span className="font-medium">Assigning to: {category.name}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddTransactions(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignTransactions}
              disabled={selectedTransactionIds.length === 0 || assigning}
            >
              <Check className="h-4 w-4 mr-2" />
              Assign {selectedTransactionIds.length} Transaction{selectedTransactionIds.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
