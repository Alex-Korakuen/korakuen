import { createServerSupabaseClient } from './supabase/server'
import { convertAmount } from './formatters'
import { getDaysUntilEndOfWeek, getAgingBucket } from './date-utils'
import { paginateArray, PAGE_SIZE } from './pagination'
import { sortRows } from './sort-rows'
import type { PaginatedResult } from './pagination'
import type {
  ApCalendarRow,
  ArBalanceRow,
  ArInvoiceDetailData,
  ArOutstandingRow,
  BankAccountCard,
  BankTransaction,
  CashFlowData,
  CashFlowMonth,
  CashFlowProject,
  CostBalanceRow,
  CostDetailData,
  CostItem,
  CurrencyAmount,
  EntityDetailData,
  EntityListItem,
  EntityTransactionRow,
  EntitiesFilterOptions,
  FinancialPositionData,
  IgvByCurrency,
  LoanDetailData,
  PartnerCostDetail,
  Payment,
  PriceFilterOptions,
  PriceHistoryRow,
  ProjectDetailData,
  ProjectListItem,
  ProjectTransactionGroup,
  ProjectEntitySummary,
  ProjectPartnerRow,
  ProjectPartnerSettlement,
  EntitySearchResult,
  PartnerCompanyOption,
  CategoryOption,
  ApCalendarBucketCounts,
  ArOutstandingBucketCounts,
  BucketValue,
} from './types'
import type { SupabaseClient } from '@supabase/supabase-js'


/** Fetch entity names by IDs and return a Map of id -> display name (common_name || legal_name) */
async function buildEntityNameMap(
  supabase: SupabaseClient,
  entityIds: string[]
): Promise<Map<string, string>> {
  if (entityIds.length === 0) return new Map()
  const { data } = await supabase
    .from('entities')
    .select('id, legal_name, common_name')
    .in('id', entityIds)
  return new Map((data ?? []).map(e => [e.id, e.common_name || e.legal_name]))
}

async function buildProjectCodeMap(
  supabase: SupabaseClient,
  projectIds: string[]
): Promise<Map<string, string>> {
  if (projectIds.length === 0) return new Map()
  const { data } = await supabase
    .from('projects')
    .select('id, project_code')
    .in('id', projectIds)
  return new Map((data ?? []).map(p => [p.id, p.project_code]))
}


type ApCalendarFilters = {
  projectId?: string
  supplier?: string
  currency?: string
  search?: string
  bucket?: string
  sort: string
  dir: 'asc' | 'desc'
  page: number
}

type ApCalendarResult = {
  paginated: PaginatedResult<ApCalendarRow>
  bucketCounts: ApCalendarBucketCounts
  uniqueSuppliers: string[]
}


function getApBucket(daysRemaining: number | null, daysToEndOfWeek: number): 'overdue' | 'today' | 'this-week' | 'next-30' | null {
  if (daysRemaining === null) return null
  if (daysRemaining < 0) return 'overdue'
  if (daysRemaining === 0) return 'today'
  if (daysRemaining <= daysToEndOfWeek) return 'this-week'
  if (daysRemaining <= 30) return 'next-30'
  return null
}

export async function getApCalendar(
  partnerIds: string[],
  filters: ApCalendarFilters,
  midRate: number | null = null,
): Promise<ApCalendarResult> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('v_ap_calendar')
    .select('*')
    .order('due_date', { ascending: true })

  if (error) throw error
  let rows = (data ?? []) as ApCalendarRow[]

  // Partner filter — both costs and loans now have partner_company_id directly in the view
  if (partnerIds.length > 0) {
    rows = rows.filter((row) => {
      if (row.partner_company_id) {
        return partnerIds.includes(row.partner_company_id)
      }
      return true
    })
  }

  // Collect unique suppliers for filter dropdown
  const supplierSet = new Set<string>()
  for (const r of rows) { if (r.entity_name) supplierSet.add(r.entity_name) }
  const uniqueSuppliers = Array.from(supplierSet).sort()

  // Compute bucket counts from all rows (before filters)
  const daysToEndOfWeek = getDaysUntilEndOfWeek()
  const emptyBucket = { count: 0, pen: 0, usd: 0 }
  const bucketCounts: ApCalendarBucketCounts = {
    overdue: { ...emptyBucket },
    today: { ...emptyBucket },
    'this-week': { ...emptyBucket },
    'next-30': { ...emptyBucket },
  }
  for (const r of rows) {
    const b = getApBucket(r.days_remaining, daysToEndOfWeek)
    if (!b) continue
    bucketCounts[b].count++
    const amt = r.outstanding ?? 0
    if (r.currency === 'PEN') bucketCounts[b].pen += amt
    else if (r.currency === 'USD') {
      bucketCounts[b].usd += amt
      if (midRate) bucketCounts[b].pen += amt * midRate
    }
  }

  // Apply filters
  if (filters.bucket && filters.bucket !== 'all') {
    rows = rows.filter(r => getApBucket(r.days_remaining, daysToEndOfWeek) === filters.bucket)
  }
  if (filters.projectId) rows = rows.filter(r => r.project_id === filters.projectId)
  if (filters.supplier) rows = rows.filter(r => r.entity_name === filters.supplier)
  if (filters.currency) rows = rows.filter(r => r.currency === filters.currency)
  if (filters.search) {
    const search = filters.search.toLowerCase()
    rows = rows.filter(r => (r.title ?? '').toLowerCase().includes(search))
  }

  // Sort and paginate
  rows = sortRows(rows, filters.sort, filters.dir)
  const paginated = paginateArray(rows, filters.page)

  return { paginated, bucketCounts, uniqueSuppliers }
}

export async function getCostDetail(costId: string): Promise<CostDetailData> {
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

  // Fetch cost header for comprobante info
  const costHeaderResult = await supabase
    .from('costs')
    .select('comprobante_type, comprobante_number, document_ref')
    .eq('id', costId)
    .single()

  return {
    cost: costResult.data as CostBalanceRow | null,
    items: (itemsResult.data ?? []) as CostItem[],
    payments: (paymentsResult.data ?? []) as Payment[],
    header: costHeaderResult.data,
  }
}

export async function getLoanIdFromSchedule(
  scheduledDate: string,
  scheduledAmount: number
): Promise<string | null> {
  const supabase = await createServerSupabaseClient()

  const { data: scheduleRow } = await supabase
    .from('loan_schedule')
    .select('loan_id')
    .eq('scheduled_date', scheduledDate)
    .eq('scheduled_amount', scheduledAmount)
    .eq('paid', false)
    .limit(1)
    .single()

  return scheduleRow?.loan_id ?? null
}

export async function getLoanDetail(loanId: string): Promise<LoanDetailData> {
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

export async function getProjectsForFilter(): Promise<{ id: string; project_code: string; name: string }[]> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('projects')
    .select('id, project_code, name')
    .eq('is_active', true)
    .order('project_code')
  return data ?? []
}

// --- AR Outstanding queries ---

type ArOutstandingFilters = {
  projectId?: string
  client?: string
  partnerCompanyId?: string
  currency?: string
  bucket?: string
  sort: string
  dir: 'asc' | 'desc'
  page: number
}

