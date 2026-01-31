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
import type { BudgetItem, Transaction, LearnedItemMapping } from '../../../shared/types'
import { getItemSuggestions } from '../../../shared/categoryInference'

interface AddTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: BudgetItem[]
  learnedMappings?: LearnedItemMapping[]
  currentMonth: string
  defaultItemId?: string
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  items,
  learnedMappings,
  currentMonth,
  defaultItemId,
  onAddTransaction
}: AddTransactionDialogProps) {
  const [amount, setAmount] = useState('')
  const [itemId, setItemId] = useState(defaultItemId || '')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [itemSuggestions, setItemSuggestions] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setItemId(defaultItemId || '')
      setAmount('')
      setDescription('')
      setDate(new Date().toISOString().split('T')[0])
      setItemSuggestions([])
    }
  }, [open, defaultItemId])

  // Update item suggestions when description changes
  useEffect(() => {
    if (description.trim()) {
      try {
        const suggestions = getItemSuggestions(
          description,
          items || [],
          learnedMappings ?? []
        )
        setItemSuggestions(suggestions)
      } catch (err) {
        console.error('Error computing item suggestions', err)
        setItemSuggestions([])
      }
    } else {
      setItemSuggestions([])
    }
  }, [description, items, learnedMappings])

  const handleSave = async () => {
    if (!amount || !itemId || saving) return

    setSaving(true)
    setErrorMessage(null)

    try {
      await onAddTransaction({
        amount: parseFloat(amount),
        itemId,
        description,
        date: new Date(date).toISOString(),
        budgetMonth: currentMonth
      })

      // Reset form only on success
      setAmount('')
      setItemId('')
      setDescription('')
      setDate(new Date().toISOString().split('T')[0])
      setItemSuggestions([])

      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Failed to add transaction', err)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to add transaction')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>Record a new expense to track your spending</DialogDescription>
        </DialogHeader>

        {errorMessage && <p className="text-sm text-destructive mb-2">{errorMessage}</p>}

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
            <Label htmlFor="item">Item</Label>
            {itemSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-sm text-muted-foreground">Suggestions:</span>
                {itemSuggestions.slice(0, 3).map((suggestionId) => {
                  const item = items.find((c) => c.id === suggestionId)
                  return item ? (
                    <Button
                      key={suggestionId}
                      variant="outline"
                      size="sm"
                      onClick={() => setItemId(suggestionId)}
                      className={
                        itemId === suggestionId ? 'bg-primary text-primary-foreground' : ''
                      }
                    >
                      {item.name}
                    </Button>
                  ) : null
                })}
              </div>
            )}
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an item" />
              </SelectTrigger>
              <SelectContent>
                {(items || []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
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
            disabled={!amount || parseFloat(amount) <= 0 || !itemId || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving...' : 'Add Expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
