import { useEffect, useState } from 'react'
import { Plus, Copy, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'
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
  DialogTitle
} from '@/components/ui/dialog'
import { cn, formatCurrency, formatMonth, parseMonthKey } from '@/lib/utils'
import type { Budget, Category, CategoryAllocation } from '../../../shared/types'

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
  onUpdateAllocation
}: BudgetViewProps) {
  const [showNewBudgetDialog, setShowNewBudgetDialog] = useState(false)
  const [newIncome, setNewIncome] = useState('')
  const [creating, setCreating] = useState(false)
  const [incomeEdit, setIncomeEdit] = useState('')
  const [savingIncome, setSavingIncome] = useState(false)

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

  useEffect(() => {
    if (budget) {
      setIncomeEdit(budget.incomeTotal.toString())
    }
  }, [budget])

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
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{group.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.categories.map((cat, index) => (
              <div key={cat.id}>
                {index > 0 && <Separator className="mb-4" />}
                <CategoryRow
                  category={cat}
                  onUpdatePlanned={(planned) => onUpdateAllocation(cat.id, planned)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
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
}

function CategoryRow({ category, onUpdatePlanned }: CategoryRowProps) {
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{category.name}</span>
          {category.carryover > 0 && (
            <span className="text-xs text-muted-foreground">
              (+{formatCurrency(category.carryover)} rollover)
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className={cn('text-sm', isOverBudget && 'text-red-600')}>
              {formatCurrency(category.spent)}
            </span>
            <span className="text-muted-foreground"> / </span>
            {isEditing ? (
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="inline-block w-24 h-7 text-right"
                autoFocus
              />
            ) : (
              <button
                onClick={() => {
                  setEditValue(category.planned.toString())
                  setIsEditing(true)
                }}
                className="font-medium hover:underline"
              >
                {formatCurrency(category.planned)}
              </button>
            )}
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
