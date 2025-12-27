import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import { formatCurrency, formatMonth, parseMonthKey } from '@/lib/utils'
import { CATEGORY_TYPE_COLORS } from '../../../shared/types'
import type { Category, Transaction } from '../../../shared/types'

interface TransactionsViewProps {
  transactions: Transaction[]
  categories: Category[]
  currentMonth: string
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
  onUpdateTransaction: (
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>
  ) => Promise<void>
  onDeleteTransaction: (id: string) => Promise<void>
}

export function TransactionsView({
  transactions,
  categories,
  currentMonth,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction
}: TransactionsViewProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter transactions
  const filteredTransactions = transactions.filter((txn) => {
    if (filterCategory !== 'all' && txn.categoryId !== filterCategory) return false
    if (searchQuery) {
      const category = categories.find((c) => c.id === txn.categoryId)
      const searchLower = searchQuery.toLowerCase()
      return (
        txn.description.toLowerCase().includes(searchLower) ||
        category?.name.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  // Group transactions by date, sorted newest first
  const groupedTransactions = useMemo(() => {
    // Sort transactions by date (newest first)
    const sorted = [...filteredTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    const groups = sorted.reduce(
      (acc, txn) => {
        const dateKey = txn.date.split('T')[0] // Use ISO date as key for proper sorting
        if (!acc[dateKey]) {
          acc[dateKey] = []
        }
        acc[dateKey].push(txn)
        return acc
      },
      {} as Record<string, Transaction[]>
    )

    // Sort groups by date (newest first) and return as array
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, txns]) => ({
        dateKey,
        dateLabel: new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        }),
        transactions: txns,
        total: txns.reduce((sum, t) => sum + t.amount, 0)
      }))
  }, [filteredTransactions])

  const totalSpent = filteredTransactions.reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">{formatMonth(parseMonthKey(currentMonth))}</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between px-6">
        <span className="text-sm text-muted-foreground">
          {filteredTransactions.length} transaction
          {filteredTransactions.length !== 1 ? 's' : ''}
        </span>
        <span className="text-sm font-medium">
          Total: <span className="text-red-600">{formatCurrency(totalSpent)}</span>
        </span>
      </div>

      {/* Transaction List */}
      {groupedTransactions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-muted p-4">
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No transactions found</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || filterCategory !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Start tracking your expenses'}
                </p>
              </div>
              {!searchQuery && filterCategory === 'all' && (
                <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first expense
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedTransactions.map((group) => (
            <Card key={group.dateKey}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{group.dateLabel}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-0">
                  {group.transactions.map((txn, index) => {
                    const category = categories.find((c) => c.id === txn.categoryId)
                    return (
                      <div key={txn.id}>
                        {index > 0 && <Separator className="my-2" />}
                        <div className="flex items-center gap-4 py-2 group">
                          {/* Description & Category */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {txn.description || 'Expense'}
                            </p>
                            <Badge
                              variant="secondary"
                              className="mt-1 text-xs font-normal"
                              style={{
                                backgroundColor: category
                                  ? `${CATEGORY_TYPE_COLORS[category.type]}20`
                                  : undefined,
                                color: category ? CATEGORY_TYPE_COLORS[category.type] : undefined
                              }}
                            >
                              {category?.name || 'Uncategorized'}
                            </Badge>
                          </div>

                          {/* Amount */}
                          <div className="text-right">
                            <p className="font-semibold text-red-600 tabular-nums">
                              -{formatCurrency(txn.amount)}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingTransaction(txn)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setDeleteConfirm(txn.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Transaction Dialog */}
      <TransactionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        categories={categories}
        currentMonth={currentMonth}
        onSave={async (data) => {
          await onAddTransaction(data)
          setShowAddDialog(false)
        }}
      />

      {/* Edit Transaction Dialog */}
      <TransactionDialog
        open={!!editingTransaction}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
        categories={categories}
        currentMonth={currentMonth}
        transaction={editingTransaction || undefined}
        onSave={async (data) => {
          if (editingTransaction) {
            await onUpdateTransaction(editingTransaction.id, data)
          }
          setEditingTransaction(null)
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteConfirm) {
                  await onDeleteTransaction(deleteConfirm)
                }
                setDeleteConfirm(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface TransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  currentMonth: string
  transaction?: Transaction
  onSave: (data: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
}

function TransactionDialog({
  open,
  onOpenChange,
  categories,
  currentMonth,
  transaction,
  onSave
}: TransactionDialogProps) {
  const [amount, setAmount] = useState(transaction?.amount.toString() || '')
  const [categoryId, setCategoryId] = useState(transaction?.categoryId || '')
  const [description, setDescription] = useState(transaction?.description || '')
  const [date, setDate] = useState(
    transaction?.date
      ? new Date(transaction.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const [saving, setSaving] = useState(false)

  // Reset form when dialog opens/closes or transaction changes
  useState(() => {
    if (transaction) {
      setAmount(transaction.amount.toString())
      setCategoryId(transaction.categoryId)
      setDescription(transaction.description)
      setDate(new Date(transaction.date).toISOString().split('T')[0])
    } else {
      setAmount('')
      setCategoryId('')
      setDescription('')
      setDate(new Date().toISOString().split('T')[0])
    }
  })

  const handleSave = async () => {
    if (!amount || !categoryId) return

    setSaving(true)
    await onSave({
      amount: parseFloat(amount),
      categoryId,
      description,
      date: new Date(date).toISOString(),
      budgetMonth: currentMonth
    })
    setSaving(false)

    // Reset form
    setAmount('')
    setCategoryId('')
    setDescription('')
    setDate(new Date().toISOString().split('T')[0])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{transaction ? 'Edit' : 'Add'} Expense</DialogTitle>
          <DialogDescription>
            {transaction ? 'Update the expense details' : 'Record a new expense'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="pl-7"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '')
                  setAmount(val)
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="What was this expense for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!amount || parseFloat(amount) <= 0 || !categoryId || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving...' : transaction ? 'Update' : 'Add'} Expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
