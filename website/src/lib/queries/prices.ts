import { createServerSupabaseClient } from '../supabase/server'
import { buildEntityNameMap, buildEntityTagsMap, buildProjectCodeMap, DEFAULT_CURRENCY } from './shared'
import { paginateArray } from '../pagination'
import { sortRows } from '../sort-rows'
import type { PaginatedResult } from '../pagination'
import type {
  Currency,
  PriceFilterOptions,
  PriceHistoryRow,
} from '../types'

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

  // Fetch invoice_items with quote_date, and only actual quotes (quote_status IS NOT NULL)
  const [invoiceItemsResult, invoicesResult] = await Promise.all([
    supabase.from('invoice_items').select('id, invoice_id, title, category, quantity, unit_of_measure, unit_price, quote_date'),
    supabase
      .from('invoices')
      .select('id, entity_id, project_id, invoice_date, currency, comprobante_type, quote_status, document_ref')
      .eq('direction', 'payable')
      .eq('cost_type', 'project_cost')
      .eq('is_active', true)
      .not('quote_status', 'is', null),
  ])

  if (invoiceItemsResult.error) throw invoiceItemsResult.error
  if (invoicesResult.error) throw invoicesResult.error

  const invoiceItems = invoiceItemsResult.data ?? []
  const invoices = invoicesResult.data ?? []

  // Build invoice_id -> invoice header map (includes active + rejected for price reference)
  const invoiceHeaderMap = new Map(invoices.map(c => [c.id, c]))

  // Collect all entity and project IDs for lookups
  const allEntityIds = new Set<string>()
  const allProjectIds = new Set<string>()

  for (const c of invoices) {
    if (c.entity_id) allEntityIds.add(c.entity_id)
    if (c.project_id) allProjectIds.add(c.project_id)
  }

  // Fetch entity names, project codes, and entity tags in parallel
  const [entityNameMap, projectCodeMap, entityTagsMap] = await Promise.all([
    buildEntityNameMap(supabase, [...allEntityIds]),
    buildProjectCodeMap(supabase, [...allProjectIds]),
    buildEntityTagsMap(supabase, [...allEntityIds]),
  ])

  // Build result: all from invoice_items (source derived from parent comprobante_type)
  let rows: PriceHistoryRow[] = []

  for (const item of invoiceItems) {
    const inv = invoiceHeaderMap.get(item.invoice_id)
    if (!inv) continue // skip items without matching header

    rows.push({
      id: item.id,
      invoiceId: item.invoice_id,
      documentRef: inv.document_ref,
      date: item.quote_date ?? inv.invoice_date ?? '',
      comprobanteType: inv.comprobante_type,
      quoteStatus: inv.quote_status,
      quoteDate: item.quote_date,
      entityId: inv.entity_id,
      entityName: inv.entity_id ? entityNameMap.get(inv.entity_id) ?? '—' : '—',
      projectId: inv.project_id,
      projectCode: inv.project_id ? projectCodeMap.get(inv.project_id) ?? '—' : '—',
      title: item.title ?? '',
      category: item.category,
      quantity: item.quantity,
      unit_of_measure: item.unit_of_measure,
      unit_price: item.unit_price,
      currency: (inv.currency ?? DEFAULT_CURRENCY) as Currency,
      entityTags: inv.entity_id ? entityTagsMap.get(inv.entity_id) ?? [] : [],
    })
  }

  // Apply filters
  if (filters.search) {
    const search = filters.search.toLowerCase()
    rows = rows.filter(r => r.title.toLowerCase().includes(search))
  }
  if (filters.category) {
    // Quotes may not have category — show them regardless when filtering by category
    rows = rows.filter(r => r.quoteStatus != null || r.category === filters.category)
  }
  if (filters.entityId) rows = rows.filter(r => r.entityId === filters.entityId)
  if (filters.projectId) rows = rows.filter(r => r.projectId === filters.projectId)
  if (filters.tagId) {
    // Look up tag name, then filter by entityTags
    const { data: tagData, error: tagError } = await supabase.from('tags').select('name').eq('id', filters.tagId).single()
    if (tagError && tagError.code !== 'PGRST116') throw tagError
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

  if (projectsResult.error) throw projectsResult.error
  if (tagsResult.error) throw tagsResult.error
  if (categoriesResult.error) throw categoriesResult.error

  // Distinct categories
  const categories = [...new Set(
    (categoriesResult.data ?? []).map(c => c.category).filter(Boolean)
  )] as string[]

  // Get entities that appear in quotes (quote_status IS NOT NULL)
  const { data: invoiceEntitiesData, error: invoiceEntitiesError } = await supabase
    .from('invoices')
    .select('entity_id')
    .eq('direction', 'payable')
    .eq('cost_type', 'project_cost')
    .eq('is_active', true)
    .not('quote_status', 'is', null)
    .not('entity_id', 'is', null)

  if (invoiceEntitiesError) throw invoiceEntitiesError

  const entityIds = [...new Set(
    (invoiceEntitiesData ?? []).map(c => c.entity_id).filter((id): id is string => id !== null)
  )]

  let entities: { id: string; name: string }[] = []
  if (entityIds.length > 0) {
    const { data, error } = await supabase
      .from('entities')
      .select('id, legal_name')
      .in('id', entityIds)
      .eq('is_active', true)
      .order('legal_name')
    if (error) throw error
    entities = (data ?? []).map(e => ({ id: e.id, name: e.legal_name }))
  }

  return {
    projects: projectsResult.data ?? [],
    entities,
    tags: tagsResult.data ?? [],
    categories: categories.sort(),
  }
}
