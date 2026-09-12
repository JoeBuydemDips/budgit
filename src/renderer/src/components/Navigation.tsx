import {
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  PanelLeftOpen,
  PanelLeftClose,
  Wallet,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type ViewType = 'dashboard' | 'budget' | 'transactions' | 'insights' | 'settings'

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
  { id: 'insights', label: 'AI Coach', icon: Sparkles },
  { id: 'settings', label: 'Settings', icon: Settings }
]

export function Navigation({
  currentView,
  onViewChange,
  collapsed,
  onToggleCollapse,
  onOpenBudgets
}: NavigationProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col h-full border-r bg-card/75 backdrop-blur-xl shadow-[8px_0_30px_hsl(222_47%_11%/0.025)] transition-all duration-300 ease-in-out',
          collapsed ? 'md:w-20' : 'md:w-[264px]'
        )}
      >
        <div
          className={cn(
            'flex items-center px-4 pb-5 pt-10',
            collapsed ? 'justify-center' : 'justify-between'
          )}
        >
          <div className={cn('flex items-center gap-3', collapsed && 'sr-only')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight tracking-tight">Budgit</p>
              <p className="text-[11px] font-medium text-muted-foreground">Money with a plan</p>
            </div>
          </div>
          {collapsed && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Wallet className="h-5 w-5" />
            </div>
          )}

          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
              <span className="sr-only">Collapse sidebar</span>
            </Button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center pb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <PanelLeftOpen className="h-4 w-4" />
              <span className="sr-only">Expand sidebar</span>
            </Button>
          </div>
        )}

        <nav className="flex-1 space-y-1.5 px-3">
          {!collapsed && (
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              Workspace
            </p>
          )}
          <TooltipProvider delayDuration={0}>
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = currentView === id
              const button = (
                <Button
                  key={id}
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'h-11 w-full justify-start gap-3 px-3 transition-all',
                    collapsed && 'justify-center px-2',
                    isActive &&
                      'bg-primary text-primary-foreground shadow-md shadow-primary/15 hover:bg-primary/90 hover:text-primary-foreground'
                  )}
                  onClick={() => onViewChange(id)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5',
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                    )}
                  />
                  {!collapsed && <span>{label}</span>}
                </Button>
              )

              return collapsed ? (
                <Tooltip key={id} delayDuration={0}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {label}
                  </TooltipContent>
                </Tooltip>
              ) : (
                button
              )
            })}
          </TooltipProvider>
        </nav>

        <div className="mt-auto p-4">
          {collapsed ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="w-full" onClick={onOpenBudgets}>
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Manage Budgets</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div className="rounded-2xl border bg-background/70 p-2">
              <p className="px-2 pb-2 pt-1 text-xs text-muted-foreground">
                Switch or create a plan
              </p>
              <Button variant="outline" className="w-full gap-2 bg-card" onClick={onOpenBudgets}>
                <Settings className="h-4 w-4" />
                Manage Budgets
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 shadow-[0_-8px_30px_hsl(222_47%_11%/0.06)] backdrop-blur-xl md:hidden">
        <div className="flex h-16 items-center justify-around px-2">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = currentView === id
            return (
              <Button
                key={id}
                variant="ghost"
                className={cn(
                  'flex h-auto flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors',
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onViewChange(id)}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </Button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
