import { createServerSupabaseClient } from '../supabase/server'
import { getDaysUntilEndOfWeek, getCalendarBucket } from '../date-utils'
import type {
  ObligationCalendarRow,
  CalendarBucketCounts,
  DirectionalBucketValue,
} from '../types'

type ObligationCalendarFilters = {
  direction?: 'payable' | 'receivable'
  projectId?: string
  supplier?: string
  type?: string
  currency?: string
  search?: string
  bucket?: string
}

type ObligationCalendarResult = {
  rows: ObligationCalendarRow[]
  bucketCounts: CalendarBucketCounts
  uniqueSuppliers: string[]
}

export { getCalendarBucket }

export async function getObligationCalendar(
  partnerIds: string[],
  filters: ObligationCalendarFilters,
  midRate: number | null = null,
): Promise<ObligationCalendarResult> {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('v_obligation_calendar')
    .select('*')
    .order('due_date', { ascending: true })

  // Push direction and partner filters to database
  if (filters.direction) {
    query = query.eq('direction', filters.direction)
  }
  if (partnerIds.length > 0) {
    query = query.or(`partner_company_id.in.(${partnerIds.join(',')}),partner_company_id.is.null`)
  }

  const { data, error } = await query

  if (error) throw error
  let rows = (data ?? []) as ObligationCalendarRow[]

  // Collect unique suppliers/clients for filter dropdown
  const supplierSet = new Set<string>()
  for (const r of rows) { if (r.entity_name) supplierSet.add(r.entity_name) }
  const uniqueSuppliers = Array.from(supplierSet).sort()

  // Compute bucket counts from all rows (before filters), split by direction
  const daysToEndOfWeek = getDaysUntilEndOfWeek()
  const emptyBucket = () => ({ count: 0, pen: 0, usd: 0 })
  const emptyDirectional = (): DirectionalBucketValue => ({ pay: emptyBucket(), collect: emptyBucket() })
  const bucketCounts: CalendarBucketCounts = {
    overdue: emptyDirectional(),
    today: emptyDirectional(),
    'this-week': emptyDirectional(),
    'next-30': emptyDirectional(),
  }
  for (const r of rows) {
    const b = getCalendarBucket(r.days_remaining, daysToEndOfWeek)
    if (!b) continue
    const side = r.direction === 'receivable' ? bucketCounts[b].collect : bucketCounts[b].pay
    side.count++
    const amt = r.outstanding ?? 0
    if (r.currency === 'PEN') side.pen += amt
    else if (r.currency === 'USD') {
      side.usd += amt
      if (midRate) side.pen += amt * midRate
    }
  }

  // Apply filters
  if (filters.bucket && filters.bucket !== 'all') {
    rows = rows.filter(r => getCalendarBucket(r.days_remaining, daysToEndOfWeek) === filters.bucket)
  }
  if (filters.projectId) rows = rows.filter(r => r.project_id === filters.projectId)
  if (filters.supplier) rows = rows.filter(r => r.entity_name === filters.supplier)
  if (filters.type) rows = rows.filter(r => r.type === filters.type)
  if (filters.currency) rows = rows.filter(r => r.currency === filters.currency)
  if (filters.search) {
    const search = filters.search.toLowerCase()
    rows = rows.filter(r => (r.title ?? '').toLowerCase().includes(search))
  }

  return { rows, bucketCounts, uniqueSuppliers }
}
