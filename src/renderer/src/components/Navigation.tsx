import { LayoutDashboard, PiggyBank, Receipt, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ViewType = 'dashboard' | 'budget' | 'transactions' | 'settings'

interface NavigationProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

const navItems: {
  id: ViewType
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'budget', label: 'Budget', icon: PiggyBank },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'settings', label: 'Settings', icon: Settings }
]

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:top-14 md:bottom-auto md:border-t-0 md:border-b">
      <div className="flex h-16 items-center justify-around md:justify-center md:gap-2 md:h-12">
        {navItems.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={currentView === id ? 'secondary' : 'ghost'}
            className={cn(
              'flex flex-col items-center gap-1 h-auto py-2 px-4 md:flex-row md:gap-2 md:py-2',
              currentView === id && 'text-primary'
            )}
            onClick={() => onViewChange(id)}
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs md:text-sm">{label}</span>
          </Button>
        ))}
      </div>
    </nav>
  )
}
