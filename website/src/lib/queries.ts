import { createServerSupabaseClient } from './supabase/server'
import type {
  ApCalendarRow,
  ArBalanceRow,
  ArDetractionEntry,
  ArOutstandingRow,
  BankAccountCard,
  BankTransaction,
  CashFlowData,
  CashFlowMonth,
  CostBalanceRow,
  CostItem,
  CurrencyAmount,
  FinancialPositionData,
  IgvByCurrency,
  PartnerBalanceData,
  PartnerCostDetail,
  Payment,
  PLData,
  PLLineItem,
  PLMonthColumn,
  PLPeriodMode,
  RetencionDashboardRow,
} from './types'

export async function getApCalendar(isAlex: boolean): Promise<ApCalendarRow[]> {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('v_ap_calendar')
    .select('*')
    .order('due_date', { ascending: true })

  // Partners only see supplier invoices; Alex sees everything (including loan obligations)
  if (!isAlex) {
    query = query.eq('type', 'supplier_invoice')
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ApCalendarRow[]
}

export async function getCostDetail(costId: string) {
  const supabase = await createServerSupabaseClient()

  const [costResult, itemsResult, paymentsResult] = await Promise.all([
    supabase
      .from('v_cost_balances')
      .select('*')
      .eq('cost_id', costId)
      .single(),
    supabase
      .from('cost_items')
      .select('*')
      .eq('cost_id', costId)
      .order('created_at'),
    supabase
      .from('payments')
      .select('*')
      .eq('related_id', costId)
      .eq('related_to', 'cost')
      .order('payment_date'),
  ])

  // Fetch cost header for comprobante and bank info
  const costHeaderResult = await supabase
    .from('costs')
    .select('comprobante_type, comprobante_number, document_ref, bank_account_id')
    .eq('id', costId)
    .single()

  // Fetch bank account name if available
  let bankInfo = null
  if (costHeaderResult.data?.bank_account_id) {
    const bankResult = await supabase
      .from('bank_accounts')
      .select('bank_name, account_number_last4, partner_company_id')
      .eq('id', costHeaderResult.data.bank_account_id)
      .single()
    bankInfo = bankResult.data
  }

  return {
    cost: costResult.data as CostBalanceRow | null,
    items: (itemsResult.data ?? []) as CostItem[],
    payments: (paymentsResult.data ?? []) as Payment[],
    header: costHeaderResult.data,
    bank: bankInfo,
  }
}

export async function getLoanDetail(loanId: string) {
  const supabase = await createServerSupabaseClient()

  const [loanResult, scheduleResult, paymentsResult] = await Promise.all([
    supabase
      .from('v_loan_balances')
      .select('*')
      .eq('loan_id', loanId)
      .single(),
    supabase
      .from('loan_schedule')
      .select('*')
      .eq('loan_id', loanId)
      .order('scheduled_date'),
    supabase
      .from('loan_payments')
      .select('*')
      .eq('loan_id', loanId)
      .order('payment_date'),
  ])

  return {
    loan: loanResult.data,
    schedule: scheduleResult.data ?? [],
    payments: paymentsResult.data ?? [],
  }
}

export async function getDetractionsPending() {
  const supabase = await createServerSupabaseClient()

  // Get all costs with detraccion amounts
  const { data: costs, error: costsError } = await supabase
    .from('v_cost_balances')
    .select('cost_id, project_id, entity_id, title, detraccion_amount, currency')
    .gt('detraccion_amount', 0)

  if (costsError) throw costsError
  if (!costs || costs.length === 0) return []

  // Get detraccion payments for these costs
  const costIds = costs.map(c => c.cost_id).filter((id): id is string => id !== null)
  const { data: detrPayments } = await supabase
    .from('payments')
    .select('related_id, amount')
    .in('related_id', costIds)
    .eq('related_to', 'cost')
    .eq('payment_type', 'detraccion')

  const paidMap = new Map<string, number>()
  for (const p of detrPayments ?? []) {
    const current = paidMap.get(p.related_id) ?? 0
    paidMap.set(p.related_id, current + (p.amount ?? 0))
  }

  // Get entity and project names
  const entityIds = [...new Set(costs.filter(c => c.entity_id).map(c => c.entity_id!))]
  const projectIds = [...new Set(costs.filter(c => c.project_id).map(c => c.project_id!))]

  const [entitiesResult, projectsResult] = await Promise.all([
    entityIds.length > 0
      ? supabase.from('entities').select('id, legal_name, common_name').in('id', entityIds)
      : { data: [] },
    projectIds.length > 0
      ? supabase.from('projects').select('id, project_code').in('id', projectIds)
      : { data: [] },
  ])

  const entityMap = new Map((entitiesResult.data ?? []).map(e => [e.id, e.common_name || e.legal_name]))
  const projectMap = new Map((projectsResult.data ?? []).map(p => [p.id, p.project_code]))

  return costs.map(c => ({
    cost_id: c.cost_id,
    entity_name: c.entity_id ? entityMap.get(c.entity_id) ?? '—' : '—',
    project_code: c.project_id ? projectMap.get(c.project_id) ?? '—' : '—',
    title: c.title,
    detraccion_amount: c.detraccion_amount ?? 0,
    currency: c.currency ?? 'PEN',
    deposited: paidMap.get(c.cost_id!) ?? 0,
    status: (paidMap.get(c.cost_id!) ?? 0) >= (c.detraccion_amount ?? 0) ? 'deposited' : 'pending',
  }))
}

export async function getProjectsForFilter() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('projects')
    .select('id, project_code, name')
    .eq('is_active', true)
    .order('project_code')
  return data ?? []
}

// --- AR Outstanding queries ---

