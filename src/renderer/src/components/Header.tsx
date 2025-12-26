import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { parseMonthKey, formatMonth } from '@/lib/utils'

interface HeaderProps {
  currentMonth: string
  onPreviousMonth: () => void
  onNextMonth: () => void
  onOpenBudgets: () => void
}

export function Header({ currentMonth, onPreviousMonth, onNextMonth, onOpenBudgets }: HeaderProps) {
  const monthDate = parseMonthKey(currentMonth)

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      {/* Drag region for macOS traffic lights */}
      <div className="absolute inset-0 app-region-drag" />

      <div className="app-region-no-drag">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          {/* Left side - App branding */}
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <div>
              <p className="text-lg font-semibold leading-tight">Budgit</p>
              <p className="text-xs text-muted-foreground">Zero-based budgeting</p>
            </div>
          </div>

          {/* Center - Month navigation */}
          <div className="hidden md:flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 shadow-sm">
            <Button variant="ghost" size="icon" onClick={onPreviousMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="min-w-[180px] text-center text-base font-medium">
              {formatMonth(monthDate)}
            </span>
            <Button variant="ghost" size="icon" onClick={onNextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" className="hidden md:inline-flex" onClick={onOpenBudgets}>
              Manage budgets
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile month controls */}
        <div className="flex items-center justify-between px-4 pb-3 md:hidden">
          <Button variant="ghost" size="icon" onClick={onPreviousMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-base font-medium">{formatMonth(monthDate)}</span>
          <Button variant="ghost" size="icon" onClick={onNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex justify-center px-4 pb-4 md:hidden">
          <Button variant="outline" size="sm" className="w-full" onClick={onOpenBudgets}>
            Manage budgets
          </Button>
        </div>
      </div>
    </header>
  )
}
