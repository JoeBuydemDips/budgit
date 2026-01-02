import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { parseMonthKey, formatMonth } from '@/lib/utils'

interface HeaderProps {
  currentMonth: string
  onPreviousMonth: () => void
  onNextMonth: () => void
  onOpenBudgets: () => void
  showMonthNav?: boolean
}

export function Header({
  currentMonth,
  onPreviousMonth,
  onNextMonth,
  onOpenBudgets,
  showMonthNav = true
}: HeaderProps) {
  const monthDate = parseMonthKey(currentMonth)

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 app-region-drag">
      <div
        className={
          showMonthNav
            ? 'mx-auto grid h-16 max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 md:px-6'
            : 'mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6'
        }
      >
        {/* Left side - App icon only to keep nav clean */}
        <div className="flex items-center gap-2 app-region-no-drag">
          <Wallet className="h-6 w-6 text-primary" />
        </div>

        {/* Center - Month navigation */}
        {showMonthNav && (
          <div className="hidden md:flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 shadow-sm app-region-no-drag">
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
          </div>
        )}

        {/* Right side actions */}
        <div className="flex items-center gap-2 app-region-no-drag">
          <ThemeToggle />
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