export async function getArOutstanding(): Promise<ArOutstandingRow[]> {
  const supabase = await createServerSupabaseClient()

  // Fetch unpaid/partial AR invoices (exclude internal settlements and paid)
  const { data: invoices, error } = await supabase
    .from('v_ar_balances')
    .select('*')
    .eq('is_internal_settlement', false)
    .in('payment_status', ['pending', 'partial'])
    .order('due_date', { ascending: true })

  if (error) throw error
  if (!invoices || invoices.length === 0) return []

  // Collect entity IDs, project IDs, partner company IDs for lookups
  const entityIds = [...new Set(invoices.filter(i => i.entity_id).map(i => i.entity_id!))]
  const projectIds = [...new Set(invoices.filter(i => i.project_id).map(i => i.project_id!))]
  const partnerIds = [...new Set(invoices.filter(i => i.partner_company_id).map(i => i.partner_company_id!))]

  const [entitiesResult, projectsResult, partnersResult] = await Promise.all([
    entityIds.length > 0
      ? supabase.from('entities').select('id, legal_name, common_name').in('id', entityIds)
      : { data: [] },
    projectIds.length > 0
      ? supabase.from('projects').select('id, project_code').in('id', projectIds)
      : { data: [] },
    partnerIds.length > 0
      ? supabase.from('partner_companies').select('id, name').in('id', partnerIds)
      : { data: [] },
  ])

  const entityMap = new Map((entitiesResult.data ?? []).map(e => [e.id, e.common_name || e.legal_name]))
  const projectMap = new Map((projectsResult.data ?? []).map(p => [p.id, p.project_code]))
  const partnerMap = new Map((partnersResult.data ?? []).map(p => [p.id, p.name]))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return invoices.map(i => {
    const dueDate = i.due_date ? new Date(i.due_date + 'T00:00:00') : null
    const daysOverdue = dueDate
      ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    return {
      ar_invoice_id: i.ar_invoice_id!,
      project_id: i.project_id,
      project_code: i.project_id ? projectMap.get(i.project_id) ?? '—' : '—',
      entity_id: i.entity_id,
      client_name: i.entity_id ? entityMap.get(i.entity_id) ?? '—' : '—',
      partner_company_id: i.partner_company_id,
      partner_name: i.partner_company_id ? partnerMap.get(i.partner_company_id) ?? '—' : '—',
      invoice_number: i.invoice_number,
      invoice_date: i.invoice_date,
      due_date: i.due_date,
      days_overdue: daysOverdue,
      subtotal: i.subtotal ?? 0,
      igv_amount: i.igv_amount ?? 0,
      gross_total: i.gross_total ?? 0,
      detraccion_amount: i.detraccion_amount ?? 0,
      retencion_amount: i.retencion_amount ?? 0,
      net_receivable: i.net_receivable ?? 0,
      amount_paid: i.amount_paid ?? 0,
      outstanding: i.outstanding ?? 0,
      currency: i.currency ?? 'PEN',
      payment_status: i.payment_status ?? 'pending',
    }
  })
}

export async function getRetencionDashboard(): Promise<RetencionDashboardRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('v_retencion_dashboard')
    .select('*')

  if (error) throw error
  return (data ?? []) as RetencionDashboardRow[]
}

export async function getArDetracciones(): Promise<ArDetractionEntry[]> {
  const supabase = await createServerSupabaseClient()

  // Get AR invoices with detraccion amounts
  const { data: invoices, error } = await supabase
    .from('v_ar_balances')
    .select('ar_invoice_id, project_id, entity_id, invoice_number, detraccion_amount, currency')
    .gt('detraccion_amount', 0)
    .eq('is_internal_settlement', false)

  if (error) throw error
  if (!invoices || invoices.length === 0) return []

  // Get inbound detraccion payments for these AR invoices
  const arIds = invoices.map(i => i.ar_invoice_id).filter((id): id is string => id !== null)
  const { data: detrPayments } = await supabase
    .from('payments')
    .select('related_id, amount')
    .in('related_id', arIds)
    .eq('related_to', 'ar_invoice')
    .eq('payment_type', 'detraccion')
    .eq('direction', 'inbound')

  const paidMap = new Map<string, number>()
  for (const p of detrPayments ?? []) {
    const current = paidMap.get(p.related_id) ?? 0
    paidMap.set(p.related_id, current + (p.amount ?? 0))
  }

  // Get entity and project names
  const entityIds = [...new Set(invoices.filter(i => i.entity_id).map(i => i.entity_id!))]
  const projectIds = [...new Set(invoices.filter(i => i.project_id).map(i => i.project_id!))]

  const [entitiesResult, projectsResult] = await Promise.all([
    entityIds.length > 0
      ? supabase.from('entities').select('id, legal_name, common_name').in('id', entityIds)
      : { data: [] },
    projectIds.length > 0
      ? supabase.from('projects').select('id, project_code').in('id', projectIds)
      : { data: [] },
  ])

  const entityMap = new Map((entitiesResult.data ?? []).map(e => [e.id, e.common_name || e.legal_name]))
  const projectMap = new Map((projectsResult.data ?? []).map(p => [p.id, p.project_code]))

  return invoices.map(i => {
    const received = paidMap.get(i.ar_invoice_id!) ?? 0
    const detrAmount = i.detraccion_amount ?? 0
    return {
      ar_invoice_id: i.ar_invoice_id!,
      project_code: i.project_id ? projectMap.get(i.project_id) ?? '—' : '—',
      client_name: i.entity_id ? entityMap.get(i.entity_id) ?? '—' : '—',
      invoice_number: i.invoice_number,
      detraccion_amount: detrAmount,
      currency: i.currency ?? 'PEN',
      received,
      pending: Math.max(0, detrAmount - received),
    }
  })
}

export async function getArInvoiceDetail(arInvoiceId: string) {
  const supabase = await createServerSupabaseClient()

  const [invoiceResult, paymentsResult] = await Promise.all([
    supabase
      .from('v_ar_balances')
      .select('*')
      .eq('ar_invoice_id', arInvoiceId)
      .single(),
    supabase
      .from('payments')
      .select('*')
      .eq('related_id', arInvoiceId)
      .eq('related_to', 'ar_invoice')
      .order('payment_date'),
  ])

  // Get entity and project names
  const invoice = invoiceResult.data
  let clientName = '—'
  let projectCode = '—'
  let partnerName = '—'

  if (invoice) {
    const [entityResult, projectResult, partnerResult] = await Promise.all([
      invoice.entity_id
        ? supabase.from('entities').select('legal_name, common_name').eq('id', invoice.entity_id).single()
        : { data: null },
      invoice.project_id
        ? supabase.from('projects').select('project_code').eq('id', invoice.project_id).single()
        : { data: null },
      invoice.partner_company_id
        ? supabase.from('partner_companies').select('name').eq('id', invoice.partner_company_id).single()
        : { data: null },
    ])
    clientName = entityResult.data?.common_name || entityResult.data?.legal_name || '—'
    projectCode = projectResult.data?.project_code || '—'
    partnerName = partnerResult.data?.name || '—'
  }

  return {
    invoice: invoice as ArBalanceRow | null,
    payments: (paymentsResult.data ?? []) as Payment[],
    client_name: clientName,
    project_code: projectCode,
    partner_name: partnerName,
  }
}

