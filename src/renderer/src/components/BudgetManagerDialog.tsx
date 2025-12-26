import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Copy, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn, formatCurrency, formatMonth, parseMonthKey } from '@/lib/utils'
import type { Budget } from '../../../shared/types'

interface BudgetManagerDialogProps {
  open: boolean
  budgets: Budget[]
  loading: boolean
  currentMonth: string
  onOpenChange: (open: boolean) => void
  onSelectMonth: (month: string) => void
  onCreate: (month: string, incomeTotal: number, copyFromMonth?: string) => Promise<void>
  onDelete: (month: string) => Promise<void>
}

export function BudgetManagerDialog({
  open,
  budgets,
  loading,
  currentMonth,
  onOpenChange,
  onSelectMonth,
  onCreate,
  onDelete
}: BudgetManagerDialogProps) {
  const [monthInput, setMonthInput] = useState(currentMonth)
  const [incomeInput, setIncomeInput] = useState('')
  const [copyFrom, setCopyFrom] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const sortedBudgets = useMemo(
    () => [...budgets].sort((a, b) => b.month.localeCompare(a.month)),
    [budgets]
  )

  useEffect(() => {
    if (open) {
      setMonthInput(currentMonth)
      const active = budgets.find((b) => b.month === currentMonth)
      if (active) {
        setIncomeInput(active.incomeTotal.toString())
      } else {
        setIncomeInput('')
      }
    }
  }, [open, currentMonth, budgets])

  const handleCreate = async () => {
    if (!monthInput || !incomeInput) return
    setCreating(true)
    await onCreate(monthInput, parseFloat(incomeInput), copyFrom || undefined)
    setCreating(false)
    setCopyFrom('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Budget Manager
          </DialogTitle>
          <DialogDescription>Switch months, copy budgets, or start fresh.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Month</p>
                <p className="text-xl font-semibold">{formatMonth(parseMonthKey(currentMonth))}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onSelectMonth(currentMonth)}>
                Open
              </Button>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Create or Copy Budget</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="budget-month">Month</Label>
                  <Input
                    id="budget-month"
                    type="month"
                    value={monthInput}
                    onChange={(e) => setMonthInput(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="income">Income</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="income"
                      type="number"
                      placeholder="0.00"
                      className="pl-7"
                      value={incomeInput}
                      onChange={(e) => setIncomeInput(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="copy-from">Copy from</Label>
                <select
                  id="copy-from"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={copyFrom}
                  onChange={(e) => setCopyFrom(e.target.value)}
                >
                  <option value="">Start from scratch</option>
                  {sortedBudgets.map((b) => (
                    <option key={b.id} value={b.month}>
                      {formatMonth(parseMonthKey(b.month))}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={!monthInput || !incomeInput || creating}
              >
                {creating ? 'Creating…' : copyFrom ? 'Copy Budget' : 'Create Budget'}
                {copyFrom ? <Copy className="ml-2 h-4 w-4" /> : <Plus className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Your Budgets</h3>
              <span className="text-xs text-muted-foreground">
                {loading ? 'Loading…' : `${sortedBudgets.length} saved`}
              </span>
            </div>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border">
              {sortedBudgets.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No budgets yet. Create your first one.
                </div>
              ) : (
                <div className="divide-y">
                  {sortedBudgets.map((budget) => {
                    const isActive = budget.month === currentMonth
                    return (
                      <div
                        key={budget.id}
                        className={cn('flex items-center justify-between gap-3 p-4',
                          isActive && 'bg-muted/60')}
                      >
                        <div className="space-y-1">
                          <p className="font-medium leading-none">
                            {formatMonth(parseMonthKey(budget.month))}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Income {formatCurrency(budget.incomeTotal)}
                            {budget.isBalanced ? ' • Balanced' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={isActive ? 'secondary' : 'outline'}
                            onClick={() => {
                              onSelectMonth(budget.month)
                              onOpenChange(false)
                            }}
                          >
                            Open
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-destructive"
                            onClick={() => setDeleting(budget.month)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {deleting && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <div className="flex items-center justify-between">
                  <span>
                    Delete {formatMonth(parseMonthKey(deleting))}? This removes its transactions.
                  </span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        await onDelete(deleting)
                        setDeleting(null)
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
