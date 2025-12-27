import { Budget, Transaction, Category } from '../shared/types'

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

export const TRANSACTION_CSV_HEADERS = [
  'id',
  'budgetMonth',
  'categoryId',
  'categoryName',
  'amount',
  'description',
  'date',
  'createdAt'
]

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

// Generate CSV content for transactions
export function generateTransactionsCSV(
  transactions: Transaction[],
  categories: Category[]
): string {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))
  const lines: string[] = [TRANSACTION_CSV_HEADERS.join(',')]

  for (const tx of transactions) {
    const row = [
      tx.id,
      tx.budgetMonth,
      tx.categoryId,
      categoryMap.get(tx.categoryId) || '',
      tx.amount,
      tx.description,
      tx.date,
      tx.createdAt
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
  categoryId: string
  amount: number
  description: string
  date: string
}

export interface ParseTransactionsResult {
  transactions: ParsedTransaction[]
  errors: ParseError[]
}

// Parse CSV content for transactions
export function parseTransactionsCSV(csvContent: string): ParseTransactionsResult {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim())
  const errors: ParseError[] = []
  const transactions: ParsedTransaction[] = []

  if (lines.length === 0) {
    return { transactions: [], errors: [{ row: 0, field: '', message: 'Empty CSV file' }] }
  }

  // Parse header
  const headers = parseCSVLine(lines[0])
  const budgetMonthIdx = headers.findIndex((h) => h.toLowerCase() === 'budgetmonth')
  const categoryIdIdx = headers.findIndex((h) => h.toLowerCase() === 'categoryid')
  const amountIdx = headers.findIndex((h) => h.toLowerCase() === 'amount')
  const descriptionIdx = headers.findIndex((h) => h.toLowerCase() === 'description')
  const dateIdx = headers.findIndex((h) => h.toLowerCase() === 'date')

  // Validate required headers
  if (budgetMonthIdx === -1) {
    errors.push({ row: 1, field: 'budgetMonth', message: 'Missing required column: budgetMonth' })
  }
  if (categoryIdIdx === -1) {
    errors.push({ row: 1, field: 'categoryId', message: 'Missing required column: categoryId' })
  }
  if (amountIdx === -1) {
    errors.push({ row: 1, field: 'amount', message: 'Missing required column: amount' })
  }
  if (dateIdx === -1) {
    errors.push({ row: 1, field: 'date', message: 'Missing required column: date' })
  }

  if (errors.length > 0) {
    return { transactions: [], errors }
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const rowNum = i + 1

    // Validate budgetMonth format (YYYY-MM)
    const budgetMonth = values[budgetMonthIdx]
    if (!budgetMonth || !/^\d{4}-\d{2}$/.test(budgetMonth)) {
      errors.push({
        row: rowNum,
        field: 'budgetMonth',
        message: 'Invalid budgetMonth format (expected YYYY-MM)'
      })
      continue
    }

    // Parse amount
    const amount = parseFloat(values[amountIdx])
    if (isNaN(amount)) {
      errors.push({ row: rowNum, field: 'amount', message: 'Invalid amount' })
      continue
    }

    const categoryId = values[categoryIdIdx]
    if (!categoryId) {
      errors.push({ row: rowNum, field: 'categoryId', message: 'Missing categoryId' })
      continue
    }

    const date = values[dateIdx]
    if (!date) {
      errors.push({ row: rowNum, field: 'date', message: 'Missing date' })
      continue
    }

    transactions.push({
      budgetMonth,
      categoryId,
      amount,
      description: descriptionIdx !== -1 ? values[descriptionIdx] || '' : '',
      date
    })
  }

  return { transactions, errors }
}
