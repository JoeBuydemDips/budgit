import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Sparkles,
  RefreshCcw,
  GripVertical,
  X
} from 'lucide-react'
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
import { useBudgetIndex } from '@/hooks/useBudget'
import { CategoryDetailPanel } from '@/components/CategoryDetailPanel'
import { BudgetSummaryPanel } from '@/components/BudgetSummaryPanel'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  MeasuringStrategy,
  DraggableAttributes,
  DraggableSyntheticListeners
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import type { BudgetWithComputed, BudgetItem, Group, Transaction, IncomeSource } from '../../../shared/types'

// Import colors directly
const GROUP_COLORS: Record<Group, string> = {
  GIVING: '#10B981',
  SAVINGS: '#3B82F6',
  NEEDS: '#8B5CF6',
  WANTS: '#F59E0B',
  DEBT: '#EF4444',
  FOOD: '#06B6D4',
  MISC: '#6B7280'
}

interface BudgetViewProps {
  budget: BudgetWithComputed | null
  items: BudgetItem[]
  transactions: Transaction[]
  loading: boolean
  currentMonth: string
  onCreateBudget: (incomeTotal: number, copyFromMonth?: string) => Promise<void>
  onUpdateAllocation: (itemId: string, planned: number) => Promise<void>
  onUpdateIncomeSources: (sources: IncomeSource[]) => Promise<void>
  onAddItem: (item: Omit<BudgetItem, 'id'>) => Promise<void>
  onUpdateItem: (id: string, updates: Partial<BudgetItem>) => Promise<void>
  onDeleteItem: (id: string) => Promise<void>
  onRemoveFromBudget: (itemId: string) => Promise<void>
  onReorderItems: (itemIds: string[]) => Promise<void>
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
  onUpdateTransaction: (
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>
  ) => Promise<void>
  onDeleteTransaction: (id: string) => Promise<void>
}

const GROUP_LABELS: Record<Group, string> = {
  GIVING: 'Giving',
  SAVINGS: 'Savings',
  NEEDS: 'Housing & Utilities',
  WANTS: 'Lifestyle',
  DEBT: 'Debt',
  FOOD: 'Food',
  MISC: 'Miscellaneous'
}

const GROUP_ORDER: Group[] = [
  'GIVING',
  'SAVINGS',
  'NEEDS',
  'FOOD',
  'WANTS',
  'DEBT',
  'MISC'
]

const GROUP_COLOR_CLASS: Record<Group, string> = {
  GIVING: 'bg-emerald-500',
  SAVINGS: 'bg-blue-500',
  NEEDS: 'bg-violet-500',
  WANTS: 'bg-amber-500',
  DEBT: 'bg-rose-500',
  FOOD: 'bg-cyan-500',
  MISC: 'bg-slate-500'
}

