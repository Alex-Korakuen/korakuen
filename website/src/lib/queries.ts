import { createServerSupabaseClient } from './supabase/server'
import { convertAmount } from './formatters'
import { getDaysUntilEndOfWeek, getAgingBucket } from './date-utils'
import { paginateArray, PAGE_SIZE } from './pagination'
import { sortRows } from './sort-rows'
import type { PaginatedResult } from './pagination'
import type {
  ObligationCalendarRow,
  InvoiceBalanceRow,
  InvoicesWithLoansRow,
  InvoiceDetailData,
  InvoicesPageRow,
  InvoiceItem,
  BankAccountCard,
  BankTransaction,
  CashFlowData,
  CashFlowMonth,
  CashFlowProject,
  CurrencyAmount,
  EntityDetailData,
  EntityListItem,
  EntityLedgerGroup,
  EntityLedgerRow,
  EntitiesFilterOptions,
  FinancialPositionData,
  IgvByCurrency,
  LoanDetailData,
  LoanScheduleEntry,
  PartnerPayableDetail,
  PartnerReceivableDetail,
  Payment,
  PaymentsPageRow,
  PaymentsSummary,
  PriceFilterOptions,
  PriceHistoryRow,
  ProjectDetailData,
  ProjectListItem,
  ProjectEntitySummary,
  ProjectPartnerRow,
  ProjectPartnerSettlement,
  EntitySearchResult,
  PartnerCompanyOption,
  CategoryOption,
  CalendarBucketCounts,
  InvoiceAgingBuckets,
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


type ObligationCalendarFilters = {
  direction?: 'payable' | 'receivable'
  projectId?: string
  supplier?: string
  currency?: string
  search?: string
  bucket?: string
  sort: string
  dir: 'asc' | 'desc'
  page: number
}

type ObligationCalendarResult = {
  paginated: PaginatedResult<ObligationCalendarRow>
  bucketCounts: CalendarBucketCounts
  uniqueSuppliers: string[]
}


function getCalendarBucket(daysRemaining: number | null, daysToEndOfWeek: number): 'overdue' | 'today' | 'this-week' | 'next-30' | null {
  if (daysRemaining === null) return null
  if (daysRemaining < 0) return 'overdue'
  if (daysRemaining === 0) return 'today'
  if (daysRemaining <= daysToEndOfWeek) return 'this-week'
  if (daysRemaining <= 30) return 'next-30'
  return null
}

export async function getObligationCalendar(
  partnerIds: string[],
  filters: ObligationCalendarFilters,
  midRate: number | null = null,
): Promise<ObligationCalendarResult> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('v_obligation_calendar')
    .select('*')
    .order('due_date', { ascending: true })

  if (error) throw error
  let rows = (data ?? []) as ObligationCalendarRow[]

  // Direction filter (AP Calendar = payable, AR Calendar = receivable)
  if (filters.direction) {
    rows = rows.filter(r => r.direction === filters.direction)
  }

  // Partner filter
  if (partnerIds.length > 0) {
    rows = rows.filter((row) => {
      if (row.partner_company_id) {
        return partnerIds.includes(row.partner_company_id)
      }
      return true
    })
  }

  // Collect unique suppliers/clients for filter dropdown
  const supplierSet = new Set<string>()
  for (const r of rows) { if (r.entity_name) supplierSet.add(r.entity_name) }
  const uniqueSuppliers = Array.from(supplierSet).sort()

  // Compute bucket counts from all rows (before filters)
  const daysToEndOfWeek = getDaysUntilEndOfWeek()
  const emptyBucket = { count: 0, pen: 0, usd: 0 }
  const bucketCounts: CalendarBucketCounts = {
    overdue: { ...emptyBucket },
    today: { ...emptyBucket },
    'this-week': { ...emptyBucket },
    'next-30': { ...emptyBucket },
  }
  for (const r of rows) {
    const b = getCalendarBucket(r.days_remaining, daysToEndOfWeek)
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
    rows = rows.filter(r => getCalendarBucket(r.days_remaining, daysToEndOfWeek) === filters.bucket)
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

export async function getInvoiceDetail(invoiceId: string): Promise<InvoiceDetailData> {
  const supabase = await createServerSupabaseClient()

  const [invoiceResult, itemsResult, paymentsResult] = await Promise.all([
    supabase
      .from('v_invoice_balances')
      .select('*')
      .eq('invoice_id', invoiceId)
      .single(),
    supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at'),
    supabase
      .from('payments')
      .select('*')
      .eq('related_id', invoiceId)
      .eq('related_to', 'invoice')
      .order('payment_date'),
  ])

  return {
    invoice: invoiceResult.data as InvoiceBalanceRow | null,
    items: (itemsResult.data ?? []) as InvoiceItem[],
    payments: (paymentsResult.data ?? []) as Payment[],
  }
}



export async function getLoanDetail(loanId: string): Promise<LoanDetailData> {
  const supabase = await createServerSupabaseClient()

  const [loanResult, scheduleResult] = await Promise.all([
    supabase
      .from('v_loan_balances')
      .select('*')
      .eq('loan_id', loanId)
      .single(),
    supabase
      .from('loan_schedule')
      .select('id, loan_id, scheduled_date, scheduled_amount, exchange_rate, created_at, updated_at')
      .eq('loan_id', loanId)
      .order('scheduled_date'),
  ])

  const scheduleEntries = scheduleResult.data ?? []
  const scheduleIds = scheduleEntries.map(s => s.id)

  // Fetch all payments linked to this loan's schedule entries
  let payments: Payment[] = []
  if (scheduleIds.length > 0) {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('related_to', 'loan_schedule')
      .in('related_id', scheduleIds)
      .order('payment_date')
    payments = (data ?? []) as Payment[]
  }

  // Compute derived fields per schedule entry
  const schedule: LoanScheduleEntry[] = scheduleEntries.map(entry => {
    const entryPayments = payments.filter(p => p.related_id === entry.id)
    const amountPaid = entryPayments.reduce((sum, p) => sum + p.amount, 0)
    const outstanding = entry.scheduled_amount - amountPaid
    const status = amountPaid >= entry.scheduled_amount ? 'paid'
      : amountPaid > 0 ? 'partial'
      : 'pending'
    return { ...entry, amount_paid: amountPaid, outstanding, payment_status: status }
  })

  return {
    loan: loanResult.data,
    schedule,
    payments,
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

type ArOutstandingRow = {
  invoice_id: string
  project_id: string | null
  project_code: string
  entity_id: string | null
  client_name: string
  partner_company_id: string | null
  partner_name: string
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  days_overdue: number
  subtotal: number
  igv_amount: number
  gross_total: number
  detraccion_amount: number
  retencion_amount: number
  retencion_applicable: boolean
  retencion_rate: number | null
  retencion_verified: boolean
  net_receivable: number
  amount_paid: number
  outstanding: number
  receivable: number
  bdn_outstanding: number
  currency: string
  payment_status: string
}

type ArOutstandingResult = {
  paginated: PaginatedResult<ArOutstandingRow>
  bucketCounts: InvoiceAgingBuckets
  totals: ArOutstandingTotals
}

export type { ArOutstandingRow }

export async function getArOutstanding(
  partnerFilter: string[],
  filters: ArOutstandingFilters,
  midRate: number | null = null,
): Promise<ArOutstandingResult> {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('v_invoice_balances')
    .select('*')
    .eq('direction', 'receivable')
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
    bucketCounts: { current: { ...emptyBucket }, '1-30': { ...emptyBucket }, '31-60': { ...emptyBucket }, '61-90': { ...emptyBucket }, '90+': { ...emptyBucket } },
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
      invoice_id: i.invoice_id!,
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
      gross_total: i.total ?? 0,
      detraccion_amount: i.detraccion_amount ?? 0,
      retencion_amount: i.retencion_amount ?? 0,
      retencion_applicable: i.retencion_applicable ?? false,
      retencion_rate: i.retencion_rate,
      retencion_verified: i.retencion_verified ?? false,
      net_receivable: i.net_amount ?? 0,
      amount_paid: i.amount_paid ?? 0,
      outstanding: i.outstanding ?? 0,
      receivable: i.payable_or_receivable ?? 0,
      bdn_outstanding: i.bdn_outstanding ?? 0,
      currency: i.currency ?? 'PEN',
      payment_status: i.payment_status ?? 'pending',
    }
  })

  // Compute bucket counts from all rows (before any filters)
  const bucketCounts: InvoiceAgingBuckets = {
    current: { ...emptyBucket },
    '1-30': { ...emptyBucket },
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

export async function getClientsForFilter(): Promise<{ id: string; name: string }[]> {
  const supabase = await createServerSupabaseClient()
  // Get distinct entities that have receivable invoices
  const { data: receivables } = await supabase
    .from('invoices')
    .select('entity_id')
    .eq('direction', 'receivable')

  if (!receivables || receivables.length === 0) return []

  const entityIds = [...new Set(receivables.map(a => a.entity_id).filter((id): id is string => id !== null))]
  if (entityIds.length === 0) return []

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

// --- Invoices page queries ---

type InvoicesPageFilters = {
  direction?: 'payable' | 'receivable'
  type?: 'commercial' | 'loan'
  status?: 'pending' | 'partial' | 'paid' | 'overdue'
  projectId?: string
  entity?: string
  bucket?: string
  sort: string
  dir: 'asc' | 'desc'
  page: number
}

type InvoicesPageSummary = {
  payable: { pen: number; usd: number; commercialPen: number; commercialUsd: number; loanPen: number; loanUsd: number }
  receivable: { pen: number; usd: number }
}

type InvoicesPageResult = {
  paginated: PaginatedResult<InvoicesPageRow>
  payableBuckets: InvoiceAgingBuckets
  receivableBuckets: InvoiceAgingBuckets
  summary: InvoicesPageSummary
  uniqueEntities: string[]
}

export async function getInvoicesPage(
  partnerFilter: string[],
  filters: InvoicesPageFilters,
  midRate: number | null = null,
): Promise<InvoicesPageResult> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('v_invoices_with_loans')
    .select('*')
    .order('due_date', { ascending: false, nullsFirst: false })

  if (error) throw error

  let rows: InvoicesWithLoansRow[] = data ?? []

  // Partner filter
  if (partnerFilter.length > 0) {
    rows = rows.filter(r => r.partner_company_id && partnerFilter.includes(r.partner_company_id))
  }

  // Collect unique entity names for filter dropdown
  const entitySet = new Set<string>()
  for (const r of rows) { if (r.entity_name) entitySet.add(r.entity_name) }
  const uniqueEntities = Array.from(entitySet).sort()

  // Compute bucket counts per direction (before filters)
  const emptyBucket = { count: 0, pen: 0, usd: 0 }
  const payableBuckets: InvoiceAgingBuckets = {
    current: { ...emptyBucket }, '1-30': { ...emptyBucket }, '31-60': { ...emptyBucket }, '61-90': { ...emptyBucket }, '90+': { ...emptyBucket },
  }
  const receivableBuckets: InvoiceAgingBuckets = {
    current: { ...emptyBucket }, '1-30': { ...emptyBucket }, '31-60': { ...emptyBucket }, '61-90': { ...emptyBucket }, '90+': { ...emptyBucket },
  }
  const summary: InvoicesPageSummary = {
    payable: { pen: 0, usd: 0, commercialPen: 0, commercialUsd: 0, loanPen: 0, loanUsd: 0 },
    receivable: { pen: 0, usd: 0 },
  }

  // Only count unpaid/partial for bucket totals and summary
  for (const r of rows) {
    if (r.payment_status === 'paid') continue
    const outstanding = r.outstanding ?? 0
    if (outstanding <= 0) continue

    const bucket = (r.aging_bucket ?? 'current') as keyof InvoiceAgingBuckets
    const buckets = r.direction === 'receivable' ? receivableBuckets : payableBuckets
    if (buckets[bucket]) {
      buckets[bucket].count++
      if (r.currency === 'PEN') buckets[bucket].pen += outstanding
      else if (r.currency === 'USD') {
        buckets[bucket].usd += outstanding
        if (midRate) buckets[bucket].pen += outstanding * midRate
      }
    }

    // Summary totals
    if (r.direction === 'receivable') {
      if (r.currency === 'PEN') summary.receivable.pen += outstanding
      else if (r.currency === 'USD') summary.receivable.usd += outstanding
    } else {
      if (r.currency === 'PEN') {
        summary.payable.pen += outstanding
        if (r.type === 'loan') summary.payable.loanPen += outstanding
        else summary.payable.commercialPen += outstanding
      } else if (r.currency === 'USD') {
        summary.payable.usd += outstanding
        if (r.type === 'loan') summary.payable.loanUsd += outstanding
        else summary.payable.commercialUsd += outstanding
      }
    }
  }

  // Apply filters
  if (filters.direction) {
    rows = rows.filter(r => r.direction === filters.direction)
  }
  if (filters.type) {
    rows = rows.filter(r => r.type === filters.type)
  }
  if (filters.status) {
    if (filters.status === 'overdue') {
      rows = rows.filter(r => r.payment_status !== 'paid' && (r.days_overdue ?? 0) > 0)
    } else {
      rows = rows.filter(r => r.payment_status === filters.status)
    }
  }
  if (filters.projectId) {
    rows = rows.filter(r => r.project_id === filters.projectId)
  }
  if (filters.entity) {
    const search = filters.entity.toLowerCase()
    rows = rows.filter(r => (r.entity_name ?? '').toLowerCase().includes(search))
  }
  if (filters.bucket && filters.bucket !== 'all') {
    rows = rows.filter(r => r.aging_bucket === filters.bucket)
  }

  // Map to InvoicesPageRow
  const mapped: InvoicesPageRow[] = rows.map(r => ({
    id: r.id!,
    type: (r.type as 'commercial' | 'loan') ?? 'commercial',
    direction: (r.direction as 'payable' | 'receivable') ?? 'payable',
    partner_company_id: r.partner_company_id,
    project_id: r.project_id,
    project_code: r.project_code,
    entity_id: r.entity_id,
    entity_name: r.entity_name,
    title: r.title,
    invoice_number: r.invoice_number,
    invoice_date: r.invoice_date,
    due_date: r.due_date,
    currency: r.currency ?? 'PEN',
    total: r.total ?? 0,
    amount_paid: r.amount_paid ?? 0,
    outstanding: r.outstanding ?? 0,
    payment_status: r.payment_status ?? 'pending',
    loan_id: r.loan_id,
  }))

  // Sort and paginate
  const sorted = sortRows(mapped, filters.sort, filters.dir)
  const paginated = paginateArray(sorted, filters.page)

  return { paginated, payableBuckets, receivableBuckets, summary, uniqueEntities }
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
  payableBalances: { invoice_id: string; project_id: string | null; due_date: string | null; outstanding: number; currency: string; exchange_rate: number | null; cost_type: string | null; partner_company_id: string | null }[]
  receivableBalances: { invoice_id: string; project_id: string | null; due_date: string | null; outstanding: number; currency: string; exchange_rate: number; partner_company_id: string | null }[]
  loanSchedule: { id: string; loan_id: string; scheduled_date: string; scheduled_amount: number; exchange_rate: number | null; loans: { currency: string; project_id: string | null; partner_company_id: string | null }[] }[]
  loanDisbursements: { id: string; amount: number; currency: string; exchange_rate: number | null; date_borrowed: string; project_id: string | null; partner_company_id: string }[]
  allProjects: { id: string; project_code: string; name: string }[]
  forecastRate: number | null
}

type CashFlowMaps = {
  invoiceProjectMap: Map<string, string | null>
  invoiceTypeMap: Map<string, string>
  invoiceDirectionMap: Map<string, string>
  invoiceCategoryMap: Map<string, { category: string; proportion: number }[]>
  loanProjectMap: Map<string, string | null>
  loanPartnerMap: Map<string, string | null>
  scheduleToLoanMap: Map<string, string>
}

async function fetchCashFlowData(supabase: SupabaseClient, year: number): Promise<CashFlowRawData> {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const [
    paymentsResult,
    payableBalancesResult,
    receivableBalancesResult,
    loanScheduleResult,
    loansResult,
    latestRate,
    projectsResult,
  ] = await Promise.all([
    supabase
      .from('payments')
      .select('id, related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, partner_company_id')
      .gte('payment_date', yearStart)
      .lte('payment_date', yearEnd),
    supabase
      .from('v_invoice_balances')
      .select('invoice_id, project_id, due_date, outstanding, currency, exchange_rate, cost_type, partner_company_id')
      .eq('direction', 'payable')
      .in('payment_status', ['pending', 'partial'])
      .not('due_date', 'is', null),
    supabase
      .from('v_invoice_balances')
      .select('invoice_id, project_id, due_date, outstanding, currency, exchange_rate, partner_company_id')
      .eq('direction', 'receivable')
      .in('payment_status', ['pending', 'partial'])
      .not('due_date', 'is', null),
    supabase
      .from('loan_schedule')
      .select('id, loan_id, scheduled_date, scheduled_amount, exchange_rate, loans!fk_loan_schedule_loans(currency, project_id, partner_company_id)'),
    supabase
      .from('loans')
      .select('id, amount, currency, exchange_rate, date_borrowed, project_id, partner_company_id')
      .gte('date_borrowed', yearStart)
      .lte('date_borrowed', yearEnd),
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
    payableBalances: payableBalancesResult.data ?? [],
    receivableBalances: receivableBalancesResult.data ?? [],
    loanSchedule: loanScheduleResult.data ?? [],
    loanDisbursements: loansResult.data ?? [],
    allProjects: projectsResult.data ?? [],
    forecastRate: latestRate.data ? Number(latestRate.data.mid_rate) : null,
  }
}

async function buildCashFlowMaps(
  supabase: SupabaseClient,
  raw: CashFlowRawData,
  hasPartnerFilter: boolean,
): Promise<CashFlowMaps> {
  // Collect relevant invoice_ids, then fetch invoice_items only for those
  const relevantInvoiceIds = new Set<string>()
  for (const ib of raw.payableBalances) {
    if (ib.invoice_id) relevantInvoiceIds.add(ib.invoice_id)
  }
  for (const p of raw.payments) {
    if (p.related_to === 'invoice' && p.related_id) relevantInvoiceIds.add(p.related_id)
  }
  const invoiceItems: { invoice_id: string; category: string; subtotal: number }[] = []
  if (relevantInvoiceIds.size > 0) {
    const { data } = await supabase
      .from('invoice_items')
      .select('invoice_id, category, subtotal')
      .in('invoice_id', [...relevantInvoiceIds])
    if (data) invoiceItems.push(...data)
  }

  // invoice_id -> project_id, cost_type, and direction from balance data
  const invoiceProjectMap = new Map<string, string | null>()
  const invoiceTypeMap = new Map<string, string>()
  const invoiceDirectionMap = new Map<string, string>()
  for (const ib of raw.payableBalances) {
    if (ib.invoice_id) {
      invoiceProjectMap.set(ib.invoice_id, ib.project_id)
      if (ib.cost_type) invoiceTypeMap.set(ib.invoice_id, ib.cost_type)
      invoiceDirectionMap.set(ib.invoice_id, 'payable')
    }
  }
  for (const ib of raw.receivableBalances) {
    if (ib.invoice_id) {
      invoiceProjectMap.set(ib.invoice_id, ib.project_id)
      invoiceDirectionMap.set(ib.invoice_id, 'receivable')
    }
  }

  // Fetch invoice project_ids/cost_types/direction for payments referencing already-paid invoices
  const paymentInvoiceIds = raw.payments
    .filter(p => p.related_to === 'invoice')
    .map(p => p.related_id)
    .filter(id => !invoiceProjectMap.has(id))
  if (paymentInvoiceIds.length > 0) {
    const { data: extraInvoices } = await supabase
      .from('invoices')
      .select('id, project_id, cost_type, direction')
      .in('id', paymentInvoiceIds)
    for (const inv of extraInvoices ?? []) {
      invoiceProjectMap.set(inv.id, inv.project_id)
      if (inv.cost_type) invoiceTypeMap.set(inv.id, inv.cost_type)
      invoiceDirectionMap.set(inv.id, inv.direction)
    }
  }

  // invoice_id -> category proportions
  const invoiceCategoryMap = new Map<string, { category: string; proportion: number }[]>()
  const invoiceSubtotals = new Map<string, number>()
  for (const item of invoiceItems) {
    invoiceSubtotals.set(item.invoice_id, (invoiceSubtotals.get(item.invoice_id) ?? 0) + (item.subtotal ?? 0))
  }
  for (const item of invoiceItems) {
    const total = invoiceSubtotals.get(item.invoice_id) ?? 1
    const entries = invoiceCategoryMap.get(item.invoice_id) ?? []
    entries.push({
      category: item.category,
      proportion: total > 0 ? (item.subtotal ?? 0) / total : 0,
    })
    invoiceCategoryMap.set(item.invoice_id, entries)
  }

  // loan_id -> project_id + partner_company_id
  const loanProjectMap = new Map<string, string | null>()
  const loanPartnerMap = new Map<string, string | null>()
  for (const loan of raw.loanDisbursements) {
    loanProjectMap.set(loan.id, loan.project_id)
    loanPartnerMap.set(loan.id, loan.partner_company_id)
  }

  // schedule_entry_id -> loan_id (for mapping loan repayment payments to loans)
  const scheduleToLoanMap = new Map<string, string>()
  for (const entry of raw.loanSchedule) {
    scheduleToLoanMap.set(entry.id, entry.loan_id)
    // Also populate loan maps from schedule entry data if not already present
    if (!loanProjectMap.has(entry.loan_id)) {
      const loanData = (entry.loans?.[0] ?? null) as { currency: string; project_id: string | null; partner_company_id: string | null } | null
      if (loanData) {
        loanProjectMap.set(entry.loan_id, loanData.project_id)
        loanPartnerMap.set(entry.loan_id, loanData.partner_company_id)
      }
    }
  }

  // Fetch loan info for any loan_schedule payments referencing loans we haven't seen
  const loanRepaymentScheduleIds = raw.payments
    .filter(p => p.related_to === 'loan_schedule')
    .map(p => p.related_id)
    .filter(id => !scheduleToLoanMap.has(id))
  if (loanRepaymentScheduleIds.length > 0) {
    const { data: extraSchedule } = await supabase
      .from('loan_schedule')
      .select('id, loan_id')
      .in('id', loanRepaymentScheduleIds)
    for (const s of extraSchedule ?? []) {
      scheduleToLoanMap.set(s.id, s.loan_id)
    }
    const missingLoanIds = [...new Set((extraSchedule ?? []).map(s => s.loan_id))]
      .filter(id => !loanProjectMap.has(id))
    if (missingLoanIds.length > 0) {
      const { data: extraLoans } = await supabase
        .from('loans')
        .select('id, project_id, partner_company_id')
        .in('id', missingLoanIds)
      for (const l of extraLoans ?? []) {
        loanProjectMap.set(l.id, l.project_id)
        loanPartnerMap.set(l.id, l.partner_company_id)
      }
    }
  }

  return { invoiceProjectMap, invoiceTypeMap, invoiceDirectionMap, invoiceCategoryMap, loanProjectMap, loanPartnerMap, scheduleToLoanMap }
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

    // Loan schedule repayments
    if (p.related_to === 'loan_schedule') {
      const loanId = maps.scheduleToLoanMap.get(p.related_id)
      if (projectId && loanId) {
        const lpProjectId = maps.loanProjectMap.get(loanId)
        if (lpProjectId !== projectId) continue
      }
      const monthKey = toMonthKey(p.payment_date)
      const bucket = monthBuckets.get(monthKey)
      if (!bucket) continue
      bucket.loanRepayment += convertAmount(p.amount, p.currency, p.exchange_rate, reportingCurrency)
      continue
    }

    // Invoice payments (both payable and receivable)
    const pProjectId = maps.invoiceProjectMap.get(p.related_id)
    if (projectId && pProjectId !== projectId) continue

    const monthKey = toMonthKey(p.payment_date)
    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    const amount = convertAmount(p.amount, p.currency, p.exchange_rate, reportingCurrency)
    if (p.direction === 'inbound') {
      const projId = pProjectId ?? '_none'
      bucket.cashInByProject[projId] = (bucket.cashInByProject[projId] ?? 0) + amount
    } else {
      const categories = maps.invoiceCategoryMap.get(p.related_id)
      const costType = maps.invoiceTypeMap.get(p.related_id) ?? null
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

  // Forecast: outstanding payable invoices by due_date
  for (const inv of raw.payableBalances) {
    if (!inv.due_date) continue
    const monthKey = toMonthKey(inv.due_date)
    if (monthKey <= currentMonthKey || monthKey < `${year}-01` || monthKey > `${year}-12`) continue
    if (projectId && inv.project_id !== projectId) continue
    if (hasPartnerFilter && inv.partner_company_id) {
      if (!partnerIds.includes(inv.partner_company_id)) continue
    }

    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    const amount = convertAmount(inv.outstanding ?? 0, inv.currency, raw.forecastRate ?? inv.exchange_rate ?? null, reportingCurrency)
    const categories = inv.invoice_id ? maps.invoiceCategoryMap.get(inv.invoice_id) : null
    const costType = inv.invoice_id ? (maps.invoiceTypeMap.get(inv.invoice_id) ?? inv.cost_type ?? null) : null
    if (categories && categories.length > 0) {
      for (const cat of categories) {
        const catKey = mapCategory(cat.category, costType, sgaKeys)
        bucket.categories[catKey] += amount * cat.proportion
      }
    } else {
      bucket.categories.other += amount
    }
  }

  // Forecast: outstanding receivable invoices by due_date
  for (const inv of raw.receivableBalances) {
    if (!inv.due_date) continue
    const monthKey = toMonthKey(inv.due_date)
    if (monthKey <= currentMonthKey || monthKey < `${year}-01` || monthKey > `${year}-12`) continue
    if (projectId && inv.project_id !== projectId) continue
    if (hasPartnerFilter && inv.partner_company_id && !partnerIds.includes(inv.partner_company_id)) continue

    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    const projId = inv.project_id ?? '_none'
    const amount = convertAmount(inv.outstanding ?? 0, inv.currency, raw.forecastRate ?? inv.exchange_rate, reportingCurrency)
    bucket.cashInByProject[projId] = (bucket.cashInByProject[projId] ?? 0) + amount
  }

  // Forecast: loan schedule (only entries not yet fully paid)
  // Build a set of paid amounts per schedule entry from actual payments
  const schedulePaidAmounts = new Map<string, number>()
  for (const p of raw.payments) {
    if (p.related_to === 'loan_schedule') {
      schedulePaidAmounts.set(p.related_id, (schedulePaidAmounts.get(p.related_id) ?? 0) + p.amount)
    }
  }

  for (const entry of raw.loanSchedule) {
    if (!entry.scheduled_date) continue
    const paidAmount = schedulePaidAmounts.get(entry.id) ?? 0
    const remaining = entry.scheduled_amount - paidAmount
    if (remaining <= 0) continue // fully paid

    const monthKey = toMonthKey(entry.scheduled_date)
    if (monthKey <= currentMonthKey || monthKey < `${year}-01` || monthKey > `${year}-12`) continue

    const loanData = (entry.loans?.[0] ?? null) as { currency: string; project_id: string | null; partner_company_id: string | null } | null
    if (projectId && loanData?.project_id !== projectId) continue
    if (hasPartnerFilter && loanData?.partner_company_id && !partnerIds.includes(loanData.partner_company_id)) continue

    const bucket = monthBuckets.get(monthKey)
    if (!bucket) continue

    const loanCurrency = loanData?.currency ?? 'PEN'
    bucket.loanRepayment += convertAmount(remaining, loanCurrency, raw.forecastRate ?? entry.exchange_rate ?? null, reportingCurrency)
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

export async function getPartnerPayableDetails(
  projectId: string,
  partnerCompanyId: string,
): Promise<PartnerPayableDetail[]> {
  const supabase = await createServerSupabaseClient()

  // Get all payable invoices for this project by this partner
  const { data: invoices, error } = await supabase
    .from('v_invoice_totals')
    .select('invoice_id, invoice_date, invoice_number, currency, subtotal, exchange_rate')
    .eq('direction', 'payable')
    .eq('project_id', projectId)
    .eq('partner_company_id', partnerCompanyId)
    .order('invoice_date', { ascending: false })

  if (error) throw error
  if (!invoices || invoices.length === 0) return []

  return invoices.map(inv => {
    const subtotal = inv.subtotal ?? 0
    const rate = inv.exchange_rate ? Number(inv.exchange_rate) : 1
    return {
      invoice_id: inv.invoice_id!,
      date: inv.invoice_date,
      invoice_number: inv.invoice_number,
      subtotal,
      currency: inv.currency,
      exchange_rate: inv.exchange_rate ? Number(inv.exchange_rate) : null,
      subtotal_pen: inv.currency === 'USD' ? Math.round(subtotal * rate * 100) / 100 : subtotal,
    }
  })
}

export async function getPartnerReceivableDetails(
  projectId: string,
  partnerCompanyId: string,
): Promise<PartnerReceivableDetail[]> {
  const supabase = await createServerSupabaseClient()

  // Get receivable invoices for this project+partner
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, currency')
    .eq('direction', 'receivable')
    .eq('project_id', projectId)
    .eq('partner_company_id', partnerCompanyId)

  if (!invoices || invoices.length === 0) return []

  const invoiceIds = invoices.map(a => a.id)
  const invoiceMap = new Map(invoices.map(a => [a.id, a]))

  // Get payments linked to these receivable invoices
  const { data: payments } = await supabase
    .from('payments')
    .select('id, related_id, payment_date, amount, currency, exchange_rate')
    .in('related_id', invoiceIds)
    .eq('related_to', 'invoice')
    .order('payment_date', { ascending: false })

  return (payments ?? []).map(p => {
    const inv = invoiceMap.get(p.related_id)
    const currency = p.currency ?? inv?.currency ?? 'PEN'
    const amount = p.amount ?? 0
    const rate = p.exchange_rate ? Number(p.exchange_rate) : 1
    return {
      payment_id: p.id,
      payment_date: p.payment_date,
      invoice_number: inv?.invoice_number ?? null,
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
    supabase.from('v_invoice_balances').select('outstanding, currency, payment_status, partner_company_id').eq('direction', 'receivable'),
    supabase.from('v_invoice_balances').select('outstanding, currency, payment_status, partner_company_id').eq('direction', 'payable'),
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
  const invoiceIds = payments
    .filter(p => p.related_to === 'invoice')
    .map(p => p.related_id)
    .filter((id): id is string => id !== null)

  let invoiceData: { id: string; entity_id: string | null; project_id: string | null; title: string | null; invoice_number: string | null; direction: string }[] = []
  if (invoiceIds.length > 0) {
    const { data } = await supabase
      .from('invoices')
      .select('id, entity_id, project_id, title, invoice_number, direction')
      .in('id', invoiceIds)
    invoiceData = data ?? []
  }

  // Get entity and project names
  const entityIds = invoiceData.map(inv => inv.entity_id).filter((id): id is string => id !== null)
  const projectIds = invoiceData.map(inv => inv.project_id).filter((id): id is string => id !== null)

  const [entityMap, projectMap] = await Promise.all([
    buildEntityNameMap(supabase, [...new Set(entityIds)]),
    buildProjectCodeMap(supabase, [...new Set(projectIds)]),
  ])

  const invoiceMap = new Map(invoiceData.map(inv => [inv.id, inv]))

  return payments.map(p => {
    let entityName: string | null = null
    let projectCode: string | null = null
    let description: string | null = null

    if (p.related_to === 'invoice' && p.related_id) {
      const inv = invoiceMap.get(p.related_id)
      if (inv) {
        entityName = inv.entity_id ? entityMap.get(inv.entity_id) ?? null : null
        projectCode = inv.project_id ? projectMap.get(inv.project_id) ?? null : null
        description = inv.direction === 'receivable'
          ? (inv.invoice_number ? `Invoice ${inv.invoice_number}` : null)
          : inv.title ?? null
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

  // 2. Spending by entity: query v_invoice_totals for payable invoices, group by (entity_id, currency)
  const { data: costTotals } = await supabase
    .from('v_invoice_totals')
    .select('entity_id, currency, subtotal')
    .eq('direction', 'payable')
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

  // 7. Partner settlements — compute cost contributions + AR payments received
  let partnerSettlements: ProjectPartnerSettlement[] = []
  if (partners.length > 0) {
    // Fetch project costs per partner from v_invoice_totals (project_cost only, SGA excluded)
    const { data: costTotals } = await supabase
      .from('v_invoice_totals')
      .select('partner_company_id, subtotal, currency, exchange_rate')
      .eq('direction', 'payable')
      .eq('project_id', projectId)
      .eq('cost_type', 'project_cost')

    // Sum cost contributions per partner in PEN
    const costsByPartner = new Map<string, number>()
    for (const ct of costTotals ?? []) {
      if (!ct.partner_company_id) continue
      const subtotal = ct.subtotal ?? 0
      const rate = ct.exchange_rate ? Number(ct.exchange_rate) : 1
      const amountPen = ct.currency === 'USD' ? subtotal * rate : subtotal
      costsByPartner.set(ct.partner_company_id, (costsByPartner.get(ct.partner_company_id) ?? 0) + amountPen)
    }

    // Get actual AR payments received per partner
    const { data: projectReceivables } = await supabase
      .from('invoices')
      .select('id, partner_company_id, currency')
      .eq('direction', 'receivable')
      .eq('project_id', projectId)

    const receivableIds = (projectReceivables ?? []).map(a => a.id)
    const receivedByPartner = new Map<string, number>()

    if (receivableIds.length > 0) {
      const { data: arPayments } = await supabase
        .from('payments')
        .select('related_id, amount, currency, exchange_rate')
        .in('related_id', receivableIds)
        .eq('related_to', 'invoice')

      const receivablePartnerMap = new Map<string, { partner_company_id: string; currency: string }>()
      for (const inv of projectReceivables ?? []) {
        if (inv.partner_company_id) {
          receivablePartnerMap.set(inv.id, { partner_company_id: inv.partner_company_id, currency: inv.currency })
        }
      }

      for (const p of arPayments ?? []) {
        const invInfo = receivablePartnerMap.get(p.related_id)
        if (!invInfo) continue
        const paymentCurrency = p.currency ?? invInfo.currency
        const amount = p.amount ?? 0
        const rate = p.exchange_rate ? Number(p.exchange_rate) : 1
        const amountPen = paymentCurrency === 'USD' ? amount * rate : amount
        receivedByPartner.set(invInfo.partner_company_id, (receivedByPartner.get(invInfo.partner_company_id) ?? 0) + amountPen)
      }
    }

    // Compute total project profit (sum of all revenue received - sum of all costs)
    const totalCosts = [...costsByPartner.values()].reduce((sum, v) => sum + v, 0)
    const totalRevenue = [...receivedByPartner.values()].reduce((sum, v) => sum + v, 0)
    const totalProjectProfit = totalRevenue - totalCosts

    // Build settlement rows — one per partner
    partnerSettlements = partners.map(p => {
      const costsContributed = costsByPartner.get(p.partnerCompanyId) ?? 0
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

  const [entityResult, tagsResult, contactsResult, payablesResult, receivablesResult] = await Promise.all([
    supabase.from('entities').select('*').eq('id', entityId).single(),
    supabase.from('entity_tags').select('tag_id, tags(name)').eq('entity_id', entityId),
    supabase
      .from('entity_contacts')
      .select('*')
      .eq('entity_id', entityId)
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('v_invoice_balances')
      .select('invoice_id, project_id, invoice_date, title, currency, total, outstanding')
      .eq('direction', 'payable')
      .eq('entity_id', entityId)
      .order('invoice_date', { ascending: false }),
    supabase
      .from('v_invoice_balances')
      .select('invoice_id, project_id, invoice_date, invoice_number, notes, currency, total, outstanding')
      .eq('direction', 'receivable')
      .eq('entity_id', entityId)
      .order('invoice_date', { ascending: false }),
  ])

  if (entityResult.error) throw entityResult.error

  const tags = (tagsResult.data ?? [])
    .map(t => {
      const name = (t.tags as unknown as { name: string } | null)?.name
      return name ? { tagId: t.tag_id, name } : null
    })
    .filter((t): t is { tagId: string; name: string } => t !== null)

  // Collect all project IDs to fetch codes/names
  const projectIds = new Set<string>()
  for (const c of payablesResult.data ?? []) if (c.project_id) projectIds.add(c.project_id)
  for (const a of receivablesResult.data ?? []) if (a.project_id) projectIds.add(a.project_id)

  const projectMap = new Map<string, { code: string; name: string }>()
  if (projectIds.size > 0) {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, project_code, name')
      .in('id', [...projectIds])
    for (const p of projects ?? []) {
      projectMap.set(p.id, { code: p.project_code, name: p.name })
    }
  }

  // Group payables by (project_id, currency)
  const payablesByProject = groupLedger(
    (payablesResult.data ?? []).map(c => ({
      transactionId: c.invoice_id,
      projectId: c.project_id,
      date: c.invoice_date,
      title: c.title,
      currency: c.currency ?? 'PEN',
      invoiceTotal: c.total ?? 0,
      outstanding: c.outstanding ?? 0,
    })),
    projectMap,
  )

  // Group receivables by (project_id, currency)
  const receivablesByProject = groupLedger(
    (receivablesResult.data ?? []).map(a => ({
      transactionId: a.invoice_id,
      projectId: a.project_id,
      date: a.invoice_date,
      title: a.notes ?? (a.invoice_number ? `Invoice ${a.invoice_number}` : null),
      currency: a.currency ?? 'PEN',
      invoiceTotal: a.total ?? 0,
      outstanding: a.outstanding ?? 0,
    })),
    projectMap,
  )

  return {
    entity: entityResult.data,
    tags,
    contacts: contactsResult.data ?? [],
    payablesByProject,
    receivablesByProject,
  }
}

type RawLedgerRow = {
  transactionId: string | null
  projectId: string | null
  date: string | null
  title: string | null
  currency: string
  invoiceTotal: number
  outstanding: number
}

function groupLedger(
  rows: RawLedgerRow[],
  projectMap: Map<string, { code: string; name: string }>,
): EntityLedgerGroup[] {
  const groups = new Map<string, EntityLedgerGroup>()

  for (const row of rows) {
    const key = `${row.projectId ?? '__none__'}|${row.currency}`
    const existing = groups.get(key)
    const proj = row.projectId ? projectMap.get(row.projectId) : null
    const txRow: EntityLedgerRow = {
      transactionId: row.transactionId ?? '',
      date: row.date,
      title: row.title,
      invoiceTotal: row.invoiceTotal,
      outstanding: row.outstanding,
      currency: row.currency,
    }

    if (existing) {
      existing.invoiceTotal += row.invoiceTotal
      existing.outstanding += row.outstanding
      if (row.date && (!existing.lastDate || row.date > existing.lastDate)) {
        existing.lastDate = row.date
      }
      existing.transactions.push(txRow)
    } else {
      groups.set(key, {
        projectId: row.projectId ?? '',
        projectCode: proj?.code ?? '—',
        projectName: proj?.name ?? '—',
        invoiceTotal: row.invoiceTotal,
        outstanding: row.outstanding,
        lastDate: row.date,
        currency: row.currency,
        transactions: [txRow],
      })
    }
  }

  return [...groups.values()].sort((a, b) => b.invoiceTotal - a.invoiceTotal)
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

  // Fetch invoice_items with their parent invoice header info, and quotes in parallel
  const [invoiceItemsResult, invoicesResult, quotesResult] = await Promise.all([
    supabase.from('invoice_items').select('id, invoice_id, title, category, quantity, unit_of_measure, unit_price'),
    supabase
      .from('invoices')
      .select('id, entity_id, project_id, invoice_date, currency')
      .eq('direction', 'payable')
      .eq('cost_type', 'project_cost'),
    supabase.from('quotes').select('id, entity_id, project_id, date_received, title, quantity, unit_of_measure, unit_price, currency'),
  ])

  const invoiceItems = invoiceItemsResult.data ?? []
  const payableInvoices = invoicesResult.data ?? []
  const quotes = quotesResult.data ?? []

  // Build invoice_id -> invoice header map
  const invoiceHeaderMap = new Map(payableInvoices.map(c => [c.id, c]))

  // Collect all entity and project IDs for lookups
  const allEntityIds = new Set<string>()
  const allProjectIds = new Set<string>()

  for (const c of payableInvoices) {
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

  // Build result: invoice_items
  let rows: PriceHistoryRow[] = []

  for (const item of invoiceItems) {
    const inv = invoiceHeaderMap.get(item.invoice_id)
    if (!inv) continue // skip invoice_items without matching project_cost header

    rows.push({
      id: item.id,
      date: inv.invoice_date ?? '',
      source: 'invoice',
      entityId: inv.entity_id,
      entityName: inv.entity_id ? entityNameMap.get(inv.entity_id) ?? '—' : '—',
      projectId: inv.project_id,
      projectCode: inv.project_id ? projectCodeMap.get(inv.project_id) ?? '—' : '—',
      title: item.title ?? '',
      category: item.category,
      quantity: item.quantity,
      unit_of_measure: item.unit_of_measure,
      unit_price: item.unit_price,
      currency: inv.currency ?? 'PEN',
      entityTags: inv.entity_id ? entityTagsMap.get(inv.entity_id) ?? [] : [],
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
    supabase.from('invoice_items').select('category'),
  ])

  // Distinct categories
  const categories = [...new Set(
    (categoriesResult.data ?? []).map(c => c.category).filter(Boolean)
  )] as string[]

  // Get entities that appear in payable invoices or quotes
  const [invoiceEntitiesResult, quoteEntitiesResult] = await Promise.all([
    supabase.from('invoices').select('entity_id').eq('direction', 'payable').eq('cost_type', 'project_cost').not('entity_id', 'is', null),
    supabase.from('quotes').select('entity_id').not('entity_id', 'is', null),
  ])

  const entityIds = [...new Set([
    ...(invoiceEntitiesResult.data ?? []).map(c => c.entity_id),
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