export async function getClientsForFilter() {
  const supabase = await createServerSupabaseClient()
  // Get distinct entities that have AR invoices
  const { data: arInvoices } = await supabase
    .from('ar_invoices')
    .select('entity_id')

  if (!arInvoices || arInvoices.length === 0) return []

  const entityIds = [...new Set(arInvoices.map(a => a.entity_id))]
  const { data } = await supabase
    .from('entities')
    .select('id, legal_name, common_name')
    .in('id', entityIds)
    .order('legal_name')

  return (data ?? []).map(e => ({
    id: e.id,
    name: e.common_name || e.legal_name,
  }))
}

export async function getPartnerCompaniesForFilter() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('partner_companies')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
  return data ?? []
}

// --- Cash Flow queries ---

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toMonthKey(dateStr: string): string {
  // Returns YYYY-MM from a date string
  return dateStr.substring(0, 7)
}

function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${MONTH_LABELS[parseInt(month, 10) - 1]} ${year}`
}

type CategoryTotals = {
  materials: number
  labor: number
  subcontractor: number
  equipment: number
  other: number
}

function mapCategory(category: string | null): keyof CategoryTotals {
  switch (category) {
    case 'materials': return 'materials'
    case 'labor': return 'labor'
    case 'subcontractor': return 'subcontractor'
    case 'equipment_rental': return 'equipment'
    default: return 'other'
  }
}

function emptyCategoryTotals(): CategoryTotals {
  return { materials: 0, labor: 0, subcontractor: 0, equipment: 0, other: 0 }
}

export async function getCashFlow(
  year: number,
  projectId: string | null,
  isAlex: boolean,
  reportingCurrency: 'PEN' | 'USD'
): Promise<CashFlowData> {
  const supabase = await createServerSupabaseClient()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  // --- Fetch all data in parallel ---
  const [
    paymentsResult,
    costBalancesResult,
    arBalancesResult,
    loanScheduleResult,
    costItemsResult,
    loansResult,
    loanPaymentsResult,
  ] = await Promise.all([
    // All payments in the year (actual cash movements)
    supabase
      .from('payments')
      .select('id, related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate')
      .gte('payment_date', yearStart)
      .lte('payment_date', yearEnd),
    // Outstanding costs with due dates (forecast out)
    supabase
      .from('v_cost_balances')
      .select('cost_id, project_id, due_date, outstanding, currency, exchange_rate, cost_type')
      .in('payment_status', ['pending', 'partial'])
      .not('due_date', 'is', null),
    // Outstanding AR invoices with due dates (forecast in)
    supabase
      .from('v_ar_balances')
      .select('ar_invoice_id, project_id, due_date, outstanding, currency, exchange_rate, is_internal_settlement')
      .in('payment_status', ['pending', 'partial'])
      .eq('is_internal_settlement', false)
      .not('due_date', 'is', null),
    // Unpaid loan schedule entries (forecast out, Alex-only)
    isAlex
      ? supabase
          .from('loan_schedule')
          .select('id, loan_id, scheduled_date, scheduled_amount, paid, exchange_rate, loans!fk_loan_schedule_loans(currency)')
          .eq('paid', false)
      : { data: [] },
    // Cost items for category breakdown (for both actual and forecast)
    supabase
      .from('cost_items')
      .select('cost_id, category, subtotal'),
    // Loan disbursements — cash in from loans (Alex-only)
    isAlex
      ? supabase
          .from('loans')
          .select('id, amount, currency, exchange_rate, date_borrowed, project_id')
          .gte('date_borrowed', yearStart)
          .lte('date_borrowed', yearEnd)
      : { data: [] },
    // Actual loan repayments (Alex-only)
    isAlex
      ? supabase
          .from('loan_payments')
          .select('id, loan_id, payment_date, amount, currency, exchange_rate')
          .gte('payment_date', yearStart)
          .lte('payment_date', yearEnd)
      : { data: [] },
  ])

  const payments = paymentsResult.data ?? []
  const costBalances = costBalancesResult.data ?? []
  const arBalances = arBalancesResult.data ?? []
  const loanSchedule = loanScheduleResult.data ?? []
  const costItems = costItemsResult.data ?? []
  const loanDisbursements = loansResult.data ?? []
  const loanRepayments = loanPaymentsResult.data ?? []

  // Build cost_id -> project_id map for payment filtering
  // Need to look up which project a payment belongs to via its cost/AR invoice
  const costProjectMap = new Map<string, string | null>()
  for (const cb of costBalances) {
    if (cb.cost_id) costProjectMap.set(cb.cost_id, cb.project_id)
  }

  // Also fetch cost project_ids for payments that reference costs not in costBalances (already paid)
  const paymentCostIds = payments
    .filter(p => p.related_to === 'cost')
    .map(p => p.related_id)
    .filter(id => !costProjectMap.has(id))
  if (paymentCostIds.length > 0) {
    const { data: extraCosts } = await supabase
      .from('costs')
      .select('id, project_id')
      .in('id', paymentCostIds)
    for (const c of extraCosts ?? []) {
      costProjectMap.set(c.id, c.project_id)
    }
  }

  // AR invoice project map
  const arProjectMap = new Map<string, string | null>()
  for (const ar of arBalances) {
    if (ar.ar_invoice_id) arProjectMap.set(ar.ar_invoice_id, ar.project_id)
  }
  const paymentArIds = payments
    .filter(p => p.related_to === 'ar_invoice')
    .map(p => p.related_id)
    .filter(id => !arProjectMap.has(id))
  if (paymentArIds.length > 0) {
    const { data: extraAr } = await supabase
      .from('ar_invoices')
      .select('id, project_id')
      .in('id', paymentArIds)
    for (const a of extraAr ?? []) {
      arProjectMap.set(a.id, a.project_id)
    }
  }

  // Build cost_id -> category proportions map
  const costCategoryMap = new Map<string, { category: string; proportion: number }[]>()
  const costSubtotals = new Map<string, number>()
  for (const item of costItems) {
    const current = costSubtotals.get(item.cost_id) ?? 0
    costSubtotals.set(item.cost_id, current + (item.subtotal ?? 0))
  }
  for (const item of costItems) {
    const total = costSubtotals.get(item.cost_id) ?? 1
    const entries = costCategoryMap.get(item.cost_id) ?? []
    entries.push({
      category: item.category,
      proportion: total > 0 ? (item.subtotal ?? 0) / total : 0,
    })
    costCategoryMap.set(item.cost_id, entries)
  }

  // Convert amount to reporting currency
  function convertAmount(amount: number, currency: string | null, exchangeRate: number | null): number {
    if (!currency || currency === reportingCurrency) return amount
    if (!exchangeRate || exchangeRate === 0) return amount
    // exchange_rate is PEN per USD
    if (reportingCurrency === 'PEN' && currency === 'USD') return amount * exchangeRate
    if (reportingCurrency === 'USD' && currency === 'PEN') return amount / exchangeRate
    return amount
  }

  // Build loan_id -> project_id map for project filtering on loan disbursements/repayments
  const loanProjectMap = new Map<string, string | null>()
  for (const loan of loanDisbursements) {
    loanProjectMap.set(loan.id, loan.project_id)
  }
  // For repayments referencing loans not in this year's disbursements, fetch their project_ids
  if (isAlex) {
    const repaymentLoanIds = loanRepayments
      .map(lp => lp.loan_id)
      .filter(id => !loanProjectMap.has(id))
    if (repaymentLoanIds.length > 0) {
      const { data: extraLoans } = await supabase
        .from('loans')
        .select('id, project_id')
        .in('id', repaymentLoanIds)
      for (const l of extraLoans ?? []) {
        loanProjectMap.set(l.id, l.project_id)
      }
    }
  }

  // Initialize 12 monthly buckets
  const monthBuckets = new Map<string, { projectCashIn: number; loansCashIn: number; categories: CategoryTotals; loanRepayment: number }>()
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    monthBuckets.set(key, { projectCashIn: 0, loansCashIn: 0, categories: emptyCategoryTotals(), loanRepayment: 0 })
  }

  const today = new Date()
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  // --- Process actual payments ---
  for (const p of payments) {
    // Project filter
    if (projectId) {
      const pProjectId = p.related_to === 'cost'
        ? costProjectMap.get(p.related_id)
        : arProjectMap.get(p.related_id)
      if (pProjectId !== projectId) continue
    }

    const monthKey = toMonthKey(p.payment_date)
    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    const amount = convertAmount(p.amount, p.currency, p.exchange_rate)

    if (p.direction === 'inbound') {
      bucket.projectCashIn += amount
    } else {
      // Outbound — distribute across categories
      const categories = costCategoryMap.get(p.related_id)
      if (categories && categories.length > 0) {
        for (const cat of categories) {
          const catKey = mapCategory(cat.category)
          bucket.categories[catKey] += amount * cat.proportion
        }
      } else {
        bucket.categories.other += amount
      }
    }
  }

  // --- Process forecast: outstanding costs by due_date ---
  for (const cost of costBalances) {
    if (!cost.due_date) continue
    const monthKey = toMonthKey(cost.due_date)
    // Only include future months within the selected year
    if (monthKey <= currentMonthKey || monthKey < `${year}-01` || monthKey > `${year}-12`) continue
    if (projectId && cost.project_id !== projectId) continue

    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    const amount = convertAmount(cost.outstanding ?? 0, cost.currency, cost.exchange_rate ?? null)
    const categories = cost.cost_id ? costCategoryMap.get(cost.cost_id) : null
    if (categories && categories.length > 0) {
      for (const cat of categories) {
        const catKey = mapCategory(cat.category)
        bucket.categories[catKey] += amount * cat.proportion
      }
    } else {
      bucket.categories.other += amount
    }
  }

  // --- Process forecast: outstanding AR invoices by due_date ---
  for (const ar of arBalances) {
    if (!ar.due_date) continue
    const monthKey = toMonthKey(ar.due_date)
    if (monthKey <= currentMonthKey || monthKey < `${year}-01` || monthKey > `${year}-12`) continue
    if (projectId && ar.project_id !== projectId) continue

    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    bucket.projectCashIn += convertAmount(ar.outstanding ?? 0, ar.currency, ar.exchange_rate)
  }

  // --- Process forecast: loan schedule (Alex-only) ---
  if (isAlex) {
    for (const entry of loanSchedule) {
      if (!entry.scheduled_date) continue
      const monthKey = toMonthKey(entry.scheduled_date)
      if (monthKey <= currentMonthKey || monthKey < `${year}-01` || monthKey > `${year}-12`) continue

      const bucket = monthBuckets.get(monthKey)
      if (!bucket) continue

      // loan_schedule joined with loans for currency
      const loanData = entry.loans as { currency: string } | null
      const loanCurrency = loanData?.currency ?? 'PEN'
      bucket.loanRepayment += convertAmount(entry.scheduled_amount, loanCurrency, entry.exchange_rate ?? null)
    }
  }

  // --- Process actual loan disbursements as cash in (Alex-only) ---
  if (isAlex) {
    for (const loan of loanDisbursements) {
      if (projectId && loan.project_id !== projectId) continue

      const monthKey = toMonthKey(loan.date_borrowed)
      const bucket = monthBuckets.get(monthKey)
      if (!bucket) continue

      bucket.loansCashIn += convertAmount(loan.amount, loan.currency, loan.exchange_rate ?? null)
    }
  }

  // --- Process actual loan repayments (Alex-only) ---
  if (isAlex) {
    for (const lp of loanRepayments) {
      if (projectId) {
        const lpProjectId = loanProjectMap.get(lp.loan_id)
        if (lpProjectId !== projectId) continue
      }

      const monthKey = toMonthKey(lp.payment_date)
      const bucket = monthBuckets.get(monthKey)
      if (!bucket) continue

      bucket.loanRepayment += convertAmount(lp.amount, lp.currency, lp.exchange_rate ?? null)
    }
  }

  // --- Build monthly rows ---
  const months: CashFlowMonth[] = []
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    const bucket = monthBuckets.get(key)!
    const projectCosts = bucket.categories.materials + bucket.categories.labor +
      bucket.categories.subcontractor + bucket.categories.equipment +
      bucket.categories.other
    const cashOut = projectCosts + bucket.loanRepayment
    const cashIn = bucket.projectCashIn + bucket.loansCashIn
    const net = cashIn - cashOut
    const isActual = key <= currentMonthKey

    months.push({
      month: key,
      label: getMonthLabel(key),
      isActual,
      cashIn,
      projectCashIn: bucket.projectCashIn,
      loansCashIn: bucket.loansCashIn,
      materials: bucket.categories.materials,
      labor: bucket.categories.labor,
      subcontractor: bucket.categories.subcontractor,
      equipment: bucket.categories.equipment,
      other: bucket.categories.other,
      projectCosts,
      loanRepayment: bucket.loanRepayment,
      cashOut,
      net,
    })
  }

  return { months }
}

// --- Partner Balances queries ---

export async function getPartnerLedger(projectId: string): Promise<PartnerBalanceData> {
  const supabase = await createServerSupabaseClient()

  // Fetch partner ledger for this project
  const { data: ledger, error: ledgerError } = await supabase
    .from('v_partner_ledger')
    .select('*')
    .eq('project_id', projectId)

  if (ledgerError) throw ledgerError
  if (!ledger || ledger.length === 0) {
    // Get project info even if no costs yet
    const { data: project } = await supabase
      .from('projects')
      .select('project_code, name')
      .eq('id', projectId)
      .single()
    return {
      contributions: [],
      settlements: [],
      projectCode: project?.project_code ?? '—',
      projectName: project?.name ?? '—',
    }
  }

  const projectCode = ledger[0].project_code ?? '—'
  const projectName = ledger[0].project_name ?? '—'

  const contributions = ledger.map(row => ({
    partner_company_id: row.partner_company_id!,
    partner_name: row.partner_name ?? '—',
    currency: row.currency ?? 'PEN',
    contribution_amount: row.contribution_amount ?? 0,
    contribution_pct: row.contribution_pct ?? 0,
    project_income: row.project_income ?? 0,
    income_share: row.income_share ?? 0,
  }))

  // Fetch actual AR payments received per partner for this project
  // Get AR invoices for this project
  const { data: arInvoices } = await supabase
    .from('ar_invoices')
    .select('id, partner_company_id, currency')
    .eq('project_id', projectId)
    .eq('is_internal_settlement', false)

  const arIds = (arInvoices ?? []).map(a => a.id)
  let paymentsByPartner = new Map<string, Map<string, number>>() // partner_id -> currency -> amount

  if (arIds.length > 0) {
    const { data: payments } = await supabase
      .from('payments')
      .select('related_id, amount, currency')
      .in('related_id', arIds)
      .eq('related_to', 'ar_invoice')

    // Build AR -> partner map
    const arPartnerMap = new Map<string, { partner_company_id: string; currency: string }>()
    for (const ar of arInvoices ?? []) {
      if (ar.partner_company_id) {
        arPartnerMap.set(ar.id, { partner_company_id: ar.partner_company_id, currency: ar.currency })
      }
    }

    for (const p of payments ?? []) {
      const arInfo = arPartnerMap.get(p.related_id)
      if (!arInfo) continue
      const partnerKey = arInfo.partner_company_id
      const currencyKey = arInfo.currency
      if (!paymentsByPartner.has(partnerKey)) {
        paymentsByPartner.set(partnerKey, new Map())
      }
      const currMap = paymentsByPartner.get(partnerKey)!
      currMap.set(currencyKey, (currMap.get(currencyKey) ?? 0) + (p.amount ?? 0))
    }
  }

  // Build settlements
  const settlements = contributions.map(c => {
    const currMap = paymentsByPartner.get(c.partner_company_id)
    const actuallyReceived = currMap?.get(c.currency) ?? 0
    return {
      partner_company_id: c.partner_company_id,
      partner_name: c.partner_name,
      currency: c.currency,
      income_share: c.income_share,
      actually_received: actuallyReceived,
      settlement_balance: c.income_share - actuallyReceived,
    }
  })

  return { contributions, settlements, projectCode, projectName }
}

export async function getPartnerCostDetails(
  projectId: string,
  partnerCompanyId: string,
  currency: string
): Promise<PartnerCostDetail[]> {
  const supabase = await createServerSupabaseClient()

  // Get bank accounts for this partner
  const { data: bankAccounts } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('partner_company_id', partnerCompanyId)

  if (!bankAccounts || bankAccounts.length === 0) return []

  const bankIds = bankAccounts.map(b => b.id)

  // Get costs for this project from these bank accounts in this currency
  const { data: costs, error } = await supabase
    .from('v_cost_totals')
    .select('cost_id, date, title, currency, subtotal')
    .eq('project_id', projectId)
    .eq('currency', currency)
    .in('bank_account_id', bankIds)
    .order('date', { ascending: false })

  if (error) throw error
  if (!costs || costs.length === 0) return []

  // Get cost items for category
  const costIds = costs.map(c => c.cost_id).filter((id): id is string => id !== null)
  const { data: items } = await supabase
    .from('cost_items')
    .select('cost_id, category')
    .in('cost_id', costIds)

  // Build cost_id -> primary category
  const categoryMap = new Map<string, string>()
  for (const item of items ?? []) {
    if (!categoryMap.has(item.cost_id)) {
      categoryMap.set(item.cost_id, item.category)
    }
  }

  return costs.map(c => ({
    cost_id: c.cost_id!,
    date: c.date,
    title: c.title,
    category: categoryMap.get(c.cost_id!) ?? 'other',
    subtotal: c.subtotal ?? 0,
    currency: c.currency,
  }))
}

// --- P&L queries ---

function emptyPLLineItem(): PLLineItem {
  return {
    income: 0,
    projectCosts: 0,
    grossProfit: 0,
    grossMarginPct: 0,
    sga: 0,
    netProfit: 0,
    netMarginPct: 0,
    projectCostsByCategory: {},
    sgaByCategory: {},
    incomeByProject: [],
  }
}

function computeDerived(item: PLLineItem): void {
  item.grossProfit = item.income - item.projectCosts
  item.grossMarginPct = item.income > 0
    ? Math.round((item.grossProfit / item.income) * 10000) / 100
    : 0
  item.netProfit = item.grossProfit - item.sga
  item.netMarginPct = item.income > 0
    ? Math.round((item.netProfit / item.income) * 10000) / 100
    : 0
}

function getPeriodRange(
  periodMode: PLPeriodMode,
  year: number,
  quarter: number,
  month: number
): { start: string; end: string; monthKeys: string[] } {
  if (periodMode === 'year') {
    const monthKeys = []
    for (let m = 1; m <= 12; m++) {
      monthKeys.push(`${year}-${String(m).padStart(2, '0')}`)
    }
    return { start: `${year}-01-01`, end: `${year}-12-31`, monthKeys }
  }
  if (periodMode === 'quarter') {
    const startMonth = (quarter - 1) * 3 + 1
    const endMonth = startMonth + 2
    const monthKeys = []
    for (let m = startMonth; m <= endMonth; m++) {
      monthKeys.push(`${year}-${String(m).padStart(2, '0')}`)
    }
    const endDay = new Date(year, endMonth, 0).getDate()
    return {
      start: `${year}-${String(startMonth).padStart(2, '0')}-01`,
      end: `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
      monthKeys,
    }
  }
  // single month
  const endDay = new Date(year, month, 0).getDate()
  const mk = `${year}-${String(month).padStart(2, '0')}`
  return {
    start: `${mk}-01`,
    end: `${mk}-${String(endDay).padStart(2, '0')}`,
    monthKeys: [mk],
  }
}

