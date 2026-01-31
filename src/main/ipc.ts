import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFile, readFile } from 'fs/promises'
import Anthropic from '@anthropic-ai/sdk'
import {
  getSettings,
  updateSettings,
  getItems,
  getLearnedMappings,
  addItem,
  updateItem,
  deleteItem,
  removeItemFromBudget,
  cleanupOrphanedAllocations,
  reorderItems,
  getBudgetByMonth,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgets,
  getBudgetsByMonths,
  getBudgetsWithSpent,
  getTransactionsByMonth,
  getTransactions,
  getTransactionsByDateRange,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  unassignTransaction,
  getBudgetWithSpent,
  getPreviousMonth,
  getNextMonth,
  importBudgets,
  importTransactions,
  importItems,
  ImportResult,
  ImportItemsResult,
  getChatSessions,
  getCurrentSessionId,
  createChatSession,
  getChatSession,
  setCurrentSession,
  saveChatMessage,
  renameChatSession,
  deleteChatSession,
  clearAllChatSessions,
  getCsvImportProfiles,
  getCsvImportProfile,
  addCsvImportProfile,
  updateCsvImportProfile,
  deleteCsvImportProfile
} from './store'
import {
  generateBudgetsCSV,
  generateTransactionsCSV,
  generateItemsCSV,
  parseBudgetsCSV,
  parseTransactionsCSV,
  parseItemsCSV,
  CsvFormat,
  extractCsvHeaders,
  getCsvPreviewRows,
  autoDetectColumnMapping,
  parseTransactionsWithMapping,
  createDefaultProfile,
  ParsedTransaction,
  ParseError
} from './csv'
import type {
  BudgetItem,
  AppSettings,
  Transaction,
  ColumnMapping,
  CsvImportProfile,
  DateFormatPreset,
  AmountSignMode,
  PaymentRowHandling
} from '../shared/types'
import type { ChatMessage, AiContextMonths } from '../shared/types'

