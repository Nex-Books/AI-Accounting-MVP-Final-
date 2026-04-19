import { streamText, tool, convertToModelMessages } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { PLAN_LIMITS, type PlanTier } from '@/lib/types'

export const maxDuration = 60

// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPT  — NexBooks AI Accountant
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are NexBooks AI — a senior chartered accountant assistant for Indian small businesses.
You are proactive, precise, and deeply knowledgeable about Indian accounting law, GST, TDS, and double-entry bookkeeping.

## YOUR PRIMARY JOB
When a user describes a transaction, you MUST:
1. Figure out the correct double-entry (debit/credit)
2. Ask ONE clarifying question if truly needed (never more than one at a time)
3. Create the journal entry using the create_journal_entry tool
4. Confirm what was done and show the entry summary

## INDIAN ACCOUNTING RULES YOU MUST FOLLOW

### Double-Entry Rules
- Assets & Expenses: Debit increases, Credit decreases
- Liabilities, Equity, Income: Credit increases, Debit decreases
- TOTAL DEBITS MUST ALWAYS EQUAL TOTAL CREDITS

### GST Rules (India)
- Intra-state sale/purchase → CGST + SGST (split equally)
- Inter-state sale/purchase → IGST only
- GST rates: 5%, 12%, 18%, 28%
- Always ask "intra-state or inter-state?" if not clear
- GST on PURCHASE → Debit: Input GST account, Credit: Vendor/Bank
- GST on SALE → Debit: Customer/Cash, Credit: Sales + Output GST account

### TDS Rules
- TDS on professional fees: 10% (Section 194J)
- TDS on rent: 10% (Section 194I) — if >₹50,000/month
- TDS on contractor payments: 1-2% (Section 194C)
- When recording TDS: Dr Expense, Cr TDS Payable + Cr Vendor (net)

### Common Transaction Patterns
**Cash/Bank Sale:**
  Dr: Cash/Bank (full amount including GST)
  Cr: Sales Revenue (base amount)
  Cr: GST Payable CGST (if intra-state)
  Cr: GST Payable SGST (if intra-state)
  OR Cr: GST Payable IGST (if inter-state)

**Cash/Bank Purchase:**
  Dr: Purchase/Expense (base amount)
  Dr: GST Input Credit CGST (if intra-state)
  Dr: GST Input Credit SGST (if intra-state)
  Cr: Cash/Bank (full amount)

**Salary Payment (with TDS):**
  Dr: Salary Expense (gross)
  Cr: TDS Payable (if applicable)
  Cr: Bank/Cash (net amount paid)

**Rent Payment:**
  Dr: Rent Expense (gross)
  Cr: TDS Payable (10% if >50k/month)
  Cr: Bank/Cash (net paid)

**Credit Sale (Invoice raised):**
  Dr: Accounts Receivable (full amount)
  Cr: Sales Revenue (base)
  Cr: GST Payable (tax portion)

**Payment Received from Customer:**
  Dr: Cash/Bank
  Cr: Accounts Receivable

**Purchase on Credit:**
  Dr: Purchase/Expense (base)
  Dr: GST Input Credit (tax portion)
  Cr: Accounts Payable (full amount)

**Payment to Vendor:**
  Dr: Accounts Payable
  Cr: Bank/Cash

**GST Payment to Government:**
  Dr: GST Payable CGST
  Dr: GST Payable SGST
  Cr: Bank

**Advance Payment:**
  Dr: Advance to Vendor / Advance from Customer
  Cr: Bank/Cash

## WHEN TO ASK QUESTIONS
Ask ONE question ONLY if:
- GST rate not mentioned for a taxable transaction
- Intra-state vs inter-state not clear (ask the state)
- Cash or bank not clear
- Credit or cash sale not clear
- Vendor/customer name useful for party tracking (ask once)

DO NOT ask if:
- Amount, date, and basic nature are clear
- User said "cash" or "bank" clearly
- Non-taxable transaction (salary, rent under 50k, bank charges)

## RESPONSE FORMAT
After creating an entry, always show:
✅ Entry Created: [Reference Number]
📋 [Description]
💰 Amount: ₹[amount in Indian format]

Then briefly explain the accounting treatment in 1-2 lines.

## FINANCIAL YEAR
India: April 1 to March 31
Current FY: Use today's date to determine. Always use today's date if user doesn't specify.

