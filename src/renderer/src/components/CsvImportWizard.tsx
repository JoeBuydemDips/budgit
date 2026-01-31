import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  Save,
  Trash2
} from 'lucide-react'
import type {
  ColumnMapping,
  CsvImportProfile,
  DateFormatPreset,
  AmountSignMode,
  PaymentRowHandling,
  Budget
} from '../../../shared/types'

interface CsvImportWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  budgets: Budget[]
  onImportComplete: (result: {
    success: boolean
    imported: number
    skipped: number
    skippedPayments?: number
    errors: string[]
  }) => void
  onRefresh: () => Promise<void>
}

type WizardStep = 'select-file' | 'map-columns' | 'configure' | 'preview' | 'import'

// Helper to format month key
function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function parseMonthKey(key: string): Date {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

export function CsvImportWizard({
  open,
  onOpenChange,
  budgets,
  onImportComplete,
  onRefresh
}: CsvImportWizardProps) {
  // Wizard state
  const [step, setStep] = useState<WizardStep>('select-file')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // File state
  const [csvContent, setCsvContent] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [headers, setHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<string[][]>([])

  // Mapping state
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '',
    description: ''
  })

  // Configuration state
  const [dateFormat, setDateFormat] = useState<DateFormatPreset>('auto')
  const [amountSignMode, setAmountSignMode] = useState<AmountSignMode>('standard')
  const [paymentHandling, setPaymentHandling] = useState<PaymentRowHandling>('skip')
  const [paymentKeywords, setPaymentKeywords] = useState<string[]>([
    'PAYMENT',
    'MOBILE PYMT',
    'PYMT',
    'CREDIT'
  ])
  const [targetMonth, setTargetMonth] = useState<string>('csv')

  // Preview state
  const [previewTransactions, setPreviewTransactions] = useState<
    Array<{
      budgetMonth: string
      itemName: string
      amount: number
      description: string
      date: string
      card?: string
    }>
  >([])
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([])
  const [skippedPayments, setSkippedPayments] = useState(0)

  // Profile state
  const [profiles, setProfiles] = useState<CsvImportProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [saveProfileName, setSaveProfileName] = useState('')
  const [showSaveProfile, setShowSaveProfile] = useState(false)

  // Load profiles on mount
  useEffect(() => {
    if (open) {
      loadProfiles()
    }
  }, [open])

  const loadProfiles = async () => {
    try {
      const loadedProfiles = await window.api.getCsvProfiles()
      setProfiles(loadedProfiles)
    } catch (err) {
      console.error('Failed to load profiles:', err)
    }
  }

  // Reset wizard when closed
  useEffect(() => {
    if (!open) {
      setStep('select-file')
      setCsvContent('')
      setFileName('')
      setHeaders([])
      setPreviewRows([])
      setMapping({ date: '', description: '' })
      setDateFormat('auto')
      setAmountSignMode('standard')
      setPaymentHandling('skip')
      setTargetMonth('csv')
      setPreviewTransactions([])
      setParseErrors([])
      setSkippedPayments(0)
      setSelectedProfileId('')
      setSaveProfileName('')
      setShowSaveProfile(false)
      setError(null)
    }
  }, [open])

  // Handle file selection
  const handleSelectFile = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.api.selectCsvFile()

      if (result.canceled) {
        setIsLoading(false)
        return
      }

      if (!result.success || !result.content) {
        setError(result.error || 'Failed to read file')
        setIsLoading(false)
        return
      }

      setCsvContent(result.content)
      setFileName(result.fileName || 'unknown.csv')

      // Extract headers
      const extractedHeaders = await window.api.extractCsvHeaders(result.content)
      setHeaders(extractedHeaders)

      // Get preview rows
      const rows = await window.api.getCsvPreviewRows(result.content, 5)
      setPreviewRows(rows)

      // Auto-detect mapping
      const detected = await window.api.autoDetectMapping(extractedHeaders)

      // Apply detected mapping
      setMapping({
        date: detected.date || '',
        amount: detected.amount,
        debitAmount: detected.debitAmount,
        creditAmount: detected.creditAmount,
        description: detected.description || '',
        category: detected.category,
        card: detected.card,
        transactionType: detected.transactionType
      })

      // Check if we have a transaction type column (suggests debit card format)
      if (detected.transactionType) {
        setAmountSignMode('absolute-with-type')
      }

      setStep('map-columns')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select file')
    } finally {
      setIsLoading(false)
    }
  }

  // Apply saved profile
  const applyProfile = useCallback(
    (profile: CsvImportProfile) => {
      setMapping(profile.mapping)
      setDateFormat(profile.dateFormat)
      setAmountSignMode(profile.amountSignMode)
      setPaymentHandling(profile.paymentHandling)
      setPaymentKeywords(profile.paymentKeywords)
    },
    []
  )

  // Handle profile selection
  const handleProfileSelect = async (profileId: string) => {
    setSelectedProfileId(profileId)
    if (profileId && profileId !== 'none') {
      const profile = profiles.find((p) => p.id === profileId)
      if (profile) {
        applyProfile(profile)
      }
    }
  }

  // Save current settings as profile
  const handleSaveProfile = async () => {
    if (!saveProfileName.trim()) return

    try {
      const newProfile = await window.api.addCsvProfile({
        name: saveProfileName.trim(),
        mapping,
        dateFormat,
        amountSignMode,
        paymentHandling,
        paymentKeywords
      })

      setProfiles([...profiles, newProfile])
      setSelectedProfileId(newProfile.id)
      setShowSaveProfile(false)
      setSaveProfileName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    }
  }

  // Delete profile
  const handleDeleteProfile = async (profileId: string) => {
    try {
      await window.api.deleteCsvProfile(profileId)
      setProfiles(profiles.filter((p) => p.id !== profileId))
      if (selectedProfileId === profileId) {
        setSelectedProfileId('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile')
    }
  }

  // Validate mapping
  const isMappingValid = (): boolean => {
    if (!mapping.date || !mapping.description) return false
    if (!mapping.amount && !(mapping.debitAmount && mapping.creditAmount)) return false
    return true
  }

  // Generate preview
  const handleGeneratePreview = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.api.parseWithMapping(csvContent, mapping, {
        dateFormat,
        amountSignMode,
        paymentHandling,
        paymentKeywords
      })

      setPreviewTransactions(result.transactions)
      setParseErrors(result.errors.map((e) => ({ row: e.row, message: e.message })))
      setSkippedPayments(result.skippedPayments)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV')
    } finally {
      setIsLoading(false)
    }
  }

  // Execute import
  const handleImport = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.api.importWithMapping(csvContent, mapping, {
        dateFormat,
        amountSignMode,
        paymentHandling,
        paymentKeywords,
        targetMonth: targetMonth !== 'csv' ? targetMonth : undefined
      })

      onImportComplete({
        success: result.success,
        imported: result.imported,
        skipped: result.skipped,
        skippedPayments: result.skippedPayments,
        errors: result.errors
      })

      if (result.success) {
        await onRefresh()
        onOpenChange(false)
      } else {
        setError(result.errors.join(', '))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import')
    } finally {
      setIsLoading(false)
    }
  }

  // Column mapping helper
  const updateMapping = (field: keyof ColumnMapping, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value === '__none__' ? undefined : value || undefined
    }))
  }

  // Render step indicator
  const renderStepIndicator = () => {
    const steps: { key: WizardStep; label: string }[] = [
      { key: 'select-file', label: 'Select File' },
      { key: 'map-columns', label: 'Map Columns' },
      { key: 'configure', label: 'Configure' },
      { key: 'preview', label: 'Preview' }
    ]

    const currentIndex = steps.findIndex((s) => s.key === step)

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i < currentIndex
                  ? 'bg-primary text-primary-foreground'
                  : i === currentIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < currentIndex ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-sm ${i === currentIndex ? 'font-medium' : 'text-muted-foreground'}`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>
    )
  }

  // Render file selection step
  const renderSelectFile = () => (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
        <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground mb-4">
          Select a CSV file to import transactions
        </p>
        <Button onClick={handleSelectFile} disabled={isLoading}>
          <Upload className="h-4 w-4 mr-2" />
          {isLoading ? 'Loading...' : 'Select CSV File'}
        </Button>
      </div>

      {profiles.length > 0 && (
        <div className="space-y-2">
          <Label>Saved Import Profiles</Label>
          <p className="text-xs text-muted-foreground">
            Select a profile after choosing your file to apply saved column mappings
          </p>
          <div className="flex flex-wrap gap-2">
            {profiles.map((profile) => (
              <Badge key={profile.id} variant="secondary" className="text-sm">
                {profile.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // Render column mapping step
  const renderMapColumns = () => (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      {/* Profile selector */}
      {profiles.length > 0 && (
        <div className="space-y-2">
          <Label>Apply Saved Profile</Label>
          <div className="flex gap-2">
            <Select value={selectedProfileId} onValueChange={handleProfileSelect}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a profile..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No profile (manual mapping)</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProfileId && selectedProfileId !== 'none' && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDeleteProfile(selectedProfileId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      <Separator />

      {/* CSV Preview */}
      <div className="space-y-2">
        <Label>CSV Preview ({fileName})</Label>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.slice(0, 3).map((row, i) => (
                <tr key={i} className="border-t">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Separator />

      {/* Column Mappings */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">Map CSV Columns</Label>

        <div className="grid grid-cols-2 gap-4">
          {/* Required: Date */}
          <div className="space-y-1">
            <Label>
              Date Column <span className="text-destructive">*</span>
            </Label>
            <Select value={mapping.date} onValueChange={(v) => updateMapping('date', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select column..." />
              </SelectTrigger>
              <SelectContent>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Required: Description */}
          <div className="space-y-1">
            <Label>
              Description Column <span className="text-destructive">*</span>
            </Label>
            <Select
              value={mapping.description}
              onValueChange={(v) => updateMapping('description', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select column..." />
              </SelectTrigger>
              <SelectContent>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Amount Columns</Label>
          <p className="text-xs text-muted-foreground">
            Use a single Amount column, OR separate Debit/Credit columns
          </p>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Single Amount</Label>
              <Select
                value={mapping.amount || '__none__'}
                onValueChange={(v) => updateMapping('amount', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="(optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">Debit Column</Label>
              <Select
                value={mapping.debitAmount || '__none__'}
                onValueChange={(v) => updateMapping('debitAmount', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="(optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">Credit Column</Label>
              <Select
                value={mapping.creditAmount || '__none__'}
                onValueChange={(v) => updateMapping('creditAmount', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="(optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Item Column</Label>
            <Select
              value={mapping.category || '__none__'}
              onValueChange={(v) => updateMapping('category', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="(optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No item column (auto-infer from description)</SelectItem>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              If your CSV has no item, we&apos;ll try to infer it from the description
            </p>
          </div>

          <div className="space-y-1">
            <Label>Card/Account Column</Label>
            <Select value={mapping.card || '__none__'} onValueChange={(v) => updateMapping('card', v)}>
              <SelectTrigger>
                <SelectValue placeholder="(optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Transaction Type</Label>
            <Select
              value={mapping.transactionType || '__none__'}
              onValueChange={(v) => updateMapping('transactionType', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="(optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              For bank statements with Credit/Debit type
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  // Render configuration step
  const renderConfigure = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date Format</Label>
          <Select
            value={dateFormat}
            onValueChange={(v) => setDateFormat(v as DateFormatPreset)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              <SelectItem value="MM/DD/YY">MM/DD/YY (01/30/26)</SelectItem>
              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (01/30/2026)</SelectItem>
              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2026-01-30)</SelectItem>
              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (30/01/2026)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Amount Sign Mode</Label>
          <Select
            value={amountSignMode}
            onValueChange={(v) => setAmountSignMode(v as AmountSignMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard (+ expense, - income)</SelectItem>
              <SelectItem value="inverted">Inverted (- expense, + income)</SelectItem>
              <SelectItem value="absolute-with-type">Use Transaction Type column</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {amountSignMode === 'standard' && 'Positive amounts are expenses, negative are income'}
            {amountSignMode === 'inverted' && 'Negative amounts are expenses, positive are income'}
            {amountSignMode === 'absolute-with-type' &&
              'Uses Transaction Type column to determine expense/income'}
          </p>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Payment Row Handling</Label>
          <Select
            value={paymentHandling}
            onValueChange={(v) => setPaymentHandling(v as PaymentRowHandling)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skip">Skip payment rows</SelectItem>
              <SelectItem value="income">Import as income</SelectItem>
              <SelectItem value="include">Include as-is</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {paymentHandling === 'skip' && 'Rows matching payment keywords will be skipped'}
            {paymentHandling === 'income' && 'Payment rows will be imported as income'}
            {paymentHandling === 'include' && 'All rows will be imported as-is'}
          </p>
        </div>

        {paymentHandling !== 'include' && (
          <div className="space-y-2">
            <Label>Payment Keywords</Label>
            <Input
              value={paymentKeywords.join(', ')}
              onChange={(e) =>
                setPaymentKeywords(
                  e.target.value
                    .split(',')
                    .map((k) => k.trim())
                    .filter(Boolean)
                )
              }
              placeholder="PAYMENT, CREDIT, PYMT..."
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated keywords to identify payment rows
            </p>
          </div>
        )}
      </div>

      <Separator />

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
          {targetMonth === 'csv'
            ? 'Each transaction will be assigned to its budget month based on date'
            : `All transactions will be imported to ${formatMonth(parseMonthKey(targetMonth))}`}
        </p>
      </div>

      <Separator />

      {/* Save Profile */}
      <div className="space-y-2">
        {!showSaveProfile ? (
          <Button variant="outline" onClick={() => setShowSaveProfile(true)}>
            <Save className="h-4 w-4 mr-2" />
            Save as Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="Profile name (e.g., Chase Credit Card)"
              value={saveProfileName}
              onChange={(e) => setSaveProfileName(e.target.value)}
            />
            <Button onClick={handleSaveProfile} disabled={!saveProfileName.trim()}>
              Save
            </Button>
            <Button variant="outline" onClick={() => setShowSaveProfile(false)}>
              Cancel
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Save your column mappings and settings for future imports from this bank
        </p>
      </div>
    </div>
  )

  // Render preview step
  const renderPreview = () => (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      {/* Summary */}
      <div className="flex gap-4">
        <div className="flex-1 p-4 rounded-lg bg-muted">
          <div className="text-2xl font-bold">{previewTransactions.length}</div>
          <div className="text-sm text-muted-foreground">Transactions to import</div>
        </div>
        {skippedPayments > 0 && (
          <div className="flex-1 p-4 rounded-lg bg-muted">
            <div className="text-2xl font-bold">{skippedPayments}</div>
            <div className="text-sm text-muted-foreground">Payment rows skipped</div>
          </div>
        )}
        {parseErrors.length > 0 && (
          <div className="flex-1 p-4 rounded-lg bg-destructive/10">
            <div className="text-2xl font-bold text-destructive">{parseErrors.length}</div>
            <div className="text-sm text-destructive">Rows with errors</div>
          </div>
        )}
      </div>

      {/* Errors */}
      {parseErrors.length > 0 && (
        <div className="space-y-2">
          <Label className="text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Parse Errors
          </Label>
          <div className="max-h-32 overflow-y-auto border rounded-lg p-2 bg-destructive/5">
            {parseErrors.slice(0, 10).map((err, i) => (
              <div key={i} className="text-sm text-destructive">
                Row {err.row}: {err.message}
              </div>
            ))}
            {parseErrors.length > 10 && (
              <div className="text-sm text-muted-foreground">
                ...and {parseErrors.length - 10} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transaction preview */}
      <div className="space-y-2">
        <Label>Transaction Preview (first 20)</Label>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Month</th>
              </tr>
            </thead>
            <tbody>
              {previewTransactions.slice(0, 20).map((tx, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">{tx.date}</td>
                  <td className="px-3 py-2">{tx.description}</td>
                  <td
                    className={`px-3 py-2 text-right whitespace-nowrap ${tx.amount < 0 ? 'text-green-600' : ''}`}
                  >
                    {tx.amount < 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{tx.itemName}</Badge>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{tx.budgetMonth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {previewTransactions.length > 20 && (
          <p className="text-sm text-muted-foreground text-center">
            ...and {previewTransactions.length - 20} more transactions
          </p>
        )}
      </div>
    </div>
  )

  // Render current step content
  const renderStepContent = () => {
    switch (step) {
      case 'select-file':
        return renderSelectFile()
      case 'map-columns':
        return renderMapColumns()
      case 'configure':
        return renderConfigure()
      case 'preview':
        return renderPreview()
      default:
        return null
    }
  }

  // Navigation buttons
  const renderNavigation = () => {
    const canGoBack = step !== 'select-file'
    const canGoNext =
      step === 'map-columns' ? isMappingValid() : step === 'configure' || step === 'preview'

    return (
      <DialogFooter className="flex justify-between">
        <div>
          {canGoBack && (
            <Button
              variant="outline"
              onClick={() => {
                if (step === 'map-columns') setStep('select-file')
                else if (step === 'configure') setStep('map-columns')
                else if (step === 'preview') setStep('configure')
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step === 'preview' ? (
            <Button onClick={handleImport} disabled={isLoading || previewTransactions.length === 0}>
              {isLoading ? 'Importing...' : `Import ${previewTransactions.length} Transactions`}
            </Button>
          ) : step !== 'select-file' ? (
            <Button
              onClick={() => {
                if (step === 'map-columns') setStep('configure')
                else if (step === 'configure') handleGeneratePreview()
              }}
              disabled={!canGoNext || isLoading}
            >
              {isLoading ? 'Loading...' : 'Next'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : null}
        </div>
      </DialogFooter>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Import Transactions</DialogTitle>
          <DialogDescription>
            Import transactions from any CSV file with flexible column mapping
          </DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {renderStepContent()}

        {step !== 'select-file' && renderNavigation()}
      </DialogContent>
    </Dialog>
  )
}