export function registerIpcHandlers(): void {
  // ============== Settings ==============
  ipcMain.handle('settings:get', () => {
    return getSettings()
  })

  ipcMain.handle('settings:update', (_, settings: Partial<AppSettings>) => {
    return updateSettings(settings)
  })

  // ============== Budget Items ==============
  ipcMain.handle('items:list', () => {
    return getItems()
  })

  ipcMain.handle('items:getLearnedMappings', () => {
    return getLearnedMappings()
  })

  ipcMain.handle('items:add', (_, item: Omit<BudgetItem, 'id'>) => {
    return addItem(item)
  })

  ipcMain.handle('items:update', (_, id: string, updates: Partial<BudgetItem>) => {
    return updateItem(id, updates)
  })

  ipcMain.handle('items:delete', (_, id: string) => {
    return deleteItem(id)
  })

  ipcMain.handle('items:remove-from-budget', (_, month: string, itemId: string) => {
    return removeItemFromBudget(month, itemId)
  })

  ipcMain.handle('items:cleanup-orphaned', () => {
    return cleanupOrphanedAllocations()
  })

  ipcMain.handle('items:reorder', (_, itemIds: string[]) => {
    return reorderItems(itemIds)
  })

  // ============== Budgets ==============
  ipcMain.handle('budget:get', (_, month: string) => {
    return getBudgetByMonth(month)
  })

  ipcMain.handle('budget:list', () => {
    return getBudgets()
  })

  ipcMain.handle('budget:listWithSpent', () => {
    return getBudgetsWithSpent()
  })

  ipcMain.handle('budget:getWithSpent', (_, month: string) => {
    return getBudgetWithSpent(month)
  })

  ipcMain.handle(
    'budget:create',
    (_, month: string, incomeTotal: number, copyFromMonth?: string) => {
      return createBudget(month, incomeTotal, copyFromMonth)
    }
  )

  ipcMain.handle(
    'budget:update',
    (
      _,
      month: string,
      updates: {
        incomeTotal?: number
        allocations?: { itemId: string; planned: number; spent: number; carryover: number }[]
      }
    ) => {
      return updateBudget(month, updates)
    }
  )

  ipcMain.handle('budget:delete', (_, month: string) => {
    return deleteBudget(month)
  })

  ipcMain.handle('budget:getPreviousMonth', (_, month: string) => {
    return getPreviousMonth(month)
  })

  ipcMain.handle('budget:getNextMonth', (_, month: string) => {
    return getNextMonth(month)
  })

  // ============== Transactions ==============
  ipcMain.handle('transactions:list', (_, month: string) => {
    return getTransactionsByMonth(month)
  })

  ipcMain.handle('transactions:add', (_, transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    return addTransaction(transaction)
  })

  ipcMain.handle(
    'transactions:update',
    (_, id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => {
      return updateTransaction(id, updates)
    }
  )

  ipcMain.handle('transactions:delete', (_, id: string) => {
    return deleteTransaction(id)
  })

  ipcMain.handle('transactions:unassign', (_, id: string) => {
    return unassignTransaction(id)
  })

  // ============== CSV Export/Import ==============
  ipcMain.handle('csv:exportBudgets', async (_, options?: { months?: string[] }) => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return { success: false, error: 'No active window' }

    const result = await dialog.showSaveDialog(window, {
      title: 'Export Budgets',
      defaultPath: 'budgit-budgets.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    try {
      // Use filtered budgets if months specified, otherwise export all
      const budgets =
        options?.months && options.months.length > 0
          ? getBudgetsByMonths(options.months)
          : getBudgets()
      const items = getItems()
      const csvContent = generateBudgetsCSV(budgets, items)
      await writeFile(result.filePath, csvContent, 'utf-8')
      return { success: true, filePath: result.filePath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'csv:exportTransactions',
    async (_, options?: { startDate?: string; endDate?: string }) => {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) return { success: false, error: 'No active window' }

      const result = await dialog.showSaveDialog(window, {
        title: 'Export Transactions',
        defaultPath: 'budgit-transactions.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true }
      }

      try {
        // Use filtered transactions if date range specified, otherwise export all
        const transactions =
          options?.startDate || options?.endDate
            ? getTransactionsByDateRange(options.startDate, options.endDate)
            : getTransactions()
        const items = getItems()
        const csvContent = generateTransactionsCSV(transactions, items)
        await writeFile(result.filePath, csvContent, 'utf-8')
        return { success: true, filePath: result.filePath }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    'csv:importBudgets',
    async (
      _,
      options?: { targetMonth?: string }
    ): Promise<ImportResult & { canceled?: boolean }> => {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) return { success: false, imported: 0, skipped: 0, errors: ['No active window'] }

      const result = await dialog.showOpenDialog(window, {
        title: 'Import Budgets',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, imported: 0, skipped: 0, errors: [], canceled: true }
      }

      try {
        const csvContent = await readFile(result.filePaths[0], 'utf-8')
        const parsed = parseBudgetsCSV(csvContent)

        if (parsed.errors.length > 0) {
          return {
            success: false,
            imported: 0,
            skipped: 0,
            errors: parsed.errors.map((e) => `Row ${e.row}: ${e.message}`)
          }
        }

        return importBudgets(parsed.allocations, options?.targetMonth)
      } catch (error) {
        return { success: false, imported: 0, skipped: 0, errors: [String(error)] }
      }
    }
  )

  ipcMain.handle(
    'csv:importTransactions',
    async (
      _,
      options?: { targetMonth?: string; format?: string }
    ): Promise<ImportResult & { canceled?: boolean }> => {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) return { success: false, imported: 0, skipped: 0, errors: ['No active window'] }

      const result = await dialog.showOpenDialog(window, {
        title: 'Import Transactions',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, imported: 0, skipped: 0, errors: [], canceled: true }
      }

      try {
        const csvContent = await readFile(result.filePaths[0], 'utf-8')
        const items = getItems()
        const format = (options?.format as CsvFormat) || CsvFormat.BUDGIT
        const parsed = parseTransactionsCSV(csvContent, items, format)

        if (parsed.errors.length > 0) {
          return {
            success: false,
            imported: 0,
            skipped: 0,
            errors: parsed.errors.map((e) => `Row ${e.row}: ${e.message}`)
          }
        }

        return importTransactions(parsed.transactions, options?.targetMonth)
      } catch (error) {
        return { success: false, imported: 0, skipped: 0, errors: [String(error)] }
      }
    }
  )

  ipcMain.handle(
    'csv:parseTransactions',
    async (
      _,
      csvContent: string,
      options?: { format?: string; defaultItemId?: string }
    ): Promise<{
      transactions: ParsedTransaction[]
      errors: { row: number; message: string }[]
    }> => {
      try {
        const items = getItems()
        const format = (options?.format as CsvFormat) || CsvFormat.BUDGIT
        const parsed = parseTransactionsCSV(csvContent, items, format, options?.defaultItemId)
        return { transactions: parsed.transactions, errors: parsed.errors }
      } catch (error) {
        return { transactions: [], errors: [{ row: 0, message: String(error) }] }
      }
    }
  )

  // ============== CSV Import Wizard (Dynamic Column Mapping) ==============

  // Open file dialog and return CSV content for wizard
  ipcMain.handle(
    'csv:selectFile',
    async (): Promise<{
      success: boolean
      content?: string
      fileName?: string
      canceled?: boolean
      error?: string
    }> => {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) return { success: false, error: 'No active window' }

      const result = await dialog.showOpenDialog(window, {
        title: 'Select CSV File',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true }
      }

      try {
        const content = await readFile(result.filePaths[0], 'utf-8')
        const fileName = result.filePaths[0].split('/').pop() || 'unknown.csv'
        return { success: true, content, fileName }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  // Extract headers from CSV content
  ipcMain.handle('csv:extractHeaders', (_, csvContent: string): string[] => {
    return extractCsvHeaders(csvContent)
  })

  // Get preview rows from CSV
  ipcMain.handle('csv:getPreviewRows', (_, csvContent: string, maxRows?: number): string[][] => {
    return getCsvPreviewRows(csvContent, maxRows)
  })

  // Auto-detect column mapping from headers
  ipcMain.handle('csv:autoDetectMapping', (_, headers: string[]): Partial<ColumnMapping> => {
    return autoDetectColumnMapping(headers)
  })

  // Parse CSV with dynamic column mapping
  ipcMain.handle(
    'csv:parseWithMapping',
    async (
      _,
      csvContent: string,
      mapping: ColumnMapping,
      options?: {
        dateFormat?: DateFormatPreset
        amountSignMode?: AmountSignMode
        paymentHandling?: PaymentRowHandling
        paymentKeywords?: string[]
        defaultItemId?: string
      }
    ): Promise<{
      transactions: ParsedTransaction[]
      errors: ParseError[]
      skippedPayments: number
    }> => {
      try {
        const items = getItems()
        const result = parseTransactionsWithMapping(csvContent, items, mapping, options)
        return result
      } catch (error) {
        return {
          transactions: [],
          errors: [{ row: 0, field: '', message: String(error) }],
          skippedPayments: 0
        }
      }
    }
  )

  // Import transactions with dynamic mapping (full flow)
  ipcMain.handle(
    'csv:importWithMapping',
    async (
      _,
      csvContent: string,
      mapping: ColumnMapping,
      options?: {
        dateFormat?: DateFormatPreset
        amountSignMode?: AmountSignMode
        paymentHandling?: PaymentRowHandling
        paymentKeywords?: string[]
        targetMonth?: string
      }
    ): Promise<ImportResult & { skippedPayments?: number }> => {
      try {
        const items = getItems()
        const parsed = parseTransactionsWithMapping(csvContent, items, mapping, options)

        if (parsed.errors.length > 0) {
          return {
            success: false,
            imported: 0,
            skipped: 0,
            errors: parsed.errors.map((e) => `Row ${e.row}: ${e.message}`),
            skippedPayments: parsed.skippedPayments
          }
        }

        const result = importTransactions(parsed.transactions, options?.targetMonth)
        return { ...result, skippedPayments: parsed.skippedPayments }
      } catch (error) {
        return { success: false, imported: 0, skipped: 0, errors: [String(error)] }
      }
    }
  )

  // ============== CSV Import Profiles ==============

  ipcMain.handle('csv:getProfiles', (): CsvImportProfile[] => {
    return getCsvImportProfiles()
  })

  ipcMain.handle('csv:getProfile', (_, id: string): CsvImportProfile | null => {
    return getCsvImportProfile(id)
  })

  ipcMain.handle(
    'csv:addProfile',
    (_, profile: Omit<CsvImportProfile, 'id' | 'createdAt' | 'updatedAt'>): CsvImportProfile => {
      return addCsvImportProfile(profile)
    }
  )

  ipcMain.handle(
    'csv:updateProfile',
    (
      _,
      id: string,
      updates: Partial<Omit<CsvImportProfile, 'id' | 'createdAt'>>
    ): CsvImportProfile | null => {
      return updateCsvImportProfile(id, updates)
    }
  )

  ipcMain.handle('csv:deleteProfile', (_, id: string): boolean => {
    return deleteCsvImportProfile(id)
  })

  // Create default profile from headers
  ipcMain.handle(
    'csv:createDefaultProfile',
    (
      _,
      name: string,
      headers: string[]
    ): Omit<CsvImportProfile, 'id' | 'createdAt' | 'updatedAt'> => {
      const detectedMapping = autoDetectColumnMapping(headers)
      return createDefaultProfile(name, headers, detectedMapping)
    }
  )

  // Export budget items
  ipcMain.handle('csv:exportItems', async () => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return { success: false, error: 'No active window' }

    const result = await dialog.showSaveDialog(window, {
      title: 'Export Budget Items',
      defaultPath: 'budgit-items.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    try {
      const items = getItems()
      const csvContent = generateItemsCSV(items)
      await writeFile(result.filePath, csvContent, 'utf-8')
      return { success: true, filePath: result.filePath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Import budget items
  ipcMain.handle(
    'csv:importItems',
    async (
      _,
      options?: { mode?: 'merge' | 'replace' }
    ): Promise<ImportItemsResult & { canceled?: boolean }> => {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) return { success: false, imported: 0, updated: 0, errors: ['No active window'] }

      const result = await dialog.showOpenDialog(window, {
        title: 'Import Budget Items',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, imported: 0, updated: 0, errors: [], canceled: true }
      }

      try {
        const csvContent = await readFile(result.filePaths[0], 'utf-8')
        const parsed = parseItemsCSV(csvContent)

        if (parsed.errors.length > 0) {
          return {
            success: false,
            imported: 0,
            updated: 0,
            errors: parsed.errors.map((e) => `Row ${e.row}: ${e.message}`)
          }
        }

        return importItems(parsed.items, options?.mode || 'merge')
      } catch (error) {
        return { success: false, imported: 0, updated: 0, errors: [String(error)] }
      }
    }
  )

  // ============== AI Chat ==============
  ipcMain.handle('ai:getSessions', () => {
    return getChatSessions()
  })

  ipcMain.handle('ai:getCurrentSessionId', () => {
    return getCurrentSessionId()
  })

  ipcMain.handle('ai:createSession', () => {
    return createChatSession()
  })

  ipcMain.handle('ai:getSession', (_, sessionId: string) => {
    return getChatSession(sessionId)
  })

  ipcMain.handle('ai:setCurrentSession', (_, sessionId: string) => {
    setCurrentSession(sessionId)
  })

  ipcMain.handle('ai:saveChatMessage', (_, sessionId: string, message: ChatMessage) => {
    saveChatMessage(sessionId, message)
  })

  ipcMain.handle('ai:renameSession', (_, sessionId: string, newTitle: string) => {
    renameChatSession(sessionId, newTitle)
  })

  ipcMain.handle('ai:deleteSession', (_, sessionId: string) => {
    deleteChatSession(sessionId)
  })

  ipcMain.handle('ai:clearAllSessions', () => {
    clearAllChatSessions()
  })

  // Streaming chat handler
  ipcMain.on(
    'ai:chat-stream',
    async (
      event,
      {
        messages,
        contextMonths
      }: {
        messages: { role: 'user' | 'assistant'; content: string }[]
        contextMonths: AiContextMonths
      }
    ) => {
      const settings = getSettings()
      const apiKey = settings.claudeApiKey

      if (!apiKey) {
        event.sender.send('ai:chat-stream-error', { error: 'API key not configured' })
        return
      }

      try {
        // Build context from budget data
        const items = getItems()
        const allBudgets = getBudgetsWithSpent()
        const allTransactions = getTransactions()

        // Filter by context months
        let filteredBudgets = allBudgets
        let filteredTransactions = allTransactions

        if (contextMonths !== 'all') {
          const now = new Date()
          const cutoffDate = new Date(now.getFullYear(), now.getMonth() - contextMonths, 1)
          const cutoffMonth = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}`

          filteredBudgets = allBudgets.filter((b) => b.month >= cutoffMonth)
          filteredTransactions = allTransactions.filter((t) => t.budgetMonth >= cutoffMonth)
        }

        // Build system prompt with budget context
        const systemPrompt = buildSystemPrompt(
          items,
          filteredBudgets,
          filteredTransactions,
          settings.currencySymbol
        )

        const client = new Anthropic({ apiKey })

        const stream = await client.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content
          }))
        })

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            event.sender.send('ai:chat-stream-chunk', { text: chunk.delta.text })
          }
        }

        event.sender.send('ai:chat-stream-end', {})
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        event.sender.send('ai:chat-stream-error', { error: errorMessage })
      }
    }
  )
}

// Build system prompt with budget context for Budgit AI
function buildSystemPrompt(
  items: BudgetItem[],
  budgets: ReturnType<typeof getBudgetsWithSpent>,
  transactions: Transaction[],
  currencySymbol: string
): string {
  const itemList = items.map((i) => `- ${i.name} (${i.group})`).join('\n')

  // Summarize budgets
  const budgetSummaries = budgets
    .slice(-6) // Last 6 months max
    .map((b) => {
      const totalPlanned = b.allocations.reduce((sum, a) => sum + a.planned, 0)
      const totalSpent = b.allocations.reduce((sum, a) => sum + a.spent, 0)
      return `${b.month}: Income ${currencySymbol}${b.incomeTotal.toFixed(2)}, Planned ${currencySymbol}${totalPlanned.toFixed(2)}, Spent ${currencySymbol}${totalSpent.toFixed(2)}`
    })
    .join('\n')

  // Summarize spending by item for the most recent month
  const recentBudget = budgets[budgets.length - 1]
  let itemBreakdown = ''
  if (recentBudget) {
    itemBreakdown = recentBudget.allocations
      .filter((a) => a.planned > 0 || a.spent > 0)
      .map((a) => {
        const item = items.find((i) => i.id === a.itemId)
        return `- ${item?.name || 'Unknown'}: Planned ${currencySymbol}${a.planned.toFixed(2)}, Spent ${currencySymbol}${a.spent.toFixed(2)}`
      })
      .join('\n')
  }

  // Transaction count and recent transactions
  const recentTransactions = transactions
    .slice(-10)
    .map((t) => {
      const item = items.find((i) => i.id === t.itemId)
      return `- ${t.date}: ${t.description} - ${currencySymbol}${t.amount.toFixed(2)} (${item?.name || 'Unknown'})`
    })
    .join('\n')

  return `You are Budgit, a friendly and knowledgeable personal finance assistant built into the Budgit budgeting app. You help users understand their spending, track their budget goals, and provide actionable financial insights.

Your personality:
- Warm, encouraging, and supportive
- Use clear, simple language (avoid jargon)
- Celebrate wins and be gentle with areas for improvement
- Provide specific, actionable advice
- Reference their actual data when answering questions

The user's currency symbol is: ${currencySymbol}

BUDGET ITEMS:
${itemList}

MONTHLY BUDGET SUMMARIES (most recent months):
${budgetSummaries || 'No budget data available yet.'}

CURRENT MONTH ITEM BREAKDOWN:
${itemBreakdown || 'No allocations yet.'}

RECENT TRANSACTIONS:
${recentTransactions || 'No transactions recorded yet.'}

When answering:
1. Reference specific numbers from their data
2. Identify trends (increasing/decreasing spending)
3. Compare planned vs actual spending
4. Highlight items that are over or under budget
5. Provide practical tips for improvement
6. Be encouraging about progress

If the user asks about something you don't have data for, let them know what information would help and suggest they add it to their budget.`
}
