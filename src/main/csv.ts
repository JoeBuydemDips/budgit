import {
  Budget,
  Transaction,
  Category,
  CategoryType,
  ColumnMapping,
  CsvImportProfile,
  DateFormatPreset,
  AmountSignMode,
  PaymentRowHandling,
  COLUMN_ALIASES
} from '../shared/types'
import { getCategorySuggestions } from '../shared/categoryInference'

// CSV format types for import (legacy - keeping for backwards compatibility)
export enum CsvFormat {
  BUDGIT = 'budgit', // Standard Budgit format
  CREDIT_CARD = 'credit_card', // Credit card statements (negative amounts = income)
  DEBIT_CARD = 'debit_card' // Debit card statements (Transaction Type column)
}

// CSV column headers for exports
export const BUDGET_CSV_HEADERS = [
  'month',
  'incomeTotal',
  'categoryId',
  'categoryName',
  'planned',
  'spent',
  'carryover'
]

export const TRANSACTION_CSV_HEADERS = ['Date', 'Amount', 'Card', 'Category', 'Description']

export const CATEGORY_CSV_HEADERS = ['id', 'name', 'type', 'rolloverEnabled', 'sortOrder']

// Escape CSV field values
function escapeCSVField(value: string | number): string {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Parse a CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++ // skip next quote
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current.trim())
  return result
}

// Parse amount based on CSV format
function parseAmount(
  values: string[],
  format: CsvFormat,
  amountIdx: number,
  transactionTypeIdx: number,
  debitAmountIdx: number,
  creditAmountIdx: number
): number {
  if (format === CsvFormat.DEBIT_CARD) {
    // Handle debit card format
    if (debitAmountIdx !== -1 && creditAmountIdx !== -1) {
      // Separate debit and credit amount columns
      const debitAmount = parseFloat(values[debitAmountIdx]) || 0
      const creditAmount = parseFloat(values[creditAmountIdx]) || 0
      return creditAmount - debitAmount // Credit = income (negative), Debit = expense (positive)
    } else if (amountIdx !== -1 && transactionTypeIdx !== -1) {
      // Single amount column with transaction type
      const amount = parseFloat(values[amountIdx])
      const transactionType = values[transactionTypeIdx]?.toLowerCase()

      if (isNaN(amount)) return 0

      if (transactionType === 'credit') {
        return -Math.abs(amount) // Credit = income (negative)
      } else if (transactionType === 'debit') {
        return Math.abs(amount) // Debit = expense (positive)
      } else {
        return amount // Fallback
      }
    } else if (amountIdx !== -1) {
      // Single amount column, assume positive = expense
      return parseFloat(values[amountIdx]) || 0
    }
  } else if (format === CsvFormat.CREDIT_CARD) {
    // Handle credit card format: negative amounts become positive income
    const amount = parseFloat(values[amountIdx])
    if (isNaN(amount)) return 0
    return amount < 0 ? Math.abs(amount) : amount // Negative → positive income
  } else {
    // Standard Budgit format
    return parseFloat(values[amountIdx]) || 0
  }

  return 0
}

// Generate CSV content for budgets
export function generateBudgetsCSV(budgets: Budget[], categories: Category[]): string {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))
  const lines: string[] = [BUDGET_CSV_HEADERS.join(',')]

  for (const budget of budgets) {
    for (const allocation of budget.allocations) {
      const row = [
        budget.month,
        budget.incomeTotal,
        allocation.categoryId,
        categoryMap.get(allocation.categoryId) || '',
        allocation.planned,
        allocation.spent,
        allocation.carryover
      ]
      lines.push(row.map(escapeCSVField).join(','))
    }
  }

  return lines.join('\n')
}

// Generate CSV content for categories
export function generateCategoriesCSV(categories: Category[]): string {
  const lines: string[] = [CATEGORY_CSV_HEADERS.join(',')]

  for (const cat of categories) {
    const row = [cat.id, cat.name, cat.type, cat.rolloverEnabled ? 'true' : 'false', cat.sortOrder]
    lines.push(row.map(escapeCSVField).join(','))
  }

  return lines.join('\n')
}

