import { createServerSupabaseClient } from '../supabase/server'
import { DEFAULT_CURRENCY, buildInvoiceCategoryMap } from './shared'
import { paginateArray } from '../pagination'
import { sortRows } from '../sort-rows'
import type { PaginatedResult } from '../pagination'
import type {
  Currency,
  PaymentsPageRow,
  PaymentsSummary,
  PaymentDirection,
  PaymentType,
  PaymentRelatedTo,
} from '../types'

type PaymentsPageFilters = {
  direction?: 'inbound' | 'outbound'
  paymentType?: 'regular' | 'detraccion' | 'retencion'
  category?: string
  entity?: string
  projectId?: string
  bankAccountId?: string
  partnerId?: string
  dateFrom?: string
  dateTo?: string
  sort: string
  dir: 'asc' | 'desc'
  page: number
}

type PaymentsPageResult = {
  paginated: PaginatedResult<PaymentsPageRow>
  summary: PaymentsSummary
  uniqueProjects: { id: string; project_code: string }[]
  uniqueBankAccounts: { id: string; label: string }[]
  uniquePartners: { id: string; label: string }[]
  uniqueCategories: { value: string; label: string }[]
  uniqueEntities: { value: string; label: string }[]
}

export async function getPaymentsPage(
  filters: PaymentsPageFilters,
): Promise<PaymentsPageResult> {
  const supabase = await createServerSupabaseClient()

  const [paymentsResult, itemCategoriesResult] = await Promise.all([
    supabase
      .from('v_payments_enriched')
      .select('*')
      .order('payment_date', { ascending: false }),
    supabase
      .from('invoice_items')
      .select('invoice_id, category')
      .not('category', 'is', null),
  ])

  if (paymentsResult.error) throw paymentsResult.error

  let rows = paymentsResult.data ?? []

  const categoryByInvoice = buildInvoiceCategoryMap(itemCategoriesResult.data ?? [])

  // Collect unique categories for filter dropdown
  const allCategories = [...new Set(
    (itemCategoriesResult.data ?? []).map(c => c.category).filter(Boolean) as string[]
  )].sort()
  const uniqueCategories = allCategories.map(c => ({ value: c, label: c }))

  // Collect unique values for filter dropdowns
  const projectMap = new Map<string, string>()
  const bankMap = new Map<string, string>()
  const partnerMap = new Map<string, string>()
  const entitySet = new Set<string>()
  for (const r of rows) {
    if (r.project_id && r.project_code) projectMap.set(r.project_id, r.project_code)
    if (r.bank_account_id && r.bank_name) bankMap.set(r.bank_account_id, r.bank_name)
    if (r.partner_id && r.partner_name) partnerMap.set(r.partner_id, r.partner_name)
    if (r.entity_name) entitySet.add(r.entity_name)
  }
  const uniqueProjects = Array.from(projectMap, ([id, project_code]) => ({ id, project_code }))
    .sort((a, b) => a.project_code.localeCompare(b.project_code))
  const uniqueBankAccounts = Array.from(bankMap, ([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const uniquePartners = Array.from(partnerMap, ([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const uniqueEntities = Array.from(entitySet).sort()
    .map(name => ({ value: name, label: name }))

  // Apply filters
  if (filters.direction) {
    rows = rows.filter(r => r.direction === filters.direction)
  }
  if (filters.paymentType) {
    rows = rows.filter(r => r.payment_type === filters.paymentType)
  }
  if (filters.category) {
    rows = rows.filter(r => {
      if (r.related_to !== 'invoice' || !r.related_id) return false
      const cats = categoryByInvoice.get(r.related_id)
      return cats?.has(filters.category!) ?? false
    })
  }
  if (filters.entity) {
    rows = rows.filter(r => r.entity_name === filters.entity)
  }
  if (filters.projectId) {
    rows = rows.filter(r => r.project_id === filters.projectId)
  }
  if (filters.bankAccountId) {
    rows = rows.filter(r => r.bank_account_id === filters.bankAccountId)
  }
  if (filters.partnerId) {
    rows = rows.filter(r => r.partner_id === filters.partnerId)
  }
  if (filters.dateFrom) {
    rows = rows.filter(r => (r.payment_date ?? '') >= filters.dateFrom!)
  }
  if (filters.dateTo) {
    rows = rows.filter(r => (r.payment_date ?? '') <= filters.dateTo!)
  }

  // Compute summary from filtered rows
  const summary: PaymentsSummary = {
    inflows: { pen: 0, usd: 0 },
    outflows: { pen: 0, usd: 0 },
    net: { pen: 0, usd: 0 },
    count: rows.length,
  }
  for (const r of rows) {
    const amt = r.amount ?? 0
    if (r.direction === 'inbound') {
      if (r.currency === 'PEN') summary.inflows.pen += amt
      else if (r.currency === 'USD') summary.inflows.usd += amt
    } else {
      if (r.currency === 'PEN') summary.outflows.pen += amt
      else if (r.currency === 'USD') summary.outflows.usd += amt
    }
  }
  summary.net.pen = summary.inflows.pen - summary.outflows.pen
  summary.net.usd = summary.inflows.usd - summary.outflows.usd

  // Map to PaymentsPageRow
  const mapped: PaymentsPageRow[] = rows.map(r => ({
    id: r.id!,
    payment_date: r.payment_date ?? '',
    direction: (r.direction ?? 'outbound') as PaymentDirection,
    payment_type: (r.payment_type ?? 'regular') as PaymentType,
    amount: r.amount ?? 0,
    currency: (r.currency ?? DEFAULT_CURRENCY) as Currency,
    exchange_rate: r.exchange_rate ?? 0,
    entity_name: r.entity_name,
    project_id: r.project_id,
    project_code: r.project_code,
    related_to: (r.related_to ?? 'invoice') as PaymentRelatedTo,
    related_id: r.related_id,
    invoice_number: r.invoice_number,
    operation_number: r.operation_number,
    document_ref: r.document_ref,
    bank_account_id: r.bank_account_id,
    bank_name: r.bank_name,
    title: r.title,
    notes: r.notes,
    partner_id: r.partner_id,
    partner_name: r.partner_name,
  }))

  // Sort and paginate
  const sorted = sortRows(mapped, filters.sort, filters.dir)
  const paginated = paginateArray(sorted, filters.page)

  return { paginated, summary, uniqueProjects, uniqueBankAccounts, uniquePartners, uniqueCategories, uniqueEntities }
}
