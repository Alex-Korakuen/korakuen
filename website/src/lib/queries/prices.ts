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

  // Fetch invoice_items with their parent invoice header info, and quotes in parallel
  const [invoiceItemsResult, invoicesResult, quotesResult] = await Promise.all([
    supabase.from('invoice_items').select('id, invoice_id, title, category, quantity, unit_of_measure, unit_price'),
    supabase
      .from('invoices')
      .select('id, entity_id, project_id, invoice_date, currency')
      .eq('direction', 'payable')
      .eq('cost_type', 'project_cost')
      .eq('is_active', true)
      .neq('comprobante_type', 'none'),
    supabase.from('quotes').select('id, entity_id, project_id, date_received, title, quantity, unit_of_measure, unit_price, currency'),
  ])

  if (invoiceItemsResult.error) throw invoiceItemsResult.error
  if (invoicesResult.error) throw invoicesResult.error
  if (quotesResult.error) throw quotesResult.error

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
  const [entityNameMap, projectCodeMap, entityTagsMap] = await Promise.all([
    buildEntityNameMap(supabase, [...allEntityIds]),
    buildProjectCodeMap(supabase, [...allProjectIds]),
    buildEntityTagsMap(supabase, [...allEntityIds]),
  ])

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
      currency: (inv.currency ?? DEFAULT_CURRENCY) as Currency,
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
      currency: (q.currency ?? DEFAULT_CURRENCY) as Currency,
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

  // Get entities that appear in payable invoices or quotes
  const [invoiceEntitiesResult, quoteEntitiesResult] = await Promise.all([
    supabase.from('invoices').select('entity_id').eq('direction', 'payable').eq('cost_type', 'project_cost').eq('is_active', true).neq('comprobante_type', 'none').not('entity_id', 'is', null),
    supabase.from('quotes').select('entity_id').not('entity_id', 'is', null),
  ])

  if (invoiceEntitiesResult.error) throw invoiceEntitiesResult.error
  if (quoteEntitiesResult.error) throw quoteEntitiesResult.error

  const entityIds = [...new Set([
    ...(invoiceEntitiesResult.data ?? []).map(c => c.entity_id),
    ...(quoteEntitiesResult.data ?? []).map(q => q.entity_id),
  ].filter((id): id is string => id !== null))]

  let entities: { id: string; name: string }[] = []
  if (entityIds.length > 0) {
    const { data, error } = await supabase
      .from('entities')
      .select('id, legal_name')
      .in('id', entityIds)
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
