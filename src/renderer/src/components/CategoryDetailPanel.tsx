import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Receipt, Edit3, Search, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import type {
  BudgetItem,
  Transaction,
  Group,
  LearnedItemMapping
} from '../../../shared/types'
import { GROUP_COLORS } from '../../../shared/types'
import { AddTransactionDialog } from './AddTransactionDialog'

const GROUP_LABELS: Record<Group, string> = {
  GIVING: 'Giving',
  SAVINGS: 'Savings',
  NEEDS: 'Essentials',
  WANTS: 'Lifestyle',
  DEBT: 'Debt',
  FOOD: 'Food',
  MISC: 'Miscellaneous'
}

const GROUP_ORDER: Group[] = ['GIVING', 'SAVINGS', 'NEEDS', 'FOOD', 'WANTS', 'DEBT']

interface CategoryDetailPanelProps {
  item: BudgetItem & {
    planned: number
    spent: number
    carryover: number
    remaining: number
  }
  transactions: Transaction[]
  items: BudgetItem[]
  learnedMappings: LearnedItemMapping[]
  currentMonth: string
  onClose: () => void
  onUpdateTransaction: (
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>
  ) => Promise<void>
  onDeleteTransaction: (id: string) => Promise<void>
  onUpdateItem: (id: string, updates: Partial<BudgetItem>) => Promise<void>
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
}

export function CategoryDetailPanel({
  item,
  transactions,
  items,
  learnedMappings,
  currentMonth,
  onClose,
  onUpdateTransaction,
  onDeleteTransaction,
  onUpdateItem,
  onAddTransaction
}: CategoryDetailPanelProps): React.JSX.Element {
  const [showAddTransactions, setShowAddTransactions] = useState(false)
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [editingGroup, setEditingGroup] = useState(false)
  const [groupValue, setGroupValue] = useState<Group>(item.group)
  const [showAddNewExpense, setShowAddNewExpense] = useState(false)

  // Update group value when item changes
  useEffect(() => {
    setGroupValue(item.group)
  }, [item.group])

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!showAddTransactions) {
      setSelectedTransactionIds([])
      setSearchQuery('')
    }
  }, [showAddTransactions])

  const itemTransactions = transactions
    .filter((t) => t.itemId === item.id && t.budgetMonth === currentMonth)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Find uncategorized item
  const uncategorizedItem = items.find((c) => c.name === 'Uncategorized')

  // Available transactions that can be assigned to this item (from uncategorized)
  const availableTransactions = transactions
    .filter(
      (t) =>
        t &&
        t.budgetMonth === currentMonth &&
        (!t.itemId ||
          t.itemId === uncategorizedItem?.id ||
          !items.find((c) => c.id === t.itemId))
    )
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

  const safeToSpend = item.planned + item.carryover - item.spent
  const headerColor = (GROUP_COLORS as Record<string, string>)[item?.group] || '#6B7280'
  const spentPercentage =
    item.planned > 0 ? Math.min((item.spent / item.planned) * 100, 100) : 0

  const handleAssignTransactions = async (): Promise<void> => {
    if (selectedTransactionIds.length === 0) return

    setAssigning(true)
    try {
      for (const id of selectedTransactionIds) {
        await onUpdateTransaction(id, { itemId: item.id })
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
            <h2 className="text-2xl font-bold">{item.name}</h2>
            <p className="text-white/70 text-sm mt-0.5">
              {formatCurrency(item.spent)} of {formatCurrency(item.planned)} spent
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
            <span className="text-3xl font-bold tracking-tight">{formatCurrency(safeToSpend)}</span>
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

        {/* Item Group */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Budget Group</span>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: GROUP_COLORS[item.group] }}
              />
            </div>
            {!editingGroup ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingGroup(true)}
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
                    setGroupValue(item.group)
                    setEditingGroup(false)
                  }}
                  className="h-8 px-2"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (groupValue !== item.group) {
                      await onUpdateItem(item.id, { group: groupValue })
                    }
                    setEditingGroup(false)
                  }}
                  className="h-8 px-2"
                  disabled={groupValue === item.group}
                >
                  Save
                </Button>
              </div>
            )}
          </div>
          {editingGroup ? (
            <div className="mt-3">
              <Select
                value={groupValue}
                onValueChange={(value: Group) => setGroupValue(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_ORDER.map((grp) => (
                    <SelectItem key={grp} value={grp}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: GROUP_COLORS[grp] }}
                        />
                        {GROUP_LABELS[grp]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              {GROUP_LABELS[item.group]}
            </p>
          )}
        </div>

        {/* Activity This Month */}
        <div className="px-4 pb-4">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-4 px-2">
            Activity This Month
          </h3>

          {itemTransactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No transactions yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your first expense to {item.name}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {itemTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="group flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {tx.description || item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-red-500 tabular-nums">
                      -{formatCurrency(tx.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                      onClick={() => onDeleteTransaction(tx.id)}
                      title="Remove from category"
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
            <p className="text-sm text-muted-foreground">{Math.round(spentPercentage)}% spent</p>
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
        items={items}
        learnedMappings={learnedMappings}
        currentMonth={currentMonth}
        defaultItemId={item.id}
        onAddTransaction={onAddTransaction}
      />

      {/* Add Transactions Dialog */}
      <Dialog open={showAddTransactions} onOpenChange={setShowAddTransactions}>
        <DialogContent
          className="sm:max-w-2xl"
          style={{ maxHeight: '90vh', maxWidth: '90vw', overflow: 'auto', padding: '1rem' }}
        >
          <DialogHeader>
            <DialogTitle>Add Transactions to {item.name}</DialogTitle>
            <DialogDescription>Select transactions to assign to this budget item</DialogDescription>
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
            <div
              className="max-h-64 overflow-y-auto border rounded-md"
              style={{ padding: '0.5rem' }}
            >
              {filteredAvailableTransactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {searchQuery
                    ? 'No transactions match your search'
                    : 'No available transactions to assign'}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredAvailableTransactions.map((txn) => {
                    const txnItem = items.find((c) => c.id === txn.itemId)
                    return (
                      <div key={txn.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                        <Checkbox
                          checked={selectedTransactionIds.includes(txn.id)}
                          onCheckedChange={() => handleToggleSelect(txn.id)}
                        />
                        {/* Description & Item */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{txn.description || 'Transaction'}</p>
                          <Badge
                            variant="secondary"
                            className="mt-1 text-xs font-normal"
                            style={{
                              backgroundColor:
                                txnItem && txnItem.name !== 'Uncategorized'
                                  ? `${GROUP_COLORS[txnItem.group]}20`
                                  : undefined,
                              color:
                                txnItem && txnItem.name !== 'Uncategorized'
                                  ? GROUP_COLORS[txnItem.group]
                                  : undefined
                            }}
                          >
                            {txnItem?.name || 'Uncategorized'}
                          </Badge>
                        </div>
                        {/* Amount */}
                        <div className="text-right flex-shrink-0">
                          <p
                            className={`font-semibold tabular-nums ${
                              txn.amount >= 0 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {txn.amount >= 0 ? '-' : '+'}
                            {formatCurrency(Math.abs(txn.amount || 0))}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Item Info */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: headerColor }} />
                <span className="font-medium">Assigning to: {item.name}</span>
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
              Assign {selectedTransactionIds.length} Transaction
              {selectedTransactionIds.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
