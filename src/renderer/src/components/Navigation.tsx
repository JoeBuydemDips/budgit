import { LayoutDashboard, PiggyBank, Receipt, Settings, PanelLeftOpen, PanelLeftClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type ViewType = 'dashboard' | 'budget' | 'transactions' | 'settings'

interface NavigationProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
  collapsed: boolean
  onToggleCollapse: () => void
  onOpenBudgets: () => void
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

export function Navigation({ currentView, onViewChange, collapsed, onToggleCollapse, onOpenBudgets }: NavigationProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col h-full border-r bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50 transition-all duration-200',
          collapsed ? 'md:w-20' : 'md:w-64'
        )}
      >
        <div className="flex items-center justify-between px-3 py-4">
          <div className={cn('font-semibold tracking-tight', collapsed && 'sr-only')}>Budgit</div>
          <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>

        <nav className="flex-1 space-y-1 px-2">
          <TooltipProvider delayDuration={0}>
            {navItems.map(({ id, label, icon: Icon }) => {
              const button = (
                <Button
                  key={id}
                  variant={currentView === id ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start gap-3',
                    collapsed && 'justify-center px-3',
                    currentView === id && 'text-primary'
                  )}
                  onClick={() => onViewChange(id)}
                >
                  <Icon className="h-5 w-5" />
                  {!collapsed && <span className="text-sm">{label}</span>}
                </Button>
              )

              return collapsed ? (
                <Tooltip key={id} delayDuration={0}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              ) : (
                button
              )
            })}
          </TooltipProvider>
        </nav>

        <div className="px-2 pb-4">
          <Button variant="outline" className="w-full" onClick={onOpenBudgets}>
            Manage Budgets
          </Button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="flex h-16 items-center justify-around">
          {navItems.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={currentView === id ? 'secondary' : 'ghost'}
              className={cn('flex flex-col items-center gap-1 h-auto py-2 px-4', currentView === id && 'text-primary')}
              onClick={() => onViewChange(id)}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>
      </nav>
    </>
  )
}
