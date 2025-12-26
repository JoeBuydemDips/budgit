import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { parseMonthKey, formatMonth } from '@/lib/utils'

interface HeaderProps {
  currentMonth: string
  onPreviousMonth: () => void
  onNextMonth: () => void
}

export function Header({ currentMonth, onPreviousMonth, onNextMonth }: HeaderProps) {
  const monthDate = parseMonthKey(currentMonth)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Drag region for macOS traffic lights */}
      <div className="absolute inset-0 app-region-drag" />

      <div className="flex h-full items-center justify-between px-4 pl-20">
        {/* Left side - App branding */}
        <div className="flex items-center gap-2 app-region-no-drag">
          <Wallet className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Budgit</span>
        </div>

        {/* Center - Month navigation */}
        <div className="flex items-center gap-2 app-region-no-drag">
          <Button variant="ghost" size="icon" onClick={onPreviousMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="min-w-[160px] text-center text-lg font-medium">
            {formatMonth(monthDate)}
          </span>
          <Button variant="ghost" size="icon" onClick={onNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Right side - Theme toggle */}
        <div className="app-region-no-drag">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
