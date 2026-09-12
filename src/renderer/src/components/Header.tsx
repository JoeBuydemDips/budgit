import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { parseMonthKey, formatMonth } from '@/lib/utils'

interface HeaderProps {
  title: string
  currentMonth: string
  onPreviousMonth: () => void
  onNextMonth: () => void
  onOpenBudgets: () => void
  showMonthNav?: boolean
}

export function Header({
  title,
  currentMonth,
  onPreviousMonth,
  onNextMonth,
  onOpenBudgets,
  showMonthNav = true
}: HeaderProps) {
  const monthDate = parseMonthKey(currentMonth)

  return (
    <header className="app-region-drag sticky top-0 z-30 border-b bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65">
      <div
        className={
          showMonthNav
            ? 'mx-auto grid h-16 max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 md:px-6'
            : 'mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6'
        }
      >
        <div className="app-region-no-drag flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary md:hidden">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="hidden min-w-0 items-center gap-2 text-sm md:flex">
            <span className="text-muted-foreground">Budgit</span>
            <span className="text-border">/</span>
            <span className="truncate font-semibold text-foreground">{title}</span>
          </div>
          <span className="truncate text-sm font-semibold md:hidden">{title}</span>
        </div>

        {/* Center - Month navigation */}
        {showMonthNav && (
          <div className="hidden md:flex items-center justify-center">
            <div className="app-region-no-drag flex items-center gap-1 rounded-full border bg-card/80 p-1 shadow-sm">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={onPreviousMonth}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="min-w-[156px] text-center text-sm font-semibold">
                {formatMonth(monthDate)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={onNextMonth}
                aria-label="Next month"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Right side actions */}
        <div className="app-region-no-drag flex items-center gap-2">
          <div className="rounded-xl border bg-card/70">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Mobile month controls */}
      {showMonthNav && (
        <>
          <div className="flex items-center justify-between px-4 pb-3 md:hidden app-region-no-drag">
            <Button variant="ghost" size="icon" onClick={onPreviousMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-base font-medium">{formatMonth(monthDate)}</span>
            <Button variant="ghost" size="icon" onClick={onNextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex justify-center px-4 pb-4 md:hidden app-region-no-drag">
            <Button variant="outline" size="sm" className="w-full" onClick={onOpenBudgets}>
              Manage budgets
            </Button>
          </div>
        </>
      )}
    </header>
  )
}
