import { LayoutDashboard, PiggyBank, Receipt, Settings, PanelLeftOpen, PanelLeftClose, Wallet } from 'lucide-react'
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
          'hidden md:flex md:flex-col h-full border-r bg-muted/10 transition-all duration-300 ease-in-out',
          collapsed ? 'md:w-20' : 'md:w-64'
        )}
      >
        <div className={cn("flex items-center px-4 py-6", collapsed ? "justify-center" : "justify-between")}>
          <div className={cn('flex items-center gap-2 font-bold text-xl tracking-tight text-primary', collapsed && 'sr-only')}>
            <Wallet className="h-6 w-6" />
            Budgit
          </div>
          {collapsed && <Wallet className="h-6 w-6 text-primary" />}
          
          {!collapsed && (
            <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <PanelLeftClose className="h-4 w-4" />
              <span className="sr-only">Collapse sidebar</span>
            </Button>
          )}
        </div>
        
        {collapsed && (
             <div className="flex justify-center pb-4">
                <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <PanelLeftOpen className="h-4 w-4" />
                  <span className="sr-only">Expand sidebar</span>
                </Button>
             </div>
        )}

        <nav className="flex-1 space-y-2 px-3">
          <TooltipProvider delayDuration={0}>
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = currentView === id
              const button = (
                <Button
                  key={id}
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start gap-3 transition-all',
                    collapsed && 'justify-center px-2',
                    isActive && 'bg-primary/10 text-primary hover:bg-primary/15 font-medium'
                  )}
                  onClick={() => onViewChange(id)}
                >
                  <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                  {!collapsed && <span>{label}</span>}
                </Button>
              )

              return collapsed ? (
                <Tooltip key={id} delayDuration={0}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">{label}</TooltipContent>
                </Tooltip>
              ) : (
                button
              )
            })}
          </TooltipProvider>
        </nav>

        <div className="p-4 mt-auto">
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
            <Button variant="outline" className="w-full gap-2" onClick={onOpenBudgets}>
              <Settings className="h-4 w-4" />
              Manage Budgets
            </Button>
          )}
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-lg md:hidden">
        <div className="flex h-16 items-center justify-around px-2">
          {navItems.map(({ id, label, icon: Icon }) => {
             const isActive = currentView === id
             return (
                <Button
                  key={id}
                  variant="ghost"
                  className={cn(
                    'flex flex-col items-center gap-1 h-auto py-2 px-3 rounded-xl transition-colors', 
                    isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'
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