function convertAmountPL(
  amount: number,
  currency: string | null,
  exchangeRate: number | null,
  reportingCurrency: 'PEN' | 'USD'
): number {
  if (!currency || currency === reportingCurrency) return amount
  if (!exchangeRate || exchangeRate === 0) return amount
  if (reportingCurrency === 'PEN' && currency === 'USD') return amount * exchangeRate
  if (reportingCurrency === 'USD' && currency === 'PEN') return amount / exchangeRate
  return amount
}

export async function getCompanyPL(
  periodMode: PLPeriodMode,
  year: number,
  quarter: number,
  month: number,
  reportingCurrency: 'PEN' | 'USD',
  isAlex: boolean
): Promise<PLData> {
  const supabase = await createServerSupabaseClient()
  const { start, end, monthKeys } = getPeriodRange(periodMode, year, quarter, month)

  // Fetch all data in parallel
  const [arResult, costTotalsResult, costItemsResult, projectsResult, partnerLedgerResult, loanBalancesResult] = await Promise.all([
    supabase
      .from('ar_invoices')
      .select('id, project_id, invoice_date, subtotal, currency, exchange_rate, is_internal_settlement')
      .gte('invoice_date', start)
      .lte('invoice_date', end)
      .eq('is_internal_settlement', false),
    supabase
      .from('v_cost_totals')
      .select('cost_id, project_id, cost_type, date, subtotal, currency, exchange_rate')
      .gte('date', start)
      .lte('date', end),
    supabase
      .from('cost_items')
      .select('cost_id, category, subtotal'),
    supabase
      .from('projects')
      .select('id, project_code, name')
      .eq('is_active', true),
    isAlex
      ? supabase.from('v_partner_ledger').select('*')
      : { data: [] },
    isAlex
      ? supabase.from('v_loan_balances').select('outstanding, currency')
      : { data: [] },
  ])

  const arInvoices = arResult.data ?? []
  const costTotals = costTotalsResult.data ?? []
  const allCostItems = costItemsResult.data ?? []
  const projectsList = projectsResult.data ?? []
  const partnerLedger = partnerLedgerResult.data ?? []
  const loanBalances = loanBalancesResult.data ?? []

  const projectMap = new Map(projectsList.map(p => [p.id, { code: p.project_code, name: p.name }]))

  // Build cost_id -> category map (primary category per cost)
  const costCategoryMap = new Map<string, string>()
  for (const item of allCostItems) {
    if (!costCategoryMap.has(item.cost_id)) {
      costCategoryMap.set(item.cost_id, item.category)
    }
  }

  // Build cost_id -> cost_items for proportional category distribution
  const costItemsByCost = new Map<string, { category: string; subtotal: number }[]>()
  for (const item of allCostItems) {
    const arr = costItemsByCost.get(item.cost_id) ?? []
    arr.push({ category: item.category, subtotal: item.subtotal ?? 0 })
    costItemsByCost.set(item.cost_id, arr)
  }

  // Initialize month buckets
  const byMonth: Record<string, PLLineItem> = {}
  for (const mk of monthKeys) {
    byMonth[mk] = emptyPLLineItem()
  }

  // Process AR invoices → income
  const incomeByProjectByMonth = new Map<string, Map<string, number>>() // monthKey -> projectId -> amount
  for (const ar of arInvoices) {
    if (!ar.invoice_date) continue
    const mk = ar.invoice_date.substring(0, 7)
    const bucket = byMonth[mk]
    if (!bucket) continue

    const amount = convertAmountPL(ar.subtotal, ar.currency, ar.exchange_rate, reportingCurrency)
    bucket.income += amount

    // Track per-project income
    if (ar.project_id) {
      if (!incomeByProjectByMonth.has(mk)) incomeByProjectByMonth.set(mk, new Map())
      const projMap = incomeByProjectByMonth.get(mk)!
      projMap.set(ar.project_id, (projMap.get(ar.project_id) ?? 0) + amount)
    }
  }

  // Process costs → project costs and SG&A
  for (const cost of costTotals) {
    if (!cost.date) continue
    const mk = cost.date.substring(0, 7)
    const bucket = byMonth[mk]
    if (!bucket) continue

    const amount = convertAmountPL(cost.subtotal ?? 0, cost.currency, cost.exchange_rate, reportingCurrency)
    const items = cost.cost_id ? costItemsByCost.get(cost.cost_id) : null
    const totalItemSubtotal = items?.reduce((s, i) => s + i.subtotal, 0) ?? 0

    if (cost.cost_type === 'project_cost') {
      bucket.projectCosts += amount
      // Distribute by category proportionally
      if (items && totalItemSubtotal > 0) {
        for (const item of items) {
          const proportion = item.subtotal / totalItemSubtotal
          const catAmount = amount * proportion
          bucket.projectCostsByCategory[item.category] =
            (bucket.projectCostsByCategory[item.category] ?? 0) + catAmount
        }
      } else {
        bucket.projectCostsByCategory['other'] =
          (bucket.projectCostsByCategory['other'] ?? 0) + amount
      }
    } else if (cost.cost_type === 'sga') {
      bucket.sga += amount
      if (items && totalItemSubtotal > 0) {
        for (const item of items) {
          const proportion = item.subtotal / totalItemSubtotal
          const catAmount = amount * proportion
          bucket.sgaByCategory[item.category] =
            (bucket.sgaByCategory[item.category] ?? 0) + catAmount
        }
      } else {
        bucket.sgaByCategory['other'] =
          (bucket.sgaByCategory['other'] ?? 0) + amount
      }
    }
  }

  // Build per-project income breakdown for each month
  for (const mk of monthKeys) {
    const bucket = byMonth[mk]
    const projMap = incomeByProjectByMonth.get(mk)
    if (projMap) {
      bucket.incomeByProject = Array.from(projMap.entries())
        .map(([projectId, amount]) => {
          const info = projectMap.get(projectId)
          return {
            projectCode: info?.code ?? '—',
            projectName: info?.name ?? '—',
            amount,
          }
        })
        .sort((a, b) => a.projectCode.localeCompare(b.projectCode))
    }
  }

  // Compute derived values for each month
  for (const mk of monthKeys) {
    computeDerived(byMonth[mk])
  }

  // Compute totals
  const total = emptyPLLineItem()
  const totalIncomeByProject = new Map<string, number>()
  for (const mk of monthKeys) {
    const m = byMonth[mk]
    total.income += m.income
    total.projectCosts += m.projectCosts
    total.sga += m.sga
    for (const [cat, amt] of Object.entries(m.projectCostsByCategory)) {
      total.projectCostsByCategory[cat] = (total.projectCostsByCategory[cat] ?? 0) + amt
    }
    for (const [cat, amt] of Object.entries(m.sgaByCategory)) {
      total.sgaByCategory[cat] = (total.sgaByCategory[cat] ?? 0) + amt
    }
    for (const p of m.incomeByProject) {
      totalIncomeByProject.set(p.projectCode, (totalIncomeByProject.get(p.projectCode) ?? 0) + p.amount)
    }
  }
  total.incomeByProject = Array.from(totalIncomeByProject.entries())
    .map(([code, amount]) => {
      const info = projectsList.find(p => p.project_code === code)
      return { projectCode: code, projectName: info?.name ?? '—', amount }
    })
    .sort((a, b) => a.projectCode.localeCompare(b.projectCode))
  computeDerived(total)

  // Build columns
  const columns: PLMonthColumn[] = monthKeys.map(mk => {
    const [, m] = mk.split('-')
    return { key: mk, label: MONTH_LABELS[parseInt(m, 10) - 1] }
  })

  // Alex personal position
  let alexProfitShare: number | null = null
  let loanObligations: number | null = null
  if (isAlex) {
    // Find Alex's average contribution_pct across all projects
    // Use the first partner company (Alex is ruc 20000000001 but we find by checking partner_ledger)
    const alexRows = partnerLedger.filter(r => {
      // Alex's partner_company is the one with bank_tracking_full = true
      // In v_partner_ledger the first partner listed is typically Alex
      // We use partner_company_id matching the first one
      return true // include all for weighted average
    })
    // Weighted average: sum(contribution_amount) / sum(total_project_costs per project)
    // Simpler: use the net profit * Alex's overall contribution share
    // For now, approximate using total contribution across projects
    // Get Alex's partner_company_id (first one in the system)
    const { data: alexPartner } = await supabase
      .from('partner_companies')
      .select('id')
      .eq('ruc', '20000000001')
      .single()

    if (alexPartner) {
      const alexLedger = partnerLedger.filter(r => r.partner_company_id === alexPartner.id)
      const alexContribution = alexLedger.reduce((sum, r) => {
        return sum + convertAmountPL(r.contribution_amount ?? 0, r.currency, null, reportingCurrency)
      }, 0)
      const totalContribution = partnerLedger.reduce((sum, r) => {
        return sum + convertAmountPL(r.contribution_amount ?? 0, r.currency, null, reportingCurrency)
      }, 0)
      const alexPct = totalContribution > 0 ? alexContribution / totalContribution : 0
      alexProfitShare = total.netProfit * alexPct
    }

    loanObligations = loanBalances.reduce((sum, l) => {
      return sum + convertAmountPL(l.outstanding ?? 0, l.currency, null, reportingCurrency)
    }, 0)
  }

  return { columns, byMonth, total, alexProfitShare, loanObligations }
}

