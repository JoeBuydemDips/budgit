// Budget groups for zero-based budgeting (high-level buckets like Giving, Savings, etc.)
export type Group = 'GIVING' | 'SAVINGS' | 'NEEDS' | 'WANTS' | 'DEBT' | 'FOOD' | 'MISC'

// Color mappings for budget groups
export const GROUP_COLORS: Record<Group, string> = {
  GIVING: '#10B981', // Emerald/Green
  SAVINGS: '#3B82F6', // Blue
  NEEDS: '#8B5CF6', // Purple
  WANTS: '#F59E0B', // Amber
  DEBT: '#EF4444', // Red
  FOOD: '#06B6D4', // Cyan
  MISC: '#6B7280' // Gray
}

// A budget item (e.g., Groceries, Rent, Netflix) belongs to a Group
export interface BudgetItem {
  id: string
  name: string
  group: Group
  rolloverEnabled: boolean
  sortOrder: number
  icon?: string
}

// Allocation for a budget item in a specific month's budget
export interface Allocation {
  itemId: string
  planned: number
  spent: number
  carryover: number // Amount carried from previous month
}

// Income source for multiple income tracking
export interface IncomeSource {
  id: string
  name: string
  planned: number
  received: number
}

export interface Budget {
  id: string
  month: string // Format: YYYY-MM
  incomeTotal: number
  incomeSources: IncomeSource[] // Multiple income sources
  allocations: Allocation[]
  isBalanced: boolean // true when income - total planned = 0
  createdAt: string
  updatedAt: string
}

// Budget with derived aggregates calculated from transactions
export interface BudgetWithComputed extends Budget {
  computed: {
    totalSpent: number // Categorized spend only (excludes Uncategorized)
    totalSpentCategorized: number
    totalSpentAll: number
    uncategorizedSpent: number
    leftToBudget: number
    available: Record<string, number>
  }
}

export interface Transaction {
  id: string
  budgetMonth: string // Format: YYYY-MM
  itemId: string // The budget item this transaction belongs to
  amount: number
  description: string
  date: string // ISO date string
  createdAt: string
  card?: string // Optional payment method/card identifier
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  currency: string
  currencySymbol: string
  claudeApiKey: string
  aiContextMonths: AiContextMonths
}

export type AiContextMonths = 1 | 3 | 6 | 12 | 'all'

export interface LearnedItemMapping {
  merchantName: string
  itemId: string
  confidence: number // 0-1, increases with repeated confirmations
  lastUsed: string // ISO date
}

export interface StoreSchema {
  items: BudgetItem[]
  budgets: Budget[]
  transactions: Transaction[]
  settings: AppSettings
  learnedMappings: LearnedItemMapping[]
  chatSessions: ChatSession[]
  currentSessionId: string | null
  csvImportProfiles: CsvImportProfile[]
}

// Default budget items following EveryDollar / zero-based budgeting principles
export const DEFAULT_ITEMS: BudgetItem[] = [
  { id: 'giving', name: 'Giving', group: 'GIVING', rolloverEnabled: false, sortOrder: 0 },
  {
    id: 'emergency-fund',
    name: 'Emergency Fund',
    group: 'SAVINGS',
    rolloverEnabled: true,
    sortOrder: 1
  },
  { id: 'savings', name: 'Savings', group: 'SAVINGS', rolloverEnabled: true, sortOrder: 2 },
  { id: 'housing', name: 'Housing', group: 'NEEDS', rolloverEnabled: false, sortOrder: 3 },
  { id: 'utilities', name: 'Utilities', group: 'NEEDS', rolloverEnabled: false, sortOrder: 4 },
  { id: 'groceries', name: 'Groceries', group: 'NEEDS', rolloverEnabled: false, sortOrder: 5 },
  {
    id: 'transportation',
    name: 'Transportation',
    group: 'NEEDS',
    rolloverEnabled: false,
    sortOrder: 6
  },
  { id: 'insurance', name: 'Insurance', group: 'NEEDS', rolloverEnabled: false, sortOrder: 7 },
  { id: 'health', name: 'Health', group: 'NEEDS', rolloverEnabled: false, sortOrder: 8 },
  { id: 'personal', name: 'Personal/Fun', group: 'WANTS', rolloverEnabled: false, sortOrder: 9 },
  { id: 'dining-out', name: 'Dining Out', group: 'WANTS', rolloverEnabled: false, sortOrder: 10 },
  {
    id: 'entertainment',
    name: 'Entertainment',
    group: 'WANTS',
    rolloverEnabled: false,
    sortOrder: 11
  },
  { id: 'clothing', name: 'Clothing', group: 'WANTS', rolloverEnabled: true, sortOrder: 12 },
  { id: 'debt', name: 'Debt Payments', group: 'DEBT', rolloverEnabled: false, sortOrder: 13 },
  { id: 'misc', name: 'Miscellaneous', group: 'MISC', rolloverEnabled: false, sortOrder: 14 }
]

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  currency: 'USD',
  currencySymbol: '$',
  claudeApiKey: '',
  aiContextMonths: 3
}

// AI Chat types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string // ISO date
}

export interface ChatSession {
  id: string
  title: string // Auto-generated from first message
  messages: ChatMessage[]
  createdAt: string // ISO date
  lastUpdated: string // ISO date
}

// ============== CSV Import Profile Types ==============

// Column mapping for flexible CSV imports
export interface ColumnMapping {
  date: string // Which CSV column contains the date
  amount?: string // Single amount column (for formats with one amount field)
  debitAmount?: string // Debit/expense column (for split format)
  creditAmount?: string // Credit/income column (for split format)
  description: string // Description/merchant name column
  category?: string // Optional category column
  card?: string // Optional card/account column
  transactionType?: string // Column that determines credit/debit (e.g., "Transaction Type")
}

// Date format presets
export type DateFormatPreset = 'MM/DD/YY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'auto'

// Amount interpretation modes
export type AmountSignMode =
  | 'standard' // Positive = expense, negative = income
  | 'inverted' // Positive = income, negative = expense (some credit cards)
  | 'absolute-with-type' // Always positive, uses transactionType column

// Payment/Credit row handling
export type PaymentRowHandling =
  | 'skip' // Skip payment rows entirely
  | 'income' // Import as income
  | 'include' // Include as-is

// Saved import profile for reuse
export interface CsvImportProfile {
  id: string
  name: string // User-friendly name: "Chase Credit Card", "Daily Bread Debit"
  mapping: ColumnMapping
  dateFormat: DateFormatPreset
  amountSignMode: AmountSignMode
  paymentHandling: PaymentRowHandling
  paymentKeywords: string[] // Keywords to identify payment rows (e.g., "PAYMENT", "CREDIT")
  createdAt: string
  updatedAt: string
}

// Common column name aliases for auto-detection
export const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  date: ['date', 'transaction date', 'trans date', 'posted date', 'post date', 'txn date'],
  amount: ['amount', 'transaction amount', 'trans amount', 'total', 'value'],
  debitAmount: ['debit', 'debit amount', 'withdrawal', 'expense', 'charge'],
  creditAmount: ['credit', 'credit amount', 'deposit', 'payment'],
  description: [
    'description',
    'transaction description',
    'merchant',
    'memo',
    'details',
    'payee',
    'name'
  ],
  category: ['category', 'type', 'expense type', 'classification'],
  card: ['card', 'card no', 'card no.', 'card number', 'account', 'account number'],
  transactionType: ['transaction type', 'type', 'trans type', 'dr/cr', 'debit/credit']
}
