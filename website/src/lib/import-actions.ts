'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { round2 } from '@/lib/queries'
import { handleDbError } from '@/lib/server-utils'

export type ImportError = { row: number; column: string; message: string }
export type ImportResult = { success?: number; errors?: ImportError[]; error?: string }

// --- Helpers ---

function str(val: unknown): string | null {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  return s || null
}

function num(val: unknown): number | null {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  if (s === '') return null
  const n = Number(s)
  return isNaN(n) ? null : n
}

// ============================================================
// Quotes Import
// ============================================================

export async function importQuotes(
  rows: Record<string, unknown>[]
): Promise<ImportResult> {
  const supabase = await createServerSupabaseClient()
  const errors: ImportError[] = []

  // Load lookups
  const { data: projects } = await supabase
    .from('projects').select('id, project_code').eq('is_active', true)
  const projectMap = new Map((projects ?? []).map(p => [p.project_code, p.id]))

  const { data: entities } = await supabase
    .from('entities').select('id, document_number').eq('is_active', true)
  const entityMap = new Map((entities ?? []).map(e => [e.document_number, e.id]))

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const r = i + 5

    const projectCode = str(row.project_code)
    const entityDocNum = str(row.entity_document_number)
    const dateReceived = str(row.date_received)
    const title = str(row.title)
    const subtotal = num(row.subtotal)
    const total = num(row.total)
    const currency = str(row.currency)
    const exchangeRate = num(row.exchange_rate)
    const status = str(row.status)

    // Required
    if (!projectCode) errors.push({ row: r, column: 'project_code', message: 'Required' })
    if (!entityDocNum) errors.push({ row: r, column: 'entity_document_number', message: 'Required' })
    if (!dateReceived) errors.push({ row: r, column: 'date_received', message: 'Required' })
    if (!title) errors.push({ row: r, column: 'title', message: 'Required' })
    if (subtotal === null) errors.push({ row: r, column: 'subtotal', message: 'Required' })
    if (total === null) errors.push({ row: r, column: 'total', message: 'Required' })
    if (!currency) errors.push({ row: r, column: 'currency', message: 'Required' })
    if (exchangeRate === null) errors.push({ row: r, column: 'exchange_rate', message: 'Required' })
    if (!status) errors.push({ row: r, column: 'status', message: 'Required' })

    // Enums
    if (currency && !['USD', 'PEN'].includes(currency)) {
      errors.push({ row: r, column: 'currency', message: 'Must be: USD, PEN' })
    }
    if (status && !['pending', 'accepted', 'rejected'].includes(status)) {
      errors.push({ row: r, column: 'status', message: 'Must be: pending, accepted, rejected' })
    }

    // FK lookups
    if (projectCode && !projectMap.has(projectCode)) {
      errors.push({ row: r, column: 'project_code', message: 'Not found in database' })
    }
    if (entityDocNum && !entityMap.has(entityDocNum)) {
      errors.push({ row: r, column: 'entity_document_number', message: 'Not found in database' })
    }

    // Exchange rate range
    if (exchangeRate !== null && (exchangeRate < 2.5 || exchangeRate > 6.0)) {
      errors.push({ row: r, column: 'exchange_rate', message: 'Outside typical range (2.5-6.0)' })
    }

    // Arithmetic validation
    const igvAmount = num(row.igv_amount)
    const quantity = num(row.quantity)
    const unitPrice = num(row.unit_price)

    if (quantity !== null && unitPrice !== null && subtotal !== null) {
      const expected = round2(quantity * unitPrice)
      if (Math.abs(expected - subtotal) > 0.01) {
        errors.push({ row: r, column: 'subtotal', message: `quantity × unit_price = ${expected}, but subtotal is ${subtotal}` })
      }
    }
    if (igvAmount !== null && subtotal !== null) {
      const expectedIgv = round2(subtotal * 0.18)
      if (Math.abs(expectedIgv - igvAmount) > 0.01) {
        errors.push({ row: r, column: 'igv_amount', message: `subtotal × 18% = ${expectedIgv}, but igv_amount is ${igvAmount}` })
      }
    }
    if (igvAmount !== null && subtotal !== null && total !== null) {
      const expectedTotal = round2(subtotal + igvAmount)
      if (Math.abs(expectedTotal - total) > 0.01) {
        errors.push({ row: r, column: 'total', message: `subtotal + igv_amount = ${expectedTotal}, but total is ${total}` })
      }
    }
  }

  if (errors.length > 0) return { errors }

  const records = rows.map(row => ({
    project_id: projectMap.get(str(row.project_code)!)!,
    entity_id: entityMap.get(str(row.entity_document_number)!)!,
    date_received: str(row.date_received)!,
    title: str(row.title)!,
    quantity: num(row.quantity),
    unit_of_measure: str(row.unit_of_measure),
    unit_price: num(row.unit_price),
    subtotal: num(row.subtotal)!,
    igv_amount: num(row.igv_amount),
    total: num(row.total)!,
    currency: str(row.currency)!,
    exchange_rate: num(row.exchange_rate)!,
    status: str(row.status)!,
    document_ref: str(row.document_ref),
    notes: str(row.notes),
  }))

  const { error, data } = await supabase.from('quotes').insert(records).select('id')
  if (error) return { error: handleDbError(error, 'Failed to import quotes') }

  revalidatePath('/prices')
  return { success: data.length }
}

