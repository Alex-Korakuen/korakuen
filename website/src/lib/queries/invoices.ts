import { createServerSupabaseClient } from '../supabase/server'
import { DEFAULT_CURRENCY } from './shared'
import { paginateArray } from '../pagination'
import { sortRows } from '../sort-rows'
import type { PaginatedResult } from '../pagination'
import type {
  Currency,
  InvoiceBalanceRow,
  InvoicesWithLoansRow,
  InvoiceDetailData,
  InvoicesPageRow,
  InvoiceItem,
  LoanDetailData,
  LoanScheduleEntry,
  Payment,
} from '../types'

type InvoicesPageFilters = {
  direction?: 'payable' | 'receivable'
  type?: 'commercial' | 'loan'
  status?: 'pending' | 'partial' | 'paid' | 'overdue'
  projectId?: string
  entity?: string

  search?: string
  sort: string
  dir: 'asc' | 'desc'
  page: number
}

type InvoicesPageResult = {
  paginated: PaginatedResult<InvoicesPageRow>
  uniqueEntities: string[]
}

export async function getInvoicesPage(
  filters: InvoicesPageFilters,
): Promise<InvoicesPageResult> {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('v_invoices_with_loans')
    .select('*')
    .order('due_date', { ascending: false, nullsFirst: false })

  const { data, error } = await query

  if (error) throw error

  let rows: InvoicesWithLoansRow[] = data ?? []

  // Collect unique entity names for filter dropdown
  const entitySet = new Set<string>()
  for (const r of rows) { if (r.entity_name) entitySet.add(r.entity_name) }
  const uniqueEntities = Array.from(entitySet).sort()

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

  if (filters.search) {
    const term = filters.search.toLowerCase()
    rows = rows.filter(r =>
      (r.invoice_number ?? '').toLowerCase().includes(term) ||
      (r.entity_name ?? '').toLowerCase().includes(term)
    )
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
    currency: (r.currency ?? DEFAULT_CURRENCY) as Currency,
    total: r.total ?? 0,
    amount_paid: r.amount_paid ?? 0,
    outstanding: r.outstanding ?? 0,
    bdn_outstanding: r.bdn_outstanding ?? 0,
    bdn_outstanding_pen: r.bdn_outstanding_pen ?? 0,
    payment_status: (r.payment_status ?? 'pending') as 'pending' | 'partial' | 'paid',
    loan_id: r.loan_id,
  }))

  const sorted = sortRows(mapped, filters.sort, filters.dir)
  const paginated = paginateArray(sorted, filters.page, 10)

  return { paginated, uniqueEntities }
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
      .eq('is_active', true)
      .order('payment_date'),
  ])

  if (invoiceResult.error) throw invoiceResult.error
  if (itemsResult.error) throw itemsResult.error
  if (paymentsResult.error) throw paymentsResult.error

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

  if (loanResult.error) throw loanResult.error
  if (scheduleResult.error) throw scheduleResult.error

  const scheduleEntries = scheduleResult.data ?? []
  const scheduleIds = scheduleEntries.map(s => s.id)

  let payments: Payment[] = []
  if (scheduleIds.length > 0) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('related_to', 'loan_schedule')
      .in('related_id', scheduleIds)
      .eq('is_active', true)
      .order('payment_date')
    if (error) throw error
    payments = (data ?? []) as Payment[]
  }

  const schedule: LoanScheduleEntry[] = scheduleEntries.map(entry => {
    const entryPayments = payments.filter(p => p.related_id === entry.id)
    const amountPaid = entryPayments.reduce((sum, p) => sum + p.amount, 0)
    const outstanding = entry.scheduled_amount - amountPaid
    const status = amountPaid >= entry.scheduled_amount ? 'paid'
      : amountPaid > 0 ? 'partial'
      : 'pending'
    return { ...entry, amount_paid: amountPaid, outstanding, payment_status: status }
  })

  const loanData = loanResult.data
  return {
    loan: { ...loanData, currency: loanData.currency as Currency | null },
    schedule,
    payments,
  }
}