## CURRENCY FORMAT
Always use Indian format: ₹1,00,000 (one lakh), ₹10,00,000 (ten lakhs), ₹1,00,00,000 (one crore)
`

// ─────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const { messages, companyId, userId, attachments } = await request.json()

  if (!companyId || !userId) {
    return new Response('Missing company or user context', { status: 400 })
  }

  const supabase = await createClient()

  // ── Plan limit check ──────────────────────────────────────
  const { data: company } = await supabase
    .from('companies')
    .select('plan, ai_queries_used_month, ai_transactions_used_month, fiscal_year_start')
    .eq('id', companyId)
    .single()

  const planKey = (company?.plan || 'free') as PlanTier
  const limits  = PLAN_LIMITS[planKey] ?? PLAN_LIMITS.free

  if ((company?.ai_queries_used_month ?? 0) >= limits.queries) {
    return Response.json(
      { error: 'Monthly AI query limit reached. Upgrade your plan to continue.', limitReached: true },
      { status: 402 }
    )
  }

  // Increment query counter
  await supabase
    .from('companies')
    .update({ ai_queries_used_month: (company?.ai_queries_used_month ?? 0) + 1 })
    .eq('id', companyId)

  // ── Context: chart of accounts ────────────────────────────
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name, type, sub_type')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('code')

  // ── Context: parties ──────────────────────────────────────
  const { data: parties } = await supabase
    .from('parties')
    .select('id, name, type')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')
    .limit(50)

  // ── Context: recent entries ───────────────────────────────
  const { data: recentEntries } = await supabase
    .from('journal_entries')
    .select('reference_number, date, description')
    .eq('company_id', companyId)
    .order('date', { ascending: false })
    .limit(8)

  const accountList = accounts?.map(a =>
    `${a.code}: ${a.name} [${a.type}${a.sub_type ? '/' + a.sub_type : ''}]`
  ).join('\n') || 'No accounts yet — user needs to complete onboarding'

  const partyList = parties?.length
    ? parties.map(p => `${p.name} (${p.type})`).join(', ')
    : 'No parties yet'

  const recentList = recentEntries?.map(e =>
    `${e.reference_number} | ${e.date} | ${e.description}`
  ).join('\n') || 'No entries yet'

  const attachmentCtx = attachments?.length
    ? `\n## Attached Documents:\n${attachments.map((a: { fileName: string; fileType: string }) =>
        `- ${a.fileName} (${a.fileType})`).join('\n')}`
    : ''

  const contextBlock = `
## Chart of Accounts (use exact codes):
${accountList}

## Known Parties (customers/vendors):
${partyList}

## Recent Journal Entries:
${recentList}
${attachmentCtx}

