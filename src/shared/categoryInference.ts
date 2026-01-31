import { Category, LearnedCategoryMapping } from './types'

// Merchant name to category ID mappings
const MERCHANT_CATEGORIES: Record<string, string> = {
  // Transportation
  'HARRIS COUNTY TOLL ROAD AUTHORITY': 'transportation',
  'RMA TOLL': 'transportation',
  'GO CARWASH': 'transportation',
  'SOUTHWEST AIRLINES': 'personal', // Travel as personal expense
  EXPEDIA: 'personal',

  // Groceries
  'SAMS CLUB': 'groceries',
  'H-E-B GROCERY': 'groceries',
  'LA MICHOACANA AUSTIN': 'groceries',
  WALMART: 'groceries',
  'LONE STAR MARKETS': 'groceries',
  'MAMA HONO': 'groceries',

  // Dining Out
  DOORDASH: 'dining-out',
  MCDONALD: 'dining-out',
  CHIPOTLE: 'dining-out',
  'FIVE GUYS': 'dining-out',
  'OLIVE GARDEN': 'dining-out',
  'SQ *TACOBABY': 'dining-out',
  'TST*LOTUS PLUS CLEAVER': 'dining-out',
  'NORTH AUSTIN CAFE': 'dining-out',
  'CANTEEN AUSTIN': 'dining-out',
  'SQ *OCH FAMILY': 'dining-out',

  // Healthcare
  'STDAVIDS PARTNERSHIP': 'health',
  'HCA LOCAL HOSPITAL VISIT': 'health',
  'AUSTIN PEDIATRIC DENTI': 'health',
  CVS: 'health',
  'AUSTIN AREA OB GYN': 'health',
  'AUSTIN FETAL MED-GT': 'health',
  'RF *AUSTIN HEALTH PA': 'health',
  'TEXAS ONCOLOGY': 'health',
  'RADIOLOGY PARTNERS': 'health',
  'OBHG TEXAS HOLDINGS': 'health',
  'CLINICAL PATHOLOGY LAB': 'health',
  'OCULUS PATHOLOGY': 'health',
  MEDFUSION: 'health',
  'SOLIS WOMEN': 'health',

  // Insurance
  'TESLA PROPERTY CASUALTY': 'insurance',

  // Entertainment
  'TRAIL OF LIGHTS': 'entertainment',
  NETFLIX: 'entertainment',
  YOUTUBE: 'entertainment',

  // Personal/Fun
  AMAZON: 'personal',
  TARGET: 'personal',
  CHATGPT: 'personal',
  GITHUB: 'personal',
  MICROSOFT: 'personal',
  APPLE: 'personal',
  'SPRUCE SERVICE': 'personal',
  'VCN*AUSTINVITALSTATSCTR': 'personal',
  'THECUT INC': 'personal',
  'ROUND ROCK BEAUTY SUPPLY': 'personal',
  'UNIQUE EYEBROW THREADING': 'personal',
  'WATCH GALAXY': 'personal',
  SHEIN: 'personal',

  // Clothing
  'CLOTHES MENTOR': 'clothing',
  'ROSS DRESS FOR LESS': 'clothing',
  'MY COMFY PAJAMA': 'clothing',

  // Phone/Cable (mapped to utilities or personal)
  'PHONE/CABLE': 'utilities' // But since no phone category, use utilities
}

// Keyword patterns for category inference
const KEYWORD_PATTERNS: Array<{ pattern: RegExp; categoryId: string; priority: number }> = [
  // High priority exact matches
  { pattern: /\b(toll|road|highway)\b/i, categoryId: 'transportation', priority: 10 },
  {
    pattern: /\b(grocery|supermarket|heb|sams|walmart|market)\b/i,
    categoryId: 'groceries',
    priority: 9
  },
  {
    pattern: /\b(restaurant|cafe|mcdonald|chipotle|doordash|dining)\b/i,
    categoryId: 'dining-out',
    priority: 8
  },
  {
    pattern: /\b(hospital|health|doctor|dentist|cvs|pharmacy|medical)\b/i,
    categoryId: 'health',
    priority: 7
  },
  { pattern: /\b(insurance|casualty)\b/i, categoryId: 'insurance', priority: 6 },
  {
    pattern: /\b(netflix|youtube|hulu|entertainment|movie|theater)\b/i,
    categoryId: 'entertainment',
    priority: 5
  },
  { pattern: /\b(amazon|target|shopping|merchandise)\b/i, categoryId: 'personal', priority: 4 },
  {
    pattern: /\b(clothing|clothes|dress|shirt|pants|shoes)\b/i,
    categoryId: 'clothing',
    priority: 3
  },
  {
    pattern: /\b(airlines|flight|travel|expedia|southwest)\b/i,
    categoryId: 'personal',
    priority: 2
  },
  { pattern: /\b(haircut|salon|beauty|spa)\b/i, categoryId: 'personal', priority: 1 }
]

// Clean merchant name for matching
function cleanMerchantName(description: string): string {
  return description
    .toUpperCase()
    .replace(/\*.*$/, '') // Remove anything after *
    .replace(/[^A-Z0-9\s]/g, ' ') // Replace special chars with space
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
}