export function BudgetView({
  budget,
  items,
  transactions,
  loading,
  currentMonth,
  onCreateBudget,
  onUpdateAllocation,
  onUpdateIncomeSources,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onRemoveFromBudget,
  onReorderItems,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction
}: BudgetViewProps) {
  const { budgets } = useBudgetIndex()
  const [showNewBudgetDialog, setShowNewBudgetDialog] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [addItemMode, setAddItemMode] = useState<'existing' | 'new'>('existing')
  const [selectedExistingItem, setSelectedExistingItem] = useState('')
  const [showAddIncomeDialog, setShowAddIncomeDialog] = useState(false)
  const [showQuickAddDialog, setShowQuickAddDialog] = useState(false)
  const [quickAddAmount, setQuickAddAmount] = useState('')
  const [quickAddDescription, setQuickAddDescription] = useState('')
  const [quickAddDate, setQuickAddDate] = useState(new Date().toISOString().split('T')[0])
  const [quickAddItemId, setQuickAddItemId] = useState('')
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [selectedIncomeSource, setSelectedIncomeSource] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemGroup, setNewItemGroup] = useState<Group>('NEEDS')
  const [newIncome, setNewIncome] = useState('')
  const [newIncomeName, setNewIncomeName] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const [creating, setCreating] = useState(false)
  const [showDeleteItemDialog, setShowDeleteItemDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<BudgetItem | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    INCOME: true,
    GIVING: true,
    SAVINGS: true,
    NEEDS: true,
    WANTS: true,
    DEBT: true
  })

  // DnD Kit sensors for drag and drop

  const sortedBudgets = useMemo(
    () => [...budgets].sort((a, b) => b.month.localeCompare(a.month)),
    [budgets]
  )

  useEffect(() => {
    if (copyFrom && copyFrom !== 'scratch') {
      const source = budgets.find((b) => b.month === copyFrom)
      if (source) {
        setNewIncome(source.incomeTotal.toString())
      }
    }
  }, [copyFrom, budgets])
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // Require 8px movement before starting drag
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const toggleGroup = (type: string) => {
    setExpandedGroups((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  // Handle drag end for item reordering
  const handleDragEnd = async (event: DragEndEvent, groupType: Group) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      // Get items of this group sorted by sortOrder
      const groupItems = items
        .filter((i) => i.group === groupType)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

      const oldIndex = groupItems.findIndex((i) => i.id === active.id)
      const newIndex = groupItems.findIndex((i) => i.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(groupItems, oldIndex, newIndex)
        const reorderedIds = reordered.map((i) => i.id)
        await onReorderItems(reorderedIds)
      }
    }
  }

  // Handle drag end for income source reordering
  const handleIncomeDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = incomeSources.findIndex((s) => s.id === active.id)
      const newIndex = incomeSources.findIndex((s) => s.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(incomeSources, oldIndex, newIndex)
        await onUpdateIncomeSources(reordered)
      }
    }
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
              No budget set up for this month yet. Let&apos;s create one!
            </p>
          </div>

          <Card className="border-2">
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <Label htmlFor="empty-copy-from" className="text-base">Copy from</Label>
                <Select
                  value={copyFrom || 'scratch'}
                  onValueChange={(val) => setCopyFrom(val === 'scratch' ? 'scratch' : val)}
                >
                  <SelectTrigger id="empty-copy-from" className="h-12">
                    <SelectValue placeholder="Start from scratch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scratch">Start from scratch</SelectItem>
                    {sortedBudgets
                      .filter((b) => b.month !== currentMonth)
                      .map((b) => (
                        <SelectItem key={b.id} value={b.month}>
                          {formatMonth(parseMonthKey(b.month))}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full h-12 text-base"
                size="lg"
                onClick={() => setShowNewBudgetDialog(true)}
              >
                <Plus className="h-5 w-5 mr-2" />
                {copyFrom && copyFrom !== 'scratch' ? 'Copy Budget' : 'Create Budget'}
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
                <Label htmlFor="copy-from">Copy from</Label>
                <Select value={copyFrom} onValueChange={setCopyFrom}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Start from scratch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scratch">Start from scratch</SelectItem>
                    {sortedBudgets
                      .filter((b) => b.month !== currentMonth)
                      .map((b) => (
                        <SelectItem key={b.id} value={b.month}>
                          {formatMonth(parseMonthKey(b.month))}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="income">Total Income</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="income"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-7 h-12 text-lg"
                    value={newIncome}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '')
                      setNewIncome(val)
                    }}
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
                  const copyFromMonth = copyFrom && copyFrom !== 'scratch' ? copyFrom : undefined
                  await onCreateBudget(parseFloat(newIncome), copyFromMonth)
                  setShowNewBudgetDialog(false)
                  setNewIncome('')
                  setCopyFrom('')
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

  // Group items by group with calculated data
  // Only show items that have an allocation in this budget
  const allocatedItemIds = new Set(budget.allocations.map((a) => a.itemId))
  const groupedItems = GROUP_ORDER.map((group) => {
    const groupItems = items
      .filter((i) => i.group === group && allocatedItemIds.has(i.id))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) // Sort by sortOrder
      .map((item) => {
        const allocation = budget.allocations.find((a) => a.itemId === item.id)
        return {
          ...item,
          planned: allocation?.planned || 0,
          spent: allocation?.spent || 0,
          carryover: allocation?.carryover || 0,
          remaining:
            (allocation?.planned || 0) + (allocation?.carryover || 0) - (allocation?.spent || 0)
        }
      })
    const groupPlanned = groupItems.reduce((sum, i) => sum + i.planned, 0)
    const groupSpent = groupItems.reduce((sum, i) => sum + i.spent, 0)
    const groupRemaining = groupItems.reduce((sum, i) => sum + i.remaining, 0)

    return {
      group,
      label: GROUP_LABELS[group],
      color: GROUP_COLORS[group],
      items: groupItems,
      planned: groupPlanned,
      spent: groupSpent,
      remaining: groupRemaining
    }
  }).filter((g) => g.items.length > 0 || true) // Show all groups

  // Summary panel data
  const itemBreakdown = GROUP_ORDER.map((grp) => {
    const groupData = groupedItems.find((g) => g.group === grp)
    return {
      group: grp,
      label: GROUP_LABELS[grp],
      planned: groupData?.planned || 0,
      spent: groupData?.spent || 0,
      percentage: budget.incomeTotal > 0 ? ((groupData?.planned || 0) / budget.incomeTotal) * 100 : 0
    }
  })

  // Find selected item data for detail panel
  const selectedItemData = selectedItem
    ? groupedItems.flatMap((g) => g.items).find((i) => i.id === selectedItem)
    : null

  // Find selected income source data for detail panel
  const selectedIncomeSourceData = selectedIncomeSource
    ? incomeSources.find((s) => s.id === selectedIncomeSource)
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

  const handleUpdateIncomeSource = async (
    id: string,
    updates: Partial<IncomeSource>
  ): Promise<void> => {
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
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-4 md:pb-8 pt-4 space-y-6">
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
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Planned
                        </p>
                        <p className="font-semibold">{formatCurrency(budget.incomeTotal)}</p>
                      </div>
                      <div className="w-28 text-right">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Received
                        </p>
                        <p className="font-semibold">{formatCurrency(totalReceived)}</p>
                      </div>
                      <div className="w-12" />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-0 space-y-0">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleIncomeDragEnd}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                    measuring={{
                      droppable: {
                        strategy: MeasuringStrategy.Always
                      }
                    }}
                  >
                    <SortableContext
                      items={incomeSources.map((s) => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {incomeSources.map((source) => (
                        <SortableIncomeRow
                          key={source.id}
                          source={source}
                          canDelete={incomeSources.length > 1}
                          isSelected={selectedIncomeSource === source.id}
                          onSelect={() => {
                            setSelectedIncomeSource(source.id)
                            setSelectedItem(null)
                          }}
                          onUpdate={(updates) => handleUpdateIncomeSource(source.id, updates)}
                          onDelete={() => handleDeleteIncomeSource(source.id)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:text-primary/80 ml-6 mt-2"
                    onClick={() => setShowAddIncomeDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Income
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Item Groups */}
          {groupedItems.map((group) => (
            <Card key={group.group}>
              <Collapsible
                open={expandedGroups[group.group]}
                onOpenChange={() => toggleGroup(group.group)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-1.5 h-8 rounded-full', GROUP_COLOR_CLASS[group.group])} />
                        <div>
                          <CardTitle className="text-base font-semibold flex items-center gap-2">
                            {group.label}
                            {expandedGroups[group.group] ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </CardTitle>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="w-28 text-right pr-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            Planned
                          </p>
                          <p className="font-semibold">{formatCurrency(group.planned)}</p>
                        </div>
                        <div className="w-28 text-right">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            Spent
                          </p>
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
                    {group.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center italic">
                        No items yet
                      </p>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(event, group.group)}
                        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                        measuring={{
                          droppable: {
                            strategy: MeasuringStrategy.Always
                          }
                        }}
                      >
                        <SortableContext
                          items={group.items.map((i) => i.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {group.items.map((item) => (
                            <SortableItemRow
                              key={item.id}
                              item={item}
                              isSelected={selectedItem === item.id}
                              onSelect={() => {
                                setSelectedItem(item.id)
                                setSelectedIncomeSource(null)
                              }}
                              onUpdateName={async (name) => {
                                await onUpdateItem(item.id, { name })
                              }}
                              onUpdatePlanned={(planned) => onUpdateAllocation(item.id, planned)}
                              onToggleRollover={async (enabled) => {
                                await onUpdateItem(item.id, { rolloverEnabled: enabled })
                              }}
                              onRemoveFromBudget={async () => {
                                await onRemoveFromBudget(item.id)
                              }}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary/80 ml-6 mt-2"
                      onClick={() => {
                        setNewItemGroup(group.group)
                        setShowAddItemDialog(true)
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
        {selectedItemData ? (
          <CategoryDetailPanel
            item={selectedItemData}
            transactions={transactions}
            items={items}
            learnedMappings={[]}
            currentMonth={currentMonth}
            onClose={() => setSelectedItem(null)}
            onUpdateTransaction={onUpdateTransaction}
            onDeleteTransaction={onDeleteTransaction}
            onUpdateItem={onUpdateItem}
            onAddTransaction={onAddTransaction}
          />
        ) : selectedIncomeSourceData ? (
          <IncomeDetailPanel
            incomeSource={selectedIncomeSourceData}
            onClose={() => setSelectedIncomeSource(null)}
            onUpdate={(updates) => handleUpdateIncomeSource(selectedIncomeSourceData.id, updates)}
          />
        ) : (
          <BudgetSummaryPanel
            incomeTotal={budget.incomeTotal}
            totalPlanned={totalPlanned}
            totalSpent={budget.computed.totalSpentCategorized}
            leftToBudget={leftToBudget}
            categoryBreakdown={itemBreakdown}
            transactions={transactions}
            items={items}
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

      <Dialog open={showAddItemDialog} onOpenChange={(open) => {
        setShowAddItemDialog(open)
        if (!open) {
          setAddItemMode('existing')
          setSelectedExistingItem('')
          setNewItemName('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item to Budget</DialogTitle>
            <DialogDescription>Add an existing item or create a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Mode tabs */}
            <div className="flex gap-2">
              <Button
                variant={addItemMode === 'existing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAddItemMode('existing')}
              >
                Existing Item
              </Button>
              <Button
                variant={addItemMode === 'new' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAddItemMode('new')}
              >
                New Item
              </Button>
            </div>

            {addItemMode === 'existing' ? (
              <div className="space-y-2">
                <Label>Select Item</Label>
                <Select
                  value={selectedExistingItem}
                  onValueChange={setSelectedExistingItem}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an item..." />
                  </SelectTrigger>
                  <SelectContent>
                    {items
                      .filter((i) => !allocatedItemIds.has(i.id))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({GROUP_LABELS[item.group]})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {items.filter((i) => !allocatedItemIds.has(i.id)).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    All items are already in this budget. Create a new one instead.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Item Name</Label>
                  <Input
                    placeholder="e.g., Groceries, Rent, Netflix"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Item Group</Label>
                  <Select
                    value={newItemGroup}
                    onValueChange={(val) => setNewItemGroup(val as Group)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GROUP_ORDER.map((grp) => (
                        <SelectItem key={grp} value={grp}>
                          {GROUP_LABELS[grp]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={addItemMode === 'existing' ? !selectedExistingItem : !newItemName}
              onClick={async () => {
                if (addItemMode === 'existing' && selectedExistingItem) {
                  // Add existing item to this month's budget with $0 allocation
                  await onUpdateAllocation(selectedExistingItem, 0)
                } else if (addItemMode === 'new' && newItemName) {
                  // Create new item (which automatically gets added to the budget)
                  await onAddItem({
                    name: newItemName,
                    group: newItemGroup,
                    rolloverEnabled: false,
                    sortOrder: 0
                  })
                }
                setShowAddItemDialog(false)
                setSelectedExistingItem('')
                setNewItemName('')
              }}
            >
              {addItemMode === 'existing' ? 'Add to Budget' : 'Create Item'}
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
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="pl-7"
                  value={newIncome}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '')
                    setNewIncome(val)
                  }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddIncomeDialog(false)}>
              Cancel
            </Button>
            <Button disabled={!newIncomeName || !newIncome} onClick={handleAddIncomeSource}>
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
                  type="text"
                  inputMode="decimal"
                  value={quickAddAmount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '')
                    setQuickAddAmount(val)
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
                <Label>Item</Label>
                <Select value={quickAddItemId} onValueChange={setQuickAddItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an item" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupedItems.map((group) =>
                      group.items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: group.color }}
                            />
                            {item.name}
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
              disabled={!quickAddAmount || parseFloat(quickAddAmount) <= 0 || !quickAddItemId}
              onClick={async () => {
                const item = items.find((i) => i.id === quickAddItemId)
                await onAddTransaction({
                  amount: parseFloat(quickAddAmount),
                  description: quickAddDescription || item?.name || '',
                  date: quickAddDate,
                  itemId: quickAddItemId,
                  budgetMonth: currentMonth
                })
                setShowQuickAddDialog(false)
                setQuickAddAmount('')
                setQuickAddDescription('')
                setQuickAddItemId('')
              }}
            >
              Track Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteItemDialog} onOpenChange={setShowDeleteItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete &quot;{itemToDelete?.name}&quot;? This
              will remove the item and all its allocations from all budgets. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteItemDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (itemToDelete) {
                  await onDeleteItem(itemToDelete.id)
                  setShowDeleteItemDialog(false)
                  setItemToDelete(null)
                }
              }}
            >
              Delete Item
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
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<IncomeSource>) => void
  onDelete: () => void
  dragHandleProps?: {
    attributes: DraggableAttributes
    listeners: DraggableSyntheticListeners
  }
}

// Sortable wrapper for income row
function SortableIncomeRow(props: Omit<IncomeRowProps, 'dragHandleProps'>): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.source.id
  })

  const nodeRef = useRef<HTMLDivElement | null>(null)
  const assignRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node)
      nodeRef.current = node
    },
    [setNodeRef]
  )

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return
    node.style.transform = CSS.Transform.toString(transform) ?? ''
    node.style.transition = transition ?? 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)'
    node.style.opacity = isDragging ? '0.9' : '1'
    node.style.zIndex = isDragging ? '50' : '0'
    node.style.position = 'relative'
    node.style.boxShadow = isDragging ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none'
    node.style.backgroundColor = isDragging ? 'hsl(var(--background))' : ''
    node.style.borderRadius = isDragging ? '6px' : ''
  }, [transform, transition, isDragging])

  return (
    <div ref={assignRef}>
      <IncomeRow {...props} dragHandleProps={{ attributes, listeners }} />
    </div>
  )
}

function IncomeRow({
  source,
  canDelete,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  dragHandleProps
}: IncomeRowProps) {
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
    <div
      className={cn(
        'group flex items-center justify-between py-3 px-6 transition-colors border-b border-border/30 last:border-b-0 cursor-pointer',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Drag handle */}
        {dragHandleProps && (
          <button
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-2 text-muted-foreground/50 hover:text-muted-foreground touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
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
      </div>
      <div className="flex items-center">
        <div className="w-28 text-right pr-2">
          {editingPlanned ? (
            <Input
              type="text"
              inputMode="decimal"
              value={plannedValue}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '')
                setPlannedValue(val)
              }}
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
              className="hover:bg-muted pl-2 py-1 rounded transition-colors"
            >
              {formatCurrency(source.planned)}
            </button>
          )}
        </div>
        <div className="w-28 text-right">
          {editingReceived ? (
            <Input
              type="text"
              inputMode="decimal"
              value={receivedValue}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '')
                setReceivedValue(val)
              }}
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
              className="hover:bg-muted pl-2 py-1 rounded transition-colors"
            >
              {formatCurrency(source.received)}
            </button>
          )}
        </div>
        {/* Action buttons - matching ItemRow structure */}
        <div className="w-12 flex items-center justify-end">
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              title="Delete Income"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// Item Row Component
interface ItemRowProps {
  item: {
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
  onRemoveFromBudget: () => void
  dragHandleProps?: {
    attributes: DraggableAttributes
    listeners: DraggableSyntheticListeners
  }
}

// Sortable wrapper component
function SortableItemRow(props: Omit<ItemRowProps, 'dragHandleProps'>): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id
  })

  const nodeRef = useRef<HTMLDivElement | null>(null)
  const assignRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node)
      nodeRef.current = node
    },
    [setNodeRef]
  )

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return
    node.style.transform = CSS.Transform.toString(transform) ?? ''
    node.style.transition = transition ?? 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)'
    node.style.opacity = isDragging ? '0.9' : '1'
    node.style.zIndex = isDragging ? '50' : '0'
    node.style.position = 'relative'
    node.style.boxShadow = isDragging ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none'
    node.style.backgroundColor = isDragging ? 'hsl(var(--background))' : ''
    node.style.borderRadius = isDragging ? '6px' : ''
  }, [transform, transition, isDragging])

  return (
    <div ref={assignRef}>
      <ItemRow {...props} dragHandleProps={{ attributes, listeners }} />
    </div>
  )
}

function ItemRow({
  item,
  isSelected,
  onSelect,
  onUpdateName,
  onUpdatePlanned,
  onToggleRollover,
  onRemoveFromBudget,
  dragHandleProps
}: ItemRowProps): React.JSX.Element {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(item.name)
  const [editingPlanned, setEditingPlanned] = useState(false)
  const [plannedValue, setPlannedValue] = useState(item.planned.toString())

  const handleSaveName = (): void => {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== item.name) {
      onUpdateName(trimmed)
    } else {
      setNameValue(item.name)
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
        {/* Drag handle */}
        {dragHandleProps && (
          <button
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-2 text-muted-foreground/50 hover:text-muted-foreground touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
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
                setNameValue(item.name)
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
              setNameValue(item.name)
              setEditingName(true)
            }}
            className="font-medium truncate hover:bg-muted px-2 py-1 rounded transition-colors text-left"
          >
            {item.name}
          </button>
        )}
        {item.carryover > 0 && (
          <Badge variant="outline" className="text-xs">
            +{formatCurrency(item.carryover)}
          </Badge>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleRollover(!item.rolloverEnabled)
          }}
          className={cn(
            'p-1 rounded transition-colors',
            item.rolloverEnabled
              ? 'text-primary hover:text-primary/80'
              : 'text-muted-foreground/40 hover:text-muted-foreground'
          )}
          title={
            item.rolloverEnabled
              ? 'Rollover enabled - click to disable'
              : 'Click to enable rollover'
          }
        >
          <RefreshCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center">
        <div className="w-28 text-right pr-2">
          {editingPlanned ? (
            <Input
              type="text"
              inputMode="decimal"
              value={plannedValue}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '')
                setPlannedValue(val)
              }}
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
                setPlannedValue(item.planned.toString())
                setEditingPlanned(true)
              }}
              className="hover:bg-muted pl-2 py-1 rounded transition-colors"
            >
              {formatCurrency(item.planned)}
            </button>
          )}
        </div>
        <div className="w-28 text-right">
          <span
            className={cn('font-medium', item.spent > 0 ? 'text-primary' : 'text-green-600')}
          >
            {formatCurrency(item.spent)}
          </span>
        </div>
        {/* Action button */}
        <div className="w-12 flex items-center justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onRemoveFromBudget()
            }}
            title="Remove from this month's budget"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Income Detail Panel Component