// ============================================================
// Invoices Import (grouped rows → header + items via RPC)
// ============================================================

const COMPROBANTE_TYPES = [
  'factura', 'boleta', 'recibo_por_honorarios',
  'liquidacion_de_compra', 'planilla_jornales', 'none',
]

export async function importInvoices(
  rows: Record<string, unknown>[]
): Promise<ImportResult> {
  const supabase = await createServerSupabaseClient()
  const errors: ImportError[] = []

  // Load lookups
  const { data: projects } = await supabase
    .from('projects').select('id, project_code').eq('is_active', true)
  const projectMap = new Map((projects ?? []).map(p => [p.project_code, p.id]))

  const { data: entities } = await supabase
    .from('entities').select('id, document_number').eq('is_active', true)
  const entityMap = new Map((entities ?? []).map(e => [e.document_number, e.id]))

  const { data: partners } = await supabase
    .from('entity_tags').select('entity_id, tags!inner(name)').eq('tags.name', 'partner')
  const partnerEntityIds = (partners ?? []).map(t => t.entity_id)
  const { data: partnerEntities } = await supabase
    .from('entities').select('id, legal_name').in('id', partnerEntityIds).eq('is_active', true)
  const partnerMap = new Map((partnerEntities ?? []).map(p => [p.legal_name, p.id]))

  const { data: quotes } = await supabase
    .from('quotes').select('id, document_ref')
  const quoteMap = new Map(
    (quotes ?? []).filter(q => q.document_ref).map(q => [q.document_ref!, q.id])
  )

  const { data: categories } = await supabase
    .from('categories').select('name')
  const categorySet = new Set((categories ?? []).map(c => c.name))

  // --- Validate each row ---
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const r = i + 5

    const direction = str(row.direction)
    const partnerName = str(row.partner_name)
    const invoiceDate = str(row.invoice_date)
    const currency = str(row.currency)
    const igvRate = num(row.igv_rate)
    const exchangeRate = num(row.exchange_rate)
    const projectCode = str(row.project_code)
    const entityDocNum = str(row.entity_document_number)
    const docRef = str(row.document_ref)
    const comprobanteType = str(row.comprobante_type)
    const quoteRef = str(row.quote_document_ref)
    const itemTitle = str(row.item_title)
    const category = str(row.category)
    const subtotal = num(row.subtotal)

    // Required fields
    if (!direction) errors.push({ row: r, column: 'direction', message: 'Required' })
    if (!partnerName) errors.push({ row: r, column: 'partner_name', message: 'Required' })
    if (!invoiceDate) errors.push({ row: r, column: 'invoice_date', message: 'Required' })
    if (!currency) errors.push({ row: r, column: 'currency', message: 'Required' })
    if (igvRate === null) errors.push({ row: r, column: 'igv_rate', message: 'Required' })
    if (exchangeRate === null) errors.push({ row: r, column: 'exchange_rate', message: 'Required' })
    if (!itemTitle) errors.push({ row: r, column: 'item_title', message: 'Required' })
    if (subtotal === null) errors.push({ row: r, column: 'subtotal', message: 'Required' })

    // Enums
    if (direction && !['payable', 'receivable'].includes(direction)) {
      errors.push({ row: r, column: 'direction', message: 'Must be: payable, receivable' })
    }
    if (currency && !['USD', 'PEN'].includes(currency)) {
      errors.push({ row: r, column: 'currency', message: 'Must be: USD, PEN' })
    }
    if (comprobanteType && !COMPROBANTE_TYPES.includes(comprobanteType)) {
      errors.push({ row: r, column: 'comprobante_type', message: `Must be: ${COMPROBANTE_TYPES.join(', ')}` })
    }

    // FK lookups
    if (partnerName && !partnerMap.has(partnerName)) {
      errors.push({ row: r, column: 'partner_name', message: 'Not found in database' })
    }
    if (projectCode && !projectMap.has(projectCode)) {
      errors.push({ row: r, column: 'project_code', message: 'Not found in database' })
    }
    if (entityDocNum && !entityMap.has(entityDocNum)) {
      errors.push({ row: r, column: 'entity_document_number', message: 'Not found in database' })
    }
    if (quoteRef && !quoteMap.has(quoteRef)) {
      errors.push({ row: r, column: 'quote_document_ref', message: 'Not found in database' })
    }
    if (category && !categorySet.has(category)) {
      errors.push({ row: r, column: 'category', message: 'Not found in categories' })
    }

    // Detraccion deposits are always in PEN (SPOT system, Banco de la Nación)
    const detrRate = num(row.detraccion_rate)
    if (detrRate !== null && detrRate > 0 && currency !== 'PEN') {
      errors.push({ row: r, column: 'detraccion_rate', message: 'Detraccion only applies to PEN invoices' })
    }

    // Retencion only on receivables (Korakuen is NOT a retencion agent)
    const retencionApplicable = String(row.retencion_applicable ?? '').toLowerCase() === 'true'
    if (direction === 'payable' && retencionApplicable) {
      errors.push({ row: r, column: 'retencion_applicable', message: 'Retencion only applies to receivable invoices' })
    }

    // Conditional requirements
    if (direction === 'payable' && !docRef) {
      errors.push({ row: r, column: 'document_ref', message: 'Required for payable (grouping key)' })
    }
    if (direction === 'receivable' && !projectCode) {
      errors.push({ row: r, column: 'project_code', message: 'Required for receivable' })
    }
    if (direction === 'receivable' && !entityDocNum) {
      errors.push({ row: r, column: 'entity_document_number', message: 'Required for receivable' })
    }
    if (direction === 'payable' && !category) {
      errors.push({ row: r, column: 'category', message: 'Required for payable' })
    }

    // Exchange rate range
    if (exchangeRate !== null && (exchangeRate < 2.5 || exchangeRate > 6.0)) {
      errors.push({ row: r, column: 'exchange_rate', message: 'Outside typical range (2.5-6.0)' })
    }
  }

  if (errors.length > 0) return { errors }

  // --- Group rows by document_ref ---
  // Payable: grouped by document_ref (required, validated above)
  // Receivable without document_ref: each row is its own invoice
  const groups = new Map<string, Record<string, unknown>[]>()
  let ungroupedIdx = 0

  for (const row of rows) {
    const docRef = str(row.document_ref)
    const key = docRef || `__auto_${ungroupedIdx++}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }

  // --- Insert each group via RPC ---
  let totalInvoices = 0

  for (const [, groupRows] of groups) {
    const first = groupRows[0]
    const direction = str(first.direction)!
    const projectCode = str(first.project_code)

    // Derive cost_type: payable with project → project_cost, payable without → sga, receivable → null
    const costType = direction === 'payable'
      ? (projectCode ? 'project_cost' : 'sga')
      : null

    const headerData = {
      direction,
      cost_type: costType,
      partner_id: partnerMap.get(str(first.partner_name)!)!,
      invoice_date: str(first.invoice_date),
      title: str(first.title),
      invoice_number: str(first.invoice_number),
      igv_rate: num(first.igv_rate),
      currency: str(first.currency),
      exchange_rate: num(first.exchange_rate),
      project_id: projectCode ? projectMap.get(projectCode)! : null,
      entity_id: str(first.entity_document_number)
        ? entityMap.get(str(first.entity_document_number)!)!
        : null,
      quote_id: str(first.quote_document_ref)
        ? quoteMap.get(str(first.quote_document_ref)!)!
        : null,
      detraccion_rate: num(first.detraccion_rate),
      retencion_applicable: String(first.retencion_applicable ?? '').toLowerCase() === 'true',
      retencion_rate: num(first.retencion_rate),
      comprobante_type: str(first.comprobante_type),
      payment_method: str(first.payment_method),
      document_ref: str(first.document_ref),
      due_date: str(first.due_date),
      notes: str(first.notes),
    }

    const itemsData = groupRows.map(row => ({
      title: str(row.item_title),
      category: str(row.category),
      subtotal: num(row.subtotal),
      quantity: num(row.quantity),
      unit_of_measure: str(row.unit_of_measure),
      unit_price: num(row.unit_price),
      notes: null,
    }))

    const { error } = await supabase.rpc('fn_create_invoice_with_items', {
      header_data: headerData,
      items_data: itemsData,
    })

    if (error) {
      const ref = str(first.document_ref) || `group ${totalInvoices + 1}`
      return { error: handleDbError(error, `Failed to import invoice "${ref}"`) }
    }
    totalInvoices++
  }

  revalidatePath('/invoices')
  revalidatePath('/calendar')
  revalidatePath('/payments')
  revalidatePath('/financial-position')
  revalidatePath('/prices')

  return { success: totalInvoices }
}

// ============================================================
// Payments Import
// ============================================================

export async function importPayments(
  rows: Record<string, unknown>[]
): Promise<ImportResult> {
  const supabase = await createServerSupabaseClient()
  const errors: ImportError[] = []

  // Load lookups
  const { data: partners } = await supabase
    .from('entity_tags').select('entity_id, tags!inner(name)').eq('tags.name', 'partner')
  const partnerEntityIds = (partners ?? []).map(t => t.entity_id)
  const { data: partnerEntities } = await supabase
    .from('entities').select('id, legal_name').in('id', partnerEntityIds).eq('is_active', true)
  const partnerMap = new Map((partnerEntities ?? []).map(p => [p.legal_name, p.id]))

  const { data: invoices } = await supabase
    .from('invoices').select('id, document_ref, direction')
  const invoiceMap = new Map(
    (invoices ?? []).filter(i => i.document_ref).map(i => [i.document_ref!, i.id])
  )
  const invoiceDirectionMap = new Map(
    (invoices ?? []).filter(i => i.document_ref).map(i => [i.document_ref!, i.direction])
  )

  const { data: bankAccounts } = await supabase
    .from('bank_accounts').select('id, bank_name, account_number_last4, currency, is_detraccion_account').eq('is_active', true)
  // Key: "BCP-1234" → bank account
  const bankMap = new Map(
    (bankAccounts ?? []).map(ba => [`${ba.bank_name}-${ba.account_number_last4}`, ba])
  )

  const DIRECTIONS = ['inbound', 'outbound']
  const PAYMENT_TYPES = ['regular', 'detraccion', 'retencion']

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const r = i + 5

    const invoiceDocRef = str(row.invoice_document_ref)
    const direction = str(row.direction)
    const paymentType = str(row.payment_type)
    const paymentDate = str(row.payment_date)
    const amount = num(row.amount)
    const currency = str(row.currency)
    const exchangeRate = num(row.exchange_rate)
    const bankAccount = str(row.bank_account)
    const partnerName = str(row.partner_name)

    // Required
    if (!invoiceDocRef) errors.push({ row: r, column: 'invoice_document_ref', message: 'Required' })
    if (!direction) errors.push({ row: r, column: 'direction', message: 'Required' })
    if (!paymentType) errors.push({ row: r, column: 'payment_type', message: 'Required' })
    if (!paymentDate) errors.push({ row: r, column: 'payment_date', message: 'Required' })
    if (amount === null) errors.push({ row: r, column: 'amount', message: 'Required' })
    if (!currency) errors.push({ row: r, column: 'currency', message: 'Required' })
    if (exchangeRate === null) errors.push({ row: r, column: 'exchange_rate', message: 'Required' })
    if (!partnerName) errors.push({ row: r, column: 'partner_name', message: 'Required' })

    // Enums
    if (direction && !DIRECTIONS.includes(direction)) {
      errors.push({ row: r, column: 'direction', message: 'Must be: inbound, outbound' })
    }
    if (paymentType && !PAYMENT_TYPES.includes(paymentType)) {
      errors.push({ row: r, column: 'payment_type', message: 'Must be: regular, detraccion, retencion' })
    }
    if (currency && !['USD', 'PEN'].includes(currency)) {
      errors.push({ row: r, column: 'currency', message: 'Must be: USD, PEN' })
    }

    // FK lookups
    if (invoiceDocRef && !invoiceMap.has(invoiceDocRef)) {
      errors.push({ row: r, column: 'invoice_document_ref', message: 'Not found in database' })
    }
    if (partnerName && !partnerMap.has(partnerName)) {
      errors.push({ row: r, column: 'partner_name', message: 'Not found in database' })
    }

    // Bank account: required for non-retencion
    if (paymentType !== 'retencion') {
      if (!bankAccount) {
        errors.push({ row: r, column: 'bank_account', message: 'Required for regular and detraccion payments' })
      } else if (!bankMap.has(bankAccount)) {
        errors.push({ row: r, column: 'bank_account', message: 'Not found — use format: BankName-Last4 (e.g. BCP-1234)' })
      } else {
        const ba = bankMap.get(bankAccount)!
        if (ba.currency !== currency) {
          errors.push({ row: r, column: 'bank_account', message: `Currency mismatch — account is ${ba.currency}, payment is ${currency}` })
        }
        if (paymentType === 'detraccion' && !ba.is_detraccion_account) {
          errors.push({ row: r, column: 'bank_account', message: 'Must be a Banco de la Nación detracción account' })
        }
        if (paymentType === 'regular' && ba.is_detraccion_account) {
          errors.push({ row: r, column: 'bank_account', message: 'Cannot use detracción account for regular payments' })
        }
      }
    }

    // Retencion only on receivable invoices (Korakuen is NOT a retencion agent)
    if (paymentType === 'retencion' && invoiceDocRef && invoiceDirectionMap.get(invoiceDocRef) === 'payable') {
      errors.push({ row: r, column: 'payment_type', message: 'Retencion payments only apply to receivable invoices' })
    }

    // Amount positive
    if (amount !== null && amount <= 0) {
      errors.push({ row: r, column: 'amount', message: 'Must be greater than 0' })
    }

    // Exchange rate range
    if (exchangeRate !== null && (exchangeRate < 2.5 || exchangeRate > 6.0)) {
      errors.push({ row: r, column: 'exchange_rate', message: 'Outside typical range (2.5-6.0)' })
    }
  }

  if (errors.length > 0) return { errors }

  const records = rows.map(row => {
    const paymentType = str(row.payment_type)!
    const bankRef = str(row.bank_account)
    return {
      related_to: 'invoice' as const,
      related_id: invoiceMap.get(str(row.invoice_document_ref)!)!,
      direction: str(row.direction)!,
      payment_type: paymentType,
      payment_date: str(row.payment_date)!,
      amount: num(row.amount)!,
      currency: str(row.currency)!,
      exchange_rate: num(row.exchange_rate)!,
      bank_account_id: paymentType === 'retencion' ? null : bankMap.get(bankRef!)!.id,
      partner_id: partnerMap.get(str(row.partner_name)!)!,
      notes: str(row.notes) ?? null,
    }
  })

  const { error, data } = await supabase.from('payments').insert(records).select('id')
  if (error) return { error: handleDbError(error, 'Failed to import payments') }

  revalidatePath('/payments')
  revalidatePath('/invoices')
  revalidatePath('/calendar')
  revalidatePath('/financial-position')

  return { success: data.length }
}

// ============================================================
// Direct Transactions Import (invoice + item + payment per row)
// ============================================================

export async function importDirectTransactions(
  rows: Record<string, unknown>[]
): Promise<ImportResult> {
  const supabase = await createServerSupabaseClient()
  const errors: ImportError[] = []

  // Load lookups
  const { data: projects } = await supabase
    .from('projects').select('id, project_code').eq('is_active', true)
  const projectMap = new Map((projects ?? []).map(p => [p.project_code, p.id]))

  const { data: partners } = await supabase
    .from('entity_tags').select('entity_id, tags!inner(name)').eq('tags.name', 'partner')
  const partnerEntityIds = (partners ?? []).map(t => t.entity_id)
  const { data: partnerEntities } = await supabase
    .from('entities').select('id, legal_name').in('id', partnerEntityIds).eq('is_active', true)
  const partnerMap = new Map((partnerEntities ?? []).map(p => [p.legal_name, p.id]))

  const { data: categories } = await supabase
    .from('categories').select('name, cost_type')
  const projectCostCategories = new Set(
    (categories ?? []).filter(c => c.cost_type === 'project_cost').map(c => c.name)
  )

  // Collect unique dates that need exchange rate lookup
  const datesToLookup = new Set<string>()
  for (const row of rows) {
    if (num(row.exchange_rate) === null && str(row.date)) {
      datesToLookup.add(str(row.date)!)
    }
  }
  const exchangeRateMap = new Map<string, number>()
  if (datesToLookup.size > 0) {
    const { data: rates } = await supabase
      .from('exchange_rates')
      .select('rate_date, sell_rate')
      .in('rate_date', [...datesToLookup])
    for (const rate of rates ?? []) {
      exchangeRateMap.set(rate.rate_date, Number(rate.sell_rate))
    }
  }

  // --- Validate each row ---
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const r = i + 5

    const direction = str(row.direction)
    const partnerName = str(row.partner_name)
    const projectCode = str(row.project_code)
    const amount = num(row.amount)
    const currency = str(row.currency)
    const date = str(row.date)
    const category = str(row.category)

    // Auto-fill exchange rate from exchange_rates table if not provided
    let exchangeRate = num(row.exchange_rate)
    if (exchangeRate === null && date) {
      const lookedUp = exchangeRateMap.get(date)
      if (lookedUp) {
        exchangeRate = lookedUp
        row.exchange_rate = lookedUp
      }
    }

    // Required
    if (!direction) errors.push({ row: r, column: 'direction', message: 'Required' })
    if (!partnerName) errors.push({ row: r, column: 'partner_name', message: 'Required' })
    if (!projectCode) errors.push({ row: r, column: 'project_code', message: 'Required' })
    if (amount === null) errors.push({ row: r, column: 'amount', message: 'Required' })
    if (!currency) errors.push({ row: r, column: 'currency', message: 'Required' })
    if (exchangeRate === null) errors.push({ row: r, column: 'exchange_rate', message: 'Required — no rate provided and no exchange rate found for this date' })
    if (!date) errors.push({ row: r, column: 'date', message: 'Required' })

    // Enums
    if (direction && !['outflow', 'inflow'].includes(direction)) {
      errors.push({ row: r, column: 'direction', message: 'Must be: outflow, inflow' })
    }
    if (currency && !['USD', 'PEN'].includes(currency)) {
      errors.push({ row: r, column: 'currency', message: 'Must be: USD, PEN' })
    }

    // FK lookups
    if (partnerName && !partnerMap.has(partnerName)) {
      errors.push({ row: r, column: 'partner_name', message: 'Not found in database' })
    }
    if (projectCode && !projectMap.has(projectCode)) {
      errors.push({ row: r, column: 'project_code', message: 'Not found in database' })
    }

    // Category: required for outflows, must exist in project_cost categories
    if (direction === 'outflow' && !category) {
      errors.push({ row: r, column: 'category', message: 'Required for outflow' })
    }
    if (category && !projectCostCategories.has(category)) {
      errors.push({ row: r, column: 'category', message: 'Not found in project_cost categories' })
    }

    // Amount positive
    if (amount !== null && amount <= 0) {
      errors.push({ row: r, column: 'amount', message: 'Must be greater than 0' })
    }

    // Exchange rate range
    if (exchangeRate !== null && (exchangeRate < 2.5 || exchangeRate > 6.0)) {
      errors.push({ row: r, column: 'exchange_rate', message: 'Outside typical range (2.5-6.0)' })
    }
  }

  if (errors.length > 0) return { errors }

  // --- Insert each row as invoice + item + payment ---
  let successCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const direction = str(row.direction)!
    const partnerId = partnerMap.get(str(row.partner_name)!)!
    const projectId = projectMap.get(str(row.project_code)!)!
    const amount = num(row.amount)!
    const currency = str(row.currency)!
    const exchangeRate = num(row.exchange_rate)!
    const date = str(row.date)!
    const category = str(row.category)
    const notes = str(row.notes)

    const invoiceDirection = direction === 'outflow' ? 'payable' : 'receivable'
    const paymentDirection = direction === 'outflow' ? 'outbound' : 'inbound'
    const costType = direction === 'outflow' ? 'project_cost' : null
    const title = notes || `Direct transaction — ${date}`

    // 1. Create auto-generated invoice
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        direction: invoiceDirection,
        cost_type: costType,
        comprobante_type: 'none',
        partner_id: partnerId,
        project_id: projectId,
        invoice_date: date,
        due_date: date,
        title,
        igv_rate: 0,
        currency,
        exchange_rate: exchangeRate,
        is_auto_generated: true,
        notes,
      })
      .select('id')
      .single()

    if (invError) {
      return { error: handleDbError(invError, `Failed to create invoice for row ${i + 5}`) }
    }

    // 2. Create invoice item
    const { error: itemError } = await supabase
      .from('invoice_items')
      .insert({
        invoice_id: invoice.id,
        title,
        subtotal: amount,
        category: direction === 'outflow' ? category : null,
      })

    if (itemError) {
      await supabase.from('invoices').delete().eq('id', invoice.id)
      return { error: handleDbError(itemError, `Failed to create invoice item for row ${i + 5}`) }
    }

    // 3. Create payment (fully paid)
    const { error: pmtError } = await supabase
      .from('payments')
      .insert({
        related_to: 'invoice',
        related_id: invoice.id,
        direction: paymentDirection,
        payment_type: 'regular',
        payment_date: date,
        amount,
        currency,
        exchange_rate: exchangeRate,
        partner_id: partnerId,
        bank_account_id: null,
        notes,
      })

    if (pmtError) {
      return { error: handleDbError(pmtError, `Failed to create payment for row ${i + 5}`) }
    }

    successCount++
  }

  revalidatePath('/invoices')
  revalidatePath('/payments')
  revalidatePath('/calendar')
  revalidatePath('/financial-position')
  revalidatePath('/projects', 'layout')
  revalidatePath('/settlement')

  return { success: successCount }
}
