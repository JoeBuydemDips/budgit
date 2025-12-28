import { useState, useEffect } from 'react'
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
import type { Category, Transaction, LearnedCategoryMapping } from '../../../shared/types'
import { getCategorySuggestions } from '../../../shared/categoryInference'

interface AddTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  learnedMappings?: LearnedCategoryMapping[]
  currentMonth: string
  defaultCategoryId?: string
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  categories,
  learnedMappings = [],
  currentMonth,
  defaultCategoryId,
  onAddTransaction
}: AddTransactionDialogProps) {
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(defaultCategoryId || '')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setCategoryId(defaultCategoryId || '')
      setAmount('')
      setDescription('')
      setDate(new Date().toISOString().split('T')[0])
      setCategorySuggestions([])
    }
  }, [open, defaultCategoryId])

  // Update category suggestions when description changes
  useEffect(() => {
    if (description.trim()) {
      const suggestions = getCategorySuggestions(description, categories, learnedMappings)
      setCategorySuggestions(suggestions)
      // Auto-select first suggestion if no category selected
      if (!categoryId && suggestions.length > 0) {
        setCategoryId(suggestions[0])
      }
    } else {
      setCategorySuggestions([])
    }
  }, [description, categories, learnedMappings, categoryId])

  const handleSave = async () => {
    if (!amount || !categoryId) return

    setSaving(true)
    await onAddTransaction({
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
    setCategorySuggestions([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>Record a new expense to track your spending</DialogDescription>
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
            {categorySuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-sm text-muted-foreground">Suggestions:</span>
                {categorySuggestions.slice(0, 3).map((suggestionId) => {
                  const category = categories.find(c => c.id === suggestionId)
                  return category ? (
                    <Button
                      key={suggestionId}
                      variant="outline"
                      size="sm"
                      onClick={() => setCategoryId(suggestionId)}
                      className={categoryId === suggestionId ? 'bg-primary text-primary-foreground' : ''}
                    >
                      {category.name}
                    </Button>
                  ) : null
                })}
              </div>
            )}
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
            {saving ? 'Saving...' : 'Add Expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
