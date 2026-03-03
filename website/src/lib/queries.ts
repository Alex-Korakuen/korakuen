import { createServerSupabaseClient } from './supabase/server'
import type {
  ApCalendarRow,
  ArBalanceRow,
  ArDetractionEntry,
  ArOutstandingRow,
  CashFlowData,
  CashFlowMonth,
  CostBalanceRow,
  CostItem,
  PartnerBalanceData,
  PartnerCostDetail,
  Payment,
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