// --- Financial Position queries ---

/** Group amounts by currency — returns sorted array (PEN first, USD second) */
function groupByCurrency(
  items: { amount: number; currency: string | null }[]
): CurrencyAmount[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const cur = item.currency ?? 'PEN'
    map.set(cur, (map.get(cur) ?? 0) + item.amount)
  }
  return Array.from(map.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

export async function getFinancialPosition(
  isAlex: boolean
): Promise<FinancialPositionData> {
  const supabase = await createServerSupabaseClient()

  const [
    bankResult,
    arResult,
    costResult,
    igvResult,
    retencionResult,
    loanResult,
  ] = await Promise.all([
    supabase.from('v_bank_balances').select('*'),
    supabase.from('v_ar_balances').select('outstanding, currency, payment_status'),
    supabase.from('v_cost_balances').select('outstanding, currency, payment_status'),
    supabase.from('v_igv_position').select('*'),
    supabase.from('v_retencion_dashboard').select('retencion_amount, currency, retencion_verified'),
    isAlex
      ? supabase.from('v_loan_balances').select('loan_id, lender_name, outstanding, currency')
      : { data: [] },
  ])

  // Bank account cards — natural currency, no conversion
  const bankCards: BankAccountCard[] = (bankResult.data ?? []).map(ba => ({
    bankAccountId: ba.bank_account_id ?? '',
    partnerCompanyId: ba.partner_company_id,
    partnerName: ba.partner_name,
    bankName: ba.bank_name,
    accountNumberLast4: ba.account_number_last4,
    accountType: ba.account_type,
    currency: ba.currency,
    isDetractionAccount: ba.is_detraccion_account ?? false,
    balance: ba.balance ?? 0,
    transactionCount: ba.transaction_count ?? 0,
  }))

  // AR outstanding grouped by currency
  const arOutstanding = groupByCurrency(
    (arResult.data ?? [])
      .filter(ar => ar.payment_status !== 'paid')
      .map(ar => ({ amount: ar.outstanding ?? 0, currency: ar.currency }))
  )

  // AP outstanding grouped by currency
  const apOutstanding = groupByCurrency(
    (costResult.data ?? [])
      .filter(c => c.payment_status !== 'paid')
      .map(c => ({ amount: c.outstanding ?? 0, currency: c.currency }))
  )

  // IGV position by currency
  const igv: IgvByCurrency[] = (igvResult.data ?? []).map(row => ({
    currency: row.currency ?? 'PEN',
    igvCollected: row.igv_collected ?? 0,
    igvPaid: row.igv_paid ?? 0,
    net: (row.igv_paid ?? 0) - (row.igv_collected ?? 0),
  }))

  // Retenciones unverified grouped by currency
  const retencionesUnverified = groupByCurrency(
    (retencionResult.data ?? [])
      .filter(r => !r.retencion_verified)
      .map(r => ({ amount: r.retencion_amount ?? 0, currency: r.currency }))
  )

  // Loans (Alex only) — natural currency
  const loans = (loanResult.data ?? []).map(l => ({
    loanId: l.loan_id ?? '',
    lenderName: l.lender_name ?? '—',
    outstanding: l.outstanding ?? 0,
    currency: l.currency ?? 'PEN',
  }))

  return {
    bankAccounts: bankCards,
    arOutstanding,
    apOutstanding,
    loans,
    igv,
    retencionesUnverified,
  }
}

export async function getBankTransactions(
  bankAccountId: string
): Promise<BankTransaction[]> {
  const supabase = await createServerSupabaseClient()

  // Get payments for this bank account, most recent first
  const { data: payments } = await supabase
    .from('payments')
    .select('id, payment_date, direction, amount, currency, related_id, related_to')
    .eq('bank_account_id', bankAccountId)
    .order('payment_date', { ascending: false })
    .limit(50)

  if (!payments || payments.length === 0) return []

  // Enrich with entity names and project codes
  const costIds = payments
    .filter(p => p.related_to === 'cost')
    .map(p => p.related_id)
    .filter((id): id is string => id !== null)

  const arIds = payments
    .filter(p => p.related_to === 'ar_invoice')
    .map(p => p.related_id)
    .filter((id): id is string => id !== null)

  const [costResult, arResult] = await Promise.all([
    costIds.length > 0
      ? supabase
          .from('v_cost_totals')
          .select('cost_id, entity_id, project_id, title')
          .in('cost_id', costIds)
      : { data: [] },
    arIds.length > 0
      ? supabase
          .from('ar_invoices')
          .select('id, entity_id, project_id, invoice_number')
          .in('id', arIds)
      : { data: [] },
  ])

  const costs = costResult.data ?? []
  const ars = arResult.data ?? []

  // Get entity and project names
  const entityIds = [
    ...costs.map(c => c.entity_id),
    ...ars.map(a => a.entity_id),
  ].filter((id): id is string => id !== null)

  const projectIds = [
    ...costs.map(c => c.project_id),
    ...ars.map(a => a.project_id),
  ].filter((id): id is string => id !== null)

  const [entityResult, projectResult] = await Promise.all([
    entityIds.length > 0
      ? supabase.from('entities').select('id, legal_name').in('id', [...new Set(entityIds)])
      : { data: [] },
    projectIds.length > 0
      ? supabase.from('projects').select('id, project_code').in('id', [...new Set(projectIds)])
      : { data: [] },
  ])

  const entityMap = new Map((entityResult.data ?? []).map(e => [e.id, e.legal_name]))
  const projectMap = new Map((projectResult.data ?? []).map(p => [p.id, p.project_code]))
  const costMap = new Map(costs.map(c => [c.cost_id, c]))
  const arMap = new Map(ars.map(a => [a.id, a]))

  return payments.map(p => {
    let entityName: string | null = null
    let projectCode: string | null = null
    let description: string | null = null

    if (p.related_to === 'cost' && p.related_id) {
      const cost = costMap.get(p.related_id)
      if (cost) {
        entityName = cost.entity_id ? entityMap.get(cost.entity_id) ?? null : null
        projectCode = cost.project_id ? projectMap.get(cost.project_id) ?? null : null
        description = cost.title ?? null
      }
    } else if (p.related_to === 'ar_invoice' && p.related_id) {
      const ar = arMap.get(p.related_id)
      if (ar) {
        entityName = ar.entity_id ? entityMap.get(ar.entity_id) ?? null : null
        projectCode = ar.project_id ? projectMap.get(ar.project_id) ?? null : null
        description = ar.invoice_number ? `Invoice ${ar.invoice_number}` : null
      }
    }

    return {
      id: p.id,
      paymentDate: p.payment_date,
      direction: p.direction,
      amount: p.amount,
      currency: p.currency,
      entityName,
      projectCode,
      description,
    }
  })
}