Today's date: ${new Date().toISOString().split('T')[0]}
Fiscal year start: ${company?.fiscal_year_start || '04-01'}
`

  try {
    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: SYSTEM_PROMPT + '\n\n' + contextBlock,
      messages: await convertToModelMessages(messages),
      maxSteps: 5,
      tools: {

        // ── TOOL 1: Create Journal Entry ──────────────────────
        create_journal_entry: tool({
          description: 'Create a double-entry journal entry. Call this IMMEDIATELY when you know the debit/credit lines. Do not ask for confirmation — just create it.',
          inputSchema: z.object({
            date: z.string().describe('YYYY-MM-DD. Use today if not specified.'),
            description: z.string().describe('Clear description, e.g. "Rent paid for January 2025"'),
            reference_number: z.string().optional().describe('Invoice/receipt number if user mentioned one'),
            lines: z.array(z.object({
              account_code: z.string().describe('Exact code from chart of accounts'),
              debit:  z.number().min(0).describe('Debit amount (0 if credit line)'),
              credit: z.number().min(0).describe('Credit amount (0 if debit line)'),
              narration: z.string().optional().describe('Line-level description'),
              party_name: z.string().optional().describe('Customer or vendor name for this line'),
            })).min(2).describe('Minimum 2 lines. Debits must equal credits.'),
          }),

          execute: async ({ date, description, reference_number, lines }) => {
            // Validate balance
            const totalDebit  = lines.reduce((s, l) => s + l.debit,  0)
            const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
              return {
                success: false,
                error: `Debits ₹${totalDebit.toLocaleString('en-IN')} ≠ Credits ₹${totalCredit.toLocaleString('en-IN')}. Entry not saved.`,
              }
            }

            const accountMap = new Map(accounts?.map(a => [a.code, a.id]) || [])
            const missing = lines.filter(l => !accountMap.has(l.account_code))
            if (missing.length > 0) {
              return {
                success: false,
                error: `Account codes not found: ${missing.map(l => l.account_code).join(', ')}. Available: ${accounts?.map(a => a.code).join(', ')}`,
              }
            }

            // Resolve / create parties
            const partyIdMap = new Map<string, string>()
            for (const line of lines) {
              if (line.party_name && !partyIdMap.has(line.party_name)) {
                const existing = parties?.find(p =>
                  p.name.toLowerCase() === line.party_name!.toLowerCase()
                )
                if (existing) {
                  partyIdMap.set(line.party_name, existing.id)
                } else {
                  const { data: newParty } = await supabase
                    .from('parties')
                    .insert({
                      company_id: companyId,
                      name: line.party_name,
                      type: 'both',
                    })
                    .select('id')
                    .single()
                  if (newParty) partyIdMap.set(line.party_name, newParty.id)
                }
              }
            }

            // Generate reference number
            const { count } = await supabase
              .from('journal_entries')
              .select('*', { count: 'exact', head: true })
              .eq('company_id', companyId)

            const refNumber = reference_number || `JE-${((count || 0) + 1).toString().padStart(4, '0')}`

            // Insert journal entry
            const { data: entry, error: entryErr } = await supabase
              .from('journal_entries')
              .insert({
                company_id: companyId,
                reference_number: refNumber,
                date,
                description,
                created_by: userId,
                created_by_ai: true,
              })
              .select('id')
              .single()

            if (entryErr) return { success: false, error: entryErr.message }

            // Insert journal lines
            const { error: linesErr } = await supabase
              .from('journal_lines')
              .insert(lines.map(l => ({
                journal_entry_id: entry.id,
                company_id:       companyId,
                account_id:       accountMap.get(l.account_code)!,
                party_id:         l.party_name ? partyIdMap.get(l.party_name) : null,
                debit:            l.debit,
                credit:           l.credit,
                narration:        l.narration || description,
              })))

            if (linesErr) {
              await supabase.from('journal_entries').delete().eq('id', entry.id)
              return { success: false, error: linesErr.message }
            }

            // Increment AI transaction counter
            await supabase
              .from('companies')
              .update({ ai_transactions_used_month: (company?.ai_transactions_used_month ?? 0) + 1 })
              .eq('id', companyId)

            return {
              success:         true,
              referenceNumber: refNumber,
              entryId:         entry.id,
              amount:          totalDebit,
              lines:           lines.map(l => ({
                account: accounts?.find(a => a.code === l.account_code)?.name,
                debit:   l.debit  > 0 ? `₹${l.debit.toLocaleString('en-IN')}`  : '',
                credit:  l.credit > 0 ? `₹${l.credit.toLocaleString('en-IN')}` : '',
              })),
              message: `Created ${refNumber}: ${description} for ₹${totalDebit.toLocaleString('en-IN')}`,
            }
          },
        }),

        // ── TOOL 2: Get Account Balance ───────────────────────
        get_account_balance: tool({
          description: 'Get current balance of one or more accounts. Use when user asks about cash, bank, receivables, or any account.',
          inputSchema: z.object({
            account_codes: z.array(z.string()).describe('List of account codes to check'),
          }),
          execute: async ({ account_codes }) => {
            const results = []
            for (const code of account_codes) {
              const account = accounts?.find(a => a.code === code)
              if (!account) {
                results.push({ code, error: 'Account not found' })
                continue
              }
              const { data: lineData } = await supabase
                .from('journal_lines')
                .select('debit, credit')
                .eq('account_id', account.id)

              const dr = lineData?.reduce((s, l) => s + (l.debit  || 0), 0) || 0
              const cr = lineData?.reduce((s, l) => s + (l.credit || 0), 0) || 0
              const isDebitNormal = account.type === 'asset' || account.type === 'expense'
              const balance = isDebitNormal ? dr - cr : cr - dr

              results.push({
                code,
                name:      account.name,
                type:      account.type,
                balance,
                formatted: `₹${Math.abs(balance).toLocaleString('en-IN')} ${balance < 0 ? 'Cr' : 'Dr'}`,
              })
            }
            return { accounts: results }
          },
        }),

        // ── TOOL 3: Financial Summary ─────────────────────────
        get_financial_summary: tool({
          description: 'Get P&L and balance sheet summary. Use when user asks about profit, loss, net worth, or financial health.',
          inputSchema: z.object({
            period: z.enum(['current_fy', 'current_month', 'last_month', 'custom']).optional().default('current_fy'),
          }),
          execute: async ({ period }) => {
            const today = new Date()
            const fyStartStr = company?.fiscal_year_start || '04-01'
            const [fyMon, fyDay] = fyStartStr.split('-').map(Number)

            let startDate: Date
            const endDate = today

            if (period === 'current_month') {
              startDate = new Date(today.getFullYear(), today.getMonth(), 1)
            } else if (period === 'last_month') {
              startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
              endDate.setDate(0)
            } else {
              // Current FY
              if (today.getMonth() + 1 >= fyMon) {
                startDate = new Date(today.getFullYear(), fyMon - 1, fyDay)
              } else {
                startDate = new Date(today.getFullYear() - 1, fyMon - 1, fyDay)
              }
            }

            const fmt = (d: Date) => d.toISOString().split('T')[0]

            const { data } = await supabase.rpc('get_financial_summary', {
              p_company_id: companyId,
              p_start_date: fmt(startDate),
              p_end_date:   fmt(endDate),
            })

            const s = data as Record<string, number> || {}
            return {
              period: `${fmt(startDate)} to ${fmt(endDate)}`,
              totalIncome:      s.total_revenue    || 0,
              totalExpenses:    s.total_expenses   || 0,
              netProfit:        s.net_profit       || 0,
              totalAssets:      s.total_assets     || 0,
              totalLiabilities: s.total_liabilities || 0,
              netWorth:         s.net_worth        || 0,
              formatted: {
                income:      `₹${(s.total_revenue    || 0).toLocaleString('en-IN')}`,
                expenses:    `₹${(s.total_expenses   || 0).toLocaleString('en-IN')}`,
                netProfit:   `₹${(s.net_profit       || 0).toLocaleString('en-IN')}`,
                assets:      `₹${(s.total_assets     || 0).toLocaleString('en-IN')}`,
                liabilities: `₹${(s.total_liabilities || 0).toLocaleString('en-IN')}`,
                netWorth:    `₹${(s.net_worth        || 0).toLocaleString('en-IN')}`,
              },
            }
          },
        }),

        // ── TOOL 4: Search Transactions ───────────────────────
        search_transactions: tool({
          description: 'Search past journal entries by keyword, party name, or date range.',
          inputSchema: z.object({
            keyword:    z.string().optional(),
            start_date: z.string().optional().describe('YYYY-MM-DD'),
            end_date:   z.string().optional().describe('YYYY-MM-DD'),
            limit:      z.number().optional().default(10),
          }),
          execute: async ({ keyword, start_date, end_date, limit }) => {
            let query = supabase
              .from('journal_entries')
              .select('reference_number, date, description, created_by_ai')
              .eq('company_id', companyId)
              .order('date', { ascending: false })
              .limit(limit || 10)

            if (keyword)    query = query.ilike('description', `%${keyword}%`)
            if (start_date) query = query.gte('date', start_date)
            if (end_date)   query = query.lte('date', end_date)

            const { data, error } = await query
            if (error) return { error: error.message }
            if (!data?.length) return { message: 'No matching transactions found.' }

            return {
              count: data.length,
              transactions: data.map(t => ({
                ref:  t.reference_number,
                date: t.date,
                desc: t.description,
                byAI: t.created_by_ai,
              })),
            }
          },
        }),

        // ── TOOL 5: Calculate GST ─────────────────────────────
        calculate_gst: tool({
          description: 'Calculate GST breakdown (CGST+SGST or IGST). Use whenever user asks about GST on an amount.',
          inputSchema: z.object({
            amount:     z.number().describe('Base amount (exclusive) or total (inclusive)'),
            rate:       z.number().describe('GST rate: 5, 12, 18, or 28'),
            inclusive:  z.boolean().optional().default(false).describe('True if amount already includes GST'),
            interstate: z.boolean().optional().default(false).describe('True for inter-state (IGST only)'),
          }),
          execute: async ({ amount, rate, inclusive, interstate }) => {
            let base: number, gst: number, total: number
            if (inclusive) {
              total = amount
              base  = total / (1 + rate / 100)
              gst   = total - base
            } else {
              base  = amount
              gst   = amount * rate / 100
              total = base + gst
            }
            base  = Math.round(base  * 100) / 100
            gst   = Math.round(gst   * 100) / 100
            total = Math.round(total * 100) / 100

            return {
              base, gst, total, rate: `${rate}%`,
              igst:  interstate ? gst : 0,
              cgst: !interstate ? gst / 2 : 0,
              sgst: !interstate ? gst / 2 : 0,
              formatted: {
                base:  `₹${base.toLocaleString('en-IN')}`,
                gst:   `₹${gst.toLocaleString('en-IN')}`,
                total: `₹${total.toLocaleString('en-IN')}`,
                cgst: !interstate ? `₹${(gst / 2).toLocaleString('en-IN')}` : undefined,
                sgst: !interstate ? `₹${(gst / 2).toLocaleString('en-IN')}` : undefined,
                igst:  interstate ? `₹${gst.toLocaleString('en-IN')}` : undefined,
              },
            }
          },
        }),

        // ── TOOL 6: List Accounts ─────────────────────────────
        list_accounts: tool({
          description: 'List accounts, optionally filtered by type. Use when user asks what accounts exist.',
          inputSchema: z.object({
            type: z.enum(['asset','liability','equity','income','expense']).optional(),
          }),
          execute: async ({ type }) => {
            const filtered = type
              ? (accounts || []).filter(a => a.type === type)
              : (accounts || [])
            return {
              count: filtered.length,
              accounts: filtered.map(a => ({ code: a.code, name: a.name, type: a.type })),
            }
          },
        }),

        // ── TOOL 7: Create or Find Party ──────────────────────
        create_or_find_party: tool({
          description: 'Create a new customer or vendor, or look up an existing one by name.',
          inputSchema: z.object({
            name:  z.string().describe('Party name'),
            type:  z.enum(['customer','vendor','both']).optional().default('both'),
            gstin: z.string().optional(),
            phone: z.string().optional(),
            email: z.string().optional(),
          }),
          execute: async ({ name, type, gstin, phone, email }) => {
            const existing = parties?.find(p =>
              p.name.toLowerCase() === name.toLowerCase()
            )
            if (existing) {
              return { found: true, id: existing.id, name: existing.name, type: existing.type }
            }
            const { data, error } = await supabase
              .from('parties')
              .insert({ company_id: companyId, name, type: type || 'both', gstin, phone, email })
              .select('id, name, type')
              .single()
            if (error) return { error: error.message }
            return { created: true, id: data.id, name: data.name, type: data.type }
          },
        }),

        // ── TOOL 8: Analyze Uploaded Document ─────────────────
        analyze_document: tool({
          description: 'Analyze an uploaded file that the user has attached. Extracts transaction data and creates journal entries.',
          inputSchema: z.object({
            file_name: z.string().describe('Name of the uploaded file'),
            action:    z.enum(['extract_and_record', 'summarize_only']).default('extract_and_record'),
          }),
          execute: async ({ file_name, action }) => {
            const att = attachments?.find((a: { fileName: string }) =>
              a.fileName === file_name
            )
            if (!att) return { error: `File "${file_name}" not found in attachments` }

            const { data: doc, error: docErr } = await supabase
              .from('documents')
              .insert({
                company_id:  companyId,
                file_name:   att.fileName,
                file_type:   att.fileType || 'unknown',
                file_size_bytes: 0,
                storage_path:   att.storagePath || '',
                uploaded_by: userId,
                ocr_status:  'pending',
              })
              .select('id')
              .single()

            if (docErr) return { error: docErr.message }

            return {
              success: true,
              documentId: doc.id,
              fileName: file_name,
              message: action === 'summarize_only'
                ? `Document "${file_name}" registered. Tell me to extract transactions when ready.`
                : `Document "${file_name}" queued for AI extraction. I'll create journal entries from it now — please also use /documents/upload for full OCR processing.`,
            }
          },
        }),

      },
    })

    return result.toUIMessageStreamResponse()
  } catch (err) {
    console.error('Chat API error:', err)
    return new Response(
      JSON.stringify({ error: 'AI service unavailable. Check OPENAI_API_KEY.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
