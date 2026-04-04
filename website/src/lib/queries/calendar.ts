import { createServerSupabaseClient } from '../supabase/server'
import { buildEntityNameMap } from './shared'
import { getCalendarBucket } from '../date-utils'
import type { ObligationCalendarRow, InvoiceDirection } from '../types'

type ObligationCalendarFilters = {
  direction?: InvoiceDirection
  projectId?: string
  supplier?: string
  type?: string
  currency?: string
  search?: string
  bucket?: string
}

type ObligationCalendarResult = {
  rows: ObligationCalendarRow[]
  uniqueSuppliers: string[]
  partnerNameMap: Map<string, string>
}

export async function getObligationCalendar(
  filters: ObligationCalendarFilters,
): Promise<ObligationCalendarResult> {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('v_obligation_calendar')
    .select('*')
    .order('due_date', { ascending: true })

  if (filters.direction) {
    query = query.eq('direction', filters.direction)
  }

  const { data, error } = await query

  if (error) throw error
  let rows = (data ?? []) as ObligationCalendarRow[]

  // Collect unique suppliers/clients for filter dropdown
  const supplierSet = new Set<string>()
  for (const r of rows) { if (r.entity_name) supplierSet.add(r.entity_name) }
  const uniqueSuppliers = Array.from(supplierSet).sort()

  // Build partner name lookup for calendar modal display
  const partnerIds = [...new Set(rows.map(r => r.partner_id).filter((id): id is string => !!id))]
  const partnerNameMap = await buildEntityNameMap(supabase, partnerIds)

  // Apply filters
  if (filters.bucket && filters.bucket !== 'all') {
    rows = rows.filter(r => getCalendarBucket(r.days_remaining) === filters.bucket)
  }
  if (filters.projectId) rows = rows.filter(r => r.project_id === filters.projectId)
  if (filters.supplier) rows = rows.filter(r => r.entity_name === filters.supplier)
  if (filters.type) rows = rows.filter(r => r.type === filters.type)
  if (filters.currency) rows = rows.filter(r => r.currency === filters.currency)
  if (filters.search) {
    const search = filters.search.toLowerCase()
    rows = rows.filter(r => (r.title ?? '').toLowerCase().includes(search))
  }

  return { rows, uniqueSuppliers, partnerNameMap }
}
