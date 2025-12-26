import { useEffect, useState } from 'react'
import { Plus, Copy, Sparkles, AlertCircle, CheckCircle2, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn, formatCurrency, formatMonth, parseMonthKey } from '@/lib/utils'
import { AddTransactionDialog } from '@/components/AddTransactionDialog'
import type { Budget, Category, CategoryAllocation, CategoryType, Transaction } from '../../../shared/types'

interface BudgetViewProps {
  budget:
    | (Budget & {
        computed: { totalSpent: number; leftToBudget: number; available: Record<string, number> }
      })
    | null
  categories: Category[]
  loading: boolean
  currentMonth: string
  onCreateBudget: (incomeTotal: number, copyFromMonth?: string) => Promise<void>
  onUpdateIncome: (incomeTotal: number) => Promise<void>
  onUpdateAllocation: (categoryId: string, planned: number) => Promise<void>
  onAddCategory: (category: Omit<Category, 'id'>) => Promise<void>
  onDeleteCategory: (id: string) => Promise<void>
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
}

const CATEGORY_TYPE_LABELS = {
  GIVING: 'Giving',
  SAVINGS: 'Savings',
  NEEDS: 'Essentials',
  WANTS: 'Lifestyle',
  DEBT: 'Debt'
}

const CATEGORY_TYPE_ORDER = ['GIVING', 'SAVINGS', 'NEEDS', 'WANTS', 'DEBT']