interface IncomeDetailPanelProps {
  incomeSource: IncomeSource
  onClose: () => void
  onUpdate: (updates: Partial<IncomeSource>) => void
}

function IncomeDetailPanel({
  incomeSource,
  onClose,
  onUpdate
}: IncomeDetailPanelProps): React.JSX.Element {
  const [editingPlanned, setEditingPlanned] = useState(false)
  const [editingReceived, setEditingReceived] = useState(false)
  const [plannedValue, setPlannedValue] = useState(incomeSource.planned.toString())
  const [receivedValue, setReceivedValue] = useState(incomeSource.received.toString())

  const remaining = incomeSource.planned - incomeSource.received
  const receivedPercentage =
    incomeSource.planned > 0
      ? Math.min((incomeSource.received / incomeSource.planned) * 100, 100)
      : 0

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
    <div className="h-full flex flex-col bg-background border-l">
      {/* Green Header for Income */}
      <div className="relative px-6 pt-6 pb-8 text-white bg-gradient-to-br from-emerald-500 to-emerald-600">
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
            <h2 className="text-2xl font-bold">{incomeSource.name}</h2>
            <p className="text-white/70 text-sm mt-0.5">
              {formatCurrency(incomeSource.received)} of {formatCurrency(incomeSource.planned)}{' '}
              received
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <progress
              value={receivedPercentage}
              max={100}
              className="h-2 w-full overflow-hidden rounded-full bg-white/20 [--bar-bg:theme(colors.white)] [--bar-radius:9999px] [--bar-height:0.5rem] [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-[color:var(--bar-bg)] [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:bg-[color:var(--bar-bg)] [&::-moz-progress-bar]:rounded-full"
            />
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <span className="text-white/70 text-sm">Remaining</span>
            <span className="text-3xl font-bold tracking-tight">{formatCurrency(remaining)}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Planned Amount */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Expected Amount</Label>
          {editingPlanned ? (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                type="text"
                inputMode="decimal"
                value={plannedValue}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '')
                  setPlannedValue(val)
                }}
                onBlur={handleSavePlanned}
                onKeyDown={(e) => e.key === 'Enter' && handleSavePlanned()}
                className="pl-7 text-lg"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setPlannedValue(incomeSource.planned.toString())
                setEditingPlanned(true)
              }}
              className="w-full text-left text-2xl font-semibold hover:bg-muted px-3 py-2 rounded-lg transition-colors"
            >
              {formatCurrency(incomeSource.planned)}
            </button>
          )}
        </div>

        {/* Received Amount */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Received Amount</Label>
          {editingReceived ? (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                type="text"
                inputMode="decimal"
                value={receivedValue}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '')
                  setReceivedValue(val)
                }}
                onBlur={handleSaveReceived}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveReceived()}
                className="pl-7 text-lg"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setReceivedValue(incomeSource.received.toString())
                setEditingReceived(true)
              }}
              className="w-full text-left text-2xl font-semibold text-green-600 hover:bg-muted px-3 py-2 rounded-lg transition-colors"
            >
              {formatCurrency(incomeSource.received)}
            </button>
          )}
        </div>

        {/* Status indicator */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant={incomeSource.received >= incomeSource.planned ? 'default' : 'secondary'}
              className={cn(
                incomeSource.received >= incomeSource.planned && 'bg-green-500 hover:bg-green-600'
              )}
            >
              {incomeSource.received >= incomeSource.planned ? 'Fully Received' : 'Pending'}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}