type ArOutstandingTotals = {
  pen: { gross: number; receivable: number; bdn: number; count: number }
  usd: { gross: number; receivable: number; bdn: number; count: number }
}

type ArOutstandingResult = {
  paginated: PaginatedResult<ArOutstandingRow>
  bucketCounts: ArOutstandingBucketCounts
  totals: ArOutstandingTotals
}

export async function getArOutstanding(
  partnerFilter: string[],
  filters: ArOutstandingFilters,
  midRate: number | null = null,
): Promise<ArOutstandingResult> {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('v_ar_balances')
    .select('*')
    .in('payment_status', ['pending', 'partial'])
    .order('due_date', { ascending: true })

  if (partnerFilter.length > 0) {
    query = query.in('partner_company_id', partnerFilter)
  }

  const { data: invoices, error } = await query

  if (error) throw error

  const emptyBucket = { count: 0, pen: 0, usd: 0 }
  const emptyResult: ArOutstandingResult = {
    paginated: { data: [], totalCount: 0, page: 1, pageSize: 25 },
    bucketCounts: { current: { ...emptyBucket }, '31-60': { ...emptyBucket }, '61-90': { ...emptyBucket }, '90+': { ...emptyBucket } },
    totals: { pen: { gross: 0, receivable: 0, bdn: 0, count: 0 }, usd: { gross: 0, receivable: 0, bdn: 0, count: 0 } },
  }

  if (!invoices || invoices.length === 0) return emptyResult

  // Collect entity IDs, project IDs, partner company IDs for lookups
  const entityIds = [...new Set(invoices.filter(i => i.entity_id).map(i => i.entity_id!))]
  const projectIds = [...new Set(invoices.filter(i => i.project_id).map(i => i.project_id!))]
  const partnerIds = [...new Set(invoices.filter(i => i.partner_company_id).map(i => i.partner_company_id!))]

  const [entityMap, projectMap, partnersResult] = await Promise.all([
    buildEntityNameMap(supabase, entityIds),
    buildProjectCodeMap(supabase, projectIds),
    partnerIds.length > 0
      ? supabase.from('partner_companies').select('id, name').in('id', partnerIds)
      : { data: [] },
  ])

  const partnerMap = new Map((partnersResult.data ?? []).map(p => [p.id, p.name]))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Enrich all rows
  let rows: ArOutstandingRow[] = invoices.map(i => {
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
      receivable: i.receivable ?? 0,
      bdn_outstanding: i.bdn_outstanding ?? 0,
      currency: i.currency ?? 'PEN',
      payment_status: i.payment_status ?? 'pending',
    }
  })

  // Compute bucket counts from all rows (before any filters)
  const bucketCounts: ArOutstandingBucketCounts = {
    current: { ...emptyBucket },
    '31-60': { ...emptyBucket },
    '61-90': { ...emptyBucket },
    '90+': { ...emptyBucket },
  }
  for (const r of rows) {
    const b = getAgingBucket(r.days_overdue)
    bucketCounts[b].count++
    if (r.currency === 'PEN') bucketCounts[b].pen += r.outstanding
    else if (r.currency === 'USD') {
      bucketCounts[b].usd += r.outstanding
      if (midRate) bucketCounts[b].pen += r.outstanding * midRate
    }
  }

  // Apply filters
  if (filters.bucket && filters.bucket !== 'all') {
    rows = rows.filter(r => getAgingBucket(r.days_overdue) === filters.bucket)
  }
  if (filters.projectId) rows = rows.filter(r => r.project_id === filters.projectId)
  if (filters.client) rows = rows.filter(r => r.client_name === filters.client)
  if (filters.partnerCompanyId) rows = rows.filter(r => r.partner_company_id === filters.partnerCompanyId)
  if (filters.currency) rows = rows.filter(r => r.currency === filters.currency)

  // Compute totals from full filtered set (before pagination)
  const totals: ArOutstandingTotals = {
    pen: { gross: 0, receivable: 0, bdn: 0, count: 0 },
    usd: { gross: 0, receivable: 0, bdn: 0, count: 0 },
  }
  for (const r of rows) {
    const t = r.currency === 'USD' ? totals.usd : totals.pen
    t.gross += r.gross_total
    t.receivable += r.receivable
    t.bdn += r.bdn_outstanding
    t.count++
  }

  // Sort and paginate
  rows = sortRows(rows, filters.sort, filters.dir)
  const paginated = paginateArray(rows, filters.page)

  return { paginated, bucketCounts, totals }
}

