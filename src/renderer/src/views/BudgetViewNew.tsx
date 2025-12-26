import { useState } from 'react'
import { Plus, ChevronDown, ChevronUp, Trash2, Sparkles, Copy, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
import { cn, formatCurrency, formatMonth, parseMonthKey } from '@/lib/utils'
import { CategoryDetailPanel } from '@/components/CategoryDetailPanel'
import { BudgetSummaryPanel } from '@/components/BudgetSummaryPanel'
import type {
  Budget,
  Category,
  CategoryType,
  Transaction,
  IncomeSource
} from '../../../shared/types'

// Import colors directly
const TYPE_COLORS: Record<CategoryType, string> = {
  GIVING: '#10B981',
  SAVINGS: '#3B82F6',
  NEEDS: '#8B5CF6',
  WANTS: '#F59E0B',
  DEBT: '#EF4444'
}

interface BudgetViewProps {
  budget:
    | (Budget & {
        computed: { totalSpent: number; leftToBudget: number; available: Record<string, number> }
      })
    | null
  categories: Category[]
  transactions: Transaction[]
  loading: boolean
  currentMonth: string
  onCreateBudget: (incomeTotal: number, copyFromMonth?: string) => Promise<void>
  onUpdateIncome: (incomeTotal: number) => Promise<void>
  onUpdateAllocation: (categoryId: string, planned: number) => Promise<void>
  onUpdateIncomeSources: (sources: IncomeSource[]) => Promise<void>
  onAddCategory: (category: Omit<Category, 'id'>) => Promise<void>
  onDeleteCategory: (id: string) => Promise<void>
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
  onDeleteTransaction: (id: string) => Promise<void>
}

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  GIVING: 'Giving',
  SAVINGS: 'Savings',
  NEEDS: 'Housing & Utilities',
  WANTS: 'Lifestyle',
  DEBT: 'Debt'
}

const CATEGORY_TYPE_ORDER: CategoryType[] = ['GIVING', 'SAVINGS', 'NEEDS', 'WANTS', 'DEBT']