export function BudgetView({
  budget,
  categories,
  loading,
  currentMonth,
  onCreateBudget,
  onUpdateIncome,
  onUpdateAllocation,
  onAddCategory,
  onDeleteCategory,
  onAddTransaction
}: BudgetViewProps) {
  const [showNewBudgetDialog, setShowNewBudgetDialog] = useState(false)
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false)
  const [showAddTransactionDialog, setShowAddTransactionDialog] = useState(false)
  const [selectedCategoryForTransaction, setSelectedCategoryForTransaction] = useState<string>('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>('NEEDS')
  const [newIncome, setNewIncome] = useState('')
  const [creating, setCreating] = useState(false)
  const [incomeEdit, setIncomeEdit] = useState('')
  const [savingIncome, setSavingIncome] = useState(false)

  // Sync incomeEdit with budget - must be before any early returns
  useEffect(() => {
    if (budget) {
      setIncomeEdit(budget.incomeTotal.toString())
    }
  }, [budget])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading budget...</div>
      </div>
    )
  }

  // No budget for this month - show create options
  if (!budget) {
    return (
      <>
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">{formatMonth(parseMonthKey(currentMonth))}</h1>
            <p className="text-muted-foreground">No budget set up for this month yet</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Create Your Budget
              </CardTitle>
              <CardDescription>
                Give every dollar a job. Enter your expected income to get started.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" size="lg" onClick={() => setShowNewBudgetDialog(true)}>
                <Plus className="h-5 w-5 mr-2" />
                Start Fresh
              </Button>
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={async () => {
                  const prevMonth = await window.api.getPreviousMonth(currentMonth)
                  const prevBudget = await window.api.getBudget(prevMonth)
                  if (prevBudget) {
                    setNewIncome(prevBudget.incomeTotal.toString())
                    setShowNewBudgetDialog(true)
                  } else {
                    setShowNewBudgetDialog(true)
                  }
                }}
              >
                <Copy className="h-5 w-5 mr-2" />
                Copy from Last Month
              </Button>
            </CardContent>
          </Card>
        </div>

        <Dialog open={showNewBudgetDialog} onOpenChange={setShowNewBudgetDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Your Monthly Income</DialogTitle>
              <DialogDescription>
                How much money do you expect to receive this month?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="income">Total Income</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="income"
                    type="number"
                    placeholder="0.00"
                    className="pl-7"
                    value={newIncome}
                    onChange={(e) => setNewIncome(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewBudgetDialog(false)}>
                Cancel
              </Button>
              <Button
                disabled={!newIncome || parseFloat(newIncome) <= 0 || creating}
                onClick={async () => {
                  setCreating(true)
                  const prevMonth = await window.api.getPreviousMonth(currentMonth)
                  const prevBudget = await window.api.getBudget(prevMonth)
                  await onCreateBudget(parseFloat(newIncome), prevBudget ? prevMonth : undefined)
                  setShowNewBudgetDialog(false)
                  setNewIncome('')
                  setCreating(false)
                }}
              >
                {creating ? 'Creating...' : 'Create Budget'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Calculate totals
  const totalPlanned = budget.allocations.reduce((sum, a) => sum + a.planned, 0)
  const leftToBudget = budget.incomeTotal - totalPlanned

  // Group categories by type
  const groupedCategories = CATEGORY_TYPE_ORDER.map((type) => ({
    type,
    label: CATEGORY_TYPE_LABELS[type as keyof typeof CATEGORY_TYPE_LABELS],
    categories: categories
      .filter((c) => c.type === type)
      .map((cat) => {
        const allocation = budget.allocations.find((a) => a.categoryId === cat.id)
        return {
          ...cat,
          planned: allocation?.planned || 0,
          spent: allocation?.spent || 0,
          carryover: allocation?.carryover || 0
        }
      })
  })).filter((g) => g.categories.length > 0)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Income and Left to Budget Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-[1.2fr_1fr_1fr]">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Income</p>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    value={incomeEdit}
                    onChange={(e) => setIncomeEdit(e.target.value)}
                    className="pl-7"
                    type="number"
                    step="0.01"
                  />
                </div>
                <Button
                  onClick={async () => {
                    if (!incomeEdit) return
                    setSavingIncome(true)
                    await onUpdateIncome(parseFloat(incomeEdit))
                    setSavingIncome(false)
                  }}
                  disabled={!incomeEdit || savingIncome}
                >
                  {savingIncome ? 'Saving…' : 'Update income'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Keep your monthly income up to date to balance the budget.
              </p>
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">Planned</p>
              <p className="text-2xl font-bold">{formatCurrency(totalPlanned)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Left to Budget</p>
              <p
                className={cn(
                  'text-2xl font-bold flex items-center justify-center gap-2',
                  leftToBudget === 0 && 'text-green-600',
                  leftToBudget > 0 && 'text-amber-600',
                  leftToBudget < 0 && 'text-red-600'
                )}
              >
                {leftToBudget === 0 ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  leftToBudget !== 0 && <AlertCircle className="h-5 w-5" />
                )}
                {formatCurrency(leftToBudget)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zero-based budget reminder */}
      {leftToBudget !== 0 && (
        <div
          className={cn(
            'rounded-lg p-4 text-sm',
            leftToBudget > 0
              ? 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200'
              : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200'
          )}
        >
          {leftToBudget > 0 ? (
            <p>
              You have <strong>{formatCurrency(leftToBudget)}</strong> left to assign. Give every
              dollar a job!
            </p>
          ) : (
            <p>
              You're over budget by <strong>{formatCurrency(Math.abs(leftToBudget))}</strong>.
              Reduce some category amounts.
            </p>
          )}
        </div>
      )}

      {leftToBudget === 0 && (
        <div className="rounded-lg p-4 text-sm bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Perfect! Every dollar has a job. Your budget is balanced.
          </p>
        </div>
      )}

      {/* Category Groups */}
      {groupedCategories.map((group) => (
        <Card key={group.type}>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">{group.label}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:text-primary"
              onClick={() => {
                setNewCategoryType(group.type as CategoryType)
                setShowAddCategoryDialog(true)
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add {group.label}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.categories.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground italic">
                No categories yet. Click "Add {group.label}" to start.
              </div>
            )}
            {group.categories.map((cat, index) => (
              <div key={cat.id}>
                {index > 0 && <Separator className="mb-4" />}
                <CategoryRow
                  category={cat}
                  onUpdatePlanned={(planned) => onUpdateAllocation(cat.id, planned)}
                  onDelete={() => onDeleteCategory(cat.id)}
                  onAddTransaction={() => {
                    setSelectedCategoryForTransaction(cat.id)
                    setShowAddTransactionDialog(true)
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <AddTransactionDialog
        open={showAddTransactionDialog}
        onOpenChange={setShowAddTransactionDialog}
        categories={categories}
        currentMonth={currentMonth}
        defaultCategoryId={selectedCategoryForTransaction}
        onAddTransaction={onAddTransaction}
      />

      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Create a new category to track your spending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input
                placeholder="e.g., Groceries, Rent, Netflix"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category Type</Label>
              <Select
                value={newCategoryType}
                onValueChange={(val) => setNewCategoryType(val as CategoryType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_TYPE_ORDER.map((type) => (
                    <SelectItem key={type} value={type}>
                      {CATEGORY_TYPE_LABELS[type as keyof typeof CATEGORY_TYPE_LABELS]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCategoryDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newCategoryName}
              onClick={async () => {
                await onAddCategory({
                  name: newCategoryName,
                  type: newCategoryType,
                  rolloverEnabled: false,
                  sortOrder: 0
                })
                setShowAddCategoryDialog(false)
                setNewCategoryName('')
              }}
            >
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface CategoryRowProps {
  category: {
    id: string
    name: string
    planned: number
    spent: number
    carryover: number
    rolloverEnabled: boolean
  }
  onUpdatePlanned: (planned: number) => void
  onDelete: () => void
  onAddTransaction: () => void
}

function CategoryRow({ category, onUpdatePlanned, onDelete, onAddTransaction }: CategoryRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(category.planned.toString())

  const available = category.planned + category.carryover - category.spent
  const progress =
    category.planned > 0 ? Math.min((category.spent / category.planned) * 100, 100) : 0
  const isOverBudget = category.spent > category.planned + category.carryover

  const handleSave = () => {
    const value = parseFloat(editValue) || 0
    if (value >= 0) {
      onUpdatePlanned(value)
    }
    setIsEditing(false)
  }

  return (
    <div className="group space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{category.name}</span>
          {category.carryover > 0 && (
            <span className="text-xs text-muted-foreground">
              (+{formatCurrency(category.carryover)} rollover)
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className={cn('text-sm', isOverBudget && 'text-red-600')}>
                {formatCurrency(category.spent)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={onAddTransaction}
                title="Add Transaction"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <span className="text-muted-foreground"> / </span>
            <div className="relative group/input">
              {isEditing ? (
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSave}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  className="w-24 h-8 text-right pr-2"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    setEditValue(category.planned.toString())
                    setIsEditing(true)
                  }}
                  className="flex items-center justify-end gap-2 w-24 h-8 px-2 rounded hover:bg-muted transition-colors text-right font-medium"
                >
                  {formatCurrency(category.planned)}
                  <Pencil className="h-3 w-3 opacity-0 group-hover/input:opacity-50" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <Progress
        value={progress}
        className="h-2"
        indicatorClassName={cn(
          isOverBudget && 'bg-red-500',
          !isOverBudget && progress >= 80 && 'bg-amber-500'
        )}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Spent: {formatCurrency(category.spent)}</span>
        <span className={cn(available < 0 && 'text-red-600')}>
          Available: {formatCurrency(available)}
        </span>
      </div>
    </div>
  )
}
