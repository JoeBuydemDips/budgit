import { useEffect, useState } from 'react'
import {
  Download,
  Upload,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Sparkles,
  Wand2,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { CsvImportWizard } from '@/components/CsvImportWizard'
import type { Budget, AiContextMonths } from '../../../shared/types'

interface SettingsViewProps {
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

export function SettingsView({
  onRefreshBudgets,
  onRefreshBudget,
  onRefreshTransactions
}: SettingsViewProps): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const [importExportFeedback, setImportExportFeedback] = useState<ImportExportFeedback | null>(
    null
  )
  const [isProcessing, setIsProcessing] = useState(false)

  // Export/Import dialog states
  const [exportDialogType, setExportDialogType] = useState<ExportDialogType>(null)
  const [importDialogType, setImportDialogType] = useState<ImportDialogType>(null)
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [targetMonth, setTargetMonth] = useState<string>('')
  const [csvFormat, setCsvFormat] = useState<string>('budgit')

  // AI Assistant settings
  const [claudeApiKey, setClaudeApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [aiContextMonths, setAiContextMonths] = useState<AiContextMonths>(3)

  // CSV Import Wizard
  const [showImportWizard, setShowImportWizard] = useState(false)
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  const [clearHistoryConfirm, setClearHistoryConfirm] = useState(false)

  // Load budgets when export/import dialog opens
  useEffect(() => {
    if (exportDialogType === 'budgets' || importDialogType) {
      window.api.getBudgets().then(setBudgets)
    }
  }, [exportDialogType, importDialogType])

  // Load AI settings on mount
  useEffect(() => {
    window.api.getSettings().then((settings) => {
      setClaudeApiKey(settings.claudeApiKey || '')
      setAiContextMonths(settings.aiContextMonths || 3)
      setAiSettingsLoaded(true)
    })
  }, [])

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

      {/* AI Assistant */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>AI Assistant</CardTitle>
              <CardDescription>Configure Budgit, your AI-powered budget assistant</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="claude-api-key">Claude API Key</Label>
            <p className="text-sm text-muted-foreground">
              Get your API key from{' '}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                console.anthropic.com
              </a>
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="claude-api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={claudeApiKey}
                  onChange={(e) => setClaudeApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  await window.api.updateSettings({ claudeApiKey })
                  setImportExportFeedback({
                    type: 'success',
                    message: 'API key saved successfully'
                  })
                }}
                disabled={!aiSettingsLoaded}
              >
                Save
              </Button>
            </div>
          </div>

          {/* Context Depth */}
          <div className="space-y-2">
            <Label htmlFor="context-months">Context Depth</Label>
            <p className="text-sm text-muted-foreground">
              How many months of budget data to include when chatting with Budgit
            </p>
            <Select
              value={String(aiContextMonths)}
              onValueChange={async (value) => {
                const months = value === 'all' ? 'all' : (parseInt(value) as AiContextMonths)
                setAiContextMonths(months)
                await window.api.updateSettings({ aiContextMonths: months })
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 1 month</SelectItem>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
                <SelectItem value="all">All data</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Chat History */}
          <div className="space-y-2">
            <Label>Chat History</Label>
            <p className="text-sm text-muted-foreground">
              Clear your conversation history with Budgit
            </p>
            {clearHistoryConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Are you sure?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await window.api.clearAllSessions()
                    setClearHistoryConfirm(false)
                    setImportExportFeedback({
                      type: 'success',
                      message: 'Chat history cleared'
                    })
                  }}
                >
                  Yes, clear
                </Button>
                <Button variant="outline" size="sm" onClick={() => setClearHistoryConfirm(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setClearHistoryConfirm(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Chat History
              </Button>
            )}
          </div>
        </CardContent>
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
            </div>
          </div>

          <Separator />

          {/* Import Section */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Import Data</Label>
            <p className="text-sm text-muted-foreground">
              Import budgets or transactions from CSV files. Duplicate transactions will be
              skipped.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="default"
                size="sm"
                className="w-full sm:w-auto"
                disabled={isProcessing}
                onClick={() => setShowImportWizard(true)}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Import Wizard (Recommended)
              </Button>
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
              Remove budget allocations for items that no longer exist. This fixes calculation
              errors from previous bugs.
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
                  const options = targetMonth && targetMonth !== 'csv' ? { targetMonth } : undefined
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
        onOpenChange={(open) => {
          if (!open) {
            setImportDialogType(null)
            setCsvFormat('budgit')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Transactions</DialogTitle>
            <DialogDescription>
              Import transactions from a CSV file. Expected format: Date (MM/DD/YYYY), Amount, Card
              (optional), Category (name), Description. Unknown categories will be automatically
              created. Budget month will be inferred from dates if not specified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>CSV Format</Label>
              <Select value={csvFormat} onValueChange={setCsvFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budgit">Budgit Format</SelectItem>
                  <SelectItem value="credit_card">Credit Card Statement</SelectItem>
                  <SelectItem value="debit_card">Debit Card Statement</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {csvFormat === 'budgit' &&
                  'Standard Budgit CSV format with Date, Amount, Category, Description columns'}
                {csvFormat === 'credit_card' &&
                  'Credit card statement: negative amounts become positive income'}
                {csvFormat === 'debit_card' &&
                  'Debit card statement: Transaction Type column determines income/expense'}
              </p>
            </div>
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
                  const options: { targetMonth?: string; format?: string } = {}
                  if (targetMonth && targetMonth !== 'csv') {
                    options.targetMonth = targetMonth
                  }
                  if (csvFormat && csvFormat !== 'budgit') {
                    options.format = csvFormat
                  }
                  const result = await window.api.importTransactionsCSV(
                    Object.keys(options).length > 0 ? options : undefined
                  )
                  if (result.canceled) {
                    // User cancelled
                  } else if (result.success) {
                    // Refresh data after import
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

      {/* CSV Import Wizard */}
      <CsvImportWizard
        open={showImportWizard}
        onOpenChange={setShowImportWizard}
        budgets={budgets}
        onImportComplete={(result) => {
          if (result.success) {
            let message = `Imported ${result.imported} transactions`
            if (result.skipped > 0) {
              message += `, skipped ${result.skipped} duplicates`
            }
            if (result.skippedPayments && result.skippedPayments > 0) {
              message += `, ${result.skippedPayments} payment rows skipped`
            }
            setImportExportFeedback({
              type: 'success',
              message
            })
          } else {
            setImportExportFeedback({
              type: 'error',
              message: result.errors.length > 0 ? result.errors[0] : 'Import failed'
            })
          }
        }}
        onRefresh={async () => {
          await onRefreshBudget()
          await onRefreshBudgets()
          await onRefreshTransactions()
        }}
      />
    </div>
  )
}