export function BudgetView({
  budget,
  categories,
  transactions,
  loading,
  currentMonth,
  onCreateBudget,
  onUpdateIncome,
  onUpdateAllocation,
  onUpdateIncomeSources,
  onAddCategory,
  onDeleteCategory,
  onAddTransaction,
  onDeleteTransaction
}: BudgetViewProps) {
  const [showNewBudgetDialog, setShowNewBudgetDialog] = useState(false)
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false)
  const [showAddIncomeDialog, setShowAddIncomeDialog] = useState(false)
  const [showQuickAddDialog, setShowQuickAddDialog] = useState(false)
  const [quickAddAmount, setQuickAddAmount] = useState('')
  const [quickAddDescription, setQuickAddDescription] = useState('')
  const [quickAddDate, setQuickAddDate] = useState(new Date().toISOString().split('T')[0])
  const [quickAddCategoryId, setQuickAddCategoryId] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>('NEEDS')
  const [newIncome, setNewIncome] = useState('')
  const [newIncomeName, setNewIncomeName] = useState('')
  const [creating, setCreating] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    GIVING: true,
    SAVINGS: true,
    NEEDS: true,
    WANTS: true,
    DEBT: true
  })

  const toggleGroup = (type: string) => {
    setExpandedGroups((prev) => ({ ...prev, [type]: !prev[type] }))
  }

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
        <div className="max-w-lg mx-auto space-y-8 py-12">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">{formatMonth(parseMonthKey(currentMonth))}</h1>
            <p className="text-muted-foreground text-lg">
              No budget set up for this month yet. Let's create one!
            </p>
          </div>

          <Card className="border-2">
            <CardContent className="pt-6 space-y-4">
              <Button
                className="w-full h-12 text-base"
                size="lg"
                onClick={() => setShowNewBudgetDialog(true)}
              >
                <Plus className="h-5 w-5 mr-2" />
                Start Fresh Budget
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 text-base"
                size="lg"
                onClick={async () => {
                  const prevMonth = await window.api.getPreviousMonth(currentMonth)
                  const prevBudget = await window.api.getBudget(prevMonth)
                  if (prevBudget) {
                    setNewIncome(prevBudget.incomeTotal.toString())
                  }
                  setShowNewBudgetDialog(true)
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
                    className="pl-7 h-12 text-lg"
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
  const incomeSources = budget.incomeSources || [
    { id: 'default', name: 'Income', planned: budget.incomeTotal, received: 0 }
  ]
  const totalReceived = incomeSources.reduce((sum, s) => sum + s.received, 0)

  // Group categories by type with calculated data
  const groupedCategories = CATEGORY_TYPE_ORDER.map((type) => {
    const typeCats = categories
      .filter((c) => c.type === type)
      .map((cat) => {
        const allocation = budget.allocations.find((a) => a.categoryId === cat.id)
        return {
          ...cat,
          planned: allocation?.planned || 0,
          spent: allocation?.spent || 0,
          carryover: allocation?.carryover || 0,
          remaining: (allocation?.planned || 0) + (allocation?.carryover || 0) - (allocation?.spent || 0)
        }
      })
    const groupPlanned = typeCats.reduce((sum, c) => sum + c.planned, 0)
    const groupSpent = typeCats.reduce((sum, c) => sum + c.spent, 0)
    const groupRemaining = typeCats.reduce((sum, c) => sum + c.remaining, 0)

    return {
      type,
      label: CATEGORY_TYPE_LABELS[type],
      color: TYPE_COLORS[type],
      categories: typeCats,
      planned: groupPlanned,
      spent: groupSpent,
      remaining: groupRemaining
    }
  }).filter((g) => g.categories.length > 0 || true) // Show all groups

  // Summary panel data
  const categoryBreakdown = CATEGORY_TYPE_ORDER.map((type) => {
    const group = groupedCategories.find((g) => g.type === type)
    return {
      type,
      label: CATEGORY_TYPE_LABELS[type],
      planned: group?.planned || 0,
      spent: group?.spent || 0,
      percentage: budget.incomeTotal > 0 ? ((group?.planned || 0) / budget.incomeTotal) * 100 : 0
    }
  })

  // Find selected category data for detail panel
  const selectedCategoryData = selectedCategory
    ? groupedCategories
        .flatMap((g) => g.categories)
        .find((c) => c.id === selectedCategory)
    : null

  const handleAddIncomeSource = async (): Promise<void> => {
    if (!newIncomeName || !newIncome) return
    const newSource: IncomeSource = {
      id: crypto.randomUUID(),
      name: newIncomeName,
      planned: parseFloat(newIncome),
      received: 0
    }
    await onUpdateIncomeSources([...incomeSources, newSource])
    setShowAddIncomeDialog(false)
    setNewIncomeName('')
    setNewIncome('')
  }

  const handleUpdateIncomeSource = async (id: string, updates: Partial<IncomeSource>): Promise<void> => {
    const updated = incomeSources.map((s) => (s.id === id ? { ...s, ...updates } : s))
    await onUpdateIncomeSources(updated)
  }

  const handleDeleteIncomeSource = async (id: string): Promise<void> => {
    const filtered = incomeSources.filter((s) => s.id !== id)
    if (filtered.length === 0) return // Don't allow deleting all sources
    await onUpdateIncomeSources(filtered)
  }

  return (
    <div className="flex gap-0 h-full">
      {/* Left Column - Budget Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sticky Header with Left to Budget */}
        <div className="sticky top-0 z-10 bg-background border-b px-4 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{formatMonth(parseMonthKey(currentMonth))}</h1>
              <p
                className={cn(
                  'text-lg font-semibold',
                  leftToBudget === 0 && 'text-green-600',
                  leftToBudget > 0 && 'text-amber-600',
                  leftToBudget < 0 && 'text-red-600'
                )}
              >
                {formatCurrency(Math.abs(leftToBudget))}{' '}
                {leftToBudget === 0
                  ? '- Fully Budgeted!'
                  : leftToBudget > 0
                    ? 'left to budget'
                    : 'over budget'}
              </p>
            </div>
            {/* Column Headers - offset to align with card content */}
            <div className="flex items-center text-xs text-muted-foreground uppercase tracking-wide pr-7">
              <div className="w-28 text-right pr-2">Planned</div>
              <div className="w-28 text-right">Spent</div>
              <div className="w-12" />
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-4 space-y-6">
          {/* Income Section */}
          <Card>
          <Collapsible open={expandedGroups['INCOME']} onOpenChange={() => toggleGroup('INCOME')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-8 rounded-full bg-green-500" />
                    <div>
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        Income for {formatMonth(parseMonthKey(currentMonth)).split(' ')[0]}
                        {expandedGroups['INCOME'] ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </CardTitle>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="w-28 text-right pr-2">
                      <p className="font-semibold">{formatCurrency(budget.incomeTotal)}</p>
                    </div>
                    <div className="w-28 text-right">
                      <p className="font-semibold">{formatCurrency(totalReceived)}</p>
                    </div>
                    <div className="w-12" />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                {incomeSources.map((source) => (
                  <IncomeRow
                    key={source.id}
                    source={source}
                    canDelete={incomeSources.length > 1}
                    onUpdate={(updates) => handleUpdateIncomeSource(source.id, updates)}
                    onDelete={() => handleDeleteIncomeSource(source.id)}
                  />
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary/80"
                  onClick={() => setShowAddIncomeDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Income
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Category Groups */}
        {groupedCategories.map((group) => (
          <Card key={group.type}>
            <Collapsible
              open={expandedGroups[group.type]}
              onOpenChange={() => toggleGroup(group.type)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-1.5 h-8 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <div>
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          {group.label}
                          {expandedGroups[group.type] ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </CardTitle>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-28 text-right pr-2">
                        <p className="font-semibold">{formatCurrency(group.planned)}</p>
                      </div>
                      <div className="w-28 text-right">
                        <p
                          className={cn(
                            'font-semibold',
                            group.spent > 0 ? 'text-primary' : 'text-green-600'
                          )}
                        >
                          {formatCurrency(group.spent)}
                        </p>
                      </div>
                      <div className="w-12" />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-0 space-y-0">
                  {group.categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center italic">
                      No categories yet
                    </p>
                  ) : (
                    group.categories.map((cat) => (
                      <CategoryRow
                        key={cat.id}
                        category={cat}
                        isSelected={selectedCategory === cat.id}
                        onSelect={() => setSelectedCategory(cat.id)}
                        onUpdateName={async (name) => {
                          await window.api.updateCategory(cat.id, { name })
                        }}
                        onUpdatePlanned={(planned) => onUpdateAllocation(cat.id, planned)}
                        onToggleRollover={async (enabled) => {
                          await window.api.updateCategory(cat.id, { rolloverEnabled: enabled })
                        }}
                        onDelete={() => onDeleteCategory(cat.id)}
                      />
                    ))
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:text-primary/80 ml-6 mt-2"
                    onClick={() => {
                      setNewCategoryType(group.type)
                      setShowAddCategoryDialog(true)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
        </div>
      </div>

      {/* Right Column - Detail Panel or Summary */}
      <div className="hidden lg:block w-[380px] border-l bg-muted/30">
        {selectedCategoryData ? (
          <CategoryDetailPanel
            category={selectedCategoryData}
            transactions={transactions}
            currentMonth={currentMonth}
            onClose={() => setSelectedCategory(null)}
            onAddTransaction={onAddTransaction}
            onDeleteTransaction={onDeleteTransaction}
          />
        ) : (
          <BudgetSummaryPanel
            incomeTotal={budget.incomeTotal}
            totalPlanned={totalPlanned}
            totalSpent={budget.computed.totalSpent}
            leftToBudget={leftToBudget}
            categoryBreakdown={categoryBreakdown}
            transactions={transactions}
            categories={categories}
            currentMonth={currentMonth}
          />
        )}
      </div>

      {/* Floating Add Button */}
      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg lg:hidden z-50"
        onClick={() => setShowQuickAddDialog(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Dialogs */}

      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>Create a new category to track your spending.</DialogDescription>
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
                      {CATEGORY_TYPE_LABELS[type]}
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

      <Dialog open={showAddIncomeDialog} onOpenChange={setShowAddIncomeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Income Source</DialogTitle>
            <DialogDescription>Add another income source to your budget.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Income Name</Label>
              <Input
                placeholder="e.g., Salary, Freelance, Side Hustle"
                value={newIncomeName}
                onChange={(e) => setNewIncomeName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Planned Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
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
            <Button variant="outline" onClick={() => setShowAddIncomeDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newIncomeName || !newIncome}
              onClick={handleAddIncomeSource}
            >
              Add Income
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Expense Dialog */}
      <Dialog open={showQuickAddDialog} onOpenChange={setShowQuickAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>Track a new expense</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Large Amount Input */}
            <div className="text-center">
              <div className="relative inline-block">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-3xl text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  value={quickAddAmount}
                  onChange={(e) => setQuickAddAmount(e.target.value)}
                  placeholder="0.00"
                  className="text-center text-4xl font-bold h-16 pl-8 pr-4 w-48 border-primary/50 focus:border-primary"
                  autoFocus
                />
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="quick-date">Date</Label>
                  <Input
                    id="quick-date"
                    type="date"
                    value={quickAddDate}
                    onChange={(e) => setQuickAddDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-description">Description</Label>
                  <Input
                    id="quick-description"
                    value={quickAddDescription}
                    onChange={(e) => setQuickAddDescription(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={quickAddCategoryId} onValueChange={setQuickAddCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupedCategories.map((group) =>
                      group.categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: group.color }}
                            />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowQuickAddDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!quickAddAmount || parseFloat(quickAddAmount) <= 0 || !quickAddCategoryId}
              onClick={async () => {
                const cat = categories.find((c) => c.id === quickAddCategoryId)
                await onAddTransaction({
                  amount: parseFloat(quickAddAmount),
                  description: quickAddDescription || cat?.name || '',
                  date: quickAddDate,
                  categoryId: quickAddCategoryId,
                  budgetMonth: currentMonth
                })
                setShowQuickAddDialog(false)
                setQuickAddAmount('')
                setQuickAddDescription('')
                setQuickAddCategoryId('')
              }}
            >
              Track Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Income Row Component
interface IncomeRowProps {
  source: IncomeSource
  canDelete: boolean
  onUpdate: (updates: Partial<IncomeSource>) => void
  onDelete: () => void
}

function IncomeRow({ source, canDelete, onUpdate, onDelete }: IncomeRowProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(source.name)
  const [editingPlanned, setEditingPlanned] = useState(false)
  const [editingReceived, setEditingReceived] = useState(false)
  const [plannedValue, setPlannedValue] = useState(source.planned.toString())
  const [receivedValue, setReceivedValue] = useState(source.received.toString())

  const handleSaveName = () => {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== source.name) {
      onUpdate({ name: trimmed })
    } else {
      setNameValue(source.name)
    }
    setEditingName(false)
  }

  const handleSavePlanned = () => {
    const value = parseFloat(plannedValue) || 0
    if (value >= 0) {
      onUpdate({ planned: value })
    }
    setEditingPlanned(false)
  }

  const handleSaveReceived = () => {
    const value = parseFloat(receivedValue) || 0
    if (value >= 0) {
      onUpdate({ received: value })
    }
    setEditingReceived(false)
  }

  return (
    <div className="group flex items-center justify-between py-2.5 px-3 hover:bg-muted/50 rounded-lg transition-colors border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {editingName ? (
          <Input
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveName()
              if (e.key === 'Escape') {
                setNameValue(source.name)
                setEditingName(false)
              }
            }}
            className="h-8 max-w-[200px]"
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              setNameValue(source.name)
              setEditingName(true)
            }}
            className="font-medium truncate hover:bg-muted px-2 py-1 rounded transition-colors text-left"
          >
            {source.name}
          </button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="flex items-center">
        <div className="w-28 text-right pr-2">
          {editingPlanned ? (
            <Input
              type="number"
              value={plannedValue}
              onChange={(e) => setPlannedValue(e.target.value)}
              onBlur={handleSavePlanned}
              onKeyDown={(e) => e.key === 'Enter' && handleSavePlanned()}
              className="h-8 text-right"
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                setPlannedValue(source.planned.toString())
                setEditingPlanned(true)
              }}
              className="hover:bg-muted px-2 py-1 rounded transition-colors"
            >
              {formatCurrency(source.planned)}
            </button>
          )}
        </div>
        <div className="w-28 text-right">
          {editingReceived ? (
            <Input
              type="number"
              value={receivedValue}
              onChange={(e) => setReceivedValue(e.target.value)}
              onBlur={handleSaveReceived}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveReceived()}
              className="h-8 text-right"
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                setReceivedValue(source.received.toString())
                setEditingReceived(true)
              }}
              className="hover:bg-muted px-2 py-1 rounded transition-colors"
            >
              {formatCurrency(source.received)}
            </button>
          )}
        </div>
        {/* Spacer to align with category row action buttons */}
        <div className="w-12" />
      </div>
    </div>
  )
}

// Category Row Component
interface CategoryRowProps {
  category: {
    id: string
    name: string
    planned: number
    spent: number
    carryover: number
    remaining: number
    rolloverEnabled: boolean
  }
  isSelected: boolean
  onSelect: () => void
  onUpdateName: (name: string) => void
  onUpdatePlanned: (planned: number) => void
  onToggleRollover: (enabled: boolean) => void
  onDelete: () => void
}

function CategoryRow({
  category,
  isSelected,
  onSelect,
  onUpdateName,
  onUpdatePlanned,
  onToggleRollover,
  onDelete
}: CategoryRowProps): React.JSX.Element {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(category.name)
  const [editingPlanned, setEditingPlanned] = useState(false)
  const [plannedValue, setPlannedValue] = useState(category.planned.toString())

  const handleSaveName = (): void => {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== category.name) {
      onUpdateName(trimmed)
    } else {
      setNameValue(category.name)
    }
    setEditingName(false)
  }

  const handleSavePlanned = (): void => {
    const value = parseFloat(plannedValue) || 0
    if (value >= 0) {
      onUpdatePlanned(value)
    }
    setEditingPlanned(false)
  }

  return (
    <div
      className={cn(
        'group flex items-center justify-between py-3 px-6 transition-colors border-b border-border/30 last:border-b-0 cursor-pointer',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {editingName ? (
          <Input
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') handleSaveName()
              if (e.key === 'Escape') {
                setNameValue(category.name)
                setEditingName(false)
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-8 max-w-[200px]"
            autoFocus
          />
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setNameValue(category.name)
              setEditingName(true)
            }}
            className="font-medium truncate hover:bg-muted px-2 py-1 rounded transition-colors text-left"
          >
            {category.name}
          </button>
        )}
        {category.carryover > 0 && (
          <Badge variant="outline" className="text-xs">
            +{formatCurrency(category.carryover)}
          </Badge>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleRollover(!category.rolloverEnabled)
          }}
          className={cn(
            'p-1 rounded transition-colors',
            category.rolloverEnabled
              ? 'text-primary hover:text-primary/80'
              : 'text-muted-foreground/40 hover:text-muted-foreground'
          )}
          title={category.rolloverEnabled ? 'Rollover enabled - click to disable' : 'Click to enable rollover'}
        >
          <RefreshCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center">
        <div className="w-28 text-right pr-2">
          {editingPlanned ? (
            <Input
              type="number"
              value={plannedValue}
              onChange={(e) => setPlannedValue(e.target.value)}
              onBlur={handleSavePlanned}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') handleSavePlanned()
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-8 text-right"
              autoFocus
            />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setPlannedValue(category.planned.toString())
                setEditingPlanned(true)
              }}
              className="hover:bg-muted px-2 py-1 rounded transition-colors"
            >
              {formatCurrency(category.planned)}
            </button>
          )}
        </div>
        <div className="w-28 text-right">
          <span
            className={cn(
              'font-medium',
              category.spent > 0 ? 'text-primary' : 'text-green-600'
            )}
          >
            {formatCurrency(category.spent)}
          </span>
        </div>
        {/* Action buttons */}
        <div className="w-12 flex items-center justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            title="Delete Category"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