// Check if a category matches the expected ID or a similar name
// This handles cases where users rename default categories
function findMatchingCategory(expectedId: string, categories: Category[]): Category | null {
  // First, try exact ID match
  const exactMatch = categories.find((c) => c.id === expectedId)
  if (exactMatch) return exactMatch

  // If ID not found, try to find by similar name
  // Map expected IDs to possible category names
  const idToNames: Record<string, string[]> = {
    personal: ['personal', 'fun', 'personal/fun', 'lifestyle', 'misc'],
    groceries: ['groceries', 'grocery', 'food'],
    'dining-out': ['dining out', 'dining', 'restaurants', 'eating out'],
    transportation: ['transportation', 'gas', 'auto', 'car'],
    health: ['health', 'medical', 'healthcare', 'doctor'],
    entertainment: ['entertainment', 'fun', 'movies'],
    clothing: ['clothing', 'clothes', 'apparel'],
    housing: ['housing', 'rent', 'mortgage', 'home'],
    utilities: ['utilities', 'bills', 'electric', 'water'],
    insurance: ['insurance'],
    debt: ['debt', 'loans', 'credit card'],
    savings: ['savings', 'save'],
    giving: ['giving', 'charity', 'donations', 'tithe']
  }

  const possibleNames = idToNames[expectedId] || [expectedId]
  for (const name of possibleNames) {
    const match = categories.find(
      (c) => c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase())
    )
    if (match) return match
  }

  return null
}

// Infer category from transaction description
export function inferCategoryFromDescription(
  description: string,
  categories: Category[],
  learnedMappings: LearnedCategoryMapping[] = []
): string | null {
  if (!description) return null

  const cleanDesc = cleanMerchantName(description)

  // First, check learned mappings (highest priority)
  const learnedMatch = learnedMappings.find(
    (mapping) => cleanMerchantName(mapping.merchantName) === cleanDesc
  )
  if (learnedMatch) {
    const categoryExists = categories.some((c) => c.id === learnedMatch.categoryId)
    if (categoryExists) return learnedMatch.categoryId
  }

  // Then, try exact merchant match
  const merchantMatch = MERCHANT_CATEGORIES[cleanDesc]
  if (merchantMatch) {
    // Use smarter matching that handles renamed categories
    const matchedCategory = findMatchingCategory(merchantMatch, categories)
    if (matchedCategory) return matchedCategory.id
  }

  // Then, try keyword patterns, sorted by priority
  const sortedPatterns = KEYWORD_PATTERNS.sort((a, b) => b.priority - a.priority)
  for (const { pattern, categoryId } of sortedPatterns) {
    if (pattern.test(cleanDesc)) {
      // Use smarter matching that handles renamed categories
      const matchedCategory = findMatchingCategory(categoryId, categories)
      if (matchedCategory) return matchedCategory.id
    }
  }

  return null
}

// Get category suggestions for a description (returns multiple possibilities)
export function getCategorySuggestions(
  description: string,
  categories: Category[],
  learnedMappings: LearnedCategoryMapping[] = []
): string[] {
  const inferred = inferCategoryFromDescription(description, categories, learnedMappings)
  if (inferred) return [inferred]

  // If no inference, return some defaults based on common patterns
  const suggestions: string[] = []
  const cleanDesc = cleanMerchantName(description)

  // Check for common patterns
  if (/\b(eat|food|drink|restaurant|cafe)\b/i.test(cleanDesc)) {
    if (categories.some((c) => c.id === 'dining-out')) suggestions.push('dining-out')
    if (categories.some((c) => c.id === 'groceries')) suggestions.push('groceries')
  }

  if (/\b(shop|buy|purchase)\b/i.test(cleanDesc)) {
    if (categories.some((c) => c.id === 'personal')) suggestions.push('personal')
  }

  // Check for income patterns
  if (/\b(payroll|salary|deposit|direct deposit|wage|income)\b/i.test(cleanDesc)) {
    if (categories.some((c) => c.id === 'salary')) suggestions.push('salary')
  }

  if (/\b(freelance|contract|consult|independent)\b/i.test(cleanDesc)) {
    if (categories.some((c) => c.id === 'freelance')) suggestions.push('freelance')
  }

  if (/\b(invest|dividend|interest|capital|return|profit)\b/i.test(cleanDesc)) {
    if (categories.some((c) => c.id === 'investments')) suggestions.push('investments')
  }

  // Note: No default fallback - if nothing matches, return empty array
  // and let the caller decide (usually defaults to 'Uncategorized')

  return suggestions
}

// Learn from user correction
export function learnCategoryMapping(
  merchantName: string,
  categoryId: string,
  learnedMappings: LearnedCategoryMapping[]
): LearnedCategoryMapping[] {
  const cleanName = cleanMerchantName(merchantName)
  const existingIndex = learnedMappings.findIndex(
    (mapping) => cleanMerchantName(mapping.merchantName) === cleanName
  )

  if (existingIndex >= 0) {
    // Update existing mapping
    const existing = learnedMappings[existingIndex]
    if (existing.categoryId === categoryId) {
      // Same category, increase confidence
      learnedMappings[existingIndex] = {
        ...existing,
        confidence: Math.min(1, existing.confidence + 0.1),
        lastUsed: new Date().toISOString()
      }
    } else {
      // Different category, update if confidence is low or reset
      if (existing.confidence < 0.5) {
        learnedMappings[existingIndex] = {
          merchantName: cleanName,
          categoryId,
          confidence: 0.6,
          lastUsed: new Date().toISOString()
        }
      } else {
        // High confidence, don't change but could log conflict
        console.warn(
          `High confidence mapping conflict for ${cleanName}: ${existing.categoryId} vs ${categoryId}`
        )
      }
    }
  } else {
    // Add new mapping
    learnedMappings.push({
      merchantName: cleanName,
      categoryId,
      confidence: 0.5,
      lastUsed: new Date().toISOString()
    })
  }

  return learnedMappings
}

// Get all learned mappings for a merchant (for debugging/display)
export function getLearnedMappingsForMerchant(
  merchantName: string,
  learnedMappings: LearnedCategoryMapping[]
): LearnedCategoryMapping | null {
  const cleanName = cleanMerchantName(merchantName)
  return (
    learnedMappings.find((mapping) => cleanMerchantName(mapping.merchantName) === cleanName) || null
  )
}
