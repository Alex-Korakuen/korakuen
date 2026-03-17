import { createServerSupabaseClient } from '../supabase/server'
import { paginateArray } from '../pagination'
import { sortRows } from '../sort-rows'
import { getPaymentBucket } from '../date-utils'
import type { PaginatedResult } from '../pagination'
import type {
  PaymentsPageRow,
  PaymentsSummary,
  PaymentBucketId,
  PaymentBucketSummary,
} from '../types'

type PaymentsPageFilters = {
  direction?: 'inbound' | 'outbound'
  paymentType?: 'regular' | 'detraccion' | 'retencion'
  relatedTo?: 'invoice' | 'loan_schedule'
  projectId?: string
  bankAccountId?: string
  sort: string
  dir: 'asc' | 'desc'
  page: number
}

type PaymentsPageResult = {
  paginated: PaginatedResult<PaymentsPageRow>
  summary: PaymentsSummary
  uniqueProjects: { id: string; project_code: string }[]
  uniqueBankAccounts: { id: string; label: string }[]
}

export async function getPaymentsPage(
  partnerFilter: string[],
  filters: PaymentsPageFilters,
): Promise<PaymentsPageResult> {
  const supabase = await createServerSupabaseClient()

  let paymentsQuery = supabase
    .from('v_payments_enriched')
    .select('*')
    .order('payment_date', { ascending: false })

  // Push partner filter to database
  if (partnerFilter.length > 0) {
    paymentsQuery = paymentsQuery.in('partner_company_id', partnerFilter)
  }

  const { data, error } = await paymentsQuery

  if (error) throw error

  let rows = data ?? []

  // Collect unique projects and bank accounts for filter dropdowns
  const projectMap = new Map<string, string>()
  const bankMap = new Map<string, string>()
  for (const r of rows) {
    if (r.project_id && r.project_code) projectMap.set(r.project_id, r.project_code)
    if (r.bank_account_id && r.bank_name) bankMap.set(r.bank_account_id, r.bank_name)
  }
  const uniqueProjects = Array.from(projectMap, ([id, project_code]) => ({ id, project_code }))
    .sort((a, b) => a.project_code.localeCompare(b.project_code))
  const uniqueBankAccounts = Array.from(bankMap, ([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))

  // Compute summary with bucket breakdowns (before filters, after partner filter)
  const emptyBucket = (): PaymentBucketSummary => ({
    inflows: { pen: 0, usd: 0 },
    outflows: { pen: 0, usd: 0 },
    net: { pen: 0, usd: 0 },
    count: 0,
  })
  const buckets: Record<PaymentBucketId, PaymentBucketSummary> = {
    'today': emptyBucket(),    // unused — folded into last-30
    'last-7': emptyBucket(),   // unused — folded into last-30
    'last-30': emptyBucket(),
    'previous': emptyBucket(),
  }
  const summary: PaymentsSummary = {
    inflows: { pen: 0, usd: 0 },
    outflows: { pen: 0, usd: 0 },
    net: { pen: 0, usd: 0 },
    buckets,
  }
  for (const r of rows) {
    const amt = r.amount ?? 0
    const rawBucket = r.payment_date ? getPaymentBucket(r.payment_date) : 'previous'
    // Fold today and last-7 into last-30 for the single-bucket summary
    const bucketId: PaymentBucketId = (rawBucket === 'today' || rawBucket === 'last-7') ? 'last-30' : rawBucket
    const bucket = buckets[bucketId]
    bucket.count++
    if (r.direction === 'inbound') {
      if (r.currency === 'PEN') { summary.inflows.pen += amt; bucket.inflows.pen += amt }
      else if (r.currency === 'USD') { summary.inflows.usd += amt; bucket.inflows.usd += amt }
    } else {
      if (r.currency === 'PEN') { summary.outflows.pen += amt; bucket.outflows.pen += amt }
      else if (r.currency === 'USD') { summary.outflows.usd += amt; bucket.outflows.usd += amt }
    }
  }
  summary.net.pen = summary.inflows.pen - summary.outflows.pen
  summary.net.usd = summary.inflows.usd - summary.outflows.usd
  for (const b of Object.values(buckets)) {
    b.net.pen = b.inflows.pen - b.outflows.pen
    b.net.usd = b.inflows.usd - b.outflows.usd
  }

  // Apply filters
  if (filters.direction) {
    rows = rows.filter(r => r.direction === filters.direction)
  }
  if (filters.paymentType) {
    rows = rows.filter(r => r.payment_type === filters.paymentType)
  }
  if (filters.relatedTo) {
    rows = rows.filter(r => r.related_to === filters.relatedTo)
  }
  if (filters.projectId) {
    rows = rows.filter(r => r.project_id === filters.projectId)
  }
  if (filters.bankAccountId) {
    rows = rows.filter(r => r.bank_account_id === filters.bankAccountId)
  }

  // Map to PaymentsPageRow
  const mapped: PaymentsPageRow[] = rows.map(r => ({
    id: r.id!,
    payment_date: r.payment_date ?? '',
    direction: r.direction ?? 'outbound',
    payment_type: r.payment_type ?? 'regular',
    amount: r.amount ?? 0,
    currency: r.currency ?? 'PEN',
    exchange_rate: r.exchange_rate ?? 0,
    entity_name: r.entity_name,
    project_id: r.project_id,
    project_code: r.project_code,
    related_to: r.related_to ?? 'invoice',
    related_id: r.related_id,
    invoice_number: r.invoice_number,
    bank_account_id: r.bank_account_id,
    bank_name: r.bank_name,
    notes: r.notes,
    partner_company_id: r.partner_company_id,
  }))

  // Sort and paginate
  const sorted = sortRows(mapped, filters.sort, filters.dir)
  const paginated = paginateArray(sorted, filters.page)

  return { paginated, summary, uniqueProjects, uniqueBankAccounts }
}