export async function getArInvoiceDetail(arInvoiceId: string): Promise<ArInvoiceDetailData> {
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

export async function getClientsForFilter(): Promise<{ id: string; name: string }[]> {
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

export async function getPartnerCompaniesForFilter(): Promise<{ id: string; name: string }[]> {
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
  sga: number
}

function mapCategory(category: string | null, costType: string | null, sgaKeys: Set<string>): keyof CategoryTotals {
  if (costType === 'sga') return 'sga'
  if (category && sgaKeys.has(category)) return 'sga'
  switch (category) {
    case 'materials': return 'materials'
    case 'labor': return 'labor'
    case 'subcontractor': return 'subcontractor'
    case 'equipment_rental': return 'equipment'
    default: return 'other'
  }
}

function emptyCategoryTotals(): CategoryTotals {
  return { materials: 0, labor: 0, subcontractor: 0, equipment: 0, other: 0, sga: 0 }
}

type MonthBucket = {
  cashInByProject: Record<string, number>
  loansCashIn: number
  categories: CategoryTotals
  loanRepayment: number
}

type CashFlowRawData = {
  payments: { id: string; related_to: string; related_id: string; direction: string; payment_type: string; payment_date: string; amount: number; currency: string; exchange_rate: number; partner_company_id: string }[]
  costBalances: { cost_id: string; project_id: string | null; due_date: string | null; outstanding: number; currency: string; exchange_rate: number | null; cost_type: string | null; partner_company_id: string | null }[]
  arBalances: { ar_invoice_id: string; project_id: string | null; due_date: string | null; outstanding: number; currency: string; exchange_rate: number; partner_company_id: string | null }[]
  loanSchedule: { id: string; loan_id: string; scheduled_date: string; scheduled_amount: number; paid: boolean; exchange_rate: number | null; loans: { currency: string; project_id: string | null; partner_company_id: string | null }[] }[]
  loanDisbursements: { id: string; amount: number; currency: string; exchange_rate: number | null; date_borrowed: string; project_id: string | null; partner_company_id: string }[]
  loanRepayments: { id: string; loan_id: string; payment_date: string; amount: number; currency: string; exchange_rate: number | null }[]
  allProjects: { id: string; project_code: string; name: string }[]
  forecastRate: number | null
}

type CashFlowMaps = {
  costProjectMap: Map<string, string | null>
  costTypeMap: Map<string, string>
  arProjectMap: Map<string, string | null>
  costCategoryMap: Map<string, { category: string; proportion: number }[]>
  loanProjectMap: Map<string, string | null>
  loanPartnerMap: Map<string, string | null>
}

async function fetchCashFlowData(supabase: SupabaseClient, year: number): Promise<CashFlowRawData> {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const [
    paymentsResult,
    costBalancesResult,
    arBalancesResult,
    loanScheduleResult,
    loansResult,
    loanPaymentsResult,
    latestRate,
    projectsResult,
  ] = await Promise.all([
    supabase
      .from('payments')
      .select('id, related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, partner_company_id')
      .gte('payment_date', yearStart)
      .lte('payment_date', yearEnd),
    supabase
      .from('v_cost_balances')
      .select('cost_id, project_id, due_date, outstanding, currency, exchange_rate, cost_type, partner_company_id')
      .in('payment_status', ['pending', 'partial'])
      .not('due_date', 'is', null),
    supabase
      .from('v_ar_balances')
      .select('ar_invoice_id, project_id, due_date, outstanding, currency, exchange_rate, partner_company_id')
      .in('payment_status', ['pending', 'partial'])
      .not('due_date', 'is', null),
    supabase
      .from('loan_schedule')
      .select('id, loan_id, scheduled_date, scheduled_amount, paid, exchange_rate, loans!fk_loan_schedule_loans(currency, project_id, partner_company_id)')
      .eq('paid', false),
    supabase
      .from('loans')
      .select('id, amount, currency, exchange_rate, date_borrowed, project_id, partner_company_id')
      .gte('date_borrowed', yearStart)
      .lte('date_borrowed', yearEnd),
    supabase
      .from('loan_payments')
      .select('id, loan_id, payment_date, amount, currency, exchange_rate')
      .gte('payment_date', yearStart)
      .lte('payment_date', yearEnd),
    supabase
      .from('exchange_rates')
      .select('mid_rate, rate_date')
      .order('rate_date', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('projects')
      .select('id, project_code, name')
      .eq('is_active', true)
      .order('project_code'),
  ])

  return {
    payments: paymentsResult.data ?? [],
    costBalances: costBalancesResult.data ?? [],
    arBalances: arBalancesResult.data ?? [],
    loanSchedule: loanScheduleResult.data ?? [],
    loanDisbursements: loansResult.data ?? [],
    loanRepayments: loanPaymentsResult.data ?? [],
    allProjects: projectsResult.data ?? [],
    forecastRate: latestRate.data ? Number(latestRate.data.mid_rate) : null,
  }
}

async function buildCashFlowMaps(
  supabase: SupabaseClient,
  raw: CashFlowRawData,
  hasPartnerFilter: boolean,
): Promise<CashFlowMaps> {
  // Collect relevant cost_ids, then fetch cost_items only for those
  const relevantCostIds = new Set<string>()
  for (const cb of raw.costBalances) {
    if (cb.cost_id) relevantCostIds.add(cb.cost_id)
  }
  for (const p of raw.payments) {
    if (p.related_to === 'cost' && p.related_id) relevantCostIds.add(p.related_id)
  }
  const costItems: { cost_id: string; category: string; subtotal: number }[] = []
  if (relevantCostIds.size > 0) {
    const { data } = await supabase
      .from('cost_items')
      .select('cost_id, category, subtotal')
      .in('cost_id', [...relevantCostIds])
    if (data) costItems.push(...data)
  }

  // cost_id -> project_id and cost_id -> cost_type
  const costProjectMap = new Map<string, string | null>()
  const costTypeMap = new Map<string, string>()
  for (const cb of raw.costBalances) {
    if (cb.cost_id) {
      costProjectMap.set(cb.cost_id, cb.project_id)
      if (cb.cost_type) costTypeMap.set(cb.cost_id, cb.cost_type)
    }
  }

  // Fetch cost project_ids/cost_types for payments referencing already-paid costs
  const paymentCostIds = raw.payments
    .filter(p => p.related_to === 'cost')
    .map(p => p.related_id)
    .filter(id => !costProjectMap.has(id))
  if (paymentCostIds.length > 0) {
    const { data: extraCosts } = await supabase
      .from('costs')
      .select('id, project_id, cost_type')
      .in('id', paymentCostIds)
    for (const c of extraCosts ?? []) {
      costProjectMap.set(c.id, c.project_id)
      if (c.cost_type) costTypeMap.set(c.id, c.cost_type)
    }
  }

  // AR invoice project + partner map
  const arProjectMap = new Map<string, string | null>()
  for (const ar of raw.arBalances) {
    if (ar.ar_invoice_id) arProjectMap.set(ar.ar_invoice_id, ar.project_id)
  }
  const paymentArIds = raw.payments
    .filter(p => p.related_to === 'ar_invoice')
    .map(p => p.related_id)
    .filter(id => !arProjectMap.has(id))
  if (paymentArIds.length > 0) {
    const { data: extraAr } = await supabase
      .from('ar_invoices')
      .select('id, project_id, partner_company_id')
      .in('id', paymentArIds)
    for (const a of extraAr ?? []) {
      arProjectMap.set(a.id, a.project_id)
    }
  }

  // cost_id -> category proportions
  const costCategoryMap = new Map<string, { category: string; proportion: number }[]>()
  const costSubtotals = new Map<string, number>()
  for (const item of costItems) {
    costSubtotals.set(item.cost_id, (costSubtotals.get(item.cost_id) ?? 0) + (item.subtotal ?? 0))
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

  // loan_id -> project_id + partner_company_id
  const loanProjectMap = new Map<string, string | null>()
  const loanPartnerMap = new Map<string, string | null>()
  for (const loan of raw.loanDisbursements) {
    loanProjectMap.set(loan.id, loan.project_id)
    loanPartnerMap.set(loan.id, loan.partner_company_id)
  }
  const repaymentLoanIds = raw.loanRepayments
    .map(lp => lp.loan_id)
    .filter(id => !loanProjectMap.has(id))
  if (repaymentLoanIds.length > 0) {
    const { data: extraLoans } = await supabase
      .from('loans')
      .select('id, project_id, partner_company_id')
      .in('id', repaymentLoanIds)
    for (const l of extraLoans ?? []) {
      loanProjectMap.set(l.id, l.project_id)
      loanPartnerMap.set(l.id, l.partner_company_id)
    }
  }

  return { costProjectMap, costTypeMap, arProjectMap, costCategoryMap, loanProjectMap, loanPartnerMap }
}

function processMonthBuckets(
  raw: CashFlowRawData,
  maps: CashFlowMaps,
  year: number,
  projectId: string | null,
  partnerIds: string[],
  reportingCurrency: 'PEN',
  sgaKeys: Set<string>,
): Map<string, MonthBucket> {
  const hasPartnerFilter = partnerIds.length > 0
  const monthBuckets = new Map<string, MonthBucket>()
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    monthBuckets.set(key, { cashInByProject: {}, loansCashIn: 0, categories: emptyCategoryTotals(), loanRepayment: 0 })
  }

  const today = new Date()
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  // Actual payments
  for (const p of raw.payments) {
    if (hasPartnerFilter && !partnerIds.includes(p.partner_company_id)) continue
    const pProjectId = p.related_to === 'cost'
      ? maps.costProjectMap.get(p.related_id)
      : maps.arProjectMap.get(p.related_id)
    if (projectId && pProjectId !== projectId) continue

    const monthKey = toMonthKey(p.payment_date)
    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    const amount = convertAmount(p.amount, p.currency, p.exchange_rate, reportingCurrency)
    if (p.direction === 'inbound') {
      const projId = pProjectId ?? '_none'
      bucket.cashInByProject[projId] = (bucket.cashInByProject[projId] ?? 0) + amount
    } else {
      const categories = maps.costCategoryMap.get(p.related_id)
      const costType = maps.costTypeMap.get(p.related_id) ?? null
      if (categories && categories.length > 0) {
        for (const cat of categories) {
          const catKey = mapCategory(cat.category, costType, sgaKeys)
          bucket.categories[catKey] += amount * cat.proportion
        }
      } else {
        bucket.categories.other += amount
      }
    }
  }

  // Forecast: outstanding costs by due_date
  for (const cost of raw.costBalances) {
    if (!cost.due_date) continue
    const monthKey = toMonthKey(cost.due_date)
    if (monthKey <= currentMonthKey || monthKey < `${year}-01` || monthKey > `${year}-12`) continue
    if (projectId && cost.project_id !== projectId) continue
    if (hasPartnerFilter && cost.partner_company_id) {
      if (!partnerIds.includes(cost.partner_company_id)) continue
    }

    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    const amount = convertAmount(cost.outstanding ?? 0, cost.currency, raw.forecastRate ?? cost.exchange_rate ?? null, reportingCurrency)
    const categories = cost.cost_id ? maps.costCategoryMap.get(cost.cost_id) : null
    const costType = cost.cost_id ? (maps.costTypeMap.get(cost.cost_id) ?? cost.cost_type ?? null) : null
    if (categories && categories.length > 0) {
      for (const cat of categories) {
        const catKey = mapCategory(cat.category, costType, sgaKeys)
        bucket.categories[catKey] += amount * cat.proportion
      }
    } else {
      bucket.categories.other += amount
    }
  }

  // Forecast: outstanding AR invoices by due_date
  for (const ar of raw.arBalances) {
    if (!ar.due_date) continue
    const monthKey = toMonthKey(ar.due_date)
    if (monthKey <= currentMonthKey || monthKey < `${year}-01` || monthKey > `${year}-12`) continue
    if (projectId && ar.project_id !== projectId) continue
    if (hasPartnerFilter && ar.partner_company_id && !partnerIds.includes(ar.partner_company_id)) continue

    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    const projId = ar.project_id ?? '_none'
    const amount = convertAmount(ar.outstanding ?? 0, ar.currency, raw.forecastRate ?? ar.exchange_rate, reportingCurrency)
    bucket.cashInByProject[projId] = (bucket.cashInByProject[projId] ?? 0) + amount
  }

  // Forecast: loan schedule
  for (const entry of raw.loanSchedule) {
    if (!entry.scheduled_date) continue
    const monthKey = toMonthKey(entry.scheduled_date)
    if (monthKey <= currentMonthKey || monthKey < `${year}-01` || monthKey > `${year}-12`) continue

    const loanData = (entry.loans?.[0] ?? null) as { currency: string; project_id: string | null; partner_company_id: string | null } | null
    if (projectId && loanData?.project_id !== projectId) continue
    if (hasPartnerFilter && loanData?.partner_company_id && !partnerIds.includes(loanData.partner_company_id)) continue

    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    const loanCurrency = loanData?.currency ?? 'PEN'
    bucket.loanRepayment += convertAmount(entry.scheduled_amount, loanCurrency, raw.forecastRate ?? entry.exchange_rate ?? null, reportingCurrency)
  }

  // Actual loan disbursements as cash in
  for (const loan of raw.loanDisbursements) {
    if (projectId && loan.project_id !== projectId) continue
    if (hasPartnerFilter && !partnerIds.includes(loan.partner_company_id)) continue

    const monthKey = toMonthKey(loan.date_borrowed)
    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    bucket.loansCashIn += convertAmount(loan.amount, loan.currency, loan.exchange_rate ?? null, reportingCurrency)
  }

  // Actual loan repayments
  for (const lp of raw.loanRepayments) {
    const lpPartner = maps.loanPartnerMap.get(lp.loan_id)
    if (hasPartnerFilter && lpPartner && !partnerIds.includes(lpPartner)) continue
    if (projectId) {
      const lpProjectId = maps.loanProjectMap.get(lp.loan_id)
      if (lpProjectId !== projectId) continue
    }

    const monthKey = toMonthKey(lp.payment_date)
    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    bucket.loanRepayment += convertAmount(lp.amount, lp.currency, lp.exchange_rate ?? null, reportingCurrency)
  }

  return monthBuckets
}

function buildCashFlowResult(
  monthBuckets: Map<string, MonthBucket>,
  allProjects: { id: string; project_code: string; name: string }[],
  year: number,
): CashFlowData {
  const today = new Date()
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  // Collect projects that appear in Cash In
  const projectIdsWithCashIn = new Set<string>()
  for (const bucket of monthBuckets.values()) {
    for (const pid of Object.keys(bucket.cashInByProject)) {
      if (pid !== '_none') projectIdsWithCashIn.add(pid)
    }
  }
  const projects: CashFlowProject[] = allProjects
    .filter(p => projectIdsWithCashIn.has(p.id))
    .map(p => ({ id: p.id, code: p.project_code, name: p.name }))

  // Build monthly rows
  const months: CashFlowMonth[] = []
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    const bucket = monthBuckets.get(key)!
    const projectCosts = bucket.categories.materials + bucket.categories.labor +
      bucket.categories.subcontractor + bucket.categories.equipment +
      bucket.categories.other
    const cashOut = projectCosts + bucket.categories.sga + bucket.loanRepayment
    const projectCashInTotal = Object.values(bucket.cashInByProject).reduce((a, b) => a + b, 0)
    const cashIn = projectCashInTotal + bucket.loansCashIn
    const net = cashIn - cashOut
    const isActual = key <= currentMonthKey
    const isCurrentMonth = key === currentMonthKey

    months.push({
      month: key,
      label: getMonthLabel(key),
      isActual,
      isCurrentMonth,
      cashIn,
      cashInByProject: { ...bucket.cashInByProject },
      loansCashIn: bucket.loansCashIn,
      materials: bucket.categories.materials,
      labor: bucket.categories.labor,
      subcontractor: bucket.categories.subcontractor,
      equipment: bucket.categories.equipment,
      other: bucket.categories.other,
      projectCosts,
      sga: bucket.categories.sga,
      loanRepayment: bucket.loanRepayment,
      cashOut,
      net,
    })
  }

  return { months, projects }
}

export async function getCashFlow(
  year: number,
  projectId: string | null,
  partnerIds: string[],
): Promise<CashFlowData> {
  const supabase = await createServerSupabaseClient()
  const [raw, { data: cats }] = await Promise.all([
    fetchCashFlowData(supabase, year),
    supabase.from('categories').select('name, cost_type').eq('is_active', true),
  ])
  const sgaKeys = new Set((cats ?? []).filter(c => c.cost_type === 'sga').map(c => c.name))
  const maps = await buildCashFlowMaps(supabase, raw, partnerIds.length > 0)
  const monthBuckets = processMonthBuckets(raw, maps, year, projectId, partnerIds, 'PEN', sgaKeys)
  return buildCashFlowResult(monthBuckets, raw.allProjects, year)
}

// --- Partner detail queries (used by Project Detail settlement section) ---

export async function getPartnerCostDetails(
  projectId: string,
  partnerCompanyId: string,
): Promise<PartnerCostDetail[]> {
  const supabase = await createServerSupabaseClient()

  // Get all costs for this project by this partner
  const { data: costs, error } = await supabase
    .from('v_cost_totals')
    .select('cost_id, date, comprobante_number, currency, subtotal, exchange_rate')
    .eq('project_id', projectId)
    .eq('partner_company_id', partnerCompanyId)
    .order('date', { ascending: false })

  if (error) throw error
  if (!costs || costs.length === 0) return []

  return costs.map(c => {
    const subtotal = c.subtotal ?? 0
    const rate = c.exchange_rate ? Number(c.exchange_rate) : 1
    return {
      cost_id: c.cost_id!,
      date: c.date,
      comprobante_number: c.comprobante_number,
      subtotal,
      currency: c.currency,
      exchange_rate: c.exchange_rate ? Number(c.exchange_rate) : null,
      subtotal_pen: c.currency === 'USD' ? Math.round(subtotal * rate * 100) / 100 : subtotal,
    }
  })
}

export async function getPartnerRevenueDetails(
  projectId: string,
  partnerCompanyId: string,
): Promise<import('./types').PartnerRevenueDetail[]> {
  const supabase = await createServerSupabaseClient()

  // Get AR invoices for this project+partner
  const { data: ars } = await supabase
    .from('ar_invoices')
    .select('id, invoice_number, currency')
    .eq('project_id', projectId)
    .eq('partner_company_id', partnerCompanyId)

  if (!ars || ars.length === 0) return []

  const arIds = ars.map(a => a.id)
  const arMap = new Map(ars.map(a => [a.id, a]))

  // Get payments linked to these AR invoices
  const { data: payments } = await supabase
    .from('payments')
    .select('id, related_id, payment_date, amount, currency, exchange_rate')
    .in('related_id', arIds)
    .eq('related_to', 'ar_invoice')
    .order('payment_date', { ascending: false })

  return (payments ?? []).map(p => {
    const ar = arMap.get(p.related_id)
    const currency = p.currency ?? ar?.currency ?? 'PEN'
    const amount = p.amount ?? 0
    const rate = p.exchange_rate ? Number(p.exchange_rate) : 1
    return {
      payment_id: p.id,
      payment_date: p.payment_date,
      invoice_number: ar?.invoice_number ?? null,
      amount,
      currency,
      exchange_rate: p.exchange_rate ? Number(p.exchange_rate) : null,
      amount_pen: currency === 'USD' ? Math.round(amount * rate * 100) / 100 : amount,
    }
  })
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
  partnerIds: string[]
): Promise<FinancialPositionData> {
  const supabase = await createServerSupabaseClient()
  const hasPartnerFilter = partnerIds.length > 0

  const [
    bankResult,
    arResult,
    costResult,
    igvResult,
    retencionResult,
    loanResult,
  ] = await Promise.all([
    supabase.from('v_bank_balances').select('*'),
    supabase.from('v_ar_balances').select('outstanding, currency, payment_status, partner_company_id'),
    supabase.from('v_cost_balances').select('outstanding, currency, payment_status, partner_company_id'),
    supabase.from('v_igv_position').select('*'),
    supabase.from('v_retencion_dashboard').select('retencion_amount, currency, retencion_verified'),
    supabase.from('v_loan_balances').select('*'),
  ])

  // Bank account cards — filter by partner
  let bankAccounts = (bankResult.data ?? [])
  if (hasPartnerFilter) {
    bankAccounts = bankAccounts.filter(ba => ba.partner_company_id && partnerIds.includes(ba.partner_company_id))
  }
  const bankCards: BankAccountCard[] = bankAccounts.map(ba => ({
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

  // AR outstanding grouped by currency — filter by partner
  let arRows = (arResult.data ?? []).filter(ar => ar.payment_status !== 'paid')
  if (hasPartnerFilter) {
    arRows = arRows.filter(ar => ar.partner_company_id && partnerIds.includes(ar.partner_company_id))
  }
  const arOutstanding = groupByCurrency(
    arRows.map(ar => ({ amount: ar.outstanding ?? 0, currency: ar.currency }))
  )

  // AP outstanding grouped by currency — filter by partner
  let costRows = (costResult.data ?? []).filter(c => c.payment_status !== 'paid')
  if (hasPartnerFilter) {
    costRows = costRows.filter(c => {
      if (!c.partner_company_id) return true
      return partnerIds.includes(c.partner_company_id)
    })
  }
  const apOutstanding = groupByCurrency(
    costRows.map(c => ({ amount: c.outstanding ?? 0, currency: c.currency }))
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

  // Loans — filter by partner
  let loanRows = loanResult.data ?? []
  if (hasPartnerFilter) {
    loanRows = loanRows.filter(l => l.partner_company_id && partnerIds.includes(l.partner_company_id))
  }
  const loans = loanRows.map(l => ({
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

  const [entityMap, projectMap] = await Promise.all([
    buildEntityNameMap(supabase, [...new Set(entityIds)]),
    buildProjectCodeMap(supabase, [...new Set(projectIds)]),
  ])

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

// --- Projects browse queries ---

export async function getProjectsList(): Promise<ProjectListItem[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('projects')
    .select('id, project_code, name, status, contract_value, contract_currency')
    .eq('is_active', true)
    .order('project_code')

  if (error) throw error
  return (data ?? []) as ProjectListItem[]
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetailData> {
  const supabase = await createServerSupabaseClient()

  // 1. Fetch project, project_partners, budget, AR invoices in parallel
  const [projectResult, ppResult, budgetResult] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('project_partners').select('id, partner_company_id, profit_share_pct').eq('project_id', projectId).eq('is_active', true),
    supabase.from('v_budget_vs_actual').select('*').eq('project_id', projectId),
  ])

  if (projectResult.error) throw projectResult.error
  const project = projectResult.data

  // 2. Spending by entity: query v_cost_totals for this project, group by (entity_id, currency)
  const { data: costTotals } = await supabase
    .from('v_cost_totals')
    .select('entity_id, currency, subtotal')
    .eq('project_id', projectId)

  const spendingMap = new Map<string, { totalSpent: number; invoiceCount: number }>()
  for (const ct of costTotals ?? []) {
    const key = `${ct.entity_id ?? '__none__'}|${ct.currency ?? 'PEN'}`
    const existing = spendingMap.get(key)
    if (existing) {
      existing.totalSpent += ct.subtotal ?? 0
      existing.invoiceCount += 1
    } else {
      spendingMap.set(key, {
        totalSpent: ct.subtotal ?? 0,
        invoiceCount: 1,
      })
    }
  }

  // Look up entity names and tags for entities with spending
  const spendingEntityIds = [...new Set(
    (costTotals ?? []).map(ct => ct.entity_id).filter((id): id is string => id !== null)
  )]
  const entityMap = await buildEntityNameMap(supabase, spendingEntityIds)

  // Fetch tags for these entities via entity_tags → tags
  const entityTagMap = new Map<string, string[]>()
  if (spendingEntityIds.length > 0) {
    const { data: entityTags } = await supabase
      .from('entity_tags')
      .select('entity_id, tag_id')
      .in('entity_id', spendingEntityIds)
    const tagIds = [...new Set((entityTags ?? []).map(et => et.tag_id))]
    if (tagIds.length > 0) {
      const { data: tags } = await supabase.from('tags').select('id, name').in('id', tagIds)
      const tagNameMap = new Map((tags ?? []).map(t => [t.id, t.name]))
      for (const et of entityTags ?? []) {
        const name = tagNameMap.get(et.tag_id)
        if (!name) continue
        const existing = entityTagMap.get(et.entity_id) ?? []
        existing.push(name)
        entityTagMap.set(et.entity_id, existing)
      }
    }
  }

  const entities: ProjectEntitySummary[] = []
  for (const [key, spending] of spendingMap) {
    const [entityIdRaw, currency] = key.split('|')
    const entityId = entityIdRaw === '__none__' ? null : entityIdRaw
    entities.push({
      entityId,
      entityName: entityId ? entityMap.get(entityId) ?? '—' : 'Other (no entity)',
      tags: entityId ? entityTagMap.get(entityId) ?? [] : [],
      totalSpent: spending.totalSpent,
      invoiceCount: spending.invoiceCount,
      currency,
    })
  }

  // Sort by totalSpent descending
  entities.sort((a, b) => (b.totalSpent ?? -1) - (a.totalSpent ?? -1))

  // 4. Client name
  let clientName: string | null = null
  if (project.client_entity_id) {
    const { data: clientEntity } = await supabase
      .from('entities')
      .select('legal_name, common_name')
      .eq('id', project.client_entity_id)
      .single()
    clientName = clientEntity?.common_name || clientEntity?.legal_name || null
  }

  // 5. Partners — build name map from partner_companies
  const ppData = ppResult.data ?? []
  const partnerCompanyIds = [...new Set(ppData.map(pp => pp.partner_company_id))]
  let partnerNameMap = new Map<string, string>()
  if (partnerCompanyIds.length > 0) {
    const { data: pcData } = await supabase
      .from('partner_companies')
      .select('id, name')
      .in('id', partnerCompanyIds)
    for (const pc of pcData ?? []) {
      partnerNameMap.set(pc.id, pc.name)
    }
  }
  const partners: ProjectPartnerRow[] = ppData.map(pp => ({
    id: pp.id,
    partnerCompanyId: pp.partner_company_id,
    partnerName: partnerNameMap.get(pp.partner_company_id) ?? '—',
    profitSharePct: pp.profit_share_pct,
  }))

  // 7. Partner settlements — fetch from v_partner_ledger + actual AR payments received
  let partnerSettlements: ProjectPartnerSettlement[] = []
  if (partners.length > 0) {
    const { data: ledger } = await supabase
      .from('v_partner_ledger')
      .select('*')
      .eq('project_id', projectId)

    // Get actual AR payments received per partner
    const { data: projectArInvoices } = await supabase
      .from('ar_invoices')
      .select('id, partner_company_id, currency')
      .eq('project_id', projectId)

    const arIds = (projectArInvoices ?? []).map(a => a.id)
    const receivedByPartner = new Map<string, number>()

    if (arIds.length > 0) {
      const { data: arPayments } = await supabase
        .from('payments')
        .select('related_id, amount, currency, exchange_rate')
        .in('related_id', arIds)
        .eq('related_to', 'ar_invoice')

      const arPartnerMap = new Map<string, { partner_company_id: string; currency: string }>()
      for (const ar of projectArInvoices ?? []) {
        if (ar.partner_company_id) {
          arPartnerMap.set(ar.id, { partner_company_id: ar.partner_company_id, currency: ar.currency })
        }
      }

      for (const p of arPayments ?? []) {
        const arInfo = arPartnerMap.get(p.related_id)
        if (!arInfo) continue
        const paymentCurrency = p.currency ?? arInfo.currency
        const amount = p.amount ?? 0
        const rate = p.exchange_rate ? Number(p.exchange_rate) : 1
        const amountPen = paymentCurrency === 'USD' ? amount * rate : amount
        receivedByPartner.set(arInfo.partner_company_id, (receivedByPartner.get(arInfo.partner_company_id) ?? 0) + amountPen)
      }
    }

    // Compute total project profit (sum of all revenue received - sum of all costs)
    const totalCosts = (ledger ?? []).reduce((sum, row) => sum + (row.contribution_amount_pen ?? 0), 0)
    const totalRevenue = [...receivedByPartner.values()].reduce((sum, v) => sum + v, 0)
    const totalProjectProfit = totalRevenue - totalCosts

    // Build settlement rows — one per partner
    partnerSettlements = partners.map(p => {
      const ledgerRow = (ledger ?? []).find(r => r.partner_company_id === p.partnerCompanyId)
      const costsContributed = ledgerRow?.contribution_amount_pen ?? 0
      const revenueReceived = receivedByPartner.get(p.partnerCompanyId) ?? 0
      const profit = Math.round((revenueReceived - costsContributed) * 100) / 100
      const shouldReceive = Math.round(totalProjectProfit * (p.profitSharePct / 100) * 100) / 100
      const balance = Math.round((shouldReceive - profit) * 100) / 100
      return {
        partnerCompanyId: p.partnerCompanyId,
        partnerName: p.partnerName,
        profitSharePct: p.profitSharePct,
        costsContributed,
        revenueReceived: Math.round(revenueReceived * 100) / 100,
        profit,
        shouldReceive,
        balance,
      }
    })
  }

  return {
    project,
    clientName,
    entities,
    budget: (budgetResult.data ?? []) as typeof budgetResult.data & { length: number },
    partners,
    partnerSettlements,
  }
}

// --- Entities browse queries ---

type EntitiesListFilters = {
  search?: string
  entityType?: string
  tagId?: string
  city?: string
  region?: string
  page: number
}

export async function getEntitiesList(
  filters: EntitiesListFilters = { page: 1 }
): Promise<PaginatedResult<EntityListItem>> {
  const supabase = await createServerSupabaseClient()

  // If tag filter is active, get matching entity IDs first
  let tagEntityIds: string[] | null = null
  if (filters.tagId) {
    const { data: etData } = await supabase
      .from('entity_tags')
      .select('entity_id')
      .eq('tag_id', filters.tagId)
    tagEntityIds = (etData ?? []).map(et => et.entity_id)
    if (tagEntityIds.length === 0) {
      return { data: [], totalCount: 0, page: filters.page, pageSize: PAGE_SIZE }
    }
  }

  // Build filtered query
  let query = supabase
    .from('entities')
    .select('id, legal_name, common_name, document_type, document_number, entity_type, city, region', { count: 'exact' })
    .eq('is_active', true)
    .order('legal_name')

  if (filters.search) {
    const s = `%${filters.search}%`
    query = query.or(`legal_name.ilike.${s},common_name.ilike.${s},document_number.ilike.${s}`)
  }
  if (filters.entityType) query = query.eq('entity_type', filters.entityType)
  if (filters.city) query = query.eq('city', filters.city)
  if (filters.region) query = query.eq('region', filters.region)
  if (tagEntityIds) query = query.in('id', tagEntityIds)

  // Apply pagination
  const offset = (filters.page - 1) * PAGE_SIZE
  query = query.range(offset, offset + PAGE_SIZE - 1)

  const { data: entities, error, count } = await query

  if (error) throw error

  // Fetch tags for the returned entities
  const entityIds = (entities ?? []).map(e => e.id)
  const tagsByEntity = new Map<string, string[]>()

  if (entityIds.length > 0) {
    const { data: entityTagsData } = await supabase
      .from('entity_tags')
      .select('entity_id, tags(name)')
      .in('entity_id', entityIds)

    for (const et of entityTagsData ?? []) {
      const tagName = (et.tags as unknown as { name: string } | null)?.name
      if (tagName) {
        const existing = tagsByEntity.get(et.entity_id) ?? []
        existing.push(tagName)
        tagsByEntity.set(et.entity_id, existing)
      }
    }
  }

  const items: EntityListItem[] = (entities ?? []).map(e => ({
    id: e.id,
    legal_name: e.legal_name,
    common_name: e.common_name,
    document_type: e.document_type,
    document_number: e.document_number,
    entity_type: e.entity_type,
    city: e.city,
    region: e.region,
    tags: tagsByEntity.get(e.id) ?? [],
  }))

  return {
    data: items,
    totalCount: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
  }
}

export async function getEntityDetail(entityId: string): Promise<EntityDetailData> {
  const supabase = await createServerSupabaseClient()

  const [entityResult, tagsResult, contactsResult, transactionsResult] = await Promise.all([
    supabase.from('entities').select('*').eq('id', entityId).single(),
    supabase.from('entity_tags').select('tag_id, tags(name)').eq('entity_id', entityId),
    supabase
      .from('entity_contacts')
      .select('*')
      .eq('entity_id', entityId)
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('v_entity_transactions')
      .select('*')
      .eq('entity_id', entityId)
      .order('date', { ascending: false }),
  ])

  if (entityResult.error) throw entityResult.error

  const tags = (tagsResult.data ?? [])
    .map(t => {
      const name = (t.tags as unknown as { name: string } | null)?.name
      return name ? { tagId: t.tag_id, name } : null
    })
    .filter((t): t is { tagId: string; name: string } => t !== null)

  // Group transactions by (project_id, currency)
  const projectGroups = new Map<string, ProjectTransactionGroup>()
  for (const tx of transactionsResult.data ?? []) {
    const key = `${tx.project_id ?? '__none__'}|${tx.currency ?? 'PEN'}`
    const existing = projectGroups.get(key)
    const amount = tx.amount ?? 0

    if (existing) {
      if (tx.transaction_type === 'cost') {
        existing.apTotal += amount
      } else {
        existing.arTotal += amount
      }
      existing.transactionCount += 1
      if (tx.date && (!existing.lastDate || tx.date > existing.lastDate)) {
        existing.lastDate = tx.date
      }
      existing.transactions.push(tx as EntityTransactionRow)
    } else {
      projectGroups.set(key, {
        projectId: tx.project_id ?? '',
        projectCode: tx.project_code ?? '—',
        projectName: tx.project_name ?? '—',
        apTotal: tx.transaction_type === 'cost' ? amount : 0,
        arTotal: tx.transaction_type === 'ar_invoice' ? amount : 0,
        net: 0, // computed below
        transactionCount: 1,
        lastDate: tx.date,
        currency: tx.currency ?? 'PEN',
        transactions: [tx as EntityTransactionRow],
      })
    }
  }

  // Compute net and sort
  const transactionsByProject = [...projectGroups.values()]
    .map(g => ({ ...g, net: g.arTotal - g.apTotal }))
    .sort((a, b) => (b.apTotal + b.arTotal) - (a.apTotal + a.arTotal))

  return {
    entity: entityResult.data,
    tags,
    contacts: contactsResult.data ?? [],
    transactionsByProject,
  }
}

export async function getEntitiesFilterOptions(): Promise<EntitiesFilterOptions> {
  const supabase = await createServerSupabaseClient()

  const [tagsResult, entitiesResult] = await Promise.all([
    supabase.from('tags').select('id, name').eq('is_active', true).order('name'),
    supabase.from('entities').select('city, region').eq('is_active', true),
  ])

  const cities = [...new Set((entitiesResult.data ?? []).map(e => e.city).filter(Boolean))] as string[]
  const regions = [...new Set((entitiesResult.data ?? []).map(e => e.region).filter(Boolean))] as string[]

  return {
    tags: tagsResult.data ?? [],
    cities: cities.sort(),
    regions: regions.sort(),
  }
}

// --- Prices browse queries ---

type PriceHistoryFilters = {
  search?: string
  category?: string
  entityId?: string
  projectId?: string
  tagId?: string
  dateFrom?: string
  dateTo?: string
  sort: string
  dir: 'asc' | 'desc'
  page: number
}

export async function getPriceHistory(
  filters: PriceHistoryFilters = { sort: 'date', dir: 'desc', page: 1 }
): Promise<PaginatedResult<PriceHistoryRow>> {
  const supabase = await createServerSupabaseClient()

  // Fetch cost_items with their parent cost header info, and quotes in parallel
  const [costItemsResult, costsResult, quotesResult] = await Promise.all([
    supabase.from('cost_items').select('id, cost_id, title, category, quantity, unit_of_measure, unit_price'),
    supabase
      .from('costs')
      .select('id, entity_id, project_id, date, currency')
      .eq('cost_type', 'project_cost'),
    supabase.from('quotes').select('id, entity_id, project_id, date_received, title, quantity, unit_of_measure, unit_price, currency'),
  ])

  const costItems = costItemsResult.data ?? []
  const costs = costsResult.data ?? []
  const quotes = quotesResult.data ?? []

  // Build cost_id -> cost header map
  const costMap = new Map(costs.map(c => [c.id, c]))

  // Collect all entity and project IDs for lookups
  const allEntityIds = new Set<string>()
  const allProjectIds = new Set<string>()

  for (const c of costs) {
    if (c.entity_id) allEntityIds.add(c.entity_id)
    if (c.project_id) allProjectIds.add(c.project_id)
  }
  for (const q of quotes) {
    if (q.entity_id) allEntityIds.add(q.entity_id)
    if (q.project_id) allProjectIds.add(q.project_id)
  }

  // Fetch entity names, project codes, and entity tags in parallel
  const [entityNameMap, projectCodeMap, entityTagsResult] = await Promise.all([
    buildEntityNameMap(supabase, [...allEntityIds]),
    buildProjectCodeMap(supabase, [...allProjectIds]),
    allEntityIds.size > 0
      ? supabase.from('entity_tags').select('entity_id, tags(name)').in('entity_id', [...allEntityIds])
      : { data: [] },
  ])

  // Build entity -> tags map
  const entityTagsMap = new Map<string, string[]>()
  for (const et of entityTagsResult.data ?? []) {
    const tagName = (et.tags as unknown as { name: string } | null)?.name
    if (tagName) {
      const existing = entityTagsMap.get(et.entity_id) ?? []
      existing.push(tagName)
      entityTagsMap.set(et.entity_id, existing)
    }
  }

  // Build result: cost_items
  let rows: PriceHistoryRow[] = []

  for (const item of costItems) {
    const cost = costMap.get(item.cost_id)
    if (!cost) continue // skip cost_items without matching project_cost header

    rows.push({
      id: item.id,
      date: cost.date ?? '',
      source: 'cost',
      entityId: cost.entity_id,
      entityName: cost.entity_id ? entityNameMap.get(cost.entity_id) ?? '—' : '—',
      projectId: cost.project_id,
      projectCode: cost.project_id ? projectCodeMap.get(cost.project_id) ?? '—' : '—',
      title: item.title ?? '',
      category: item.category,
      quantity: item.quantity,
      unit_of_measure: item.unit_of_measure,
      unit_price: item.unit_price,
      currency: cost.currency ?? 'PEN',
      entityTags: cost.entity_id ? entityTagsMap.get(cost.entity_id) ?? [] : [],
    })
  }

  // Build result: quotes
  for (const q of quotes) {
    rows.push({
      id: q.id,
      date: q.date_received ?? '',
      source: 'quote',
      entityId: q.entity_id,
      entityName: q.entity_id ? entityNameMap.get(q.entity_id) ?? '—' : '—',
      projectId: q.project_id,
      projectCode: q.project_id ? projectCodeMap.get(q.project_id) ?? '—' : '—',
      title: q.title ?? '',
      category: null,
      quantity: q.quantity,
      unit_of_measure: q.unit_of_measure,
      unit_price: q.unit_price,
      currency: q.currency ?? 'PEN',
      entityTags: q.entity_id ? entityTagsMap.get(q.entity_id) ?? [] : [],
    })
  }

  // Apply filters
  if (filters.search) {
    const search = filters.search.toLowerCase()
    rows = rows.filter(r => r.title.toLowerCase().includes(search))
  }
  if (filters.category) {
    rows = rows.filter(r => r.source === 'quote' || r.category === filters.category)
  }
  if (filters.entityId) rows = rows.filter(r => r.entityId === filters.entityId)
  if (filters.projectId) rows = rows.filter(r => r.projectId === filters.projectId)
  if (filters.tagId) {
    // Look up tag name, then filter by entityTags
    const { data: tagData } = await supabase.from('tags').select('name').eq('id', filters.tagId).single()
    if (tagData) {
      rows = rows.filter(r => r.entityTags.includes(tagData.name))
    }
  }
  if (filters.dateFrom) rows = rows.filter(r => r.date >= filters.dateFrom!)
  if (filters.dateTo) rows = rows.filter(r => r.date <= filters.dateTo!)

  // Sort and paginate
  rows = sortRows(rows, filters.sort, filters.dir)
  return paginateArray(rows, filters.page)
}

export async function getPriceFilterOptions(): Promise<PriceFilterOptions> {
  const supabase = await createServerSupabaseClient()

  const [projectsResult, tagsResult, categoriesResult] = await Promise.all([
    supabase.from('projects').select('id, project_code, name').eq('is_active', true).order('project_code'),
    supabase.from('tags').select('id, name').eq('is_active', true).order('name'),
    supabase.from('cost_items').select('category'),
  ])

  // Distinct categories
  const categories = [...new Set(
    (categoriesResult.data ?? []).map(c => c.category).filter(Boolean)
  )] as string[]

  // Get entities that appear in costs or quotes
  const [costEntitiesResult, quoteEntitiesResult] = await Promise.all([
    supabase.from('costs').select('entity_id').eq('cost_type', 'project_cost').not('entity_id', 'is', null),
    supabase.from('quotes').select('entity_id').not('entity_id', 'is', null),
  ])

  const entityIds = [...new Set([
    ...(costEntitiesResult.data ?? []).map(c => c.entity_id),
    ...(quoteEntitiesResult.data ?? []).map(q => q.entity_id),
  ].filter((id): id is string => id !== null))]

  let entities: { id: string; name: string }[] = []
  if (entityIds.length > 0) {
    const { data } = await supabase
      .from('entities')
      .select('id, legal_name, common_name')
      .in('id', entityIds)
      .order('legal_name')
    entities = (data ?? []).map(e => ({ id: e.id, name: e.common_name || e.legal_name }))
  }

  return {
    projects: projectsResult.data ?? [],
    entities,
    tags: tagsResult.data ?? [],
    categories: categories.sort(),
  }
}

// ============================================================
// Exchange Rate
// ============================================================

export type BankAccountOption = {
  id: string
  bank_name: string
  account_number_last4: string
  label: string
  currency: string
  is_detraccion_account: boolean
}

export async function getBankAccountsForPartner(
  partnerCompanyId: string
): Promise<BankAccountOption[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('id, bank_name, account_number_last4, label, currency, is_detraccion_account')
    .eq('partner_company_id', partnerCompanyId)
    .eq('is_active', true)
    .order('label')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getExchangeRateForDate(
  date: string
): Promise<{ mid_rate: number; rate_date: string } | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('mid_rate, rate_date')
    .lte('rate_date', date)
    .order('rate_date', { ascending: false })
    .limit(1)
    .single()
  if (error || !data) return null
  return { mid_rate: Number(data.mid_rate), rate_date: data.rate_date }
}

export async function getLatestExchangeRate(): Promise<{ mid_rate: number; rate_date: string } | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('mid_rate, rate_date')
    .order('rate_date', { ascending: false })
    .limit(1)
    .single()
  if (error || !data) return null
  return { mid_rate: Number(data.mid_rate), rate_date: data.rate_date }
}

// --- Partner companies (for dropdowns) ---

export type { PartnerCompanyOption, CategoryOption }

export async function getPartnerCompanies(): Promise<PartnerCompanyOption[]> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('partner_companies')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
  return data ?? []
}

// --- Entity search (for entity picker) ---

export async function searchEntities(
  query: string
): Promise<EntitySearchResult[]> {
  if (!query || query.trim().length < 2) return []
  const supabase = await createServerSupabaseClient()
  const pattern = `%${query.trim()}%`
  const { data } = await supabase
    .from('entities')
    .select('id, legal_name, common_name, document_number')
    .eq('is_active', true)
    .or(`legal_name.ilike.${pattern},common_name.ilike.${pattern},document_number.ilike.${pattern}`)
    .order('legal_name')
    .limit(10)
  return data ?? []
}

// --- Next project code ---

export async function getNextProjectCode(): Promise<string> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('projects')
    .select('project_code')
    .order('project_code', { ascending: false })
    .limit(1)
  if (data && data.length > 0) {
    const lastNum = parseInt(data[0].project_code.replace('PRY', ''), 10)
    return `PRY${String(lastNum + 1).padStart(3, '0')}`
  }
  return 'PRY001'
}

// --- Categories (for budget form) ---

export async function getProjectCategories(): Promise<CategoryOption[]> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('categories')
    .select('name, cost_type')
    .eq('is_active', true)
    .eq('cost_type', 'project_cost')
    .order('name')
  return data ?? []
}

// --- Tags (standalone for role dropdowns) ---

export async function getTags(): Promise<{ id: string; name: string }[]> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('tags')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
  return data ?? []
}