// Generate CSV content for transactions
export function generateTransactionsCSV(
  transactions: Transaction[],
  categories: Category[]
): string {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))
  const lines: string[] = [TRANSACTION_CSV_HEADERS.join(',')]

  for (const tx of transactions) {
    // Format date to MM/DD/YYYY
    const date = new Date(tx.date)
    const formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`

    const row = [
      formattedDate,
      tx.amount,
      tx.card || '',
      categoryMap.get(tx.categoryId) || '',
      tx.description
    ]
    lines.push(row.map(escapeCSVField).join(','))
  }

  return lines.join('\n')
}

export interface ParseError {
  row: number
  field: string
  message: string
}

export interface ParsedBudgetAllocation {
  month: string
  incomeTotal: number
  categoryId: string
  planned: number
  spent: number
  carryover: number
}

export interface ParseBudgetsResult {
  allocations: ParsedBudgetAllocation[]
  errors: ParseError[]
}

// Parse CSV content for budgets
export function parseBudgetsCSV(csvContent: string): ParseBudgetsResult {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim())
  const errors: ParseError[] = []
  const allocations: ParsedBudgetAllocation[] = []

  if (lines.length === 0) {
    return { allocations: [], errors: [{ row: 0, field: '', message: 'Empty CSV file' }] }
  }

  // Parse header
  const headers = parseCSVLine(lines[0])
  const monthIdx = headers.findIndex((h) => h.toLowerCase() === 'month')
  const incomeTotalIdx = headers.findIndex((h) => h.toLowerCase() === 'incometotal')
  const categoryIdIdx = headers.findIndex((h) => h.toLowerCase() === 'categoryid')
  const plannedIdx = headers.findIndex((h) => h.toLowerCase() === 'planned')
  const spentIdx = headers.findIndex((h) => h.toLowerCase() === 'spent')
  const carryoverIdx = headers.findIndex((h) => h.toLowerCase() === 'carryover')

  // Validate required headers
  if (monthIdx === -1) {
    errors.push({ row: 1, field: 'month', message: 'Missing required column: month' })
  }
  if (categoryIdIdx === -1) {
    errors.push({ row: 1, field: 'categoryId', message: 'Missing required column: categoryId' })
  }
  if (plannedIdx === -1) {
    errors.push({ row: 1, field: 'planned', message: 'Missing required column: planned' })
  }

  if (errors.length > 0) {
    return { allocations: [], errors }
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const rowNum = i + 1

    // Validate month format (YYYY-MM)
    const month = values[monthIdx]
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      errors.push({
        row: rowNum,
        field: 'month',
        message: 'Invalid month format (expected YYYY-MM)'
      })
      continue
    }

    // Parse numeric values
    const incomeTotal = incomeTotalIdx !== -1 ? parseFloat(values[incomeTotalIdx]) : 0
    const planned = parseFloat(values[plannedIdx])
    const spent = spentIdx !== -1 ? parseFloat(values[spentIdx]) : 0
    const carryover = carryoverIdx !== -1 ? parseFloat(values[carryoverIdx]) : 0

    if (isNaN(planned)) {
      errors.push({ row: rowNum, field: 'planned', message: 'Invalid planned amount' })
      continue
    }

    const categoryId = values[categoryIdIdx]
    if (!categoryId) {
      errors.push({ row: rowNum, field: 'categoryId', message: 'Missing categoryId' })
      continue
    }

    allocations.push({
      month,
      incomeTotal: isNaN(incomeTotal) ? 0 : incomeTotal,
      categoryId,
      planned,
      spent: isNaN(spent) ? 0 : spent,
      carryover: isNaN(carryover) ? 0 : carryover
    })
  }

  return { allocations, errors }
}

export interface ParsedTransaction {
  budgetMonth: string
  categoryName: string
  amount: number
  description: string
  date: string
  card?: string
}

export interface ParseTransactionsResult {
  transactions: ParsedTransaction[]
  errors: ParseError[]
}

// Parse CSV content for transactions
export function parseTransactionsCSV(
  csvContent: string,
  categories: Category[],
  format: CsvFormat = CsvFormat.BUDGIT,
  defaultCategoryId?: string
): ParseTransactionsResult {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim())
  const errors: ParseError[] = []
  const transactions: ParsedTransaction[] = []

  if (lines.length === 0) {
    return { transactions: [], errors: [{ row: 0, field: '', message: 'Empty CSV file' }] }
  }

  // Parse header
  const headers = parseCSVLine(lines[0])
  let budgetMonthIdx: number
  let categoryIdIdx: number
  let categoryNameIdx: number
  let amountIdx: number
  let descriptionIdx: number
  let dateIdx: number
  let cardIdx: number
  let transactionTypeIdx: number
  let debitAmountIdx: number
  let creditAmountIdx: number

  if (format === CsvFormat.DEBIT_CARD) {
    // Debit card format headers
    budgetMonthIdx = headers.findIndex((h) => h.toLowerCase() === 'budgetmonth')
    categoryIdIdx = headers.findIndex((h) => h.toLowerCase() === 'categoryid')
    categoryNameIdx = headers.findIndex((h) => h.toLowerCase() === 'category')
    amountIdx = headers.findIndex((h) => h.toLowerCase() === 'transaction amount')
    descriptionIdx = headers.findIndex((h) => h.toLowerCase() === 'transaction description')
    dateIdx = headers.findIndex((h) => h.toLowerCase() === 'transaction date')
    cardIdx = headers.findIndex((h) => h.toLowerCase() === 'card')
    transactionTypeIdx = headers.findIndex((h) => h.toLowerCase() === 'transaction type')
    debitAmountIdx = headers.findIndex((h) => h.toLowerCase() === 'debit amount')
    creditAmountIdx = headers.findIndex((h) => h.toLowerCase() === 'credit amount')
  } else {
    // Standard Budgit format headers
    budgetMonthIdx = headers.findIndex((h) => h.toLowerCase() === 'budgetmonth')
    categoryIdIdx = headers.findIndex((h) => h.toLowerCase() === 'categoryid')
    categoryNameIdx = headers.findIndex((h) => h.toLowerCase() === 'category')
    amountIdx = headers.findIndex((h) => h.toLowerCase() === 'amount')
    descriptionIdx = headers.findIndex((h) => h.toLowerCase() === 'description')
    dateIdx = headers.findIndex((h) => h.toLowerCase() === 'date')
    cardIdx = headers.findIndex((h) => h.toLowerCase() === 'card')
    transactionTypeIdx = -1
    debitAmountIdx = -1
    creditAmountIdx = -1
  }

  // Validate required headers
  if (format === CsvFormat.DEBIT_CARD) {
    if (amountIdx === -1 && debitAmountIdx === -1 && creditAmountIdx === -1) {
      errors.push({
        row: 1,
        field: 'amount',
        message: 'Missing required column: Transaction Amount, Debit Amount, or Credit Amount'
      })
    }
    if (dateIdx === -1) {
      errors.push({ row: 1, field: 'date', message: 'Missing required column: Transaction Date' })
    }
    if (descriptionIdx === -1) {
      errors.push({
        row: 1,
        field: 'description',
        message: 'Missing required column: Transaction Description'
      })
    }
  } else {
    if (amountIdx === -1) {
      errors.push({ row: 1, field: 'amount', message: 'Missing required column: amount' })
    }
    if (dateIdx === -1) {
      errors.push({ row: 1, field: 'date', message: 'Missing required column: date' })
    }
    if (categoryIdIdx === -1 && categoryNameIdx === -1) {
      errors.push({
        row: 1,
        field: 'category',
        message: 'Missing required column: categoryId or category'
      })
    }
  }

  if (errors.length > 0) {
    return { transactions: [], errors }
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const rowNum = i + 1

    // Parse amount
    const amount = parseAmount(
      values,
      format,
      amountIdx,
      transactionTypeIdx,
      debitAmountIdx,
      creditAmountIdx
    )
    if (isNaN(amount)) {
      errors.push({ row: rowNum, field: 'amount', message: 'Invalid amount' })
      continue
    }

    // Parse date
    const dateStr = values[dateIdx]
    if (!dateStr) {
      errors.push({ row: rowNum, field: 'date', message: 'Missing date' })
      continue
    }
    let parsedDate: Date
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      // ISO format
      parsedDate = new Date(dateStr)
    } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(dateStr)) {
      // MM/DD/YY or MM/DD/YYYY format
      const [month, day, yearStr] = dateStr.split('/').map(Number)
      let year = yearStr
      if (year < 100) {
        // 2-digit year, assume 2000s
        year += 2000
      }
      parsedDate = new Date(year, month - 1, day)
    } else {
      errors.push({
        row: rowNum,
        field: 'date',
        message: 'Invalid date format (expected MM/DD/YY, MM/DD/YYYY, or YYYY-MM-DD)'
      })
      continue
    }
    if (isNaN(parsedDate.getTime())) {
      errors.push({ row: rowNum, field: 'date', message: 'Invalid date' })
      continue
    }
    const isoDate = parsedDate.toISOString().split('T')[0]

    // Determine budgetMonth
    let budgetMonth = budgetMonthIdx !== -1 ? values[budgetMonthIdx] : null
    if (!budgetMonth) {
      // Infer from date
      budgetMonth = `${parsedDate.getFullYear()}-${(parsedDate.getMonth() + 1).toString().padStart(2, '0')}`
    }
    if (!/^\d{4}-\d{2}$/.test(budgetMonth)) {
      errors.push({
        row: rowNum,
        field: 'budgetMonth',
        message: 'Invalid budgetMonth format (expected YYYY-MM)'
      })
      continue
    }

    // Determine categoryName
    let categoryName = ''
    if (format === CsvFormat.DEBIT_CARD || format === CsvFormat.CREDIT_CARD) {
      // For debit/credit cards, try to infer category from description
      if (categoryNameIdx !== -1) {
        categoryName = values[categoryNameIdx]?.trim() || ''
      }

      // If no explicit category, try to infer from description
      if (!categoryName && descriptionIdx !== -1) {
        const description = values[descriptionIdx] || ''
        const suggestions = getCategorySuggestions(description, categories)

        if (suggestions.length > 0) {
          // Find the category by ID
          const suggestedCategory = categories.find((c) => c.id === suggestions[0])
          if (suggestedCategory) {
            categoryName = suggestedCategory.name
          }
        }
      }

      // Final fallback to Uncategorized
      if (!categoryName) {
        categoryName = 'Uncategorized'
      }
    } else {
      // Standard format requires category
      if (categoryNameIdx !== -1) {
        categoryName = values[categoryNameIdx]?.trim() || ''
      } else if (categoryIdIdx !== -1) {
        const categoryId = values[categoryIdIdx]?.trim()
        if (categoryId) {
          const cat = categories.find((c) => c.id === categoryId)
          categoryName = cat ? cat.name : categoryId // fallback to id if not found
        }
      }
      if (!categoryName && defaultCategoryId) {
        const defaultCat = categories.find((c) => c.id === defaultCategoryId)
        if (defaultCat) {
          categoryName = defaultCat.name
        }
      }
      if (!categoryName) {
        errors.push({ row: rowNum, field: 'category', message: 'Missing category' })
        continue
      }
    }

    const card = cardIdx !== -1 ? values[cardIdx] : undefined

    transactions.push({
      budgetMonth,
      categoryName,
      amount,
      description: descriptionIdx !== -1 ? values[descriptionIdx] || '' : '',
      date: isoDate,
      card
    })
  }

  return { transactions, errors }
}

// Parsed category from CSV
export interface ParsedCategory {
  id: string
  name: string
  type: CategoryType
  rolloverEnabled: boolean
  sortOrder: number
}

export interface ParseCategoriesResult {
  categories: ParsedCategory[]
  errors: ParseError[]
}

const VALID_CATEGORY_TYPES: CategoryType[] = [
  'GIVING',
  'SAVINGS',
  'NEEDS',
  'WANTS',
  'DEBT',
  'FOOD',
  'MISC'
]

// Parse CSV content for categories
export function parseCategoriesCSV(csvContent: string): ParseCategoriesResult {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim())
  const errors: ParseError[] = []
  const categories: ParsedCategory[] = []

  if (lines.length === 0) {
    return { categories: [], errors: [{ row: 0, field: '', message: 'Empty CSV file' }] }
  }

  // Parse header
  const headers = parseCSVLine(lines[0])
  const idIdx = headers.findIndex((h) => h.toLowerCase() === 'id')
  const nameIdx = headers.findIndex((h) => h.toLowerCase() === 'name')
  const typeIdx = headers.findIndex((h) => h.toLowerCase() === 'type')
  const rolloverIdx = headers.findIndex((h) => h.toLowerCase() === 'rolloverenabled')
  const sortOrderIdx = headers.findIndex((h) => h.toLowerCase() === 'sortorder')

  // Validate required headers
  if (idIdx === -1) {
    errors.push({ row: 1, field: 'id', message: 'Missing required column: id' })
  }
  if (nameIdx === -1) {
    errors.push({ row: 1, field: 'name', message: 'Missing required column: name' })
  }
  if (typeIdx === -1) {
    errors.push({ row: 1, field: 'type', message: 'Missing required column: type' })
  }

  if (errors.length > 0) {
    return { categories: [], errors }
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const rowNum = i + 1

    const id = values[idIdx]
    if (!id) {
      errors.push({ row: rowNum, field: 'id', message: 'Missing id' })
      continue
    }

    const name = values[nameIdx]
    if (!name) {
      errors.push({ row: rowNum, field: 'name', message: 'Missing name' })
      continue
    }

    const typeValue = values[typeIdx]?.toUpperCase() as CategoryType
    if (!VALID_CATEGORY_TYPES.includes(typeValue)) {
      errors.push({
        row: rowNum,
        field: 'type',
        message: `Invalid type: ${typeValue}. Must be one of: ${VALID_CATEGORY_TYPES.join(', ')}`
      })
      continue
    }

    const rolloverEnabled =
      rolloverIdx !== -1 ? values[rolloverIdx]?.toLowerCase() === 'true' : false

    const sortOrder = sortOrderIdx !== -1 ? parseInt(values[sortOrderIdx], 10) : i - 1

    categories.push({
      id,
      name,
      type: typeValue,
      rolloverEnabled,
      sortOrder: isNaN(sortOrder) ? i - 1 : sortOrder
    })
  }

  return { categories, errors }
}

// ============== Dynamic Column Mapping Functions ==============

// Extract CSV headers from content
export function extractCsvHeaders(csvContent: string): string[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return []
  return parseCSVLine(lines[0])
}

// Get preview rows (first N data rows)
export function getCsvPreviewRows(csvContent: string, maxRows: number = 5): string[][] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length <= 1) return []

  const dataLines = lines.slice(1, 1 + maxRows)
  return dataLines.map((line) => parseCSVLine(line))
}

// Auto-detect column mappings based on header names
export function autoDetectColumnMapping(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {}
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim())

  // For each mapping field, try to find a matching header
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const index = lowerHeaders.findIndex((h) => h === alias.toLowerCase())
      if (index !== -1) {
        mapping[field as keyof ColumnMapping] = headers[index]
        break
      }
    }
  }

  return mapping
}

// Parse date based on format preset
function parseDateWithFormat(dateStr: string, format: DateFormatPreset): Date | null {
  if (!dateStr) return null

  if (format === 'auto') {
    // Try to auto-detect format
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return new Date(dateStr)
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      const [month, day, year] = dateStr.split('/').map(Number)
      return new Date(year, month - 1, day)
    } else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(dateStr)) {
      const [month, day, yearShort] = dateStr.split('/').map(Number)
      const year = yearShort + 2000
      return new Date(year, month - 1, day)
    }
    return null
  }

  switch (format) {
    case 'YYYY-MM-DD':
      return new Date(dateStr)
    case 'MM/DD/YYYY': {
      const [month, day, year] = dateStr.split('/').map(Number)
      return new Date(year, month - 1, day)
    }
    case 'MM/DD/YY': {
      const [month, day, yearShort] = dateStr.split('/').map(Number)
      const year = yearShort + 2000
      return new Date(year, month - 1, day)
    }
    case 'DD/MM/YYYY': {
      const [day, month, year] = dateStr.split('/').map(Number)
      return new Date(year, month - 1, day)
    }
    default:
      return null
  }
}

// Parse amount based on column mapping and sign mode
function parseAmountWithMapping(
  row: Record<string, string>,
  mapping: ColumnMapping,
  signMode: AmountSignMode
): number {
  // Check for split debit/credit columns
  if (mapping.debitAmount && mapping.creditAmount) {
    const debitStr = row[mapping.debitAmount] || ''
    const creditStr = row[mapping.creditAmount] || ''
    const debit = parseFloat(debitStr.replace(/[^0-9.-]/g, '')) || 0
    const credit = parseFloat(creditStr.replace(/[^0-9.-]/g, '')) || 0

    // Debit = expense (positive), Credit = income (negative)
    if (debit > 0) return Math.abs(debit)
    if (credit > 0) return -Math.abs(credit)
    return 0
  }

  // Single amount column with transaction type
  if (mapping.amount && mapping.transactionType) {
    const amountStr = row[mapping.amount] || ''
    const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0
    const txType = (row[mapping.transactionType] || '').toLowerCase()

    if (signMode === 'absolute-with-type') {
      if (txType === 'credit' || txType === 'deposit') {
        return -Math.abs(amount) // Income
      } else {
        return Math.abs(amount) // Expense
      }
    }
    return amount
  }

  // Single amount column only
  if (mapping.amount) {
    const amountStr = row[mapping.amount] || ''
    const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0

    if (signMode === 'inverted') {
      return -amount // Flip sign
    }
    return amount
  }

  return 0
}

// Check if row is a payment/credit row
function isPaymentRow(
  row: Record<string, string>,
  mapping: ColumnMapping,
  keywords: string[]
): boolean {
  if (keywords.length === 0) return false

  // Check description
  const description = (row[mapping.description] || '').toLowerCase()

  // Check category if mapped
  const category = mapping.category ? (row[mapping.category] || '').toLowerCase() : ''

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase()
    if (description.includes(lowerKeyword) || category.includes(lowerKeyword)) {
      return true
    }
  }

  return false
}

export interface ParseWithMappingResult {
  transactions: ParsedTransaction[]
  errors: ParseError[]
  skippedPayments: number
}

// Parse CSV with dynamic column mapping
export function parseTransactionsWithMapping(
  csvContent: string,
  categories: Category[],
  mapping: ColumnMapping,
  options: {
    dateFormat?: DateFormatPreset
    amountSignMode?: AmountSignMode
    paymentHandling?: PaymentRowHandling
    paymentKeywords?: string[]
    defaultCategoryId?: string
  } = {}
): ParseWithMappingResult {
  const {
    dateFormat = 'auto',
    amountSignMode = 'standard',
    paymentHandling = 'skip',
    paymentKeywords = ['PAYMENT', 'MOBILE PYMT', 'CREDIT'],
    defaultCategoryId
  } = options

  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim())
  const errors: ParseError[] = []
  const transactions: ParsedTransaction[] = []
  let skippedPayments = 0

  if (lines.length === 0) {
    return {
      transactions: [],
      errors: [{ row: 0, field: '', message: 'Empty CSV file' }],
      skippedPayments: 0
    }
  }

  // Parse headers and create index map
  const headers = parseCSVLine(lines[0])
  const headerIndexMap = new Map<string, number>()
  headers.forEach((h, i) => headerIndexMap.set(h, i))

  // Validate required mappings
  if (!mapping.date || !headerIndexMap.has(mapping.date)) {
    errors.push({
      row: 1,
      field: 'date',
      message: `Date column "${mapping.date}" not found in CSV`
    })
  }
  if (!mapping.description || !headerIndexMap.has(mapping.description)) {
    errors.push({
      row: 1,
      field: 'description',
      message: `Description column "${mapping.description}" not found in CSV`
    })
  }

  // Check amount columns
  const hasAmount = mapping.amount && headerIndexMap.has(mapping.amount)
  const hasSplitAmount =
    mapping.debitAmount &&
    mapping.creditAmount &&
    headerIndexMap.has(mapping.debitAmount) &&
    headerIndexMap.has(mapping.creditAmount)

  if (!hasAmount && !hasSplitAmount) {
    errors.push({
      row: 1,
      field: 'amount',
      message: 'No valid amount column(s) found. Need either Amount or Debit/Credit columns.'
    })
  }

  if (errors.length > 0) {
    return { transactions: [], errors, skippedPayments: 0 }
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const rowNum = i + 1

    // Create row object with header keys
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })

    // Check for payment row
    if (paymentHandling === 'skip' && isPaymentRow(row, mapping, paymentKeywords)) {
      skippedPayments++
      continue
    }

    // Parse date
    const dateStr = row[mapping.date]
    const parsedDate = parseDateWithFormat(dateStr, dateFormat)
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      errors.push({ row: rowNum, field: 'date', message: `Invalid date: "${dateStr}"` })
      continue
    }
    const isoDate = parsedDate.toISOString().split('T')[0]

    // Parse amount
    let amount = parseAmountWithMapping(row, mapping, amountSignMode)

    // Handle payment rows as income if configured
    if (paymentHandling === 'income' && isPaymentRow(row, mapping, paymentKeywords)) {
      amount = -Math.abs(amount) // Force negative (income)
    }

    if (amount === 0) {
      // Skip zero amount rows
      continue
    }

    // Determine budget month from date
    const budgetMonth = `${parsedDate.getFullYear()}-${(parsedDate.getMonth() + 1).toString().padStart(2, '0')}`

    // Get description
    const description = row[mapping.description] || ''

    // Determine category
    let categoryName = ''
    if (mapping.category && row[mapping.category]) {
      categoryName = row[mapping.category].trim()
    }

    // If no category, try to infer
    if (!categoryName && description) {
      const suggestions = getCategorySuggestions(description, categories)
      if (suggestions.length > 0) {
        const suggestedCategory = categories.find((c) => c.id === suggestions[0])
        if (suggestedCategory) {
          categoryName = suggestedCategory.name
        }
      }
    }

    // Fallback to uncategorized or default
    if (!categoryName) {
      if (defaultCategoryId) {
        const defaultCat = categories.find((c) => c.id === defaultCategoryId)
        categoryName = defaultCat ? defaultCat.name : 'Uncategorized'
      } else {
        categoryName = 'Uncategorized'
      }
    }

    // Get card if mapped
    const card = mapping.card ? row[mapping.card] : undefined

    transactions.push({
      budgetMonth,
      categoryName,
      amount,
      description,
      date: isoDate,
      card
    })
  }

  return { transactions, errors, skippedPayments }
}

// Create a default profile based on detected headers
export function createDefaultProfile(
  name: string,
  _headers: string[],
  detectedMapping: Partial<ColumnMapping>
): Omit<CsvImportProfile, 'id' | 'createdAt' | 'updatedAt'> {
  // Detect date format from sample if possible
  const dateFormat: DateFormatPreset = 'auto'

  // Detect amount sign mode based on presence of transaction type column
  let amountSignMode: AmountSignMode = 'standard'
  if (detectedMapping.transactionType) {
    amountSignMode = 'absolute-with-type'
  }

  return {
    name,
    mapping: {
      date: detectedMapping.date || '',
      amount: detectedMapping.amount,
      debitAmount: detectedMapping.debitAmount,
      creditAmount: detectedMapping.creditAmount,
      description: detectedMapping.description || '',
      category: detectedMapping.category,
      card: detectedMapping.card,
      transactionType: detectedMapping.transactionType
    },
    dateFormat,
    amountSignMode,
    paymentHandling: 'skip',
    paymentKeywords: ['PAYMENT', 'MOBILE PYMT', 'PYMT', 'CREDIT', 'PMT']
  }
}
