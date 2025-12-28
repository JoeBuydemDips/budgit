import { useEffect, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Download,
  Upload,
  CheckCircle,
  XCircle,
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
import { useTheme } from '@/components/theme-provider'
import { formatMonth, parseMonthKey } from '@/lib/utils'
import type { Budget, Category, CategoryType } from '../../../shared/types'

interface SettingsViewProps {
  categories: Category[]
  onRefreshCategories: () => Promise<void>
  onRefreshBudgets: () => Promise<void>
  onRefreshBudget: () => Promise<void>
  onRefreshTransactions: () => Promise<void>
}

interface ImportExportFeedback {
  type: 'success' | 'error'
  message: string
}

type ExportDialogType = 'budgets' | 'transactions' | null
type ImportDialogType = 'budgets' | 'transactions' | null

const CATEGORY_TYPES: { value: CategoryType; label: string }[] = [
  { value: 'GIVING', label: 'Giving' },
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'NEEDS', label: 'Essentials' },
  { value: 'WANTS', label: 'Lifestyle' },
  { value: 'DEBT', label: 'Debt' },
  { value: 'FOOD', label: 'Food' }
]

export function SettingsView({
  categories,
  onRefreshCategories,
  onRefreshBudgets,
  onRefreshBudget,
  onRefreshTransactions
}: SettingsViewProps): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [importExportFeedback, setImportExportFeedback] = useState<ImportExportFeedback | null>(
    null
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoriesExpanded, setCategoriesExpanded] = useState(true)

  // Export/Import dialog states
  const [exportDialogType, setExportDialogType] = useState<ExportDialogType>(null)
  const [importDialogType, setImportDialogType] = useState<ImportDialogType>(null)
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [targetMonth, setTargetMonth] = useState<string>('')

  // Load budgets when export/import dialog opens
  useEffect(() => {
    if (exportDialogType === 'budgets' || importDialogType) {
      window.api.getBudgets().then(setBudgets)
    }
  }, [exportDialogType, importDialogType])

  // Auto-dismiss feedback after 5 seconds
  useEffect(() => {
    if (importExportFeedback) {
      const timer = setTimeout(() => {
        setImportExportFeedback(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [importExportFeedback])

  // Filter categories based on search term
  const filteredCategories = categories.filter((category) => {
    if (!searchTerm.trim()) return true

    const searchLower = searchTerm.toLowerCase()
    const categoryName = category.name.toLowerCase()
    const categoryTypeLabel = CATEGORY_TYPES.find((t) => t.value === category.type)?.label.toLowerCase() || ''

    return categoryName.includes(searchLower) || categoryTypeLabel.includes(searchLower)
  })

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Customize your budget experience</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how Budgit looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select
              value={theme}
              onValueChange={(value: 'light' | 'dark' | 'system') => setTheme(value)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <Collapsible open={categoriesExpanded} onOpenChange={setCategoriesExpanded}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div>
                    <CardTitle>Categories</CardTitle>
                    <CardDescription>Manage your budget categories</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => setShowAddCategory(true)} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                  {categoriesExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search categories by name or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="space-y-2">
            {filteredCategories.map((category, index) => (
              <div key={category.id}>
                {index > 0 && <Separator className="my-2" />}
                <div className="flex items-center justify-between py-2 group">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {CATEGORY_TYPES.find((t) => t.value === category.type)?.label}
                        {category.rolloverEnabled && ' • Rollover enabled'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingCategory(category)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700"
                      onClick={() => setDeleteConfirm(category.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {filteredCategories.length === 0 && searchTerm.trim() && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No categories found matching "{searchTerm}"</p>
                <p className="text-sm">Try searching by category name or type</p>
              </div>
            )}
          </div>
        </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Import/Export Data */}
      <Card>
        <CardHeader>
          <CardTitle>Data Import/Export</CardTitle>
          <CardDescription>
            Import or export your budgets and transactions as CSV files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Feedback Message */}
          {importExportFeedback && (
            <div
              className={`flex items-center gap-2 p-3 rounded-md ${
                importExportFeedback.type === 'success'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              }`}
            >
              {importExportFeedback.type === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="text-sm">{importExportFeedback.message}</span>
            </div>
          )}

          {/* Export Section */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Export Data</Label>
            <p className="text-sm text-muted-foreground">
              Download your data as CSV files for backup or use in other applications.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={isProcessing}
                onClick={() => {
                  setSelectedMonths([])
                  setExportDialogType('budgets')
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Budgets
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={isProcessing}
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                  setExportDialogType('transactions')
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Transactions
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={isProcessing}
                onClick={async () => {
                  setIsProcessing(true)
                  setImportExportFeedback(null)
                  try {
                    const result = await window.api.exportCategoriesCSV()
                    if (result.canceled) {
                      // User canceled, no feedback needed
                    } else if (result.success) {
                      setImportExportFeedback({
                        type: 'success',
                        message: 'Categories exported successfully!'
                      })
                    } else {
                      setImportExportFeedback({
                        type: 'error',
                        message: result.error || 'Export failed'
                      })
                    }
                  } catch (error) {
                    setImportExportFeedback({
                      type: 'error',
                      message: String(error)
                    })
                  } finally {
                    setIsProcessing(false)
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Categories
              </Button>
            </div>
          </div>

          <Separator />

          {/* Import Section */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Import Data</Label>
            <p className="text-sm text-muted-foreground">
              Import budgets, transactions, or categories from CSV files. Duplicate transactions will be skipped.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={isProcessing}
                onClick={() => {
                  setTargetMonth('')
                  setImportDialogType('budgets')
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Budgets
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={isProcessing}
                onClick={() => {
                  setTargetMonth('')
                  setImportDialogType('transactions')
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Transactions
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={isProcessing}
                onClick={async () => {
                  setIsProcessing(true)
                  setImportExportFeedback(null)
                  try {
                    const result = await window.api.importCategoriesCSV({ mode: 'merge' })
                    if (result.canceled) {
                      // User canceled, no feedback needed
                    } else if (result.success) {
                      await onRefreshCategories()
                      setImportExportFeedback({
                        type: 'success',
                        message: `Categories imported: ${result.imported} new, ${result.updated} updated`
                      })
                    } else {
                      setImportExportFeedback({
                        type: 'error',
                        message: result.errors.join(', ') || 'Import failed'
                      })
                    }
                  } catch (error) {
                    setImportExportFeedback({
                      type: 'error',
                      message: String(error)
                    })
                  } finally {
                    setIsProcessing(false)
                  }
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Categories
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance</CardTitle>
          <CardDescription>Fix data inconsistencies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label className="text-base font-medium">Clean Up Orphaned Allocations</Label>
            <p className="text-sm text-muted-foreground">
              Remove budget allocations for categories that no longer exist. This fixes calculation errors from previous bugs.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true)
                setImportExportFeedback(null)
                try {
                  const result = await window.api.cleanupOrphanedAllocations()
                  await onRefreshCategories()
                  await onRefreshBudgets()
                  setImportExportFeedback({
                    type: 'success',
                    message: `Cleaned up ${result.removedAllocations} orphaned allocations from ${result.cleanedBudgets} budgets`
                  })
                } catch (error) {
                  setImportExportFeedback({
                    type: 'error',
                    message: String(error)
                  })
                } finally {
                  setIsProcessing(false)
                }
              }}
            >
              Clean Up Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Budgit</strong> - Family Budget Tracker
          </p>
          <p>Version 1.0.0</p>
          <p>Zero-based budgeting for families. Give every dollar a job.</p>
        </CardContent>
      </Card>

      {/* Add Category Dialog */}
      <CategoryDialog
        open={showAddCategory}
        onOpenChange={setShowAddCategory}
        onSave={async (data) => {
          await window.api.addCategory({
            ...data,
            sortOrder: categories.length
          })
          await onRefreshCategories()
          setShowAddCategory(false)
        }}
      />

      {/* Edit Category Dialog */}
      <CategoryDialog
        open={!!editingCategory}
        onOpenChange={(open) => !open && setEditingCategory(null)}
        category={editingCategory || undefined}
        onSave={async (data) => {
          if (editingCategory) {
            await window.api.updateCategory(editingCategory.id, data)
            await onRefreshCategories()
          }
          setEditingCategory(null)
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this category? Transactions in this category will
              become uncategorized.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteConfirm) {
                  await window.api.deleteCategory(deleteConfirm)
                  await onRefreshCategories()
                }
                setDeleteConfirm(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Budgets Dialog */}
      <Dialog
        open={exportDialogType === 'budgets'}
        onOpenChange={(open) => !open && setExportDialogType(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Budgets</DialogTitle>
            <DialogDescription>
              Select which budget months to export, or leave empty to export all.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Months</Label>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                {budgets.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">No budgets available</p>
                ) : (
                  [...budgets]
                    .sort((a, b) => b.month.localeCompare(a.month))
                    .map((budget) => (
                      <label
                        key={budget.month}
                        className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMonths.includes(budget.month)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMonths([...selectedMonths, budget.month])
                            } else {
                              setSelectedMonths(selectedMonths.filter((m) => m !== budget.month))
                            }
                          }}
                          className="h-4 w-4 rounded border-input"
                        />
                        <span className="text-sm">{formatMonth(parseMonthKey(budget.month))}</span>
                      </label>
                    ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedMonths.length === 0
                  ? 'All budgets will be exported'
                  : `${selectedMonths.length} month(s) selected`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogType(null)}>
              Cancel
            </Button>
            <Button
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true)
                setImportExportFeedback(null)
                setExportDialogType(null)
                try {
                  const result = await window.api.exportBudgetsCSV(
                    selectedMonths.length > 0 ? { months: selectedMonths } : undefined
                  )
                  if (result.canceled) {
                    // User cancelled
                  } else if (result.success) {
                    setImportExportFeedback({
                      type: 'success',
                      message: `Budgets exported successfully to ${result.filePath}`
                    })
                  } else {
                    setImportExportFeedback({
                      type: 'error',
                      message: result.error || 'Failed to export budgets'
                    })
                  }
                } catch (error) {
                  setImportExportFeedback({
                    type: 'error',
                    message:
                      error instanceof Error
                        ? `Failed to export budgets: ${error.message}`
                        : 'Failed to export budgets'
                  })
                }
                setIsProcessing(false)
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Transactions Dialog */}
      <Dialog
        open={exportDialogType === 'transactions'}
        onOpenChange={(open) => !open && setExportDialogType(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Transactions</DialogTitle>
            <DialogDescription>
              Set a date range to filter transactions, or leave empty to export all.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {!startDate && !endDate
                ? 'All transactions will be exported'
                : startDate && endDate
                  ? `Transactions from ${startDate} to ${endDate}`
                  : startDate
                    ? `Transactions from ${startDate} onwards`
                    : `Transactions up to ${endDate}`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogType(null)}>
              Cancel
            </Button>
            <Button
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true)
                setImportExportFeedback(null)
                setExportDialogType(null)
                try {
                  const options =
                    startDate || endDate
                      ? { startDate: startDate || undefined, endDate: endDate || undefined }
                      : undefined
                  const result = await window.api.exportTransactionsCSV(options)
                  if (result.canceled) {
                    // User cancelled
                  } else if (result.success) {
                    setImportExportFeedback({
                      type: 'success',
                      message: `Transactions exported successfully to ${result.filePath}`
                    })
                  } else {
                    setImportExportFeedback({
                      type: 'error',
                      message: result.error || 'Failed to export transactions'
                    })
                  }
                } catch (error) {
                  setImportExportFeedback({
                    type: 'error',
                    message:
                      error instanceof Error
                        ? `Failed to export transactions: ${error.message}`
                        : 'Failed to export transactions'
                  })
                }
                setIsProcessing(false)
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Budgets Dialog */}
      <Dialog
        open={importDialogType === 'budgets'}
        onOpenChange={(open) => !open && setImportDialogType(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Budgets</DialogTitle>
            <DialogDescription>
              Choose whether to import budget allocations to a specific month or use the months from
              the CSV file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target Budget Month</Label>
              <Select value={targetMonth} onValueChange={setTargetMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Use months from CSV file" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">Use months from CSV file</SelectItem>
                  {[...budgets]
                    .sort((a, b) => b.month.localeCompare(a.month))
                    .map((budget) => (
                      <SelectItem key={budget.month} value={budget.month}>
                        {formatMonth(parseMonthKey(budget.month))}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {!targetMonth || targetMonth === 'csv'
                  ? 'Each row will be imported to the month specified in the CSV'
                  : `All allocations will be imported to ${formatMonth(parseMonthKey(targetMonth))}`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogType(null)}>
              Cancel
            </Button>
            <Button
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true)
                setImportExportFeedback(null)
                setImportDialogType(null)
                try {
                  const options =
                    targetMonth && targetMonth !== 'csv' ? { targetMonth } : undefined
                  const result = await window.api.importBudgetsCSV(options)
                  if (result.canceled) {
                    // User cancelled
                  } else if (result.success) {
                    setImportExportFeedback({
                      type: 'success',
                      message: `Imported ${result.imported} budget allocations${result.skipped > 0 ? `, skipped ${result.skipped}` : ''}`
                    })
                  } else {
                    setImportExportFeedback({
                      type: 'error',
                      message:
                        result.errors.length > 0 ? result.errors[0] : 'Failed to import budgets'
                    })
                  }
                } catch (error) {
                  setImportExportFeedback({
                    type: 'error',
                    message:
                      error instanceof Error
                        ? `Failed to import budgets: ${error.message}`
                        : 'Failed to import budgets'
                  })
                }
                setIsProcessing(false)
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Select File & Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Transactions Dialog */}
      <Dialog
        open={importDialogType === 'transactions'}
        onOpenChange={(open) => !open && setImportDialogType(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Transactions</DialogTitle>
            <DialogDescription>
              Import transactions from a CSV file. Expected format: Date (MM/DD/YYYY), Amount, Card (optional), Category (name), Description.
              Unknown categories will be automatically created. Budget month will be inferred from dates if not specified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target Budget Month</Label>
              <Select value={targetMonth} onValueChange={setTargetMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Use months from CSV file" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">Use months from CSV file</SelectItem>
                  {[...budgets]
                    .sort((a, b) => b.month.localeCompare(a.month))
                    .map((budget) => (
                      <SelectItem key={budget.month} value={budget.month}>
                        {formatMonth(parseMonthKey(budget.month))}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {!targetMonth || targetMonth === 'csv'
                  ? 'Each transaction will be imported to the budget month specified in the CSV'
                  : `All transactions will be imported to ${formatMonth(parseMonthKey(targetMonth))}`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogType(null)}>
              Cancel
            </Button>
            <Button
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true)
                setImportExportFeedback(null)
                setImportDialogType(null)
                try {
                  const options =
                    targetMonth && targetMonth !== 'csv' ? { targetMonth } : undefined
                  const result = await window.api.importTransactionsCSV(options)
                  if (result.canceled) {
                    // User cancelled
                  } else if (result.success) {
                    // Refresh data after import
                    await onRefreshCategories()
                    await onRefreshBudget()
                    await onRefreshBudgets()
                    await onRefreshTransactions()
                    setImportExportFeedback({
                      type: 'success',
                      message: `Imported ${result.imported} transactions${result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ''}`
                    })
                  } else {
                    setImportExportFeedback({
                      type: 'error',
                      message:
                        result.errors.length > 0
                          ? result.errors[0]
                          : 'Failed to import transactions'
                    })
                  }
                } catch (error) {
                  setImportExportFeedback({
                    type: 'error',
                    message:
                      error instanceof Error
                        ? `Failed to import transactions: ${error.message}`
                        : 'Failed to import transactions'
                  })
                }
                setIsProcessing(false)
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Select File & Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: Category
  onSave: (data: Omit<Category, 'id' | 'sortOrder'>) => Promise<void>
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSave
}: CategoryDialogProps): React.JSX.Element {
  const [name, setName] = useState(category?.name || '')
  const [type, setType] = useState<CategoryType>(category?.type || 'NEEDS')
  const [rolloverEnabled, setRolloverEnabled] = useState(category?.rolloverEnabled || false)
  const [saving, setSaving] = useState(false)

  // Reset form when category changes
  useEffect(() => {
    if (category) {
      setName(category.name)
      setType(category.type)
      setRolloverEnabled(category.rolloverEnabled)
    } else {
      setName('')
      setType('NEEDS')
      setRolloverEnabled(false)
    }
  }, [category])

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return

    setSaving(true)
    await onSave({
      name: name.trim(),
      type,
      rolloverEnabled
    })
    setSaving(false)

    // Reset form
    setName('')
    setType('NEEDS')
    setRolloverEnabled(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Edit' : 'Add'} Category</DialogTitle>
          <DialogDescription>
            {category ? 'Update the category details' : 'Create a new budget category'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g., Groceries"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(value: CategoryType) => setType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rollover"
              checked={rolloverEnabled}
              onChange={(e) => setRolloverEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="rollover" className="text-sm font-normal">
              Enable rollover (carry unused funds to next month)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || saving} onClick={handleSave}>
            {saving ? 'Saving...' : category ? 'Update' : 'Add'} Category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
