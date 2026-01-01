// Category types for zero-based budgeting
export type CategoryType = 'GIVING' | 'SAVINGS' | 'NEEDS' | 'WANTS' | 'DEBT' | 'FOOD' | 'MISC'

// Color mappings for category types
export const CATEGORY_TYPE_COLORS: Record<CategoryType, string> = {
  GIVING: '#10B981', // Emerald/Green
  SAVINGS: '#3B82F6', // Blue
  NEEDS: '#8B5CF6', // Purple
  WANTS: '#F59E0B', // Amber
  DEBT: '#EF4444', // Red
  FOOD: '#06B6D4', // Cyan
  MISC: '#6B7280' // Gray
}

export interface Category {
  id: string
  name: string
  type: CategoryType
  rolloverEnabled: boolean
  sortOrder: number
  icon?: string
}

export interface CategoryAllocation {
  categoryId: string
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
  allocations: CategoryAllocation[]
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
  categoryId: string
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

export interface LearnedCategoryMapping {
  merchantName: string
  categoryId: string
  confidence: number // 0-1, increases with repeated confirmations
  lastUsed: string // ISO date
}

export interface StoreSchema {
  categories: Category[]
  budgets: Budget[]
  transactions: Transaction[]
  settings: AppSettings
  learnedMappings: LearnedCategoryMapping[]
  chatSessions: ChatSession[]
  currentSessionId: string | null
}

// Default categories following EveryDollar / zero-based budgeting principles
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'giving', name: 'Giving', type: 'GIVING', rolloverEnabled: false, sortOrder: 0 },
  {
    id: 'emergency-fund',
    name: 'Emergency Fund',
    type: 'SAVINGS',
    rolloverEnabled: true,
    sortOrder: 1
  },
  { id: 'savings', name: 'Savings', type: 'SAVINGS', rolloverEnabled: true, sortOrder: 2 },
  { id: 'housing', name: 'Housing', type: 'NEEDS', rolloverEnabled: false, sortOrder: 3 },
  { id: 'utilities', name: 'Utilities', type: 'NEEDS', rolloverEnabled: false, sortOrder: 4 },
  { id: 'groceries', name: 'Groceries', type: 'NEEDS', rolloverEnabled: false, sortOrder: 5 },
  {
    id: 'transportation',
    name: 'Transportation',
    type: 'NEEDS',
    rolloverEnabled: false,
    sortOrder: 6
  },
  { id: 'insurance', name: 'Insurance', type: 'NEEDS', rolloverEnabled: false, sortOrder: 7 },
  { id: 'health', name: 'Health', type: 'NEEDS', rolloverEnabled: false, sortOrder: 8 },
  { id: 'personal', name: 'Personal/Fun', type: 'WANTS', rolloverEnabled: false, sortOrder: 9 },
  { id: 'dining-out', name: 'Dining Out', type: 'WANTS', rolloverEnabled: false, sortOrder: 10 },
  {
    id: 'entertainment',
    name: 'Entertainment',
    type: 'WANTS',
    rolloverEnabled: false,
    sortOrder: 11
  },
  { id: 'clothing', name: 'Clothing', type: 'WANTS', rolloverEnabled: true, sortOrder: 12 },
  { id: 'debt', name: 'Debt Payments', type: 'DEBT', rolloverEnabled: false, sortOrder: 13 },
  { id: 'misc', name: 'Miscellaneous', type: 'MISC', rolloverEnabled: false, sortOrder: 14 }
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
